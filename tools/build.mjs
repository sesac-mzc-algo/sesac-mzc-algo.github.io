#!/usr/bin/env node
// weeks / members / solutions 를 읽어 dist/ 에 정적 사이트를 만든다.
// GitHub Pages 는 dist/ 를 그대로 서빙한다.
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import { ROOT, MAX_PICKS, PROGRAMMERS_LEVELS, LEETCODE_LEVELS, currentWeek, weekLabel, readWeeks } from "./weeks.mjs";
import { splitDocument } from "./validate.mjs";

const DIST = path.join(ROOT, "dist");
const REPO = process.env.REPO_URL ?? "https://github.com/sesac-mzc-algo/sesac-mzc-algo.github.io";
const BASE = process.env.BASE_PATH ?? "";        // Pages 하위 경로 (예: /code-study)

const STATUSES = [["todo", "풀 문제"], ["doing", "푸는 중"], ["done", "푼 문제"]];
const STATUS_LABEL = Object.fromEntries(STATUSES);
const LANGUAGE_LABEL = { python: "Python", javascript: "JavaScript", typescript: "TypeScript",
  java: "Java", cpp: "C++", c: "C", csharp: "C#", go: "Go", rust: "Rust", kotlin: "Kotlin",
  swift: "Swift", ruby: "Ruby", sql: "SQL", text: "기타" };

