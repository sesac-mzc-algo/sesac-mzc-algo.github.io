#!/usr/bin/env node
// 이번 주차 파일(weeks/YYYY-Www.yaml)이 없으면 만든다.
//   node tools/generate-week.mjs                     이번 주
//   node tools/generate-week.mjs 2026-10-W1          특정 주차
//   node tools/generate-week.mjs 2026-10-W1 greedy   주제 지정
import { writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stringify } from "yaml";
import { ROOT, WEEK_ID, currentWeek, weekId, weekLabel, weeksInMonth, readProblems, readWeeks, readMembers, buildWeek } from "./weeks.mjs";

const [target, topicSlug] = process.argv.slice(2);
const current = currentWeek();
let { year, month, week } = current;
if (target) {
  const match = WEEK_ID.exec(target);
  if (!match) { console.error(`generate-week: 주차 형식이 올바르지 않습니다: ${target} (예: 2026-10-W1)`); process.exit(1); }
  [year, month, week] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const limit = weeksInMonth(year, month);
  if (month < 1 || month > 12 || week < 1 || week > limit) {
    console.error(`generate-week: ${year}년 ${month}월은 ${limit}주까지입니다: ${target}`);
    process.exit(1);
  }
}

const id = weekId(year, month, week);
const file = path.join(ROOT, "weeks", `${id}.yaml`);
if (await access(file).then(() => true, () => false)) {
  console.log(`generate-week: ${id} 는 이미 있습니다.`);
  process.exit(0);
}

const members = await readMembers();
const value = buildWeek({
  problems: await readProblems(), weeks: await readWeeks(), members, year, month, week, topicSlug,
});
delete value.id;
await writeFile(file, stringify(value, { lineWidth: 0 }));

console.log(`generate-week: weeks/${id}.yaml 생성 — ${weekLabel({ year, month, week })} · ${value["topic-name"]}`);
const titles = new Map([...value.problems, ...value.suggestions].map((problem) => [problem.id, problem]));
const show = (id, mark) => {
  const problem = titles.get(id);
  console.log(`    ${mark} [${problem.source} ${problem.label}] ${problem.title}`);
};

console.log("  추천 문제 (직접 고를 때 참고)");
for (const problem of value.suggestions) show(problem.id, "·");

for (const [login, assignment] of Object.entries(value.assignments)) {
  console.log(`  @${login}`);
  for (const id of assignment.picked ?? []) show(id, "  ");
  if (assignment.random) show(assignment.random, "🎲");
  const remaining = 2 - (assignment.picked?.length ?? 0);
  if (remaining > 0) console.log(`      (직접 고를 문제 ${remaining}개 — picks/${id}/${login}.yaml)`);
}
if (members.length === 0) console.log("  (등록된 멤버가 없습니다. members/<github-id>.md 를 추가하면 배정됩니다.)");
