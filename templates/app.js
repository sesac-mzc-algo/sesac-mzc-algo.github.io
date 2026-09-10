// 멤버별 칸반. 데이터(CARDS, MEMBERS, STATUSES)는 빌드 시 index.html 에 심어진다.
const esc = (value) => String(value ?? "").replace(/[&<>"']/g,
  (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

const SOURCE_LABEL = { leetcode: "LeetCode", programmers: "프로그래머스" };

const avatarHtml = (member, size) => `
  <span class="avatar" style="--size:${size}px">
    <span class="initial">${esc(member.initial)}</span>
    <img src="${esc(member.avatar)}" alt="" loading="lazy" onerror="this.remove()">
  </span>`;

// 문제가 그 멤버가 원하는 난이도인지 (members/*.md 의 levels)
function matchesLevels(problem, levels) {
  if (!levels) return true;
  if (problem.source === "programmers") {
    const level = Number(/^Lv\.(\d)$/.exec(problem.label)?.[1]);
    return Number.isNaN(level) ? true : levels.programmers.includes(level);
  }
  return levels.leetcode.includes(problem.label);
}
const filters = { week: CURRENT ? "current" : "all", diff: "all", who: "all" };
const lanes = document.getElementById("lanes");

function cardHtml(card) {
  const showWeek = filters.week === "all";
  return `
    <a class="card" href="${card.page}">
      <div class="row1">
        <span class="tag src-${card.source}">${SOURCE_LABEL[card.source]}</span>
        <span class="tag d${card.difficulty}">${esc(card.label)}</span>
        <span class="tag kind-${card.kind}">${card.kind === "random" ? "랜덤" : "직접 고름"}</span>
      </div>
      <span class="title">${esc(card.title)}</span>
      <div class="meta">
        <span>${showWeek ? `${esc(card.weekLabel)} · ${esc(card.topic)}` : ""}</span>
        ${card.language ? `<span class="owner">${esc(card.language)}</span>` : ""}
      </div>
    </a>`;
}

function laneHtml(member, cards) {
  const done = cards.filter((card) => card.status === "done").length;
  const ratio = cards.length ? Math.round((done / cards.length) * 100) : 0;
  const pending = PENDING.filter((entry) => entry.login === member.login
    && (filters.week === "all" || entry.weekId === (filters.week === "current" ? CURRENT : filters.week)));
  return `
    <section class="lane">
      <div class="lane-head">
        ${avatarHtml(member, 24)}
        <a class="lane-name" href="${member.page}">${esc(member.name)}</a>
        <span class="hint">@${esc(member.login)}</span>
        <span class="lane-progress">
          <span class="bar"><span style="width:${ratio}%"></span></span>
          <b>${done}</b>/${cards.length}
        </span>
      </div>
      ${pending.length ? `<p class="pick-todo">아직 고르지 않은 문제 ${pending.reduce((sum, entry) => sum + entry.remaining, 0)}개 —
        <code>${pending.map((entry) => entry.path).join("</code>, <code>")}</code> 에 링크를 넣어 PR을 열어주세요.</p>` : ""}
      <div class="lane-columns">
        ${STATUSES.map(([status, label]) => {
          const list = cards.filter((card) => card.status === status);
          return `
            <div class="col" data-status="${status}">
              <h3><span class="dot ${status}"></span>${label}<span class="count">${list.length}</span></h3>
              ${list.length ? list.map(cardHtml).join("") : '<p class="empty">없음</p>'}
            </div>`;
        }).join("")}
      </div>
    </section>`;
}

function renderSuggestions() {
  const list = document.getElementById("suggestList");
  if (!list) return;
  const member = MEMBERS.find((candidate) => candidate.login === filters.who);
  const shown = member ? SUGGESTIONS.filter((problem) => matchesLevels(problem, member.levels)) : SUGGESTIONS;

  document.getElementById("suggestNote").textContent = member
    ? `· ${TOPIC_NAME} · ${member.name} 님의 선호 난이도에 맞춘 ${shown.length}개`
    : `· ${TOPIC_NAME} · 여기서 골라도 되고 다른 문제를 골라도 됩니다`;

  list.innerHTML = shown.length
    ? shown.map((problem) => `
      <li>
        <span class="tag src-${problem.source}">${SOURCE_LABEL[problem.source]}</span>
        <span class="tag d${problem.difficulty}">${esc(problem.label)}</span>
        <a href="${esc(problem.url)}" target="_blank" rel="noopener">${esc(problem.title)}</a>
      </li>`).join("")
    : '<li class="empty">선호 난이도에 맞는 추천 문제가 없습니다. 멤버 파일의 levels 를 넓혀보세요.</li>';
}

function apply() {
  const visible = CARDS.filter((card) => {
    if (filters.week === "current" && card.weekId !== CURRENT) return false;
    if (filters.week !== "current" && filters.week !== "all" && card.weekId !== filters.week) return false;
    if (filters.diff !== "all" && String(card.difficulty) !== filters.diff) return false;
    return true;
  });

  renderSuggestions();
  const shown = MEMBERS.filter((member) => filters.who === "all" || member.login === filters.who);
  lanes.innerHTML = shown.length
    ? shown.map((member) => laneHtml(member, visible.filter((card) => card.login === member.login))).join("")
    : '<p class="empty">해당 멤버가 없습니다.</p>';
}

for (const [id, key] of [["fWeek", "week"], ["fDiff", "diff"], ["fWho", "who"]]) {
  const select = document.getElementById(id);
  if (!select) continue;
  select.value = filters[key];
  select.onchange = () => { filters[key] = select.value; apply(); };
}
if (lanes) apply();
