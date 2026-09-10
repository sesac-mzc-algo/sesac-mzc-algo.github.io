#!/usr/bin/env node
// 이번 주차 파일(weeks/YYYY-Www.yaml)이 없으면 만든다.
//   node tools/generate-week.mjs                  이번 주
//   node tools/generate-week.mjs 2026-W40         특정 주차
//   node tools/generate-week.mjs 2026-W40 greedy  주제 지정
import { writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stringify } from "yaml";
import { ROOT, WEEK_ID, isoWeek, weekId, readProblems, readWeeks, readMemberLogins, buildWeek } from "./weeks.mjs";

const [target, topicSlug] = process.argv.slice(2);
const current = isoWeek();
let year = current.year;
let week = current.week;
if (target) {
  const match = WEEK_ID.exec(target);
  if (!match) { console.error(`generate-week: 주차 형식이 올바르지 않습니다: ${target} (예: 2026-W40)`); process.exit(1); }
  [, year, week] = [match[0], Number(match[1]), Number(match[2])];
}

const id = weekId(year, week);
const file = path.join(ROOT, "weeks", `${id}.yaml`);
if (await access(file).then(() => true, () => false)) {
  console.log(`generate-week: ${id} 는 이미 있습니다.`);
  process.exit(0);
}

const logins = await readMemberLogins();
const value = buildWeek({
  problems: await readProblems(), weeks: await readWeeks(), logins, year, week, topicSlug,
});
delete value.id;
await writeFile(file, stringify(value, { lineWidth: 0 }));

console.log(`generate-week: weeks/${id}.yaml 생성 — 주제: ${value["topic-name"]}`);
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
if (logins.length === 0) console.log("  (등록된 멤버가 없습니다. members/<github-id>.md 를 추가하면 배정됩니다.)");
