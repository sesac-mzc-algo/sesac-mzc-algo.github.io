import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_PICKS, weekId, weekLabel, weekDates, weeksInMonth, currentWeek,
  assignMembers, assignedTo, matchesLevels, pickRandom,
} from "./weeks.mjs";

const problem = (id, source, label, difficulty, topics = ["hash"]) =>
  ({ id, source, label, difficulty, topics, title: id, url: `https://example.com/${id}`, featured: true });

const POOL = [
  problem("programmers-1", "programmers", "Lv.1", 1),
  problem("programmers-2", "programmers", "Lv.2", 2),
  problem("programmers-4", "programmers", "Lv.4", 3),
  problem("leetcode-1", "leetcode", "Easy", 1),
  problem("leetcode-2", "leetcode", "Medium", 2),
  problem("leetcode-3", "leetcode", "Hard", 3),
];
const member = (login, levels) => ({ login, levels });
const ALL = { programmers: [1, 2, 3, 4, 5], leetcode: ["Easy", "Medium", "Hard"] };
const emptyWeek = () => ({ id: "2026-09-W2", topic: "hash", problems: [], assignments: {} });

// ---------- 주차 계산 ----------

test("주의 목요일이 속한 달을 그 주의 달로 삼는다", () => {
  // 2026-08-31(월) ~ 09-06(일) 의 목요일은 9월 3일이므로 9월 1주차
  assert.equal(currentWeek(new Date("2026-08-31T00:00:00Z")).id, "2026-09-W1");
  assert.equal(currentWeek(new Date("2026-09-06T00:00:00Z")).id, "2026-09-W1");
  assert.equal(currentWeek(new Date("2026-09-07T00:00:00Z")).id, "2026-09-W2");
});

test("연말 주차도 한 달에만 속한다", () => {
  assert.equal(currentWeek(new Date("2025-12-29T00:00:00Z")).id, "2026-01-W1");
  assert.equal(currentWeek(new Date("2026-01-01T00:00:00Z")).id, "2026-01-W1");
});

test("주차 id 와 날짜가 서로 왕복한다", () => {
  for (const day of ["2026-01-01", "2026-02-26", "2026-08-31", "2026-09-10", "2026-12-31"]) {
    const week = currentWeek(new Date(`${day}T00:00:00Z`));
    assert.deepEqual(weekDates(week.year, week.month, week.week), { start: week.start, end: week.end });
    assert.equal(weekId(week.year, week.month, week.week), week.id);
  }
});

test("한 달은 4주 또는 5주다", () => {
  for (let month = 1; month <= 12; month += 1) {
    const count = weeksInMonth(2026, month);
    assert.ok(count === 4 || count === 5, `${month}월: ${count}`);
  }
});

test("주차 라벨은 년/월/주로 읽힌다", () => {
  assert.equal(weekLabel({ year: 2026, month: 9, week: 2 }), "2026년 9월 2주차");
});

// ---------- 난이도 선호도 ----------

test("프로그래머스 레벨과 LeetCode 난이도를 각각 본다", () => {
  const levels = { programmers: [1, 2], leetcode: ["Easy"] };
  assert.equal(matchesLevels(problem("a", "programmers", "Lv.2", 2), levels), true);
  assert.equal(matchesLevels(problem("b", "programmers", "Lv.4", 3), levels), false);
  assert.equal(matchesLevels(problem("c", "leetcode", "Easy", 1), levels), true);
  assert.equal(matchesLevels(problem("d", "leetcode", "Hard", 3), levels), false);
});

test("랜덤 문제는 선호 난이도 안에서 뽑는다", () => {
  for (const seed of ["a", "b", "c", "d", "e"]) {
    const picked = pickRandom(POOL, seed, { levels: { programmers: [1], leetcode: ["Easy"] } });
    assert.ok(["programmers-1", "leetcode-1"].includes(picked.id), picked.id);
  }
});

// ---------- 배정 ----------

test("랜덤 문제가 없는 멤버에게만 배정한다", () => {
  const week = emptyWeek();
  week.assignments.already = { picked: [], random: "leetcode-2" };
  week.problems = [{ id: "leetcode-2", source: "leetcode", label: "Medium", difficulty: 2, title: "x", url: "https://example.com/x" }];

  const { added, week: next } = assignMembers(week, {
    problems: POOL, weeks: [], members: [member("already", ALL), member("newbie", ALL)],
  });

  assert.equal(added, 1);
  assert.equal(next.assignments.already.random, "leetcode-2", "이미 받은 멤버는 그대로");
  assert.ok(next.assignments.newbie.random, "새 멤버는 랜덤을 받는다");
});

test("직접 고른 문제만 있고 랜덤이 없으면 채워 넣는다", () => {
  const week = emptyWeek();
  week.assignments.picker = { picked: ["leetcode-1"], random: null };
  week.problems = [{ id: "leetcode-1", source: "leetcode", label: "Easy", difficulty: 1, title: "x", url: "https://example.com/x" }];

  const { added, week: next } = assignMembers(week, {
    problems: POOL, weeks: [], members: [member("picker", ALL)],
  });

  assert.equal(added, 1);
  assert.deepEqual(next.assignments.picker.picked, ["leetcode-1"], "고른 문제는 유지");
  assert.ok(next.assignments.picker.random);
  assert.notEqual(next.assignments.picker.random, "leetcode-1", "고른 문제와 겹치지 않는다");
  assert.equal(next.problems.length, 2, "새 문제가 목록에 추가된다");
});

test("이전 주차에 받은 문제는 다시 주지 않는다", () => {
  const past = {
    id: "2026-09-W1",
    assignments: { repeat: { picked: ["programmers-1"], random: "leetcode-1" } },
  };
  assert.deepEqual([...assignedTo([past], "repeat")].sort(), ["leetcode-1", "programmers-1"]);

  const { week: next } = assignMembers(emptyWeek(), {
    problems: POOL, weeks: [past], members: [member("repeat", ALL)],
  });
  assert.ok(!["programmers-1", "leetcode-1"].includes(next.assignments.repeat.random));
});

test("직접 고르는 문제는 2개까지다", () => {
  assert.equal(MAX_PICKS, 2);
});
