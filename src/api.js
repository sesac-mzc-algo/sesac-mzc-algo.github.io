import { q, one, run } from './db.js';
import { hashPassword, verifyPassword, createSession, destroySession } from './auth.js';
import { generateWeek, syncAssignments, isoWeek, nextTopic } from './rotation.js';
import { collectAll } from './collect.js';
import { TOPICS } from './topics.js';

const INVITE_CODE = process.env.STUDY_INVITE_CODE || '';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (msg) => { throw new HttpError(400, msg); };
const requireUser = (ctx) => { if (!ctx.user) throw new HttpError(401, '로그인이 필요합니다.'); return ctx.user; };
const requireAdmin = (ctx) => {
  const u = requireUser(ctx);
  if (u.role !== 'admin') throw new HttpError(403, '관리자만 할 수 있습니다.');
  return u;
};

// ---------------- 인증 ----------------

function signup(ctx) {
  const { username, password, display_name, invite_code } = ctx.body ?? {};
  if (INVITE_CODE && invite_code !== INVITE_CODE) bad('초대 코드가 올바르지 않습니다.');
  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username ?? '')) bad('아이디는 영문/숫자/-/_ 3~20자여야 합니다.');
  if ((password ?? '').length < 6) bad('비밀번호는 6자 이상이어야 합니다.');
  if (one(`SELECT id FROM users WHERE username=?`, username)) bad('이미 사용 중인 아이디입니다.');

  const isFirst = one(`SELECT COUNT(*) c FROM users`).c === 0;
  run(`INSERT INTO users (username, display_name, password_hash, role) VALUES (?,?,?,?)`,
      username, (display_name || username).slice(0, 20), hashPassword(password), isFirst ? 'admin' : 'member');
  const user = one(`SELECT id, username, display_name, role FROM users WHERE username=?`, username);
  syncAssignments();                                  // 기존 주차 문제를 신규 멤버에게도 배정
  const { token, expires } = createSession(user.id);
  ctx.setSession(token, expires);
  return { user };
}

function login(ctx) {
  const { username, password } = ctx.body ?? {};
  const row = one(`SELECT * FROM users WHERE username=?`, username ?? '');
  if (!row || !verifyPassword(password ?? '', row.password_hash)) throw new HttpError(401, '아이디 또는 비밀번호가 올바르지 않습니다.');
  const { token, expires } = createSession(row.id);
  ctx.setSession(token, expires);
  return { user: { id: row.id, username: row.username, display_name: row.display_name, role: row.role } };
}

function logout(ctx) {
  destroySession(ctx.token);
  ctx.clearSession();
  return { ok: true };
}

// ---------------- 보드 ----------------

function board(ctx) {
  const me = requireUser(ctx);
  const weeks = q(`SELECT * FROM weeks ORDER BY year DESC, week_no DESC`);
  const members = q(`SELECT id, username, display_name, role FROM users ORDER BY id`);
  const cards = q(`
    SELECT a.id, a.week_id, a.user_id, a.status, a.solution_url, a.solved_at, a.language,
           substr(a.note, 1, 140) AS note_preview,
           (LENGTH(a.note) > 140) AS note_more,
           (LENGTH(a.code) > 0)   AS has_code,
           p.id AS problem_id, p.source, p.title, p.url, p.difficulty, p.diff_label, p.topics,
           wp.kind, wp.slot
      FROM assignments a
      JOIN problems p       ON p.id = a.problem_id
      JOIN week_problems wp ON wp.week_id = a.week_id AND wp.problem_id = a.problem_id
     ORDER BY wp.slot, a.user_id`);
  const cur = isoWeek();
  return {
    me, weeks, members,
    cards: cards.map((c) => ({ ...c, topics: JSON.parse(c.topics), mine: c.user_id === me.id })),
    current: { year: cur.year, week: cur.week },
    topics: TOPICS.map(({ slug, name }) => ({ slug, name })),
    next_topic: nextTopic()?.name ?? null,
  };
}

