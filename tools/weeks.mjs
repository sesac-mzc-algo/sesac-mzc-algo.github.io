// 주차 계산과 문제 선정 — generate-week.mjs 와 build.mjs 가 함께 쓴다.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { TOPICS, TOPIC_BY_SLUG } from "./topics.mjs";

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const WEEK_ID = /^(\d{4})-W(\d{2})$/;
export const MAX_PICKS = 2;      // 멤버가 직접 고르는 문제 수

export const weekId = (year, week) => `${year}-W${String(week).padStart(2, "0")}`;

// 오늘이 속한 ISO 주차
export function isoWeek(date = new Date()) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);                  // 그 주의 목요일
  const year = utc.getUTCFullYear();
  const week = Math.ceil(((utc - Date.UTC(year, 0, 1)) / 864e5 + 1) / 7);
  return { year, week, ...isoWeekDates(year, week) };
}

// (year, week) -> 그 주의 월요일 / 일요일
export function isoWeekDates(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

export async function readProblems() {
  return JSON.parse(await readFile(path.join(ROOT, "data", "problems.json"), "utf8"));
}

// weeks/*.yaml 을 모두 읽어 주차 순으로 돌려준다.
export async function readWeeks() {
  const root = path.join(ROOT, "weeks");
  const entries = await readdir(root).catch(() => []);
  const weeks = [];
  for (const name of entries) {
    if (!name.endsWith(".yaml")) continue;
    const id = name.slice(0, -5);
    const match = WEEK_ID.exec(id);
    if (!match) continue;
    const value = parse(await readFile(path.join(root, name), "utf8"));
    weeks.push({ ...value, id, year: Number(match[1]), week: Number(match[2]) });
  }
  return weeks.sort((a, b) => b.year - a.year || b.week - a.week);
}

// 최근에 다루지 않은 주제부터 순환한다.
export function nextTopic(weeks) {
  const recent = new Set(weeks.slice(0, TOPICS.length - 1).map((week) => week.topic));
  return TOPICS.find((topic) => !recent.has(topic.slug)) ?? TOPICS[weeks.length % TOPICS.length];
}

// (year, week) 기준 재현 가능한 난수 — 같은 주차는 언제 돌려도 같은 문제 세트
function seeded(seed) {
  let state = 2166136261;
  for (const char of seed) { state ^= char.charCodeAt(0); state = Math.imul(state, 16777619); }
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5; state |= 0;
    return ((state >>> 0) % 1e6) / 1e6;
  };
}

// 대표(빈출) 문제가 있으면 그 안에서만 고른다
const preferFeatured = (list) => list.filter((problem) => problem.featured).length
  ? list.filter((problem) => problem.featured)
  : list;

// "N-Queen"(프로그래머스)과 "N-Queens II"(LeetCode)처럼 같은 문제가 한 주에 겹치지 않게
const normalize = (title) => title.toLowerCase().replace(/^\d+\.\s*/, "").replace(/[^a-z0-9가-힣]/g, "");
const duplicates = (title, chosen) => chosen.some((picked) => {
  const [a, b] = [normalize(title), normalize(picked.title)];
  return a.length >= 5 && b.length >= 5 && (a.includes(b) || b.includes(a));
});

// 이 주 주제에 맞는 추천 문제 — 멤버가 직접 고를 때 참고한다.
export function suggestProblems(problems, topicSlug, seed, count = 6) {
  const random = seeded(seed);
  const matching = problems.filter((problem) => problem.topics.includes(topicSlug));
  const chosen = [];

  const take = (candidates) => {
    const available = candidates.filter((problem) => !chosen.some((picked) => picked.id === problem.id));
    const deduped = available.filter((problem) => !duplicates(problem.title, chosen));
    const finalists = preferFeatured(deduped.length ? deduped : available);
    if (finalists.length === 0) return false;
    chosen.push(finalists[Math.floor(random() * finalists.length)]);
    return true;
  };
  const byDifficulty = (list, level) => list.filter((problem) => problem.difficulty === level);

  const programmers = matching.filter((problem) => problem.source === "programmers");
  const leetcode = matching.filter((problem) => problem.source === "leetcode");

  // 쉬운 것부터 어려운 것까지, 두 사이트를 섞어서 고른다
  for (const list of [byDifficulty(programmers, 1), byDifficulty(leetcode, 1),
                      byDifficulty(programmers, 2), byDifficulty(leetcode, 2),
                      byDifficulty(programmers, 3), byDifficulty(leetcode, 3)]) {
    if (chosen.length >= count) break;
    if (list.length) take(list);
  }
  while (chosen.length < count && matching.length) if (!take(matching)) break;
  return chosen.slice(0, count);
}

