#!/usr/bin/env node
// 이번 주차 파일(weeks/YYYY-Www.yaml)이 없으면 만든다.
//   node tools/generate-week.mjs                  이번 주
//   node tools/generate-week.mjs 2026-W40         특정 주차
//   node tools/generate-week.mjs 2026-W40 greedy  주제 지정
import { writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stringify } from "yaml";
import { ROOT, WEEK_ID, isoWeek, weekId, readProblems, readWeeks, buildWeek } from "./weeks.mjs";

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

const value = buildWeek({ problems: await readProblems(), weeks: await readWeeks(), year, week, topicSlug });
delete value.id;
await writeFile(file, stringify(value, { lineWidth: 0 }));

console.log(`generate-week: weeks/${id}.yaml 생성 — 주제: ${value["topic-name"]}`);
for (const problem of value.problems) {
  console.log(`  ${problem.kind === "random" ? "🎲" : "  "} [${problem.source} ${problem.label}] ${problem.title}`);
}
