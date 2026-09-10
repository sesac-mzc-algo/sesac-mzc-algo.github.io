// 주차별로 순환할 알고리즘 커리큘럼.
// leetcode: LeetCode topicTag slug, programmers: data/programmers-seed.json 의 topic 값
export const TOPICS = [
  { slug: 'hash',          name: '해시 / 맵',        leetcode: ['hash-table', 'counting'] },
  { slug: 'stack-queue',   name: '스택 / 큐',        leetcode: ['stack', 'queue', 'monotonic-stack'] },
  { slug: 'sorting',       name: '정렬',             leetcode: ['sorting'] },
  { slug: 'two-pointers',  name: '투 포인터',        leetcode: ['two-pointers'] },
  { slug: 'sliding-window',name: '슬라이딩 윈도우',  leetcode: ['sliding-window'] },
  { slug: 'binary-search', name: '이분 탐색',        leetcode: ['binary-search'] },
  { slug: 'brute-force',   name: '완전 탐색',        leetcode: ['enumeration', 'brainteaser'] },
  { slug: 'greedy',        name: '그리디',           leetcode: ['greedy'] },
  { slug: 'dfs-bfs',       name: 'DFS / BFS',        leetcode: ['depth-first-search', 'breadth-first-search'] },
  { slug: 'backtracking',  name: '백트래킹',         leetcode: ['backtracking'] },
  { slug: 'dp',            name: '동적 계획법',      leetcode: ['dynamic-programming'] },
  { slug: 'heap',          name: '힙 / 우선순위 큐', leetcode: ['heap-priority-queue'] },
  { slug: 'tree',          name: '트리',             leetcode: ['tree', 'binary-tree', 'binary-search-tree'] },
  { slug: 'graph',         name: '그래프',           leetcode: ['graph', 'union-find', 'topological-sort'] },
  { slug: 'shortest-path', name: '최단 경로',        leetcode: ['shortest-path', 'graph'] },
  { slug: 'string',        name: '문자열',           leetcode: ['string', 'string-matching'] },
  { slug: 'simulation',    name: '구현 / 시뮬레이션', leetcode: ['simulation', 'matrix'] },
  { slug: 'math',          name: '수학',             leetcode: ['math', 'number-theory'] },
  { slug: 'bit',           name: '비트마스크',       leetcode: ['bit-manipulation', 'bitmask'] },
  { slug: 'linked-list',   name: '연결 리스트',      leetcode: ['linked-list'] },
];

export const TOPIC_BY_SLUG = new Map(TOPICS.map((t) => [t.slug, t]));
