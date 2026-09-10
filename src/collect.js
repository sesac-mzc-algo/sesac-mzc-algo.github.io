import fs from 'node:fs';
import path from 'node:path';
import { db, run, one, ROOT } from './db.js';
import { TOPICS } from './topics.js';

const UA = 'Mozilla/5.0 (compatible; code-study/1.0)';

// LeetCode 태그 slug -> 커리큘럼 topic slug 역인덱스
const LC_TAG_TO_TOPICS = (() => {
  const m = new Map();
  for (const t of TOPICS) for (const tag of t.leetcode) {
    if (!m.has(tag)) m.set(tag, []);
    m.get(tag).push(t.slug);
  }
  return m;
})();

function upsertProblem(p) {
  run(
    `INSERT INTO problems (source, ext_id, title, url, difficulty, diff_label, topics, raw_tags, featured)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(source, ext_id) DO UPDATE SET
       title = excluded.title, url = excluded.url,
       difficulty = excluded.difficulty, diff_label = excluded.diff_label,
       topics = excluded.topics, raw_tags = excluded.raw_tags,
       featured = MAX(problems.featured, excluded.featured)`,
    p.source, String(p.ext_id), p.title, p.url, p.difficulty, p.diff_label,
    JSON.stringify(p.topics), JSON.stringify(p.raw_tags), p.featured ? 1 : 0,
  );
}

// LeetCode 스터디 플랜(빈출 문제 모음)에 속한 문제에 featured 표시.
// 주차 문제는 이 중에서 우선 선정 -> 잘 알려진 문제 위주가 된다.
const STUDY_PLANS = ['top-interview-150', 'leetcode-75', 'dynamic-programming', 'graph-theory', 'binary-search'];

export async function markFeatured({ log = console.log } = {}) {
  let marked = 0;
  for (const slug of STUDY_PLANS) {
    try {
      const res = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
        body: JSON.stringify({
          query: `query($slug: String!) { studyPlanV2Detail(planSlug: $slug) { planSubGroups { questions { questionFrontendId } } } }`,
          variables: { slug },
        }),
      });
      const groups = (await res.json())?.data?.studyPlanV2Detail?.planSubGroups ?? [];
      for (const g of groups) for (const qn of g.questions) {
        const r = run(`UPDATE problems SET featured = 1 WHERE source='leetcode' AND ext_id=?`, qn.questionFrontendId);
        marked += r.changes;
      }
    } catch (e) { log(`  ! 스터디 플랜 ${slug} 실패: ${e.message}`); }
    await new Promise((r) => setTimeout(r, 350));
  }
  // 프로그래머스 시드는 전부 고득점 Kit 중심이라 기본 featured
  run(`UPDATE problems SET featured = 1 WHERE source='programmers'`);
  log(`  대표 문제 ${marked}개 표시`);
  return marked;
}

// ---------- LeetCode ----------

const LC_QUERY = `query problemsetQuestionList($limit: Int!, $skip: Int!) {
  problemsetQuestionList: questionList(categorySlug: "", limit: $limit, skip: $skip, filters: {}) {
    total: totalNum
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

export async function collectLeetCode({ limit = 1200, log = console.log } = {}) {
  const PAGE = 100;
  let saved = 0, skipped = 0;
  for (let skip = 0; skip < limit; skip += PAGE) {
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ query: LC_QUERY, variables: { limit: PAGE, skip } }),
    });
    if (!res.ok) throw new Error(`LeetCode HTTP ${res.status}`);
    const json = await res.json();
    const list = json?.data?.problemsetQuestionList?.questions ?? [];
    if (list.length === 0) break;

    for (const qn of list) {
      if (qn.isPaidOnly) { skipped++; continue; }   // 유료 문제는 스터디에 부적합
      const tags = qn.topicTags.map((t) => t.slug);
      const topics = [...new Set(tags.flatMap((t) => LC_TAG_TO_TOPICS.get(t) ?? []))];
      if (topics.length === 0) { skipped++; continue; }
      upsertProblem({
        source: 'leetcode',
        ext_id: qn.questionFrontendId,
        title: `${qn.questionFrontendId}. ${qn.title}`,
        url: `https://leetcode.com/problems/${qn.titleSlug}/`,
        difficulty: { Easy: 1, Medium: 2, Hard: 3 }[qn.difficulty] ?? 2,
        diff_label: qn.difficulty,
        topics,
        raw_tags: tags,
      });
      saved++;
    }
    log(`  leetcode ${skip + list.length}개 확인 (저장 ${saved} / 제외 ${skipped})`);
    await new Promise((r) => setTimeout(r, 350));   // rate limit 예의
  }
  return { saved, skipped };
}

// ---------- Programmers ----------
// 프로그래머스는 문제 목록 API가 로그인 없이 열려있지 않아, 큐레이션된 문제 ID 목록
// (data/programmers-seed.json, 고득점 Kit 중심)을 쓰고 제목만 실제 페이지에서 확인한다.

export async function collectProgrammers({ log = console.log } = {}) {
  const seedPath = path.join(ROOT, 'data', 'programmers-seed.json');
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  let saved = 0, failed = 0;

  for (const item of seed) {
    const url = `https://school.programmers.co.kr/learn/courses/30/lessons/${item.id}`;
    const existing = one(`SELECT title FROM problems WHERE source='programmers' AND ext_id=?`, String(item.id));
    let title = existing?.title ?? null;

    if (!title) {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': UA } });
        const html = await res.text();
        const m = html.match(/<title>\s*(?:코딩테스트 연습 - )?(.*?)\s*\|/);
        title = m ? m[1] : null;
      } catch { /* 네트워크 실패는 아래에서 처리 */ }
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!title || title.includes('프로그래머스')) { failed++; log(`  ! ${item.id} 제목 확인 실패, 건너뜀`); continue; }

    upsertProblem({
      source: 'programmers',
      ext_id: String(item.id),
      title,
      url,
      difficulty: Math.min(3, Math.max(1, item.level - (item.level >= 3 ? 1 : 0))), // Lv1->1, Lv2->2, Lv3->2, Lv4->3
      diff_label: `Lv.${item.level}`,
      topics: [item.topic],
      raw_tags: [item.topic],
    });
    saved++;
  }
  log(`  programmers 저장 ${saved} / 실패 ${failed}`);
  return { saved, failed };
}

export async function collectAll(opts = {}) {
  const log = opts.log ?? console.log;
  log('LeetCode 수집 중...');
  const lc = await collectLeetCode(opts);
  log('프로그래머스 수집 중...');
  const pg = await collectProgrammers(opts);
  log('대표 문제 표시 중...');
  await markFeatured(opts);
  const total = db.prepare(`SELECT COUNT(*) c FROM problems`).get().c;
  log(`완료. 문제 풀(pool) 총 ${total}개`);
  return { leetcode: lc, programmers: pg, total };
}
