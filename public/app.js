const app = document.getElementById('app');
const state = { user: null, data: null, filter: { week: 'current', diff: 'all', who: 'all' }, mode: 'login', error: '' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const STATUSES = [['todo','풀 문제'], ['doing','푸는 중'], ['done','푼 문제']];

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method ?? 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `요청 실패 (${res.status})`);
  return json;
}

// ---------------- 로그인 화면 ----------------

function renderAuth() {
  const signup = state.mode === 'signup';
  app.className = 'auth-wrap';
  app.innerHTML = `
    <form class="auth" id="authForm">
      <h1>🧩 코딩테스트 스터디</h1>
      <p class="sub">${signup ? '계정을 만들고 이번 주차에 합류하세요.' : '스터디 보드에 로그인합니다.'}</p>
      <label>아이디</label><input name="username" autocomplete="username" required>
      ${signup ? '<label>표시 이름</label><input name="display_name" placeholder="비우면 아이디로 표시">' : ''}
      <label>비밀번호</label><input name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" required>
      ${signup ? '<label>초대 코드 <span class="hint">(설정된 경우에만)</span></label><input name="invite_code">' : ''}
      ${state.error ? `<div class="err">${esc(state.error)}</div>` : ''}
      <button class="primary" type="submit">${signup ? '가입하고 시작하기' : '로그인'}</button>
      <div class="switch">${signup ? '이미 계정이 있나요? <a id="sw">로그인</a>' : '처음이신가요? <a id="sw">계정 만들기</a>'}</div>
    </form>`;

  app.querySelector('#sw').onclick = () => { state.mode = signup ? 'login' : 'signup'; state.error = ''; renderAuth(); };
  app.querySelector('#authForm').onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    try {
      const { user } = await api(`/api/auth/${signup ? 'signup' : 'login'}`, { method: 'POST', body });
      state.user = user; state.error = '';
      await loadBoard();
    } catch (err) { state.error = err.message; renderAuth(); }
  };
}

// ---------------- 보드 ----------------

async function loadBoard() {
  state.data = await api('/api/board');
  state.user = state.data.me;
  state.stats = await api('/api/stats').catch(() => null);
  renderBoard();
}

function activeWeek() {
  const { weeks, current } = state.data;
  if (state.filter.week === 'all') return null;
  if (state.filter.week === 'current')
    return weeks.find((w) => w.year === current.year && w.week_no === current.week) ?? weeks[0] ?? null;
  return weeks.find((w) => String(w.id) === state.filter.week) ?? null;
}

function visibleCards() {
  const { cards } = state.data;
  const w = activeWeek();
  return cards.filter((c) => {
    if (w && c.week_id !== w.id) return false;
    if (state.filter.diff !== 'all' && String(c.difficulty) !== state.filter.diff) return false;
    if (state.filter.who === 'me' && !c.mine) return false;
    if (state.filter.who !== 'all' && state.filter.who !== 'me' && String(c.user_id) !== state.filter.who) return false;
    return true;
  });
}

function cardHtml(c) {
  const weekOf = state.data.weeks.find((w) => w.id === c.week_id);
  const owner = state.data.members.find((m) => m.id === c.user_id);
  const showWeek = state.filter.week === 'all';
  const moves = STATUSES.filter(([s]) => s !== c.status);
  return `
    <div class="card ${c.mine ? 'mine' : ''}" data-id="${c.id}" ${c.mine ? 'draggable="true"' : ''}>
      <div class="row1">
        <span class="tag src-${c.source}">${c.source === 'leetcode' ? 'LeetCode' : '프로그래머스'}</span>
        <span class="tag d${c.difficulty}">${esc(c.diff_label)}</span>
        ${c.kind === 'random' ? '<span class="tag kind-random">랜덤</span>' : ''}
      </div>
      <a class="title" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.title)}</a>
      <div class="meta">
        ${showWeek && weekOf ? `<span>${weekOf.week_no}주차 · ${esc(weekOf.topic_name)}</span>` : `<span>${esc(c.topics.join(', '))}</span>`}
        <span class="owner">${esc(owner?.display_name ?? '?')}${c.mine ? ' (나)' : ''}</span>
      </div>
      ${c.note_preview ? `<div class="note">${esc(c.note_preview)}${c.note_more ? '…' : ''}</div>` : ''}
      <div class="actions">
        ${c.mine ? moves.map(([s, label]) => `<button data-move="${s}">→ ${label}</button>`).join('') : ''}
        <button class="solve" data-open="1">${c.mine ? (c.has_code ? '풀이 수정' : '풀이 작성') : '풀이 보기'}${c.has_code ? ` <span class="lang">${esc(c.language)}</span>` : ''}</button>
      </div>
    </div>`;
}

