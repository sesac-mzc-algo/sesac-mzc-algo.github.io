// 주차 계산과 문제 선정 — generate-week.mjs 와 build.mjs 가 함께 쓴다.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { TOPICS, TOPIC_BY_SLUG } from "./topics.mjs";

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const WEEK_ID = /^(\d{4})-W(\d{2})$/;

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

export function selectProblems(problems, weeks, topicSlug, seed) {
  const random = seeded(seed);
  const used = new Set(weeks.flatMap((week) => week.problems.map((problem) => problem.id)));
  const fresh = problems.filter((problem) => !used.has(problem.id));
  const pool = fresh.length >= 3 ? fresh : problems;            // 풀이 마르면 재사용 허용
  const matching = pool.filter((problem) => problem.topics.includes(topicSlug));
  const chosen = [];

  const take = (candidates) => {
    const available = candidates.filter((problem) => !chosen.some((picked) => picked.id === problem.id));
    const deduped = available.filter((problem) => !duplicates(problem.title, chosen));
    const finalists = preferFeatured(deduped.length ? deduped : available);
    if (finalists.length === 0) return null;
    const picked = finalists[Math.floor(random() * finalists.length)];
    chosen.push(picked);
    return picked;
  };
  const byDifficulty = (list, ...levels) => {
    for (const level of levels) {
      const hit = list.filter((problem) => problem.difficulty === level);
      if (hit.length) return hit;
    }
    return list;
  };

  const programmers = matching.filter((problem) => problem.source === "programmers");
  const leetcode = matching.filter((problem) => problem.source === "leetcode");

  take(byDifficulty(programmers.length ? programmers : matching, 1, 2, 3));   // 워밍업
  take(byDifficulty(leetcode.length ? leetcode : matching, 2, 3, 1));         // 본 문제
  while (chosen.length < 2 && matching.length) if (!take(matching)) break;
  while (chosen.length < 2 && pool.length) if (!take(pool)) break;

  const topicPicks = chosen.slice(0, 2).map((problem) => ({ ...problem, kind: "topic" }));
  // 앞의 두 문제가 다 어려우면 랜덤 문제로 난이도를 맞춘다
  const allHard = topicPicks.length === 2 && topicPicks.every((problem) => problem.difficulty === 3);
  const extra = take(allHard ? byDifficulty(pool, 1, 2, 3) : pool);
  return [...topicPicks, ...(extra ? [{ ...extra, kind: "random" }] : [])];
}

export function buildWeek({ problems, weeks, year, week, topicSlug }) {
  const topic = topicSlug ? TOPIC_BY_SLUG.get(topicSlug) : nextTopic(weeks);
  if (!topic) throw new Error(`알 수 없는 알고리즘입니다: ${topicSlug}`);
  const picks = selectProblems(problems, weeks, topic.slug, `${year}-${week}-${topic.slug}`);
  if (picks.length < 3) throw new Error("문제가 부족합니다. npm run collect 를 먼저 실행하세요.");
  return {
    id: weekId(year, week),
    topic: topic.slug,
    "topic-name": topic.name,
    ...isoWeekDates(year, week),
    problems: picks.map(({ id, source, title, url, difficulty, label, kind }) =>
      ({ id, source, title, url, difficulty, label, kind })),
  };
}
