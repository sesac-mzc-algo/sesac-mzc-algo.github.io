import { db, q, one, run } from './db.js';
import { TOPICS, TOPIC_BY_SLUG } from './topics.js';

// ---------- ISO 주차 ----------
export function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;              // 월=1 ... 일=7
  d.setUTCDate(d.getUTCDate() + 4 - day);      // 그 주의 목요일
  const year = d.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((d - jan1) / 864e5 + 1) / 7);
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - 3);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { year, week, start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

// (year, week) -> 해당 ISO 주차의 월요일/일요일
export function isoWeekDates(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (day - 1) + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

// (year, week) 기준 재현 가능한 난수 — 같은 주차는 항상 같은 문제 세트
function seeded(seedStr) {
  let h = 2166136261;
  for (const ch of seedStr) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h |= 0;
    return ((h >>> 0) % 1e6) / 1e6;
  };
}
const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];

// ---------- 주제 선정 ----------
export function nextTopic() {
  const used = q(`SELECT topic_slug FROM weeks ORDER BY year DESC, week_no DESC`).map((r) => r.topic_slug);
  const recent = new Set(used.slice(0, TOPICS.length - 1));
  return TOPICS.find((t) => !recent.has(t.slug)) ?? TOPICS[used.length % TOPICS.length];
}

// ---------- 문제 선정 ----------
function poolFor(topicSlug) {
  const usedIds = new Set(q(`SELECT problem_id FROM week_problems`).map((r) => r.problem_id));
  const all = q(`SELECT id, source, title, difficulty, topics, featured FROM problems`);
  const fresh = all.filter((p) => !usedIds.has(p.id));
  const base = fresh.length >= 3 ? fresh : all;   // 풀이 마르면 재사용 허용
  const matching = base.filter((p) => JSON.parse(p.topics).includes(topicSlug));
  return { base, matching };
}

// 대표(빈출) 문제가 있으면 그 안에서만 고른다 — 잘 알려진 문제 위주로 출제
const preferFeatured = (list) => {
  const f = list.filter((p) => p.featured);
  return f.length ? f : list;
};

// "N-Queen"(프로그래머스)과 "N-Queens II"(LeetCode)처럼 같은 문제가 한 주에 겹치지 않게
const norm = (t) => t.toLowerCase().replace(/^\d+\.\s*/, '').replace(/[^a-z0-9가-힣]/g, '');
const isDuplicate = (title, chosen) => chosen.some((c) => {
  const [a, b] = [norm(title), norm(c.title)];
  return a.length >= 5 && b.length >= 5 && (a.includes(b) || b.includes(a));
});

function selectProblems(topicSlug, seedStr) {
  const rnd = seeded(seedStr);
  const { base, matching } = poolFor(topicSlug);
  if (base.length === 0) return [];
  const chosen = [];
  const take = (candidates) => {
    let avail = candidates.filter((p) => !chosen.some((c) => c.id === p.id));
    const deduped = avail.filter((p) => !isDuplicate(p.title, chosen));
    avail = preferFeatured(deduped.length ? deduped : avail);
    if (avail.length === 0) return null;
    const p = pick(avail, rnd);
    chosen.push(p);
    return p;
  };

  // 주제 문제 2개: 서로 다른 출처 + 난이도 차이가 나게
  const pg = matching.filter((p) => p.source === 'programmers');
  const lc = matching.filter((p) => p.source === 'leetcode');
  const byDiff = (list, ...levels) => {
    for (const lv of levels) { const hit = list.filter((p) => p.difficulty === lv); if (hit.length) return hit; }
    return list;
  };

  // 1번 문제: 워밍업 — 프로그래머스 우선, 쉬운 난이도부터
  take(byDiff(pg.length ? pg : matching, 1, 2, 3));
  // 2번 문제: 본 문제 — LeetCode 우선, Medium 우선(없으면 Hard, 그 다음 Easy)
  take(byDiff(lc.length ? lc : matching, 2, 3, 1));
  while (chosen.length < 2 && matching.length) if (!take(matching)) break;
  while (chosen.length < 2 && base.length) if (!take(base)) break;

  const topicPicks = chosen.slice(0, 2).map((p, i) => ({ ...p, kind: 'topic', slot: i + 1 }));
  // 랜덤 1문제: 이미 두 문제가 다 어려우면 난이도를 낮춰 균형을 맞춘다
  const allHard = topicPicks.length === 2 && topicPicks.every((p) => p.difficulty === 3);
  const random = take(allHard ? byDiff(base, 1, 2, 3) : base);
  const picks = [...topicPicks];
  if (random) picks.push({ ...random, kind: 'random', slot: 3 });
  return picks;
}

// ---------- 주차 생성 ----------
export function generateWeek({ year, week, start, end, topicSlug } = {}) {
  const cur = isoWeek();
  const explicit = year != null && week != null;
  year ??= cur.year; week ??= cur.week;
  if (explicit) ({ start, end } = isoWeekDates(year, week));
  else { start ??= cur.start; end ??= cur.end; }

  const existing = one(`SELECT * FROM weeks WHERE year=? AND week_no=?`, year, week);
  if (existing) return { week: existing, created: false };

  const total = one(`SELECT COUNT(*) c FROM problems`).c;
  if (total === 0) throw new Error('수집된 문제가 없습니다. 먼저 문제를 수집하세요 (npm run collect).');

  const topic = topicSlug ? TOPIC_BY_SLUG.get(topicSlug) : nextTopic();
  if (!topic) throw new Error(`알 수 없는 알고리즘: ${topicSlug}`);

  const picks = selectProblems(topic.slug, `${year}-${week}-${topic.slug}`);

  run(
    `INSERT INTO weeks (year, week_no, topic_slug, topic_name, start_date, end_date) VALUES (?,?,?,?,?,?)`,
    year, week, topic.slug, topic.name, start, end,
  );
  const w = one(`SELECT * FROM weeks WHERE year=? AND week_no=?`, year, week);
  for (const p of picks) {
    run(`INSERT OR IGNORE INTO week_problems (week_id, problem_id, kind, slot) VALUES (?,?,?,?)`,
        w.id, p.id, p.kind, p.slot);
  }
  syncAssignments(w.id);
  return { week: w, created: true, problems: picks.length };
}

// 해당 주차의 문제 × 전체 멤버에 대해 빠진 배정을 채운다 (신규 가입자 포함)
export function syncAssignments(weekId = null) {
  const weeks = weekId ? [{ id: weekId }] : q(`SELECT id FROM weeks`);
  const users = q(`SELECT id FROM users`);
  for (const w of weeks) {
    const problems = q(`SELECT problem_id FROM week_problems WHERE week_id=?`, w.id);
    for (const u of users) for (const p of problems) {
      run(`INSERT OR IGNORE INTO assignments (week_id, problem_id, user_id) VALUES (?,?,?)`,
          w.id, p.problem_id, u.id);
    }
  }
}

// 서버 부팅 / 매시 정각에 호출 — 이번 주차가 없으면 자동 생성
export function ensureCurrentWeek({ log = () => {} } = {}) {
  try {
    const total = one(`SELECT COUNT(*) c FROM problems`).c;
    if (total === 0) return null;
    const r = generateWeek();
    if (r.created) log(`[auto] ${r.week.year}년 ${r.week.week_no}주차 생성 — 주제: ${r.week.topic_name}`);
    else syncAssignments(r.week.id);
    return r.week;
  } catch (e) {
    log(`[auto] 주차 생성 실패: ${e.message}`);
    return null;
  }
}