function renderBoard() {
  const { weeks, members, current, topics, next_topic } = state.data;
  const w = activeWeek();
  const cards = visibleCards();
  const isAdmin = state.user.role === 'admin';

  app.className = '';
  app.innerHTML = `
    <header>
      <h1>🧩 코딩테스트 스터디</h1>
      ${w ? `<span class="week-title">${w.year}년 ${w.week_no}주차 · <span class="topic">${esc(w.topic_name)}</span></span>` : '<span class="week-title">전체 주차</span>'}
      <div class="spacer"></div>
      <span class="who">${esc(state.user.display_name)} ${isAdmin ? '<span class="badge">관리자</span>' : ''}</span>
      <button id="logout">로그아웃</button>
    </header>

    <div class="toolbar">
      <label>주차</label>
      <select id="fWeek">
        <option value="current">이번 주</option>
        ${weeks.map((x) => `<option value="${x.id}" ${state.filter.week === String(x.id) ? 'selected' : ''}>${x.year} ${x.week_no}주차 — ${esc(x.topic_name)}</option>`).join('')}
        <option value="all" ${state.filter.week === 'all' ? 'selected' : ''}>전체</option>
      </select>
      <label>난이도</label>
      <select id="fDiff">
        <option value="all">전체</option>
        <option value="1" ${state.filter.diff==='1'?'selected':''}>쉬움 (Easy / Lv.1)</option>
        <option value="2" ${state.filter.diff==='2'?'selected':''}>보통 (Medium / Lv.2~3)</option>
        <option value="3" ${state.filter.diff==='3'?'selected':''}>어려움 (Hard / Lv.4+)</option>
      </select>
      <label>멤버</label>
      <select id="fWho">
        <option value="all">전체</option>
        <option value="me" ${state.filter.who==='me'?'selected':''}>나만</option>
        ${members.map((m) => `<option value="${m.id}" ${state.filter.who===String(m.id)?'selected':''}>${esc(m.display_name)}</option>`).join('')}
      </select>
      <span class="hint">내 카드는 드래그하거나 버튼으로 옮길 수 있어요</span>
    </div>

    <main>
      ${isAdmin ? adminPanel(topics, next_topic, current) : ''}
      ${statsPanel()}
      <div class="columns">
        ${STATUSES.map(([s, label]) => {
          const list = cards.filter((c) => c.status === s);
          return `<section class="col" data-status="${s}">
            <h2><span class="dot ${s}"></span>${label}<span class="count">${list.length}</span></h2>
            ${list.length ? list.map(cardHtml).join('') : '<div class="empty">카드가 없습니다.</div>'}
          </section>`;
        }).join('')}
      </div>
    </main>`;

  wire();
}

function adminPanel(topics, nextTopic, current) {
  return `<div class="panel">
    <h3>관리자</h3>
    <div class="line">
      <button id="genWeek" class="primary">주차 생성</button>
      <select id="genTopic">
        <option value="">자동 (다음 순서: ${esc(nextTopic ?? '-')})</option>
        ${topics.map((t) => `<option value="${t.slug}">${esc(t.name)}</option>`).join('')}
      </select>
      <span class="hint">이번 주(${current.year}-${current.week}주차)는 서버가 자동 생성합니다.</span>
      <button id="collect">문제 다시 수집</button>
    </div>
    <div class="log" id="log" hidden></div>
  </div>`;
}

function statsPanel() {
  if (!state.stats) return '';
  return `<div class="panel">
    <h3>진행 현황 <span class="hint">· 문제 풀 ${state.stats.total}개</span></h3>
    <div class="rank">
      ${state.stats.ranking.map((r) => `<div>${esc(r.display_name)} <b>${r.done}</b>/${r.total}</div>`).join('')}
    </div>
  </div>`;
}

// ---------------- 이벤트 ----------------

async function patch(id, body) {
  try { await api(`/api/assignments/${id}`, { method: 'PATCH', body }); await loadBoard(); }
  catch (e) { alert(e.message); }
}

