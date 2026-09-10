import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse } from "yaml";
import { TOPIC_BY_SLUG } from "./topics.mjs";
import { WEEK_ID, isoWeekDates } from "./weeks.mjs";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const GITHUB_ID = /^[a-z\d](?:-?[a-z\d]){0,38}$/;
const PROBLEM_ID = /^(leetcode|programmers)-[a-z\d-]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = new Set(["todo", "doing", "done"]);
const LANGUAGES = new Set(["python", "javascript", "typescript", "java", "cpp", "c", "csharp",
                           "go", "rust", "kotlin", "swift", "ruby", "sql", "text"]);
const KINDS = new Set(["topic", "random"]);
const UNSAFE_MARKUP = /<(?:embed|iframe|link|object|script|style)\b|\son[a-z]+\s*=/i;

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

async function validateFile(file, label) {
  const stats = await lstat(file);
  requireValue(!stats.isSymbolicLink(), `${label}: symlink는 허용하지 않습니다.`);
  requireValue(stats.isFile(), `${label}: 일반 파일이어야 합니다.`);
  requireValue(stats.size <= MAX_FILE_SIZE, `${label}: 파일 크기는 2MB 이하여야 합니다.`);
}

// frontmatter 와 본문을 분리한다. board 의 markdownBody 와 같은 규칙을 따른다.
export function splitDocument(source, label) {
  const normalized = source.replace(/\r\n?/g, "\n").trim();
  if (!normalized.startsWith("---\n")) return { frontmatter: null, body: normalized };
  const closingFence = normalized.indexOf("\n---\n", 4);
  requireValue(closingFence !== -1, `${label}: frontmatter 종료 구분자가 없습니다.`);
  return {
    frontmatter: parse(normalized.slice(4, closingFence)) ?? {},
    body: normalized.slice(closingFence + 5).trim(),
  };
}

function requireSafeBody(body, label) {
  requireValue(body, `${label}: 본문이 비어 있습니다.`);
  requireValue(!UNSAFE_MARKUP.test(body), `${label}: unsafe HTML을 포함할 수 없습니다.`);
  for (const match of body.matchAll(/!?\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))/g)) {
    const target = match[1] ?? match[2];
    const scheme = /^([a-z][a-z\d+.-]*):/i.exec(target);
    if (!scheme) continue;
    requireValue(
      /^(?:https?|mailto)$/i.test(scheme[1]),
      `${label}: unsafe link scheme은 허용하지 않습니다: ${scheme[1]}`,
    );
  }
}

// ---------- weeks ----------