// 자동 배정되는 랜덤 1문제 — 주제와 무관하다.
export function pickRandom(problems, seed, { excluded = new Set(), deprioritized = new Set() } = {}) {
  const random = seeded(seed);
  const fresh = problems.filter((problem) => !excluded.has(problem.id));
  const pool = fresh.length ? fresh : problems;
  const unseen = pool.filter((problem) => !deprioritized.has(problem.id));
  const finalists = preferFeatured(unseen.length ? unseen : pool);
  return finalists.length ? finalists[Math.floor(random() * finalists.length)] : null;
}

// 어떤 멤버가 지금까지 받았거나 직접 고른 문제 id
export function assignedTo(weeks, login) {
  const ids = new Set();
  for (const week of weeks) {
    const assignment = week.assignments?.[login];
    if (!assignment) continue;
    for (const id of assignment.picked ?? []) ids.add(id);
    if (assignment.random) ids.add(assignment.random);
  }
  return ids;
}

export const problemMetadata = ({ id, source, title, url, difficulty, label }) =>
  ({ id, source, title, url, difficulty, label });

// 주차의 problems 목록을 실제 할당에 맞춰 다시 맞춘다 (참조되지 않는 문제는 버린다).
export function syncCatalog(week, extra = []) {
  const catalog = new Map([...(week.problems ?? []), ...extra].map((problem) => [problem.id, problemMetadata(problem)]));
  const used = new Set();
  for (const assignment of Object.values(week.assignments ?? {})) {
    for (const id of assignment.picked ?? []) used.add(id);
    if (assignment.random) used.add(assignment.random);
  }
  return [...catalog.values()].filter((problem) => used.has(problem.id))
    .sort((a, b) => a.id.localeCompare(b.id));
}

// 아직 랜덤 문제를 받지 않은 멤버에게 배정한다. 이미 받은 멤버는 건드리지 않는다.
export function assignMembers(week, { problems, weeks, logins }) {
  const assignments = { ...(week.assignments ?? {}) };
  const extra = [];
  const thisWeek = new Set(Object.values(assignments).flatMap((a) => [...(a.picked ?? []), a.random].filter(Boolean)));
  let added = 0;

  for (const login of [...logins].sort()) {
    const current = assignments[login] ?? { picked: [], random: null };
    if (current.random) { assignments[login] = current; continue; }

    const problem = pickRandom(problems, `${week.id}-${login}-random`, {
      excluded: new Set([...assignedTo(weeks, login), ...(current.picked ?? [])]),
      deprioritized: thisWeek,
    });
    if (!problem) throw new Error(`${week.id}: ${login} 에게 줄 문제가 부족합니다. npm run collect 를 먼저 실행하세요.`);
    assignments[login] = { ...current, random: problem.id };
    extra.push(problem);
    thisWeek.add(problem.id);
    added += 1;
  }

  const ordered = Object.fromEntries(Object.keys(assignments).sort().map((login) => [login, assignments[login]]));
  const next = { ...week, assignments: ordered };
  return { added, week: { ...next, problems: syncCatalog(next, extra) } };
}

export function buildWeek({ problems, weeks, logins, year, week, topicSlug }) {
  const topic = topicSlug ? TOPIC_BY_SLUG.get(topicSlug) : nextTopic(weeks);
  if (!topic) throw new Error(`알 수 없는 알고리즘입니다: ${topicSlug}`);
  const id = weekId(year, week);
  const base = {
    id,
    topic: topic.slug,
    "topic-name": topic.name,
    ...isoWeekDates(year, week),
    suggestions: suggestProblems(problems, topic.slug, `${id}-${topic.slug}`).map(problemMetadata),
    problems: [],
    assignments: {},
  };
  return assignMembers(base, { problems, weeks, logins }).week;
}

// members/*.md 에 등록된 GitHub ID
export async function readMemberLogins() {
  const entries = await readdir(path.join(ROOT, "members")).catch(() => []);
  return entries.filter((name) => name.endsWith(".md")).map((name) => name.slice(0, -3));
}