function wire() {
  app.querySelector('#logout').onclick = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    state.user = null; state.data = null; state.mode = 'login'; renderAuth();
  };
  const bind = (id, key) => {
    const el = app.querySelector(id);
    el.onchange = () => { state.filter[key] = el.value; renderBoard(); };
  };
  bind('#fWeek', 'week'); bind('#fDiff', 'diff'); bind('#fWho', 'who');

  app.querySelectorAll('[data-move]').forEach((b) => {
    b.onclick = () => patch(b.closest('.card').dataset.id, { status: b.dataset.move });
  });
  app.querySelectorAll('[data-open]').forEach((b) => {
    b.onclick = () => openSolutionModal(b.closest('.card').dataset.id);
  });

  // 드래그 앤 드롭
  let dragId = null;
  app.querySelectorAll('.card[draggable="true"]').forEach((el) => {
    el.ondragstart = () => { dragId = el.dataset.id; el.classList.add('dragging'); };
    el.ondragend = () => el.classList.remove('dragging');
  });
  app.querySelectorAll('.col').forEach((col) => {
    col.ondragover = (e) => { e.preventDefault(); col.classList.add('drop'); };
    col.ondragleave = () => col.classList.remove('drop');
    col.ondrop = (e) => {
      e.preventDefault(); col.classList.remove('drop');
      if (dragId) patch(dragId, { status: col.dataset.status });
      dragId = null;
    };
  });

  const gen = app.querySelector('#genWeek');
  if (gen) {
    gen.onclick = async () => {
      gen.disabled = true;
      try {
        await api('/api/weeks/generate', { method: 'POST', body: { topic_slug: app.querySelector('#genTopic').value } });
        await loadBoard();
      } catch (e) { alert(e.message); gen.disabled = false; }
    };
    const col = app.querySelector('#collect');
    col.onclick = async () => {
      col.disabled = true; col.textContent = '수집 중… (1~2분)';
      const log = app.querySelector('#log'); log.hidden = false; log.textContent = '시작…';
      try {
        const r = await api('/api/collect', { method: 'POST', body: {} });
        log.textContent = r.log.join('\n');
        await loadBoard();
      } catch (e) { log.textContent = '실패: ' + e.message; col.disabled = false; col.textContent = '문제 다시 수집'; }
    };
  }
}


// ---------------- 풀이 모달 ----------------

const LANG_LABEL = { python:'Python', javascript:'JavaScript', typescript:'TypeScript', java:'Java',
  cpp:'C++', c:'C', csharp:'C#', go:'Go', rust:'Rust', kotlin:'Kotlin', swift:'Swift',
  ruby:'Ruby', sql:'SQL', text:'기타' };

const ago = (iso) => {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z'))) / 1000;
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
};

const STATUS_LABEL = Object.fromEntries(STATUSES);

function closeModal() {
  document.getElementById('modal')?.remove();
  document.body.style.overflow = '';
}