function validateWeek(id, value, label) {
  const match = WEEK_ID.exec(id);
  requireValue(match, `${label}: 파일명은 YYYY-Www 형식이어야 합니다. (예: 2026-W40.yaml)`);
  const [year, week] = [Number(match[1]), Number(match[2])];
  requireValue(week >= 1 && week <= 53, `${label}: 주차는 1~53 사이여야 합니다.`);
  requireValue(value && typeof value === "object", `${label}: 내용이 비어 있습니다.`);

  const topic = TOPIC_BY_SLUG.get(value.topic);
  requireValue(topic, `${label}: 알 수 없는 알고리즘입니다: ${value.topic}`);
  requireValue(
    value["topic-name"] === topic.name,
    `${label}: topic-name이 topic과 다릅니다. (${topic.name})`,
  );

  const dates = isoWeekDates(year, week);
  requireValue(DATE.test(value.start) && DATE.test(value.end), `${label}: start와 end는 YYYY-MM-DD여야 합니다.`);
  requireValue(
    value.start === dates.start && value.end === dates.end,
    `${label}: 날짜가 ISO 주차와 다릅니다. (${dates.start} ~ ${dates.end})`,
  );

  requireValue(Array.isArray(value.problems), `${label}: problems 배열이 필요합니다.`);
  requireValue(value.problems.length === 3, `${label}: 문제는 3개여야 합니다. (주제 2 + 랜덤 1)`);
  const seen = new Set();
  for (const problem of value.problems) {
    const at = `${label}: ${problem?.id ?? "?"}`;
    requireValue(PROBLEM_ID.test(problem?.id ?? ""), `${at}: 문제 id 형식이 올바르지 않습니다.`);
    requireValue(!seen.has(problem.id), `${at}: 같은 문제가 중복되었습니다.`);
    seen.add(problem.id);
    requireValue(problem.id.startsWith(`${problem.source}-`), `${at}: id와 source가 다릅니다.`);
    requireValue(typeof problem.title === "string" && problem.title.trim(), `${at}: title이 필요합니다.`);
    requireValue(/^https:\/\//.test(problem.url ?? ""), `${at}: url은 https여야 합니다.`);
    requireValue([1, 2, 3].includes(problem.difficulty), `${at}: difficulty는 1, 2, 3 중 하나여야 합니다.`);
    requireValue(typeof problem.label === "string" && problem.label.trim(), `${at}: label이 필요합니다.`);
    requireValue(KINDS.has(problem.kind), `${at}: kind는 topic 또는 random이어야 합니다.`);
  }
  requireValue(
    value.problems.filter((problem) => problem.kind === "random").length === 1,
    `${label}: 랜덤 문제는 정확히 1개여야 합니다.`,
  );
  return { id, ...value };
}

// ---------- solutions ----------

function validateSolution(source, label, { week, login, problemId, members }) {
  requireValue(week, `${label}: weeks/${label.split("/")[1]}.yaml 이 없습니다.`);
  requireValue(
    week.problems.some((problem) => problem.id === problemId),
    `${label}: ${week.id} 주차에 없는 문제입니다.`,
  );
  requireValue(members.has(login), `${label}: members/${login}.md 를 먼저 추가해야 합니다.`);

  const { frontmatter, body } = splitDocument(source, label);
  requireValue(frontmatter, `${label}: status frontmatter가 필요합니다.`);

  const allowed = new Set(["status", "language", "url"]);
  for (const key of Object.keys(frontmatter)) {
    requireValue(allowed.has(key), `${label}: frontmatter에는 status, language, url만 쓸 수 있습니다: ${key}`);
  }
  requireValue(STATUSES.has(frontmatter.status), `${label}: status는 todo, doing, done 중 하나여야 합니다.`);
  if (frontmatter.language !== undefined) {
    requireValue(LANGUAGES.has(frontmatter.language), `${label}: 지원하지 않는 언어입니다: ${frontmatter.language}`);
  }
  if (frontmatter.url !== undefined) {
    requireValue(/^https?:\/\//i.test(frontmatter.url), `${label}: url은 http 또는 https여야 합니다.`);
  }

  requireSafeBody(body, label);
  if (frontmatter.status === "done") {
    requireValue(/```/.test(body), `${label}: done 상태에는 풀이 코드 블록이 필요합니다.`);
  }
}

// ---------- 전체 ----------

export async function validateBoard(root) {
  const weeksRoot = path.join(root, "weeks");
  const weeks = new Map();
  for (const entry of await readdir(weeksRoot, { withFileTypes: true }).catch(() => [])) {
    if (entry.name === ".gitkeep") continue;
    const label = `weeks/${entry.name}`;
    requireValue(entry.isFile() && entry.name.endsWith(".yaml"), `${label}: YAML 파일이어야 합니다.`);
    const file = path.join(weeksRoot, entry.name);
    await validateFile(file, label);
    const id = entry.name.slice(0, -5);
    weeks.set(id, validateWeek(id, parse(await readFile(file, "utf8")), label));
  }

  const membersRoot = path.join(root, "members");
  const members = new Set();
  for (const entry of await readdir(membersRoot, { withFileTypes: true }).catch(() => [])) {
    if (entry.name === ".gitkeep") continue;
    const label = `members/${entry.name}`;
    requireValue(entry.isFile() && entry.name.endsWith(".md"), `${label}: Markdown 파일이어야 합니다.`);
    const login = entry.name.slice(0, -3);
    requireValue(GITHUB_ID.test(login), `${label}: 파일명은 소문자 GitHub ID여야 합니다.`);
    const file = path.join(membersRoot, entry.name);
    await validateFile(file, label);
    const { body } = splitDocument(await readFile(file, "utf8"), label);
    requireValue(/^#\s+\S/.test(body.split("\n")[0].trim()), `${label}: 첫 줄은 표시할 이름 제목이어야 합니다.`);
    requireSafeBody(body, label);
    members.add(login);
  }

  const solutionsRoot = path.join(root, "solutions");
  for (const weekEntry of await readdir(solutionsRoot, { withFileTypes: true }).catch(() => [])) {
    if (weekEntry.name === ".gitkeep") continue;
    requireValue(weekEntry.isDirectory(), `solutions/${weekEntry.name}: 주차 디렉터리여야 합니다.`);
    requireValue(WEEK_ID.test(weekEntry.name), `solutions/${weekEntry.name}: YYYY-Www 형식이어야 합니다.`);

    for (const memberEntry of await readdir(path.join(solutionsRoot, weekEntry.name), { withFileTypes: true })) {
      const memberLabel = `solutions/${weekEntry.name}/${memberEntry.name}`;
      requireValue(memberEntry.isDirectory(), `${memberLabel}: GitHub ID 디렉터리여야 합니다.`);
      requireValue(GITHUB_ID.test(memberEntry.name), `${memberLabel}: 소문자 GitHub ID여야 합니다.`);

      const memberRoot = path.join(solutionsRoot, weekEntry.name, memberEntry.name);
      for (const entry of await readdir(memberRoot, { withFileTypes: true })) {
        const label = `${memberLabel}/${entry.name}`;
        requireValue(entry.isFile() && entry.name.endsWith(".md"), `${label}: Markdown 파일이어야 합니다.`);
        const problemId = entry.name.slice(0, -3);
        requireValue(PROBLEM_ID.test(problemId), `${label}: 파일명은 문제 id여야 합니다. (예: leetcode-1.md)`);
        const file = path.join(memberRoot, entry.name);
        await validateFile(file, label);
        validateSolution(await readFile(file, "utf8"), label, {
          week: weeks.get(weekEntry.name), login: memberEntry.name, problemId, members,
        });
      }
    }
  }

  return { weeks: weeks.size, members: members.size };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  validateBoard(root).then(
    ({ weeks, members }) => console.log(`validate: 주차 ${weeks}개, 멤버 ${members}명 확인`),
    (error) => { console.error(`validate: ${error.message}`); process.exitCode = 1; },
  );
}
