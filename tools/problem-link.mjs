// 문제 링크를 파싱해서 실제 문제 정보를 가져온다.
// 멤버가 picks/<주차>/<github-id>.yaml 에 URL 만 넣으면 여기서 제목·난이도·주제를 채운다.
import { TOPICS } from "./topics.mjs";

const UA = "Mozilla/5.0 (compatible; code-study-board/1.0)";

const LEETCODE_HOSTS = new Set(["leetcode.com", "www.leetcode.com"]);
const PROGRAMMERS_HOSTS = new Set(["school.programmers.co.kr", "programmers.co.kr", "www.programmers.co.kr"]);

const LC_TAG_TO_TOPICS = new Map();
for (const topic of TOPICS) {
  for (const tag of topic.leetcode) {
    if (!LC_TAG_TO_TOPICS.has(tag)) LC_TAG_TO_TOPICS.set(tag, []);
    LC_TAG_TO_TOPICS.get(tag).push(topic.slug);
  }
}

export class LinkError extends Error {}

// 지원하는 링크인지 확인하고 (source, ref) 로 쪼갠다. 네트워크를 쓰지 않아 검증에서도 쓸 수 있다.
export function parseProblemUrl(input) {
  let url;
  try { url = new URL(String(input).trim()); }
  catch { throw new LinkError(`URL 형식이 아닙니다: ${input}`); }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new LinkError(`https 링크여야 합니다: ${input}`);
  }

  if (LEETCODE_HOSTS.has(url.hostname)) {
    const match = /^\/problems\/([a-z0-9-]+)/.exec(url.pathname);
    if (!match) throw new LinkError(`LeetCode 문제 링크가 아닙니다: ${input}`);
    return { source: "leetcode", ref: match[1], id: null };
  }

  if (PROGRAMMERS_HOSTS.has(url.hostname)) {
    const match = /\/learn\/courses\/\d+\/lessons\/(\d+)/.exec(url.pathname);
    if (!match) throw new LinkError(`프로그래머스 문제 링크가 아닙니다: ${input}`);
    return { source: "programmers", ref: match[1], id: `programmers-${match[1]}` };
  }

  throw new LinkError(`LeetCode 또는 프로그래머스 링크만 등록할 수 있습니다: ${input}`);
}

async function resolveLeetCode(slug) {
  const response = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({
      query: `query($slug: String!) {
        question(titleSlug: $slug) {
          questionFrontendId title titleSlug difficulty isPaidOnly topicTags { slug }
        }
      }`,
      variables: { slug },
    }),
  });
  if (!response.ok) throw new LinkError(`LeetCode 응답 오류 (HTTP ${response.status})`);
  const question = (await response.json())?.data?.question;
  if (!question) throw new LinkError(`LeetCode에 없는 문제입니다: ${slug}`);
  if (question.isPaidOnly) throw new LinkError(`유료(Premium) 문제는 등록할 수 없습니다: ${question.title}`);

  const tags = question.topicTags.map((tag) => tag.slug);
  return {
    id: `leetcode-${question.questionFrontendId}`,
    source: "leetcode",
    title: `${question.questionFrontendId}. ${question.title}`,
    url: `https://leetcode.com/problems/${question.titleSlug}/`,
    difficulty: { Easy: 1, Medium: 2, Hard: 3 }[question.difficulty] ?? 2,
    label: question.difficulty,
    topics: [...new Set(tags.flatMap((tag) => LC_TAG_TO_TOPICS.get(tag) ?? []))],
  };
}

async function resolveProgrammers(lessonId) {
  const url = `https://school.programmers.co.kr/learn/courses/30/lessons/${lessonId}`;
  const response = await fetch(url, { headers: { "User-Agent": UA } });
  if (!response.ok) throw new LinkError(`프로그래머스 응답 오류 (HTTP ${response.status})`);
  const html = await response.text();

  // 페이지의 분석 이벤트 속성에 제목과 난이도가 HTML 이스케이프된 채로 들어 있다.
  const title = /&quot;challenge_title&quot;:&quot;(.*?)&quot;/.exec(html)?.[1]
    ?? /<title>\s*(?:코딩테스트 연습 - )?(.*?)\s*\|/.exec(html)?.[1];
  const level = Number(/&quot;challenge_level&quot;:(\d+)/.exec(html)?.[1]);
  if (!title || title.includes("프로그래머스")) throw new LinkError(`프로그래머스에 없는 문제입니다: ${lessonId}`);

  const unescaped = title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  return {
    id: `programmers-${lessonId}`,
    source: "programmers",
    title: unescaped,
    url,
    // Lv.1 -> 1, Lv.2~3 -> 2, Lv.4+ -> 3
    difficulty: level ? Math.min(3, Math.max(1, level - (level >= 3 ? 1 : 0))) : 2,
    label: level ? `Lv.${level}` : "Lv.?",
    topics: [],                       // 프로그래머스는 문제 페이지에서 유형을 알 수 없다
  };
}

export async function resolveProblem(link) {
  return link.source === "leetcode"
    ? resolveLeetCode(link.ref)
    : resolveProgrammers(link.ref);
}

export const resolveProblemUrl = async (input) => resolveProblem(parseProblemUrl(input));