async function openSolutionModal(assignmentId) {
  let data;
  try { data = await api(`/api/assignments/${assignmentId}/solutions`); }
  catch (e) { return alert(e.message); }

  const { problem, week, languages, solutions } = data;
  const mine = solutions.find((s) => s.mine);
  const others = solutions.filter((s) => !s.mine);
  const written = others.filter((s) => s.code || s.note);

  const wrap = document.createElement('div');
  wrap.id = 'modal';
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div>
          <div class="modal-tags">
            <span class="tag src-${problem.source}">${problem.source === 'leetcode' ? 'LeetCode' : '프로그래머스'}</span>
            <span class="tag d${problem.difficulty}">${esc(problem.diff_label)}</span>
            <span class="hint">${week.year}년 ${week.week_no}주차 · ${esc(week.topic_name)}</span>
          </div>
          <h2>${esc(problem.title)}</h2>
          <a class="hint" href="${esc(problem.url)}" target="_blank" rel="noopener">문제 풀러 가기 ↗</a>
        </div>
        <button class="close" aria-label="닫기">✕</button>
      </div>

      <div class="modal-body">
        ${mine ? `
        <section class="editor">
          <div class="sec-head">
            <h3>내 풀이</h3>
            <select id="mStatus">
              ${STATUSES.map(([v, l]) => `<option value="${v}" ${mine.status === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
            <select id="mLang">
              ${languages.map((l) => `<option value="${l}" ${mine.language === l ? 'selected' : ''}>${LANG_LABEL[l] ?? l}</option>`).join('')}
            </select>
            <span class="hint" id="saveState"></span>
            <button class="primary" id="mSave">저장</button>
          </div>
          <label class="fl">풀이 코드 <span class="hint">Tab 으로 들여쓰기</span></label>
          <textarea id="mCode" class="code" spellcheck="false" placeholder="여기에 풀이 코드를 붙여넣으세요">${esc(mine.code)}</textarea>
          <label class="fl">설명 <span class="hint">접근 방법, 시간복잡도, 막혔던 부분</span></label>
          <textarea id="mNote" class="note-area" placeholder="예) 해시맵에 이름별 개수를 세고 participant를 순회하며 차감. O(n)"></textarea>
          <label class="fl">참고 링크 <span class="hint">GitHub, 블로그 등 (선택)</span></label>
          <input id="mUrl" placeholder="https://github.com/..." value="${esc(mine.solution_url)}">
        </section>` : ''}

        <section class="others">
          <div class="sec-head"><h3>스터디원 풀이 <span class="hint">${written.length} / ${others.length}명 작성</span></h3></div>
          ${others.length === 0 ? '<p class="empty">아직 다른 멤버가 없습니다.</p>' : others.map((s) => `
            <details class="sol" ${s.code || s.note ? '' : 'data-empty="1"'}>
              <summary>
                <span class="dot ${s.status}"></span>
                <b>${esc(s.display_name)}</b>
                <span class="hint">${STATUS_LABEL[s.status]}${s.code ? ` · ${esc(LANG_LABEL[s.language] ?? s.language)}` : ''}</span>
                <span class="hint pushr">${s.code || s.note ? ago(s.updated_at) : '미작성'}</span>
              </summary>
              <div class="sol-body">
                ${s.note ? `<div class="sol-note">${esc(s.note)}</div>` : ''}
                ${s.code ? `<div class="code-block"><button class="copy" data-code="${esc(s.code)}">복사</button><pre>${esc(s.code)}</pre></div>` : ''}
                ${s.solution_url ? `<a class="hint" href="${esc(s.solution_url)}" target="_blank" rel="noopener">참고 링크 ↗</a>` : ''}
                ${!s.code && !s.note ? '<p class="empty">아직 풀이를 작성하지 않았습니다.</p>' : ''}
              </div>
            </details>`).join('')}
        </section>
      </div>
    </div>`;

  document.body.appendChild(wrap);
  document.body.style.overflow = 'hidden';
  if (mine) wrap.querySelector('#mNote').value = mine.note;

  const close = () => { closeModal(); loadBoard(); };
  wrap.querySelector('.close').onclick = close;
  wrap.onclick = (e) => { if (e.target === wrap) close(); };
  document.addEventListener('keydown', function esc2(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc2); }
  });

  wrap.querySelectorAll('.copy').forEach((b) => {
    b.onclick = async () => {
      await navigator.clipboard.writeText(b.dataset.code);
      b.textContent = '복사됨'; setTimeout(() => (b.textContent = '복사'), 1200);
    };
  });

  if (!mine) return;

  // Tab 키로 들여쓰기 (포커스 이동 대신)
  const code = wrap.querySelector('#mCode');
  code.onkeydown = (e) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const { selectionStart: a, selectionEnd: b, value } = code;
    code.value = value.slice(0, a) + '    ' + value.slice(b);
    code.selectionStart = code.selectionEnd = a + 4;
  };

  const saveBtn = wrap.querySelector('#mSave');
  const saveState = wrap.querySelector('#saveState');
  const save = async ({ silent = false } = {}) => {
    saveBtn.disabled = true;
    saveState.textContent = '저장 중…';
    try {
      await api(`/api/assignments/${mine.id}`, { method: 'PATCH', body: {
        status: wrap.querySelector('#mStatus').value,
        language: wrap.querySelector('#mLang').value,
        code: code.value,
        note: wrap.querySelector('#mNote').value,
        solution_url: wrap.querySelector('#mUrl').value,
      }});
      saveState.textContent = `저장됨 · ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
      if (!silent) { closeModal(); await loadBoard(); }
    } catch (e) { saveState.textContent = ''; alert(e.message); }
    finally { saveBtn.disabled = false; }
  };
  saveBtn.onclick = () => save();

  // 자동 저장 — 입력이 멈추고 2초 뒤
  let timer;
  const touch = () => { clearTimeout(timer); saveState.textContent = '변경됨'; timer = setTimeout(() => save({ silent: true }), 2000); };
  ['#mCode', '#mNote', '#mUrl'].forEach((sel) => (wrap.querySelector(sel).oninput = touch));
  ['#mStatus', '#mLang'].forEach((sel) => (wrap.querySelector(sel).onchange = touch));
}

// ---------------- 시작 ----------------
try {
  const { user } = await api('/api/me');
  if (user) { state.user = user; await loadBoard(); } else renderAuth();
} catch { renderAuth(); }
