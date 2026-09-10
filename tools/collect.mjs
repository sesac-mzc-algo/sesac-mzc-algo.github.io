// LeetCode / 프로그래머스 문제를 모아 data/problems.json 으로 저장한다.
// GitHub Actions(collect.yml)에서 주기적으로 실행되고, 결과는 커밋된다.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TOPICS } from "./topics.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const UA = "Mozilla/5.0 (compatible; code-study-board/1.0)";
const STUDY_PLANS = ["top-interview-150", "leetcode-75", "dynamic-programming", "graph-theory", "binary-search"];

const LC_TAG_TO_TOPICS = new Map();
for (const topic of TOPICS) {
  for (const tag of topic.leetcode) {
    if (!LC_TAG_TO_TOPICS.has(tag)) LC_TAG_TO_TOPICS.set(tag, []);
    LC_TAG_TO_TOPICS.get(tag).push(topic.slug);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function graphql(query, variables) {
  const response = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`LeetCode HTTP ${response.status}`);
  return (await response.json()).data;
}

async function collectLeetCode(limit, log) {
  const query = `query problemsetQuestionList($limit: Int!, $skip: Int!) {
    problemsetQuestionList: questionList(categorySlug: "", limit: $limit, skip: $skip, filters: {}) {
      questions: data {
        questionFrontendId
        title
        titleSlug
        difficulty
        isPaidOnly
        topicTags { slug }
      }
    }
  }`;
  const problems = [];
  const page = 100;
  for (let skip = 0; skip < limit; skip += page) {
    const data = await graphql(query, { limit: page, skip });
    const questions = data?.problemsetQuestionList?.questions ?? [];
    if (questions.length === 0) break;
    for (const question of questions) {
      if (question.isPaidOnly) continue;                       // 유료 문제는 스터디에 부적합
      const tags = question.topicTags.map((tag) => tag.slug);
      const topics = [...new Set(tags.flatMap((tag) => LC_TAG_TO_TOPICS.get(tag) ?? []))];
      if (topics.length === 0) continue;                       // 커리큘럼에 없는 주제는 제외
      problems.push({
        id: `leetcode-${question.questionFrontendId}`,
        source: "leetcode",
        title: `${question.questionFrontendId}. ${question.title}`,
        url: `https://leetcode.com/problems/${question.titleSlug}/`,
        difficulty: { Easy: 1, Medium: 2, Hard: 3 }[question.difficulty] ?? 2,
        label: question.difficulty,
        topics,
        featured: false,
      });
    }
    log(`  leetcode ${skip + questions.length}개 확인 (수집 ${problems.length})`);
    await sleep(350);
  }
  return problems;
}

// 프로그래머스는 문제 목록 API가 로그인 없이 열려 있지 않다.
// data/programmers-seed.json 의 큐레이션 목록을 쓰고 제목만 실제 페이지에서 확인한다.
async function collectProgrammers(previous, log) {
  const seed = JSON.parse(await readFile(path.join(ROOT, "data", "programmers-seed.json"), "utf8"));
  const known = new Map(previous.map((problem) => [problem.id, problem.title]));
  const problems = [];
  let failed = 0;

  for (const item of seed) {
    const id = `programmers-${item.id}`;
    const url = `https://school.programmers.co.kr/learn/courses/30/lessons/${item.id}`;
    let title = known.get(id) ?? null;
    if (!title) {
      try {
        const html = await (await fetch(url, { headers: { "User-Agent": UA } })).text();
        title = /<title>\s*(?:코딩테스트 연습 - )?(.*?)\s*\|/.exec(html)?.[1] ?? null;
      } catch { title = null; }
      await sleep(250);
    }
    if (!title || title.includes("프로그래머스")) { failed += 1; log(`  ! ${item.id} 제목 확인 실패`); continue; }
    problems.push({
      id,
      source: "programmers",
      title,
      url,
      // Lv.1 -> 1, Lv.2~3 -> 2, Lv.4+ -> 3
      difficulty: Math.min(3, Math.max(1, item.level - (item.level >= 3 ? 1 : 0))),
      label: `Lv.${item.level}`,
      topics: [item.topic],
      featured: true,                                          // 고득점 Kit 중심이라 전부 대표 문제
    });
  }
  log(`  programmers ${problems.length}개 수집 (실패 ${failed})`);
  return problems;
}

// 스터디 플랜(빈출 문제 모음)에 속한 LeetCode 문제를 대표 문제로 표시한다.
async function markFeatured(problems, log) {
  const byId = new Map(problems.map((problem) => [problem.id, problem]));
  let marked = 0;
  for (const slug of STUDY_PLANS) {
    try {
      const data = await graphql(
        `query($slug: String!) { studyPlanV2Detail(planSlug: $slug) { planSubGroups { questions { questionFrontendId } } } }`,
        { slug },
      );
      for (const group of data?.studyPlanV2Detail?.planSubGroups ?? []) {
        for (const question of group.questions) {
          const problem = byId.get(`leetcode-${question.questionFrontendId}`);
          if (problem && !problem.featured) { problem.featured = true; marked += 1; }
        }
      }
    } catch (error) { log(`  ! 스터디 플랜 ${slug} 실패: ${error.message}`); }
    await sleep(350);
  }
  log(`  대표 문제 ${marked}개 표시`);
}

export async function collect({ limit = 1200, log = console.log } = {}) {
  const target = path.join(ROOT, "data", "problems.json");
  const previous = await readFile(target, "utf8").then(JSON.parse).catch(() => []);

  log("LeetCode 수집 중...");
  const leetcode = await collectLeetCode(limit, log);
  log("프로그래머스 수집 중...");
  const programmers = await collectProgrammers(previous, log);
  log("대표 문제 표시 중...");
  await markFeatured(leetcode, log);

  const problems = [...programmers, ...leetcode].sort((a, b) => a.id.localeCompare(b.id));
  await writeFile(target, `${JSON.stringify(problems, null, 2)}\n`);
  log(`완료. data/problems.json 에 ${problems.length}개 저장`);
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await collect({ limit: Number(process.argv[2]) || 1200 });
}
