// 정적 보드의 필터링. 데이터(CARDS)는 빌드 시 index.html 에 심어진다.
const esc = (value) => String(value ?? "").replace(/[&<>"']/g,
  (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

const filters = { week: CURRENT ? "current" : "all", diff: "all", who: "all" };

const SOURCE_LABEL = { leetcode: "LeetCode", programmers: "프로그래머스" };

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
        <span class="owner">${esc(card.name)}${card.language ? ` · ${esc(card.language)}` : ""}</span>
      </div>
    </a>`;
}

function apply() {
  const visible = CARDS.filter((card) => {
    if (filters.week === "current" && card.weekId !== CURRENT) return false;
    if (filters.week !== "current" && filters.week !== "all" && card.weekId !== filters.week) return false;
    if (filters.diff !== "all" && String(card.difficulty) !== filters.diff) return false;
    if (filters.who !== "all" && card.login !== filters.who) return false;
    return true;
  });

  for (const column of document.querySelectorAll(".col")) {
    const list = visible.filter((card) => card.status === column.dataset.status);
    column.querySelector(".col-body").innerHTML = list.map(cardHtml).join("");
    column.querySelector(`[data-count="${column.dataset.status}"]`).textContent = list.length;
    column.querySelector(".empty").hidden = list.length > 0;
  }
}

for (const [id, key] of [["fWeek", "week"], ["fDiff", "diff"], ["fWho", "who"]]) {
  const select = document.getElementById(id);
  select.value = filters[key];
  select.onchange = () => { filters[key] = select.value; apply(); };
}
apply();