function updateAssignment(ctx, id) {
  const me = requireUser(ctx);
  const a = one(`SELECT * FROM assignments WHERE id=?`, Number(id));
  if (!a) throw new HttpError(404, '해당 카드를 찾을 수 없습니다.');
  if (a.user_id !== me.id) throw new HttpError(403, '본인 카드만 수정할 수 있습니다.');

  const { status, note, code, language, solution_url } = ctx.body ?? {};
  if (status !== undefined && !['todo', 'doing', 'done'].includes(status)) bad('status 값이 올바르지 않습니다.');
  if (code !== undefined && String(code).length > 100_000) bad('코드가 너무 깁니다. (10만자 제한)');
  if (note !== undefined && String(note).length > 20_000) bad('설명이 너무 깁니다. (2만자 제한)');
  if (language !== undefined && !LANGUAGES.includes(language)) bad('지원하지 않는 언어입니다.');

  const nextStatus = status ?? a.status;
  const solvedAt = nextStatus === 'done' ? (a.solved_at ?? new Date().toISOString()) : null;

  run(`UPDATE assignments SET status=?, note=?, code=?, language=?, solution_url=?, solved_at=?,
              updated_at=datetime('now')
        WHERE id=?`,
      nextStatus, note ?? a.note, code ?? a.code, language ?? a.language,
      solution_url ?? a.solution_url, solvedAt, a.id);
  return { assignment: one(`SELECT * FROM assignments WHERE id=?`, a.id) };
}

export const LANGUAGES = ['python', 'javascript', 'typescript', 'java', 'cpp', 'c', 'csharp',
                          'go', 'rust', 'kotlin', 'swift', 'ruby', 'sql', 'text'];

// 한 문제에 대한 스터디원 전원의 풀이 — 스터디이므로 서로 다 볼 수 있다.
function solutions(ctx, assignmentId) {
  const me = requireUser(ctx);
  const a = one(`SELECT week_id, problem_id FROM assignments WHERE id=?`, Number(assignmentId));
  if (!a) throw new HttpError(404, '해당 카드를 찾을 수 없습니다.');

  const problem = one(`SELECT * FROM problems WHERE id=?`, a.problem_id);
  const week = one(`SELECT * FROM weeks WHERE id=?`, a.week_id);
  const rows = q(`
    SELECT a.id, a.user_id, a.status, a.note, a.code, a.language, a.solution_url,
           a.solved_at, a.updated_at, u.display_name, u.username
      FROM assignments a JOIN users u ON u.id = a.user_id
     WHERE a.week_id = ? AND a.problem_id = ?
     ORDER BY (a.user_id = ?) DESC, (a.status = 'done') DESC, a.updated_at DESC`,
    a.week_id, a.problem_id, me.id);

  return {
    problem: { ...problem, topics: JSON.parse(problem.topics), raw_tags: JSON.parse(problem.raw_tags) },
    week,
    languages: LANGUAGES,
    solutions: rows.map((r) => ({ ...r, mine: r.user_id === me.id })),
  };
}

// ---------------- 관리 ----------------

function generate(ctx) {
  requireAdmin(ctx);
  const { topic_slug, year, week } = ctx.body ?? {};
  const base = year && week ? { year: Number(year), week: Number(week) } : {};
  const r = generateWeek({ ...base, topicSlug: topic_slug || undefined });
  if (!r.created) bad('해당 주차는 이미 생성되어 있습니다.');
  return r;
}

async function collect(ctx) {
  requireAdmin(ctx);
  const lines = [];
  const result = await collectAll({ limit: Number(ctx.body?.limit) || 1200, log: (m) => lines.push(m) });
  return { ...result, log: lines };
}

function stats(ctx) {
  requireUser(ctx);
  return {
    pool: q(`SELECT source, difficulty, COUNT(*) c FROM problems GROUP BY source, difficulty`),
    total: one(`SELECT COUNT(*) c FROM problems`).c,
    ranking: q(`
      SELECT u.display_name, u.username,
             SUM(a.status='done') AS done,
             COUNT(a.id)          AS total
        FROM users u LEFT JOIN assignments a ON a.user_id = u.id
       GROUP BY u.id ORDER BY done DESC, u.id`),
  };
}

// ---------------- 라우팅 ----------------

export async function handleApi(ctx) {
  const { method, path } = ctx;
  const m = (p) => path === p;

  if (method === 'POST' && m('/api/auth/signup')) return signup(ctx);
  if (method === 'POST' && m('/api/auth/login'))  return login(ctx);
  if (method === 'POST' && m('/api/auth/logout')) return logout(ctx);
  if (method === 'GET'  && m('/api/me'))          return { user: ctx.user };
  if (method === 'GET'  && m('/api/board'))       return board(ctx);
  if (method === 'GET'  && m('/api/stats'))       return stats(ctx);
  if (method === 'POST' && m('/api/weeks/generate')) return generate(ctx);
  if (method === 'POST' && m('/api/collect'))     return await collect(ctx);

  const sm = path.match(/^\/api\/assignments\/(\d+)\/solutions$/);
  if (sm && method === 'GET') return solutions(ctx, sm[1]);

  const am = path.match(/^\/api\/assignments\/(\d+)$/);
  if (am && (method === 'PATCH' || method === 'POST')) return updateAssignment(ctx, am[1]);

  throw new HttpError(404, '없는 API 경로입니다.');
}
