// 멤버별 칸반. 데이터(CARDS, MEMBERS, STATUSES)는 빌드 시 index.html 에 심어진다.
const esc = (value) => String(value ?? "").replace(/[&<>"']/g,
  (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

const SOURCE_LABEL = { leetcode: "LeetCode", programmers: "프로그래머스" };
const filters = { week: CURRENT ? "current" : "all", diff: "all", who: "all" };
const lanes = document.getElementById("lanes");

function cardHtml(card) {
  const showWeek = filters.week === "all";
  return `
    <a class="card" href="${card.page}">
      <div class="row1">
        <span class="tag src-${card.source}">${SOURCE_LABEL[card.source]}</span>
        <span class="tag d${card.difficulty}">${esc(card.label)}</span>
        ${card.kind === "random" ? '<span class="tag kind-random">랜덤</span>' : ""}
      </div>
      <span class="title">${esc(card.title)}</span>
      <div class="meta">
        <span>${showWeek ? `${card.year} ${card.week}주차 · ${esc(card.topic)}` : esc(card.topic)}</span>
        ${card.language ? `<span class="owner">${esc(card.language)}</span>` : ""}
      </div>
    </a>`;
}

function laneHtml(member, cards) {
  const done = cards.filter((card) => card.status === "done").length;
  const ratio = cards.length ? Math.round((done / cards.length) * 100) : 0;
  return `
    <section class="lane">
      <div class="lane-head">
        <a class="lane-name" href="${member.page}">${esc(member.name)}</a>
        <span class="hint">@${esc(member.login)}</span>
        <span class="lane-progress">
          <span class="bar"><span style="width:${ratio}%"></span></span>
          <b>${done}</b>/${cards.length}
        </span>
      </div>
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

function apply() {
  const visible = CARDS.filter((card) => {
    if (filters.week === "current" && card.weekId !== CURRENT) return false;
    if (filters.week !== "current" && filters.week !== "all" && card.weekId !== filters.week) return false;
    if (filters.diff !== "all" && String(card.difficulty) !== filters.diff) return false;
    return true;
  });

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
