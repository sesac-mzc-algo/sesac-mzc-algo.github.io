#!/usr/bin/env node
// 1) picks/<주차>/<github-id>.yaml 의 링크를 파싱해 주차 파일에 문제로 등록하고
// 2) 아직 랜덤 문제를 못 받은 멤버에게 자동 배정한다.
// 이미 끝난 주차와 이미 배정된 멤버는 건드리지 않는다.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse, stringify } from "yaml";
import {
  ROOT, WEEK_ID, MAX_PICKS, currentWeek, readProblems, readWeeks, readMembers,
  assignMembers, assignedTo, problemMetadata, syncCatalog,
} from "./weeks.mjs";
import { parseProblemUrl, resolveProblem, LinkError } from "./problem-link.mjs";

// picks/<주차>/<github-id>.yaml -> { "2026-W37": { jiwon: ["https://..."] } }
export async function readPicks(root = ROOT) {
  const picksRoot = path.join(root, "picks");
  const picks = new Map();
  for (const weekId of await readdir(picksRoot).catch(() => [])) {
    if (!WEEK_ID.test(weekId)) continue;
    const byMember = new Map();
    for (const entry of await readdir(path.join(picksRoot, weekId))) {
      if (!entry.endsWith(".yaml")) continue;
      const value = parse(await readFile(path.join(picksRoot, weekId, entry), "utf8"));
      byMember.set(entry.slice(0, -5), Array.isArray(value) ? value : []);
    }
    picks.set(weekId, byMember);
  }
  return picks;
}

async function main() {
  const [problems, weeks, members, picks] = await Promise.all([
    readProblems(), readWeeks(), readMembers(), readPicks(),
  ]);
  const logins = members.map((member) => member.login);
  if (members.length === 0) {
    console.log("assign: 등록된 멤버가 없습니다.");
    return;
  }

  const known = new Map(problems.map((problem) => [problem.id, problem]));
  const today = currentWeek().start;
  let changed = 0;

  for (const week of weeks) {
    if (week.end < today) continue;                       // 지나간 주차는 그대로 둔다

    const assignments = { ...(week.assignments ?? {}) };
    const resolved = [];
    const notes = [];

    // (1) 직접 고른 링크 등록
    for (const [login, urls] of (picks.get(week.id) ?? new Map())) {
      if (!logins.includes(login)) {
        notes.push(`  ! @${login}: members/${login}.md 가 없어 건너뜁니다.`);
        continue;
      }
      const current = assignments[login] ?? { picked: [], random: null };
      const already = new Set(current.picked ?? []);
      const taken = new Set([...assignedTo(weeks, login)].filter((id) => !already.has(id)));
      const picked = [...(current.picked ?? [])];

      for (const url of urls.slice(0, MAX_PICKS)) {
        try {
          const link = parseProblemUrl(url);
          if (link.id && picked.includes(link.id)) continue;      // 이미 등록됨
          const problem = await resolveProblem(link);
          if (picked.includes(problem.id)) continue;
          if (taken.has(problem.id)) {
            notes.push(`  ! @${login}: 이전 주차에 이미 푼 문제라 건너뜁니다 — ${problem.title}`);
            continue;
          }
          // 프로그래머스는 문제 페이지에서 유형을 알 수 없어 수집된 풀에서 보완한다
          const topics = problem.topics.length ? problem.topics : (known.get(problem.id)?.topics ?? []);
          if (topics.length && !topics.includes(week.topic)) {
            notes.push(`  · @${login}: 이번 주 주제(${week["topic-name"]}) 밖의 문제입니다 — ${problem.title}`);
          }
          resolved.push(problemMetadata(problem));
          picked.push(problem.id);
          changed += 1;
          console.log(`assign: ${week.id} @${login} 등록 — [${problem.source} ${problem.label}] ${problem.title}`);
        } catch (error) {
          if (!(error instanceof LinkError)) throw error;
          notes.push(`  ! @${login}: ${error.message}`);
        }
      }
      assignments[login] = { ...current, picked: picked.slice(0, MAX_PICKS) };
    }

    // (2) 랜덤 문제 자동 배정
    const withPicks = { ...week, assignments, problems: syncCatalog({ ...week, assignments }, resolved) };
    const { added, week: next } = assignMembers(withPicks, { problems, weeks, members });
    changed += added;
    if (added > 0) {
      const newcomers = Object.keys(next.assignments).filter((login) => !week.assignments?.[login]?.random);
      console.log(`assign: ${week.id} 랜덤 배정 — ${newcomers.map((login) => `@${login}`).join(", ")}`);
    }
    for (const note of notes) console.log(note);

    const before = stringify(parse(await readFile(path.join(ROOT, "weeks", `${week.id}.yaml`), "utf8")), { lineWidth: 0 });
    const value = parse(await readFile(path.join(ROOT, "weeks", `${week.id}.yaml`), "utf8"));
    value.problems = next.problems;
    value.assignments = next.assignments;
    const after = stringify(value, { lineWidth: 0 });
    if (before !== after) await writeFile(path.join(ROOT, "weeks", `${week.id}.yaml`), after);
  }

  if (changed === 0) console.log("assign: 새로 등록하거나 배정할 것이 없습니다.");
}

if (process.argv[1] && process.argv[1].endsWith("assign.mjs")) await main();