const esc = (value) => String(value ?? "").replace(/[&<>"']/g,
  (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

const render = (markdown) => micromark(markdown, {
  extensions: [gfm()],
  htmlExtensions: [gfmHtml()],
  // allowDangerousHtml / allowDangerousProtocol 은 기본값(false) 그대로 둔다.
});

const link = (href) => `${BASE}${href}`;

// ---------- 읽기 ----------

async function readBoardMembers() {
  const root = path.join(ROOT, "members");
  const members = [];
  for (const entry of await readdir(root).catch(() => [])) {
    if (!entry.endsWith(".md")) continue;
    const login = entry.slice(0, -3);
    const { frontmatter, body } = splitDocument(await readFile(path.join(root, entry), "utf8"), `members/${entry}`);
    const [heading, ...rest] = body.split("\n");
    const levels = frontmatter?.levels ?? {};
    members.push({
      login,
      name: heading.replace(/^#\s+/, "").trim() || login,
      bio: render(rest.join("\n").trim()),
      // GitHub 프로필 이미지. 계정이 없으면 404 라서 사이트에서 이니셜로 대체한다.
      avatar: `https://github.com/${encodeURIComponent(login)}.png?size=80`,
      levels: {
        programmers: levels.programmers ?? PROGRAMMERS_LEVELS,
        leetcode: levels.leetcode ?? LEETCODE_LEVELS,
      },
    });
  }
  return members.sort((a, b) => a.login.localeCompare(b.login));
}

// 아바타 이미지 + 계정이 없을 때 보일 이니셜
const avatarHtml = (member, size = 26) => `
  <span class="avatar" style="--size:${size}px">
    <span class="initial">${esc([...member.name][0] ?? "?")}</span>
    <img src="${esc(member.avatar)}" alt="" loading="lazy" onerror="this.remove()">
  </span>`;

async function readSolutions() {
  const root = path.join(ROOT, "solutions");
  const solutions = [];
  for (const weekId of await readdir(root).catch(() => [])) {
    if (weekId.startsWith(".")) continue;
    for (const login of await readdir(path.join(root, weekId))) {
      for (const entry of await readdir(path.join(root, weekId, login))) {
        if (!entry.endsWith(".md")) continue;
        const file = path.join(root, weekId, login, entry);
        const { frontmatter, body } = splitDocument(await readFile(file, "utf8"), file);
        solutions.push({
          weekId, login, problemId: entry.slice(0, -3),
          status: frontmatter.status, language: frontmatter.language ?? null,
          url: frontmatter.url ?? null,
          html: render(body),
          source: body,
        });
      }
    }
  }
  return solutions;
}

// ---------- 레이아웃 ----------

function page({ title, heading, body, script = "" }) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧩</text></svg>">
<link rel="stylesheet" href="${link("/style.css")}">
</head>
<body>
<header>
  <a class="home" href="${link("/")}">🧩 코딩테스트 스터디</a>
  ${heading}
  <div class="spacer"></div>
  <a class="ghost" href="${REPO}" target="_blank" rel="noopener">GitHub ↗</a>
</header>
${body}
${script}
</body>
</html>
`;
}

// ---------- 보드 ----------

function boardPage({ weeks, members, solutions, current }) {
  const byKey = new Map(solutions.map((s) => [`${s.weekId}/${s.login}/${s.problemId}`, s]));
  const cards = [];
  for (const week of weeks) {
    const catalog = new Map(week.problems.map((problem) => [problem.id, problem]));
    for (const [login, assignment] of Object.entries(week.assignments ?? {})) {
      const member = members.find((candidate) => candidate.login === login);
      if (!member) continue;
      const entries = [
        ...(assignment.picked ?? []).map((id) => ({ id, kind: "picked" })),
        ...(assignment.random ? [{ id: assignment.random, kind: "random" }] : []),
      ];
      for (const { id, kind } of entries) {
        const problem = catalog.get(id);
        if (!problem) continue;
        const solution = byKey.get(`${week.id}/${login}/${id}`);
        cards.push({
          weekId: week.id, weekLabel: weekLabel(week), topic: week["topic-name"],
          login, name: member.name,
          problem: problem.id, title: problem.title, source: problem.source,
          difficulty: problem.difficulty, label: problem.label, kind,
          url: problem.url, page: link(`/p/${week.id}/${problem.id}.html`),
          status: solution?.status ?? "todo",
          language: solution?.language ?? null,
        });
      }
    }
  }

  const thisWeek = weeks.find((w) => w.id === current.id) ?? weeks[0] ?? null;

  const body = `
<div class="toolbar">
  <label for="fWeek">주차</label>
  <select id="fWeek">
    ${thisWeek ? '<option value="current">이번 주</option>' : ""}
    ${weeks.map((w) => `<option value="${w.id}">${weekLabel(w)} — ${esc(w["topic-name"])}</option>`).join("")}
    <option value="all">전체</option>
  </select>
  <label for="fDiff">난이도</label>
  <select id="fDiff">
    <option value="all">전체</option>
    <option value="1">쉬움 (Easy / Lv.1)</option>
    <option value="2">보통 (Medium / Lv.2~3)</option>
    <option value="3">어려움 (Hard / Lv.4+)</option>
  </select>
  <label for="fWho">멤버</label>
  <select id="fWho">
    <option value="all">전체</option>
    ${members.map((m) => `<option value="${m.login}">${esc(m.name)}</option>`).join("")}
  </select>
  <a class="hint" href="${REPO}/blob/main/README.md#2-풀이-올리기">풀이는 Pull Request로 올립니다 ↗</a>
</div>

<main>
  ${thisWeek ? `
  <details class="panel suggestions">
    <summary><b>이번 주 추천 문제</b> <span class="hint" id="suggestNote">· ${esc(thisWeek["topic-name"])} · 여기서 골라도 되고 다른 문제를 골라도 됩니다</span></summary>
    <ul id="suggestList"></ul>
  </details>` : ""}
  ${members.length === 0
    ? '<div class="panel"><b>아직 멤버가 없습니다.</b> <span class="hint">members/&lt;github-id&gt;.md 를 추가하는 PR을 열어주세요.</span></div>'
    : '<div id="lanes"></div>'}
</main>`;

  const script = `<script>
const CARDS = ${JSON.stringify(cards)};
const MEMBERS = ${JSON.stringify(members.map(({ login, name, avatar, levels }) => ({
  login, name, avatar, levels, initial: [...name][0] ?? "?", page: link(`/m/${login}.html`),
})))};
const SUGGESTIONS = ${JSON.stringify(thisWeek?.suggestions ?? [])};
const TOPIC_NAME = ${JSON.stringify(thisWeek?.["topic-name"] ?? "")};
const CURRENT = ${JSON.stringify(thisWeek?.id ?? null)};
const STATUSES = ${JSON.stringify(STATUSES)};
const MAX_PICKS = ${MAX_PICKS};
const PENDING = ${JSON.stringify(weeks.flatMap((week) => Object.entries(week.assignments ?? {})
  .map(([login, assignment]) => ({
    weekId: week.id, login,
    remaining: MAX_PICKS - (assignment.picked?.length ?? 0),
    path: `picks/${week.id}/${login}.yaml`,
  }))
  .filter((entry) => entry.remaining > 0)))};
</script>
<script src="${link("/app.js")}"></script>`;

  const heading = thisWeek
    ? `<span class="week-title">${weekLabel(thisWeek)} · <span class="topic">${esc(thisWeek["topic-name"])}</span></span>`
    : '<span class="week-title hint">아직 주차가 없습니다</span>';

  return page({ title: "코딩테스트 스터디", heading, body, script });
}

// ---------- 문제 페이지 ----------

function problemPage({ week, problem, members, solutions }) {
  const written = solutions.filter((s) => s.html);
  const body = `
<main class="doc">
  <div class="problem-head">
    <div class="modal-tags">
      <span class="tag src-${problem.source}">${problem.source === "leetcode" ? "LeetCode" : "프로그래머스"}</span>
      <span class="tag d${problem.difficulty}">${esc(problem.label)}</span>
      ${problem.kind === "random" ? '<span class="tag kind-random">랜덤</span>' : ""}
      <span class="hint">${weekLabel(week)} · ${esc(week["topic-name"])}</span>
    </div>
    <h1>${esc(problem.title)}</h1>
    <a href="${esc(problem.url)}" target="_blank" rel="noopener">문제 풀러 가기 ↗</a>
  </div>

  <p class="hint spoiler-note">이 문제를 받은 ${members.length}명 중 ${written.length}명이 풀이를 올렸습니다. 스포일러를 피하려면 직접 풀어본 뒤에 펼쳐보세요.</p>

  ${members.map((member) => {
    const solution = solutions.find((s) => s.login === member.login);
    const status = solution?.status ?? "todo";
    return `
    <details class="sol" ${solution?.html ? "" : 'data-empty="1"'}>
      <summary>
        ${avatarHtml(member, 22)}
        <span class="dot ${status}"></span>
        <b>${esc(member.name)}</b>
        <span class="hint">${STATUS_LABEL[status]}${solution?.language ? ` · ${esc(LANGUAGE_LABEL[solution.language] ?? solution.language)}` : ""}</span>
        <span class="hint pushr">${solution?.html ? "" : "미작성"}</span>
      </summary>
      <div class="sol-body markdown">
        ${solution?.html || '<p class="empty">아직 풀이를 올리지 않았습니다.</p>'}
        ${solution?.url ? `<p><a class="hint" href="${esc(solution.url)}" target="_blank" rel="noopener">풀이 원문 ↗</a></p>` : ""}
      </div>
    </details>`;
  }).join("")}

  <p class="hint edit-hint">
    내 풀이를 올리려면
    <code>solutions/${week.id}/&lt;github-id&gt;/${problem.id}.md</code>
    파일을 추가하는 Pull Request를 열면 됩니다.
  </p>
</main>`;

  return page({
    title: `${problem.title} — ${weekLabel(week)}`,
    heading: `<span class="week-title">${weekLabel(week)} · <span class="topic">${esc(week["topic-name"])}</span></span>`,
    body,
  });
}

// ---------- 멤버 페이지 ----------

function memberPage({ member, weeks, solutions }) {
  const mine = solutions.filter((s) => s.login === member.login);
  const doneCount = mine.filter((s) => s.status === "done").length;
  const rows = weeks.flatMap((week) => {
    const catalog = new Map(week.problems.map((problem) => [problem.id, problem]));
    const assignment = week.assignments?.[member.login];
    if (!assignment) return [];
    const ids = [...(assignment.picked ?? []), ...(assignment.random ? [assignment.random] : [])];
    return ids.map((problemId) => {
      const problem = catalog.get(problemId);
      const solution = mine.find((s) => s.weekId === week.id && s.problemId === problemId);
      const kind = assignment.random === problemId ? "random" : "picked";
      return { week, problem, kind, status: solution?.status ?? "todo", language: solution?.language };
    }).filter((row) => row.problem);
  });

  const body = `
<main class="doc">
  <h1 class="member-title">${avatarHtml(member, 34)} ${esc(member.name)}</h1>
  <p class="hint">
    <a href="https://github.com/${esc(member.login)}" target="_blank" rel="noopener">@${esc(member.login)}</a>
    · 푼 문제 ${doneCount} / ${rows.length}
    · 선호 난이도 프로그래머스 ${member.levels.programmers.map((level) => `Lv.${level}`).join(", ")}
    / LeetCode ${member.levels.leetcode.join(", ")}
  </p>
  ${member.bio ? `<div class="markdown">${member.bio}</div>` : ""}

  <table class="member-table">
    <thead><tr><th>주차</th><th>문제</th><th>난이도</th><th>상태</th></tr></thead>
    <tbody>
      ${rows.map(({ week, problem, kind, status, language }) => `
        <tr>
          <td class="hint">${weekLabel(week)}</td>
          <td>
            <a href="${link(`/p/${week.id}/${problem.id}.html`)}">${esc(problem.title)}</a>
            ${kind === "random" ? '<span class="tag kind-random">랜덤</span>' : ""}
          </td>
          <td><span class="tag d${problem.difficulty}">${esc(problem.label)}</span></td>
          <td><span class="dot ${status}"></span> ${STATUS_LABEL[status]}${language ? ` <span class="hint">· ${esc(LANGUAGE_LABEL[language] ?? language)}</span>` : ""}</td>
        </tr>`).join("")}
    </tbody>
  </table>
</main>`;

  return page({ title: `${member.name} — 코딩테스트 스터디`, heading: "", body });
}

// ---------- 실행 ----------

async function build() {
  const [weeks, members, solutions] = await Promise.all([readWeeks(), readBoardMembers(), readSolutions()]);
  const current = currentWeek();

  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  await cp(path.join(ROOT, "templates"), DIST, { recursive: true });
  await writeFile(path.join(DIST, ".nojekyll"), "");            // _ 로 시작하는 파일도 서빙되도록
  await writeFile(path.join(DIST, "index.html"), boardPage({ weeks, members, solutions, current }));

  let pages = 0;
  for (const week of weeks) {
    await mkdir(path.join(DIST, "p", week.id), { recursive: true });
    for (const problem of week.problems) {
      const holders = members.filter((member) => {
        const assignment = week.assignments?.[member.login];
        if (!assignment) return false;
        return (assignment.picked ?? []).includes(problem.id) || assignment.random === problem.id;
      });
      const forProblem = solutions.filter((s) => s.weekId === week.id && s.problemId === problem.id);
      await writeFile(
        path.join(DIST, "p", week.id, `${problem.id}.html`),
        problemPage({ week, problem, members: holders, solutions: forProblem }),
      );
      pages += 1;
    }
  }

  await mkdir(path.join(DIST, "m"), { recursive: true });
  for (const member of members) {
    await writeFile(path.join(DIST, "m", `${member.login}.html`), memberPage({ member, weeks, solutions }));
  }

  console.log(`build: 주차 ${weeks.length}개, 멤버 ${members.length}명, 문제 페이지 ${pages}개 → dist/`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await build();
export { build };
