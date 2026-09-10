import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { validateBoard } from "./validate.mjs";

const WEEK = `topic: hash
topic-name: 해시 / 맵
start: 2026-09-07
end: 2026-09-13
problems:
  - id: programmers-1845
    source: programmers
    title: 폰켓몬
    url: https://school.programmers.co.kr/learn/courses/30/lessons/1845
    difficulty: 1
    label: Lv.1
    kind: topic
  - id: leetcode-3
    source: leetcode
    title: 3. Longest Substring Without Repeating Characters
    url: https://leetcode.com/problems/longest-substring-without-repeating-characters/
    difficulty: 2
    label: Medium
    kind: topic
  - id: leetcode-643
    source: leetcode
    title: 643. Maximum Average Subarray I
    url: https://leetcode.com/problems/maximum-average-subarray-i/
    difficulty: 1
    label: Easy
    kind: random
`;
const MEMBER = "# 지원\n\n백엔드 개발자입니다.\n";
const SOLUTION = "---\nstatus: done\nlanguage: python\n---\n\n## 접근\n\n집합 크기와 N/2 중 작은 값.\n\n```python\nprint(1)\n```\n";

// 유효한 보드를 만들고 mutate 로 한 군데만 망가뜨린 뒤 검사한다.
async function board(mutate = async () => {}) {
  const root = await mkdtemp(path.join(tmpdir(), "board-"));
  await mkdir(path.join(root, "weeks"), { recursive: true });
  await mkdir(path.join(root, "members"), { recursive: true });
  await mkdir(path.join(root, "solutions", "2026-W37", "jiwon"), { recursive: true });
  await writeFile(path.join(root, "weeks", "2026-W37.yaml"), WEEK);
  await writeFile(path.join(root, "members", "jiwon.md"), MEMBER);
  await writeFile(path.join(root, "solutions", "2026-W37", "jiwon", "programmers-1845.md"), SOLUTION);
  await mutate(root);
  return root;
}

async function rejects(mutate, message) {
  const root = await board(mutate);
  await assert.rejects(validateBoard(root), (error) => {
    assert.match(error.message, message);
    return true;
  });
  await rm(root, { recursive: true, force: true });
}

const write = (...parts) => (content) => async (root) =>
  writeFile(path.join(root, ...parts), content);

test("유효한 보드를 통과시킨다", async () => {
  const root = await board();
  assert.deepEqual(await validateBoard(root), { weeks: 1, members: 1 });
  await rm(root, { recursive: true, force: true });
});

test("주차 파일명이 YYYY-Www 가 아니면 거부한다", async () => {
  await rejects(async (root) => {
    await writeFile(path.join(root, "weeks", "week37.yaml"), WEEK);
  }, /YYYY-Www 형식/);
});

test("topic-name 이 topic 과 다르면 거부한다", async () => {
  await rejects(write("weeks", "2026-W37.yaml")(WEEK.replace("해시 / 맵", "그리디")), /topic-name이 topic과 다릅니다/);
});

test("알 수 없는 알고리즘을 거부한다", async () => {
  await rejects(write("weeks", "2026-W37.yaml")(WEEK.replace("topic: hash", "topic: quantum")), /알 수 없는 알고리즘/);
});

test("ISO 주차와 날짜가 어긋나면 거부한다", async () => {
  await rejects(write("weeks", "2026-W37.yaml")(WEEK.replace("2026-09-07", "2026-09-01")), /날짜가 ISO 주차와 다릅니다/);
});

test("문제가 3개가 아니면 거부한다", async () => {
  const trimmed = WEEK.slice(0, WEEK.indexOf("  - id: leetcode-643"));
  await rejects(write("weeks", "2026-W37.yaml")(trimmed), /문제는 3개여야 합니다/);
});

test("랜덤 문제가 없으면 거부한다", async () => {
  await rejects(write("weeks", "2026-W37.yaml")(WEEK.replace("kind: random", "kind: topic")), /랜덤 문제는 정확히 1개/);
});

test("status 가 없으면 거부한다", async () => {
  await rejects(
    write("solutions", "2026-W37", "jiwon", "programmers-1845.md")(SOLUTION.replace("status: done\n", "")),
    /status는 todo, doing, done/,
  );
});

test("허용하지 않는 frontmatter 키를 거부한다", async () => {
  await rejects(
    write("solutions", "2026-W37", "jiwon", "programmers-1845.md")(SOLUTION.replace("status: done", "status: done\nscore: 100")),
    /frontmatter에는 status, language, url만/,
  );
});

test("지원하지 않는 언어를 거부한다", async () => {
  await rejects(
    write("solutions", "2026-W37", "jiwon", "programmers-1845.md")(SOLUTION.replace("python", "brainfuck")),
    /지원하지 않는 언어/,
  );
});

test("done 인데 코드 블록이 없으면 거부한다", async () => {
  await rejects(
    write("solutions", "2026-W37", "jiwon", "programmers-1845.md")("---\nstatus: done\n---\n\n집합 크기와 N/2 중 작은 값.\n"),
    /풀이 코드 블록이 필요합니다/,
  );
});

test("그 주차에 없는 문제의 풀이를 거부한다", async () => {
  await rejects(async (root) => {
    await writeFile(path.join(root, "solutions", "2026-W37", "jiwon", "leetcode-9999.md"), SOLUTION);
  }, /주차에 없는 문제/);
});

test("멤버 등록 없이 올린 풀이를 거부한다", async () => {
  await rejects(async (root) => {
    await mkdir(path.join(root, "solutions", "2026-W37", "newbie"), { recursive: true });
    await writeFile(path.join(root, "solutions", "2026-W37", "newbie", "programmers-1845.md"), SOLUTION);
  }, /members\/newbie\.md 를 먼저 추가/);
});

test("unsafe HTML 을 거부한다", async () => {
  await rejects(
    write("solutions", "2026-W37", "jiwon", "programmers-1845.md")(SOLUTION + "\n<script>alert(1)</script>\n"),
    /unsafe HTML/,
  );
});

test("unsafe link scheme 을 거부한다", async () => {
  await rejects(
    write("solutions", "2026-W37", "jiwon", "programmers-1845.md")(`${SOLUTION}\n[click](javascript:alert(1))\n`),
    /unsafe link scheme/,
  );
});

test("멤버 파일에 제목이 없으면 거부한다", async () => {
  await rejects(write("members", "jiwon.md")("백엔드 개발자입니다.\n"), /첫 줄은 표시할 이름 제목/);
});

test("대문자 GitHub ID 를 거부한다", async () => {
  await rejects(async (root) => {
    await writeFile(path.join(root, "members", "Jiwon.md"), MEMBER);
  }, /소문자 GitHub ID/);
});
