(function () {
'use strict';
const S = window.TSC_STORE;
const STAGES = ['현설공고', '참가신청', '현설', '견적산출', '서류제출', '입찰', '관련서류', '수주여부', 'P.O발행', '착공서류', '착공', '준공', '준공서류', '정산'];
const PHASES = [{ n: '입찰 준비', c: 'p1', r: [0, 3] }, { n: '입찰', c: 'p2', r: [4, 7] }, { n: '착공', c: 'p3', r: [8, 10] }, { n: '준공·정산', c: 'p4', r: [11, 13] }];
const phaseOf = (i) => PHASES.find((p) => i >= p.r[0] && i <= p.r[1]);
const CATS = { FC: 'FC·서브허브', MB: '모바일캠프', ETC: '기타' };
const INFO_KEYS = ['현설 일시', '입찰 일정', '견적 제출기한', '착공서류 제출기한', '공사기간', '준공서류 제출기한', '비고'];
const INFO_LABEL = { '현설 일시': '현설', '입찰 일정': '입찰', '견적 제출기한': '견적 제출', '착공서류 제출기한': '착공서류', '공사기간': '공사 시작', '준공서류 제출기한': '준공서류' };
const STAGE_LABEL = { 4: '견적 제출' };
const AMOUNT_KEYS = ['견적금액', '결정금액', '준공·정산금액'];

const st = { sites: [], secrets: {}, editing: true, cat: 'ALL', q: '', hideDone: true, logFilter: 'all', calMonth: null, calSel: null, open: null, activity: [] };
const $app = document.getElementById('app'), $layer = document.getElementById('layer');

// ───── 아이콘 ─────
const IC = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  list: '<rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  back: '<path d="M15 6l-6 6 6 6"/>', dl: '<path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/>', cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  next: '<path d="M9 6l6 6-6 6"/>',
};
const ic = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ───── 날짜 ─────
const day0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const TODAY = () => day0(new Date());
const md = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
const key = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const WD = ['일', '월', '화', '수', '목', '금', '토'];
function parseDate(text, year) {
  if (!text) return null;
  let m = String(text).match(/(\d{2})\.(\d{1,2})\.(\d{1,2})/);
  if (m) return new Date(2000 + +m[1], +m[2] - 1, +m[3]);
  m = String(text).match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (m && +m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= 31) return new Date(year || new Date().getFullYear(), +m[1] - 1, +m[2]);
  return null;
}
function allDates(text, year) {
  const out = []; const re = /(\d{1,2})\s*\/\s*(\d{1,2})/g; let m;
  while ((m = re.exec(text || ''))) if (+m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= 31) out.push({ d: new Date(year, +m[1] - 1, +m[2]), i: m.index });
  return out;
}
const dday = (d) => { const n = Math.round((d - TODAY()) / 864e5); return n === 0 ? 'D-DAY' : n > 0 ? 'D-' + n : 'D+' + -n; };
const ddCls = (d) => { const n = Math.round((d - TODAY()) / 864e5); return n >= 0 && n <= 7 ? 'd' + n : ''; };

// ───── 단계 상태 ─────
function stageState(v, year) {
  v = String(v || '').trim();
  if (!v) return 'none';
  if (/^n\/?a$/i.test(v) || /취소/.test(v)) return 'skip';
  if (/진행|작성\s*중/.test(v)) return 'now';
  if (/대기|△/.test(v)) return 'wait';
  if (/^[ⅩX✕×]$/.test(v) || /실주|탈락/.test(v)) return 'lost';
  if (/^[○O◯oㅇ✓]/.test(v) || /완료/.test(v)) return 'done';
  const d = parseDate(v, year);
  if (d) return d < TODAY() ? 'done' : 'plan';
  return 'done';
}
function siteStatus(s) {
  const states = s.stages.map((v) => stageState(v, s.year));
  if (s.closed) return { label: s.closed, cls: '', states, active: false };
  if (states[7] === 'lost') return { label: '실주', cls: '', states, active: false };
  if (states[13] === 'done') return { label: '완료', cls: 'ok', states, active: false };
  const w = states.findIndex((x) => x === 'now' || x === 'wait');
  const p = states.findIndex((x) => x === 'plan');
  let last = -1; states.forEach((x, i) => { if (x !== 'none') last = i; });
  let idx, text;
  if (w >= 0 && (p < 0 || w <= p)) { idx = w; text = `${STAGES[w]} ${s.stages[w].replace(/\s+/g, ' ')}`; }
  else if (p >= 0) { idx = p; text = `${STAGES[p]} 예정 ${s.stages[p].replace(/\s+/g, ' ')}`; }
  else { idx = Math.min(last + 1, 13); text = last < 0 ? '시작 전' : `다음: ${STAGES[idx]}`; }
  const ph = phaseOf(idx);
  return { label: ph.n, cls: ph.c, text, states, active: true, idx };
}
const openIssues = (s) => s.logs.filter((l) => l.kind === '이슈' && !l.done);
const photoCount = (s) => s.logs.reduce((n, l) => n + (l.photos || []).length, 0);
const lastLog = (s) => { const ds = s.logs.map((l) => parseDate(l.date, s.year)).filter(Boolean).sort((a, b) => b - a); return ds[0]; };

// ───── 일정 모으기 ─────
function events() {
  const map = new Map();
  const add = (s, d, label, text, ph) => {
    if (!d) return;
    const k = s.id + '|' + key(d);
    const e = map.get(k) || { site: s, date: d, labels: [], texts: [], ph };
    if (!e.labels.includes(label)) e.labels.push(label);
    if (text && !e.texts.includes(text)) e.texts.push(text);
    if (!e.ph) e.ph = ph;
    map.set(k, e);
  };
  st.sites.forEach((s) => {
    if (s.closed) return;
    s.stages.forEach((v, i) => { const d = parseDate(v, s.year); if (d && stageState(v, s.year) !== 'skip') add(s, d, STAGE_LABEL[i] || STAGES[i], v.replace(/\s+/g, ' '), phaseOf(i).c); });
    Object.entries(s.info || {}).forEach(([k, v]) => {
      if (!INFO_LABEL[k]) return;
      const d = parseDate(v, s.year); const ph = { '현설 일시': 'p1', '입찰 일정': 'p2', '견적 제출기한': 'p2', '착공서류 제출기한': 'p3', '공사기간': 'p3', '준공서류 제출기한': 'p4' }[k];
      add(s, d, INFO_LABEL[k], v.replace(/\s+/g, ' '), ph);
    });
    s.logs.forEach((l) => {
      const ld = parseDate(l.date, s.year);
      allDates(l.text + ' ' + (l.result || ''), s.year).forEach(({ d, i }) => {
        if (ld && d <= ld) return;
        const src = (l.text + ' ' + (l.result || ''));
        const snip = src.slice(Math.max(0, i - 18), i + 22).replace(/\s+/g, ' ').trim();
        add(s, d, '기록', snip, 'p0');
      });
    });
  });
  return [...map.values()].sort((a, b) => a.date - b.date);
}
function waiting() {
  const out = [];
  st.sites.forEach((s) => {
    if (s.closed) return;
    const ss = siteStatus(s); if (!ss.active) return;
    s.stages.forEach((v, i) => { const x = stageState(v, s.year); if (x === 'now' || x === 'wait') out.push({ site: s, label: STAGES[i], text: v.replace(/\s+/g, ' ') }); });
    Object.entries(s.info || {}).forEach(([k, v]) => { if (INFO_LABEL[k] && /예정|통보/.test(v) && !parseDate(v, s.year)) out.push({ site: s, label: INFO_LABEL[k], text: v }); });
  });
  return out;
}

// ───── 화면 공통 ─────
const ROUTES = [['home', '홈', 'home'], ['sites', '현장', 'list'], ['calendar', '달력', 'cal']];
function nav(cur) {
  const h = ROUTES.map(([r, n, i]) => `<a href="#${r}" class="${cur === r ? 'on' : ''}">${ic(i)}<span>${n}</span></a>`).join('');
  document.getElementById('nav').innerHTML = h;
  document.getElementById('bnav').innerHTML = h;
}
function editBtn() {
  document.body.classList.toggle('editing', st.editing); return;
  document.getElementById('editbtn').innerHTML = st.editing ? `${ic('unlock')}<span>수정 중 · 나가기</span>` : `${ic('lock')}<span>수정 모드</span>`;
}
function toast(msg) { document.querySelectorAll('.toast').forEach((x) => x.remove()); const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
const siteById = (id) => st.sites.find((s) => s.id === id);
const go = (h) => { if (location.hash === '#' + h) render(); else location.hash = h; };

// ───── 홈 ─────
// ───── 차례(우리/쿠팡/모름/끝) ─────
const TURNS = ['우리', '쿠팡', '모름', '끝'];
const plan = (s) => ({ turn: (s.info || {})._turn || '', next: (s.info || {})._next || '', due: (s.info || {})._due || '', since: (s.info || {})._since || '' });
const daysSince = (s, t) => { const d = parseDate(t, s.year); return d ? Math.max(0, Math.round((TODAY() - d) / 864e5)) : null; };
function buckets() {
  const todo = [], unknown = [], wait = [];
  st.sites.forEach((s) => {
    if (s.closed) return;
    const p = plan(s); if (!p.turn || p.turn === '끝') return;
    const age = daysSince(s, p.since);
    const due = parseDate(p.due, s.year);
    if (p.turn === '우리' && due) todo.push({ s, p, due });
    else if (p.turn === '쿠팡' && (age == null || age <= 14)) wait.push({ s, p, age });
    else unknown.push({ s, p, age, q: p.turn === '쿠팡' ? (p.next || '결과') + '?' : (p.next || '다음 할 일?') });
  });
  todo.sort((a, b) => a.due - b.due);
  wait.sort((a, b) => (b.age || 0) - (a.age || 0));
  const g = new Map();
  unknown.forEach((u) => { const k = u.q + '|' + u.p.since; const e = g.get(k); if (e) e.more.push(u.s); else g.set(k, { ...u, more: [] }); });
  const unk = [...g.values()].sort((a, b) => (b.age || 0) - (a.age || 0));
  return { todo, unknown: unk, wait };
}
function flowOf(s) {
  const x = s.stages.map((v) => stageState(v, s.year));
  const FCF = [['현설', [0, 1, 2]], ['견적', [3, 4]], ['입찰', [5, 6]], ['수주', [7]], ['P.O', [8]], ['착공서류', [9]], ['시공', [10, 11]], ['준공', [12, 13]]];
  const CPF = [['현설', [0, 1, 2]], ['견적', [3, 4, 5, 6]], ['결과', [7, 8]], ['시공', [9, 10, 11]], ['준공', [12, 13]]];
  const F = s.cat === 'FC' ? FCF : CPF;
  const ph = F.map(([label, idx]) => {
    const v = idx.map((i) => x[i]);
    const k = v.some((y) => y === 'now' || y === 'wait') ? 'now' : v.some((y) => y === 'done' || y === 'lost') ? 'done' : v.every((y) => y === 'skip') ? 'skip' : v.some((y) => y === 'plan') ? 'plan' : 'todo';
    return { label, k };
  });
  if (!ph.some((p) => p.k === 'now')) {
    let last = -1; ph.forEach((p, i) => { if (p.k === 'done') last = i; });
    const nx = ph.findIndex((p, i) => i > last && p.k !== 'skip');
    if (nx >= 0) ph[nx].k = plan(s).turn === '모름' ? 'unk' : 'now';
  }
  return ph;
}
const ddText = (d) => { const n = Math.round((d - TODAY()) / 864e5); return n < 0 ? `${-n}일 지남` : n === 0 ? '오늘' : n === 1 ? '내일' : `D-${n}`; };
const ddLevel = (d) => { const n = Math.round((d - TODAY()) / 864e5); return n <= 0 ? 'now' : n <= 3 ? 'soon' : 'later'; };

function viewHome() {
  const { todo, unknown, wait } = buckets();
  const urgent = todo.filter((t) => ddLevel(t.due) === 'now');
  const op = st.open;
  const item = (id, head, body) => `<button class="tcard ${op === id ? 'open' : ''}" data-open="${id}">${head}${op === id && body ? `<span class="tmore">${body}<span class="tgo" data-site-go="${id.split('|')[1]}">현장 보기 ›</span></span>` : ''}</button>`;
  const flows = st.sites.filter((s) => !s.closed && plan(s).turn && plan(s).turn !== '끝');
  const turnCls = { 우리: 'tu', 쿠팡: 'tc', 모름: 'tm' };
  return `
  ${urgent.length ? `<section class="alarm"><span class="alarm-k">오늘 마감</span>${urgent.map((t) => `<button class="alarm-i" data-site="${t.s.id}"><b>${esc(t.s.short)}</b> ${esc(t.p.next)}<span>${esc(t.p.due)}</span></button>`).join('')}</section>` : ''}
  <div class="hrow"><h1 class="headline"><span class="hl-r">할 일 ${todo.length}</span> · <span class="hl-a">알아낼 일 ${unknown.length}</span> · 기다림 ${wait.length}</h1><button class="btn pri" data-act="paste">Claude 붙여넣기</button></div>
  <section class="three">
    <div class="col">
      <h2 class="ch red">할 일</h2>
      ${todo.map((t) => item('t|' + t.s.id, `<span class="tline ${ddLevel(t.due)}"><span class="tdd">${ddText(t.due)}</span><span class="tt"><b>${esc(t.s.short)}</b> ${esc(t.p.next)}</span></span>`, `${esc(t.p.due)} · ${esc(t.s.name)}`)).join('') || '<div class="none">급한 일이 없어요</div>'}
    </div>
    <div class="col">
      <h2 class="ch amber">알아낼 일</h2>
      ${unknown.map((u) => item('u|' + u.s.id, `<span class="uline"><span class="tt"><b>${esc(u.s.short)}${u.more.length ? ` 외 ${u.more.length}곳` : ''}</b> · ${esc(u.q)}</span>${u.age != null ? `<span class="uage">${u.age}일</span>` : ''}</span>`, `${u.p.since ? esc(u.p.since) + ' 부터' : '기준일 없음'}${u.more.length ? ' · ' + [u.s, ...u.more].map((x) => esc(x.short)).join(', ') : ''}`)).join('') || '<div class="none">모르는 게 없어요</div>'}
    </div>
    <div class="col">
      <h2 class="ch">기다림</h2>
      ${wait.map((w) => item('w|' + w.s.id, `<span class="uline"><span class="tt"><b>${esc(w.s.short)}</b></span>${w.age != null ? `<span class="wage">${w.age}일</span>` : ''}</span><span class="wbar"><i style="width:${Math.min(100, ((w.age || 0) / 14) * 100).toFixed(0)}%"></i></span>`, `${esc(w.p.next || '결과 대기')} · ${esc(w.p.since)} 부터`)).join('') || '<div class="none">기다리는 건이 없어요</div>'}
    </div>
  </section>
  ${st.activity.length ? `<section>
    <h2 class="ch">최근 반영</h2>
    <div class="feed">${st.activity.slice(0, 15).map((a) => { const s = siteById(a.site_id); const id = 'a|' + a.site_id + '|' + a.id; const t = new Date(a.at); return `<button class="fitem ${st.open === id ? 'open' : ''}" data-open="${id}"><span class="fwhen">${t.getMonth() + 1}/${t.getDate()} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}</span><span class="fwho ${a.who === 'AI' ? 'ai' : ''}">${esc(a.who)}</span><span class="fsite">${esc(s ? s.short : '')}</span><span class="fsum">${esc(a.summary)}</span>${st.open === id ? `<span class="factions"><span class="fa" data-feed="fix" data-aid="${a.id}">고치기</span><span class="fa" data-site-go="${esc(a.site_id)}">현장 보기</span><span class="fa dim" data-feed="del" data-aid="${a.id}">목록에서 빼기</span></span>` : ''}</button>`; }).join('')}</div>
  </section>` : ''}
  <section>
    <h2 class="ch">현장별 흐름</h2>
    <div class="tbl-wrap"><div class="flows">
      ${flows.map((s) => `<button class="frow" data-site="${s.id}"><span class="fname"><b>${esc(s.short)}</b><small>${s.cat === 'FC' ? 'FC' : s.cat === 'MB' ? '캠프' : '기타'}</small></span><span class="fsteps">${flowOf(s).map((p) => `<i class="fs ${p.k}">${esc(p.label)}${p.k === 'unk' ? ' ?' : ''}</i>`).join('')}</span><span class="fturn ${turnCls[plan(s).turn] || ''}">${esc(plan(s).turn)}</span></button>`).join('')}
    </div></div>
  </section>`;
}

// ───── 현장 목록 ─────
function viewSites() {
  const q = st.q.trim().toLowerCase();
  let list = st.sites.filter((s) => (st.cat === 'ALL' || s.cat === st.cat) && (!q || (s.name + s.short + s.memo).toLowerCase().includes(q)));
  if (st.hideDone) list = list.filter((s) => siteStatus(s).active);
  const counts = (c) => st.sites.filter((s) => (c === 'ALL' || s.cat === c) && (!st.hideDone || siteStatus(s).active)).length;
  const card = (s) => {
    const ss = siteStatus(s), oi = openIssues(s).length, pc = photoCount(s), ll = lastLog(s);
    return `<button class="card ${ss.active ? '' : 'closed'}" data-site="${s.id}">
      <div class="card-h"><h3>${esc(s.name)}</h3><span class="pill ${ss.cls}">${esc(ss.label)}</span></div>
      <div class="st">${plan(s).turn ? `<span class="ct t-${plan(s).turn}">${esc(plan(s).turn)}</span> ` : ''}${esc(plan(s).next || ss.text || s.memo || '')}${plan(s).due ? ` · ${esc(plan(s).due)}` : ''}</div>
      <div class="bar">${ss.states.map((x, i) => `<i class="${x}" title="${STAGES[i]}"></i>`).join('')}</div>
      <div class="meta">${oi ? `<span class="pill danger">이슈 ${oi}</span>` : ''}<span>기록 ${s.logs.length}</span><span>사진 ${pc}</span>${ll ? `<span>최근 ${md(ll)}</span>` : ''}<span style="margin-left:auto">${CATS[s.cat]}</span></div>
    </button>`;
  };
  return `
  <div class="tools">
    <div class="seg" role="tablist">${[['ALL', '전체'], ['FC', CATS.FC], ['MB', CATS.MB], ['ETC', CATS.ETC]].map(([c, n]) => `<button data-cat="${c}" class="${st.cat === c ? 'on' : ''}">${n} <span class="num">${counts(c)}</span></button>`).join('')}</div>
    <input class="search" id="q" type="search" placeholder="현장 이름 찾기" value="${esc(st.q)}">
    <label class="chk"><input type="checkbox" id="hide" ${st.hideDone ? 'checked' : ''}> 끝난 현장 숨기기</label>
    <span style="margin-left:auto;display:flex;gap:8px"><button class="btn ed" data-act="paste">${ic('edit')}Claude 변경 붙여넣기</button><button class="btn ed" data-act="add-site">${ic('plus')}현장 추가</button><button class="btn" data-act="excel">${ic('dl')}엑셀로 받기</button></span>
  </div>
  <div class="legend"><span><i style="background:var(--accent)"></i>완료</span><span><i style="background:var(--warn)"></i>진행·대기</span><span><i style="box-shadow:inset 0 0 0 1.5px var(--accent)"></i>예정</span><span><i style="background:repeating-linear-gradient(45deg,var(--line) 0 3px,transparent 3px 6px)"></i>해당 없음</span><span><i style="background:var(--line)"></i>미진행</span><span>막대 14칸 = ${STAGES[0]} → ${STAGES[13]}</span></div>
  ${list.length ? `<div class="cards">${list.map(card).join('')}</div>` : '<div class="panel"><div class="empty">조건에 맞는 현장이 없어요.</div></div>'}`;
}

// ───── 현장 상세 ─────
function viewSite(id) {
  const s = siteById(id);
  if (!s) return `<a class="back" href="#sites">${ic('back')}현장 목록</a><div class="panel"><div class="empty">현장을 찾을 수 없어요.</div></div>`;
  const ss = siteStatus(s), sec = st.secrets && st.secrets[s.id];
  let logs = [...s.logs].sort((a, b) => (parseDate(b.date, s.year) || 0) - (parseDate(a.date, s.year) || 0));
  if (st.logFilter === 'issue') logs = logs.filter((l) => l.kind === '이슈');
  if (st.logFilter === 'open') logs = logs.filter((l) => l.kind === '이슈' && !l.done);
  const info = INFO_KEYS.filter((k) => (s.info || {})[k]).map((k) => `<div class="k">${k === '비고' ? '주소·비고' : k}</div><div>${esc(s.info[k])}</div>`).join('');
  const logHtml = (l) => `<div class="log ${l.kind === '이슈' && !l.done ? 'open' : ''}">
    <div class="ld">${esc(l.date)}</div>
    <div class="lb">
      ${l.kind === '이슈' ? `<span class="pill ${l.done ? 'ok' : 'danger'}" style="margin-bottom:4px">${l.done ? '해결' : '미해결 이슈'}</span> ` : ''}
      <div class="lt">${esc(l.text)}</div>
      ${l.result || l.note ? `<div class="lr">${esc([l.result, l.note].filter(Boolean).join('\n'))}</div>` : ''}
      ${(l.photos || []).length ? `<div class="thumbs">${l.photos.map((p) => `<img src="${esc(p)}" alt="현장 사진" data-view="${esc(p)}" loading="lazy">`).join('')}</div>` : ''}
      <div class="ed" style="gap:4px;margin-top:6px">${l.kind === '이슈' ? `<button class="mini" data-act="toggle-log" data-id="${l.id}">${l.done ? '미해결로 되돌리기' : '해결 처리'}</button>` : ''}<button class="mini" data-act="edit-log" data-id="${l.id}">고치기</button></div>
    </div></div>`;
  return `
  <a class="back" href="#sites">${ic('back')}현장 목록</a>
  <div class="d-head">
    <div><h2>${esc(s.name)}</h2><div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap"><span class="pill">${CATS[s.cat]}${s.kind ? ' · ' + esc(s.kind) : ''}</span></div></div>
    <div style="display:flex;gap:8px"><button class="btn ed" data-act="edit-site">${ic('edit')}기본정보 고치기</button><button class="btn" data-act="excel-one">${ic('dl')}엑셀</button></div>
  </div>
  <section class="planbox">
    <div class="pturns">${TURNS.map((t) => `<button class="pt ${plan(s).turn === t ? 'on t-' + t : ''}" data-act="set-turn" data-t="${t}">${t === '끝' ? '끝남' : t + ' 차례'}</button>`).join('')}</div>
    <button class="pnext" data-act="edit-plan"><span class="pk">다음</span><b>${esc(plan(s).next || '정해지지 않음')}</b>${plan(s).due ? `<span class="pdue">${esc(plan(s).due)}</span>` : ''}${plan(s).since ? `<span class="psince">${esc(plan(s).since)}부터</span>` : ''}<span class="pedit">고치기</span></button>
  </section>
  <section>
    <div class="sec-h"><h2>진행 단계</h2>${st.editing ? '<span class="sub">칸을 누르면 고칠 수 있어요</span>' : ''}</div>
    <div class="stages">${s.stages.map((v, i) => `<button class="stage ${ss.states[i]}" data-act="edit-stage" data-i="${i}"><div class="n">${i + 1}. ${STAGES[i]}</div><div class="v">${esc(v || '–')}</div></button>`).join('')}</div>
  </section>
  <div class="grid2">
    <section><div class="sec-h"><h2>기본 정보</h2></div>
      <div class="panel">${info ? `<div class="kv">${info}</div>` : '<div class="empty">입력된 정보가 없어요.</div>'}${s.memo ? `<div class="kv"><div class="k" style="border-top:1px solid var(--line)">메모</div><div style="border-top:1px solid var(--line)">${esc(s.memo)}</div></div>` : ''}</div>
    </section>
    <section><div class="sec-h"><h2>금액·연락처</h2>${st.editing ? '<button class="mini" data-act="edit-secret">고치기</button>' : ''}</div>
      <div class="panel">${st.editing ? `<div class="kv">${AMOUNT_KEYS.map((k) => `<div class="k">${k}</div><div class="num">${esc(sec?.amounts?.[k] || '–')}</div>`).join('')}<div class="k">연락처</div><div>${esc(sec?.contact || '–')}</div></div>` : `<div class="lockbox">${ic('lock')}수정 모드에서 비밀번호를 넣으면 보여요.</div>`}</div>
    </section>
  </div>
  <section>
    <div class="sec-h"><h2>진행 기록·이슈 <span class="num" style="color:var(--muted);font-weight:400">${s.logs.length}</span></h2>
      <div style="display:flex;gap:8px;align-items:center"><div class="seg">${[['all', '전체'], ['issue', '이슈만'], ['open', '미해결']].map(([k, n]) => `<button data-lf="${k}" class="${st.logFilter === k ? 'on' : ''}">${n}</button>`).join('')}</div><button class="btn pri ed" data-act="add-log">${ic('plus')}기록 추가</button></div></div>
    <div class="panel">${logs.length ? logs.map(logHtml).join('') : '<div class="empty">기록이 없어요. 수정 모드에서 현설 내용, 질의회신, 사진을 올려보세요.</div>'}</div>
  </section>
  <section>
    <div class="sec-h"><h2>제출 서류 <span class="num" style="color:var(--muted);font-weight:400">${s.docs.length}</span></h2><button class="btn ed" data-act="add-doc">${ic('plus')}서류 추가</button></div>
    <div class="panel tbl-wrap">${s.docs.length ? `<table class="docs"><thead><tr><th style="width:70px">제출일</th><th>서류명</th><th>처리</th><th>비고</th>${st.editing ? '<th></th>' : ''}</tr></thead><tbody>${s.docs.map((d) => `<tr><td>${esc(d.date || '–')}</td><td>${esc(d.name)}</td><td>${esc(d.status)}</td><td>${esc(d.note)}</td>${st.editing ? `<td><button class="mini" data-act="edit-doc" data-id="${d.id}">고치기</button></td>` : ''}</tr>`).join('')}</tbody></table>` : '<div class="empty">기록된 제출 서류가 없어요.</div>'}</div>
  </section>`;
}

// ───── 달력 ─────
function viewCalendar() {
  const T = TODAY();
  if (!st.calMonth) st.calMonth = new Date(T.getFullYear(), T.getMonth(), 1);
  const m0 = st.calMonth, y = m0.getFullYear(), m = m0.getMonth();
  const start = new Date(y, m, 1 - m0.getDay());
  const evs = events(); const by = {};
  evs.forEach((e) => (by[key(e.date)] = by[key(e.date)] || []).push(e));
  const sel = st.calSel || (T.getMonth() === m && T.getFullYear() === y ? T : new Date(y, m, 1));
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(y, m, 1 - m0.getDay() + i);
    if (i >= 35 && d.getMonth() !== m) break;
    const list = by[key(d)] || [];
    cells += `<button class="day ${d.getMonth() !== m ? 'out' : ''} ${+d === +T ? 'today' : ''} ${+d === +sel ? 'sel' : ''} ${d.getDay() === 0 ? 'sun' : ''}" data-day="${+d}"><span class="dn">${d.getDate()}</span>${list.slice(0, 3).map((e) => `<span class="ev ${e.ph}" title="${esc(e.site.short + ' ' + e.labels.join(', '))}">${esc(e.site.short)} ${esc(e.labels[0])}</span>`).join('')}${list.length > 3 ? `<span class="more">+${list.length - 3}</span>` : ''}<span class="dots">${list.slice(0, 5).map((e) => `<i class="dot ${e.ph}"></i>`).join('')}</span></button>`;
  }
  const selList = by[key(sel)] || [];
  return `
  <div class="d-head"><div class="cal-h"><button class="btn" data-mon="-1" aria-label="이전 달">${ic('back')}</button><h2>${y}년 ${m + 1}월</h2><button class="btn" data-mon="1" aria-label="다음 달">${ic('next')}</button><button class="btn" data-mon="0">오늘</button></div>
  <div class="legend">${PHASES.map((p) => `<span><i class="dot ${p.c}"></i>${p.n}</span>`).join('')}<span><i class="dot p0"></i>기록 속 날짜</span></div></div>
  <div class="cal">${WD.map((w, i) => `<div class="wd ${i === 0 ? 'sun' : ''}">${w}</div>`).join('')}${cells}</div>
  <section><div class="sec-h"><h2>${md(sel)} (${WD[sel.getDay()]}) 일정</h2></div>
  <div class="panel">${selList.length ? selList.map((e) => `<button class="row" data-site="${e.site.id}"><i class="dot ${e.ph}"></i><span class="main"><span class="t">${esc(e.site.name)} · ${esc(e.labels.join(', '))}</span><span class="s">${esc(e.texts.join(' / '))}</span></span><span class="dday ${ddCls(e.date)}">${dday(e.date)}</span></button>`).join('') : '<div class="empty">이 날은 일정이 없어요.</div>'}</div></section>`;
}

// ───── 렌더 ─────
function render() {
  const h = (location.hash || '#home').slice(1);
  const r = h.startsWith('site-') ? 'sites' : (ROUTES.some((x) => x[0] === h) ? h : 'home');
  nav(r); editBtn();
  $app.innerHTML = h.startsWith('site-') ? viewSite(h.slice(5)) : r === 'sites' ? viewSites() : r === 'calendar' ? viewCalendar() : viewHome();
  const q = document.getElementById('q');
  if (q) q.oninput = (e) => { st.q = e.target.value; const pos = e.target.selectionStart; render(); const n = document.getElementById('q'); n.focus(); n.setSelectionRange(pos, pos); };
  const hide = document.getElementById('hide'); if (hide) hide.onchange = (e) => { st.hideDone = e.target.checked; render(); };
}

// ───── 대화상자 ─────
function dialog(html, onMount) {
  $layer.innerHTML = `<div class="dlg-back"><div class="dlg" role="dialog" aria-modal="true">${html}</div></div>`;
  const back = $layer.firstChild, dlg = back.firstChild;
  const close = () => ($layer.innerHTML = '');
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  dlg.querySelectorAll('[data-close]').forEach((b) => (b.onclick = close));
  const first = dlg.querySelector('input,textarea,select'); if (first) setTimeout(() => first.focus(), 30);
  onMount && onMount(dlg, close);
}
async function guard(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); return true; } catch (e) { toast(e.message || '저장하지 못했어요'); return false; }
}
function askPass() {
  dialog(`<h3>수정 모드</h3><div class="f"><label for="pw">비밀번호</label><input id="pw" type="password" autocomplete="current-password"></div><div class="err" id="pwerr"></div>
  <div class="dlg-f"><button class="btn" data-close>취소</button><button class="btn pri" id="pwok">들어가기</button></div>`, (d, close) => {
    const go2 = async () => {
      const p = d.querySelector('#pw').value; if (!p) { d.querySelector('#pwerr').textContent = '비밀번호를 넣어주세요.'; return; }
      d.querySelector('#pwok').disabled = true;
      const sec = await S.unlock(p).catch(() => null);
      d.querySelector('#pwok').disabled = false;
      if (!sec) { d.querySelector('#pwerr').textContent = '비밀번호가 맞지 않아요.'; return; }
      st.secrets = sec; st.editing = true; try { sessionStorage.setItem('tsc-pw', p); } catch (e) {}
      close(); render(); toast('수정 모드로 바꿨어요');
    };
    d.querySelector('#pwok').onclick = go2;
    d.querySelector('#pw').onkeydown = (e) => { if (e.key === 'Enter') go2(); };
  });
}
function editStage(s, i) {
  const t = TODAY();
  dialog(`<h3>${esc(s.short)} · ${i + 1}. ${STAGES[i]}</h3>
  <div class="f"><label for="sv">내용 (날짜는 11/23처럼, 시간도 같이 적어도 돼요)</label><input id="sv" value="${esc(s.stages[i])}" placeholder="11/23 16시"></div>
  <div class="quick">${[md(t), '○', '진행중', '대기', 'N/A', 'Ⅹ'].map((q) => `<button class="btn" data-q="${esc(q)}">${q === md(t) ? '오늘 ' + q : q}</button>`).join('')}<button class="btn" data-q="">지우기</button></div>
  <div class="dlg-f"><button class="btn" data-close>취소</button><button class="btn pri" id="ok">저장</button></div>`, (d, close) => {
    d.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => (d.querySelector('#sv').value = b.dataset.q)));
    const save = async () => { const v = d.querySelector('#sv').value.trim(); const n = { ...s, stages: [...s.stages] }; n.stages[i] = v; if (await guard(() => S.saveSite(n), '저장했어요')) { s.stages[i] = v; close(); render(); } };
    d.querySelector('#ok').onclick = save; d.querySelector('#sv').onkeydown = (e) => { if (e.key === 'Enter') save(); };
  });
}
function editSite(s) {
  const isNew = !s;
  s = s || { id: S.uid(), cat: st.cat === 'ALL' ? 'FC' : st.cat, name: '', short: '', kind: '', sort: Math.max(0, ...st.sites.map((x) => x.sort || 0)) + 1, year: new Date().getFullYear(), stages: Array(14).fill(''), memo: '', info: {}, logs: [], docs: [] };
  dialog(`<h3>${isNew ? '현장 추가' : '기본정보 고치기'}</h3>
  <div class="f2"><div class="f"><label for="e-cat">구분</label><select id="e-cat">${Object.entries(CATS).map(([k, v]) => `<option value="${k}" ${s.cat === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
  <div class="f"><label for="e-year">기준 연도</label><input id="e-year" type="number" value="${s.year}"></div></div>
  <div class="f"><label for="e-name">현장명 (RFP 명칭)</label><input id="e-name" value="${esc(s.name)}" placeholder="이천 덕평1(DEO1)"></div>
  <div class="f2"><div class="f"><label for="e-short">짧은 이름 (달력·목록용)</label><input id="e-short" value="${esc(s.short)}" placeholder="덕평1"></div>
  <div class="f"><label for="e-kind">분류 (기타 현장)</label><input id="e-kind" value="${esc(s.kind || '')}" placeholder="유지보수, 기타공사"></div></div>
  ${INFO_KEYS.map((k, i) => `<div class="f"><label for="e-i${i}">${k === '비고' ? '주소·비고' : k}</label><input id="e-i${i}" value="${esc((s.info || {})[k] || '')}"></div>`).join('')}
  <div class="f"><label for="e-memo">메모 (목록 카드에 보임)</label><input id="e-memo" value="${esc(s.memo || '')}"></div>
  <label class="chk"><input type="checkbox" id="e-closed" ${s.closed ? 'checked' : ''}> 취소된 공사</label>
  <div class="err" id="e-err"></div>
  <div class="dlg-f">${isNew ? '' : '<button class="btn dan" id="del">현장 삭제</button>'}<span class="sp"></span><button class="btn" data-close>취소</button><button class="btn pri" id="ok">저장</button></div>`, (d, close) => {
    const v = (id) => d.querySelector('#' + id).value.trim();
    d.querySelector('#ok').onclick = async () => {
      if (!v('e-name')) { d.querySelector('#e-err').textContent = '현장명을 넣어주세요.'; return; }
      const info = {}; INFO_KEYS.forEach((k, i) => { const x = v('e-i' + i); if (x) info[k] = x; });
      const n = { ...s, cat: v('e-cat'), year: +v('e-year') || s.year, name: v('e-name'), short: v('e-short') || v('e-name').replace(/\(.*?\)/g, '').trim(), kind: v('e-kind'), info, memo: v('e-memo'), closed: d.querySelector('#e-closed').checked ? '취소' : '' };
      const { logs, docs, ...row } = n;
      if (await guard(() => S.saveSite(n), '저장했어요')) { if (isNew) st.sites.push({ ...row, logs: [], docs: [] }); else Object.assign(s, row); close(); isNew ? go('site-' + n.id) : render(); }
    };
    const del = d.querySelector('#del');
    if (del) del.onclick = () => confirmBox(`'${s.name}' 현장과 기록 ${s.logs.length}건을 지울까요? 되돌릴 수 없어요.`, async () => { if (await guard(() => S.deleteSite(s.id), '삭제했어요')) { st.sites = st.sites.filter((x) => x !== s); go('sites'); } });
  });
}

// ───── Claude 변경 붙여넣기 ─────
const norm = (x) => String(x || '').toLowerCase().replace(/[\s()_\-·]/g, '');
function findSite(q) {
  if (!q) return null; const n = norm(q);
  return st.sites.find((s) => s.id === q) || st.sites.find((s) => norm(s.short) === n || norm(s.name) === n)
    || st.sites.find((s) => norm(s.name).includes(n) || (n.includes(norm(s.short)) && norm(s.short).length >= 2));
}
const STAGE_ALIAS = { '서류제출일': 4, '견적제출': 4, '견적': 3, 'po': 8, 'po발행': 8, '수주': 7, '관련서류제출': 6, '현설공고일': 0 };
function findStage(q) {
  if (typeof q === 'number' || /^\d+$/.test(q)) { const i = +q - 1; return i >= 0 && i < 14 ? i : -1; }
  const n = norm(q).replace(/\./g, ''); const i = STAGES.findIndex((x) => norm(x).replace(/\./g, '') === n);
  return i >= 0 ? i : (STAGE_ALIAS[n] ?? -1);
}
const INFO_ALIAS = { '주소': '비고', '현설': '현설 일시', '입찰': '입찰 일정', '견적제출기한': '견적 제출기한', '착공서류': '착공서류 제출기한', '준공서류': '준공서류 제출기한', '공사기간': '공사기간' };
function findInfoKey(q) { const n = norm(q); return INFO_KEYS.find((k) => norm(k) === n) || INFO_ALIAS[n] || INFO_ALIAS[q] || null; }
function planChanges(list) {
  return list.map((c) => {
    const op = c.op; const s = op === 'site' ? findSite(c.name) : findSite(c.site);
    const bad = (why) => ({ c, ok: false, why, label: `${op} · ${c.site || c.name || '?'}` });
    if (op === 'site') return { c, ok: !!c.name, s, label: s ? `현장 정보 수정 · ${s.short}` : `새 현장 추가 · ${c.name}`, why: c.name ? '' : '현장명 없음' };
    if (!s) return bad('현장을 찾지 못함');
    if (op === 'stage') { const i = findStage(c.stage); if (i < 0) return bad('단계 이름을 모름: ' + c.stage); return { c, ok: true, s, i, label: `${s.short} · ${STAGES[i]}: ${s.stages[i] || '–'} → ${c.value || '(지움)'}` }; }
    if (op === 'info') { const k = findInfoKey(c.key); if (!k) return bad('항목 이름을 모름: ' + c.key); return { c, ok: true, s, k, label: `${s.short} · ${k}: ${c.value}` }; }
    if (op === 'memo') return { c, ok: true, s, label: `${s.short} · 메모: ${c.value}` };
    if (op === 'log') { if (!c.text) return bad('내용 없음'); return { c, ok: true, s, label: `${s.short} · 기록 추가 (${c.date || '날짜 없음'}): ${c.text}` }; }
    if (op === 'plan') { if (c.turn && !TURNS.includes(c.turn)) return bad('차례는 우리/쿠팡/모름/끝 중 하나'); return { c, ok: true, s, label: `${s.short} · ${c.turn ? c.turn + ' 차례 · ' : ''}다음: ${c.next || plan(s).next || '-'}${c.due ? ' · ' + c.due : ''}` }; }
    if (op === 'doc') { if (!c.name) return bad('서류명 없음'); const ex = s.docs.find((d) => norm(d.name) === norm(c.name)); return { c, ok: true, s, ex, label: `${s.short} · 서류 ${ex ? '수정' : '추가'}: ${c.name} ${c.status || ''}` }; }
    return bad('모르는 종류: ' + op);
  });
}
async function applyPlan(plan) {
  let n = 0;
  for (const p of plan.filter((x) => x.ok)) {
    const c = p.c; let s = p.s;
    if (c.op === 'site') {
      const base = s || { id: S.uid(), cat: 'FC', name: c.name, short: '', kind: '', sort: Math.max(0, ...st.sites.map((x) => x.sort || 0)) + 1, year: new Date().getFullYear(), stages: Array(14).fill(''), memo: '', info: {}, logs: [], docs: [] };
      const info = { ...base.info }; Object.entries(c.info || {}).forEach(([k, v]) => { const kk = findInfoKey(k); if (kk) info[kk] = v; });
      const row = { ...base, cat: CATS[c.cat] ? c.cat : base.cat, name: c.name, short: c.short || base.short || c.name.replace(/\(.*?\)/g, '').trim(), kind: c.kind ?? base.kind, memo: c.memo ?? base.memo, info };
      if (Array.isArray(c.stages)) row.stages = c.stages.concat(Array(14).fill('')).slice(0, 14);
      await S.saveSite(row); if (!s) st.sites.push({ ...row, logs: [], docs: [] }); else Object.assign(s, row); n++; continue;
    }
    if (c.op === 'stage') { const row = { ...s, stages: [...s.stages] }; row.stages[p.i] = c.value || ''; await S.saveSite(row); s.stages = row.stages; }
    if (c.op === 'info') { const row = { ...s, info: { ...s.info, [p.k]: c.value || '' } }; if (!c.value) delete row.info[p.k]; await S.saveSite(row); s.info = row.info; }
    if (c.op === 'memo') { const row = { ...s, memo: c.value || '' }; await S.saveSite(row); s.memo = row.memo; }
    if (c.op === 'log') { const l = { id: S.uid(), date: c.date || md(TODAY()), kind: '기록', text: c.text, result: c.result || '', note: '', done: false, photos: [] }; await S.saveLog(s.id, l); s.logs.push(l); }
    if (c.op === 'plan') { const info = { ...s.info }; if (c.turn) { if (c.turn !== info._turn) info._since = c.since || md(TODAY()); info._turn = c.turn; } if (c.next !== undefined) info._next = c.next; if (c.due !== undefined) info._due = c.due; if (c.since) info._since = c.since; await S.saveSite({ ...s, info }); s.info = info; }
    if (c.op === 'doc') { const d = p.ex ? { ...p.ex, date: c.date ?? p.ex.date, status: c.status ?? p.ex.status, note: c.note ?? p.ex.note } : { id: S.uid(), date: c.date || '', name: c.name, status: c.status || '', note: c.note || '' }; await S.saveDoc(s.id, d); if (p.ex) Object.assign(p.ex, d); else s.docs.push(d); }
    n++;
  }
  return n;
}
function pasteChanges() {
  dialog(`<h3>Claude 변경 붙여넣기</h3>
  <p style="margin:0;color:var(--muted);font-size:13.5px">쿠팡 일정공유 프로젝트의 Claude가 만들어 준 변경 내용(코드 블록)을 통째로 붙여넣으세요. 확인 화면을 보고 반영해요.</p>
  <div class="f"><label for="pc">변경 내용</label><textarea id="pc" style="min-height:160px;font-family:var(--font-mono,monospace);font-size:12.5px" placeholder='{"tsc":1,"changes":[ ... ]}'></textarea></div>
  <div id="pv"></div><div class="err" id="perr"></div>
  <div class="dlg-f"><button class="btn" data-close>닫기</button><button class="btn" id="chk">확인하기</button><button class="btn pri" id="go" hidden>반영하기</button></div>`, (d, close) => {
    let plan = null;
    d.querySelector('#chk').onclick = () => {
      const t = d.querySelector('#pc').value; const a = t.indexOf('{'), b = t.lastIndexOf('}');
      d.querySelector('#perr').textContent = ''; d.querySelector('#go').hidden = true; d.querySelector('#pv').innerHTML = '';
      let obj; try { obj = JSON.parse(t.slice(a, b + 1)); } catch (e) { d.querySelector('#perr').textContent = '형식을 읽을 수 없어요. Claude가 준 코드 블록 전체를 붙여넣었는지 확인해 주세요.'; return; }
      const list = Array.isArray(obj) ? obj : obj.changes;
      if (!Array.isArray(list) || !list.length) { d.querySelector('#perr').textContent = '변경 항목이 없어요.'; return; }
      plan = planChanges(list);
      const okN = plan.filter((p) => p.ok).length;
      d.querySelector('#pv').innerHTML = `<div class="panel" style="max-height:260px;overflow:auto">${plan.map((p) => `<div class="row" style="cursor:default"><span class="pill ${p.ok ? 'ok' : 'danger'}">${p.ok ? '반영' : '건너뜀'}</span><span class="main"><span class="s" style="white-space:normal">${esc(p.label)}${p.ok ? '' : ' — ' + esc(p.why)}</span></span></div>`).join('')}</div>`;
      const go = d.querySelector('#go'); go.hidden = !okN; go.textContent = `${okN}건 반영하기`;
    };
    d.querySelector('#go').onclick = async () => {
      d.querySelector('#go').disabled = true;
      try {
        let n;
        if (S.apply) {
          const ops = plan.filter((p) => p.ok).map((p) => ({ ...p.c, site_id: p.s ? p.s.id : undefined, stage: p.i != null ? STAGES[p.i] : p.c.stage, key: p.k || p.c.key }));
          const r = await S.apply(ops, '붙여넣기'); n = r.applied; await reload();
        } else n = await applyPlan(plan);
        close(); render(); toast(`${n}건 반영했어요`);
      }
      catch (e) { d.querySelector('#perr').textContent = '반영 중 멈췄어요: ' + e.message + ' (앞부분은 이미 저장됐을 수 있어요)'; d.querySelector('#go').disabled = false; }
    };
  });
}

function editPlan(s) {
  const p = plan(s);
  dialog(`<h3>${esc(s.short)} · 다음 할 일</h3>
  <div class="f"><label>차례</label><div class="quick">${TURNS.map((t) => `<button class="btn ${p.turn === t ? 'pri' : ''}" data-tn="${t}">${t}</button>`).join('')}</div></div>
  <div class="f"><label for="p-next">다음 할 일 (모르면 질문으로: 입찰 결과?)</label><input id="p-next" value="${esc(p.next)}"></div>
  <div class="f2"><div class="f"><label for="p-due">기한</label><input id="p-due" value="${esc(p.due)}" placeholder="11/25"></div><div class="f"><label for="p-since">언제부터</label><input id="p-since" value="${esc(p.since)}" placeholder="${md(TODAY())}"></div></div>
  <div class="dlg-f"><button class="btn" data-close>취소</button><button class="btn pri" id="ok">저장</button></div>`, (d, close) => {
    let turn = p.turn;
    d.querySelectorAll('[data-tn]').forEach((b) => (b.onclick = () => { turn = b.dataset.tn; d.querySelectorAll('[data-tn]').forEach((x) => x.classList.toggle('pri', x === b)); if (turn !== p.turn && !d.querySelector('#p-since').value) d.querySelector('#p-since').value = md(TODAY()); }));
    d.querySelector('#ok').onclick = async () => {
      const info = { ...s.info, _turn: turn, _next: d.querySelector('#p-next').value.trim(), _due: d.querySelector('#p-due').value.trim(), _since: d.querySelector('#p-since').value.trim() || (turn !== p.turn ? md(TODAY()) : p.since) };
      if (await guard(() => S.saveSite({ ...s, info }), '저장했어요')) { s.info = info; close(); render(); }
    };
  });
}
function confirmBox(msg, yes) {
  dialog(`<h3>확인</h3><p style="margin:0">${esc(msg)}</p><div class="dlg-f"><button class="btn" data-close>취소</button><button class="btn pri" id="yes" style="background:var(--danger);border-color:var(--danger)">지우기</button></div>`, (d, close) => { d.querySelector('#yes').onclick = async () => { close(); await yes(); render(); }; });
}
function editLog(s, l) {
  const isNew = !l;
  l = l ? { ...l, photos: [...(l.photos || [])] } : { id: S.uid(), date: md(TODAY()), kind: '기록', text: '', result: '', note: '', done: false, photos: [] };
  dialog(`<h3>${isNew ? '기록 추가' : '기록 고치기'} · ${esc(s.short)}</h3>
  <div class="f2"><div class="f"><label for="l-date">날짜</label><input id="l-date" value="${esc(l.date)}" placeholder="11/21"></div>
  <div class="f"><label for="l-kind">종류</label><select id="l-kind"><option ${l.kind === '기록' ? 'selected' : ''}>기록</option><option ${l.kind === '이슈' ? 'selected' : ''}>이슈</option></select></div></div>
  <div class="f"><label for="l-text">내용</label><textarea id="l-text" placeholder="현설 내용, 질의회신, 쿠팡 요청사항 (일정은 11/24처럼 적으면 홈 화면에 떠요)">${esc(l.text)}</textarea></div>
  <div class="f"><label for="l-res">처리·답변</label><input id="l-res" value="${esc([l.result, l.note].filter(Boolean).join(' / '))}"></div>
  <label class="chk" id="l-donewrap"><input type="checkbox" id="l-done" ${l.done ? 'checked' : ''}> 해결됨</label>
  <div class="f"><label>사진</label><div class="ph-edit" id="phs"></div><label class="btn" style="align-self:flex-start;cursor:pointer">${ic('cam')}사진 올리기<input type="file" id="l-file" accept="image/*" multiple hidden></label></div>
  <div class="err" id="l-err"></div>
  <div class="dlg-f">${isNew ? '' : '<button class="btn dan" id="del">삭제</button>'}<span class="sp"></span><button class="btn" data-close>취소</button><button class="btn pri" id="ok">저장</button></div>`, (d, close) => {
    const drawPh = () => { d.querySelector('#phs').innerHTML = l.photos.map((p, i) => `<div><img src="${esc(p)}" alt=""><button data-rm="${i}" aria-label="사진 빼기">×</button></div>`).join(''); d.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { l.photos.splice(+b.dataset.rm, 1); drawPh(); })); };
    drawPh();
    const kindSel = d.querySelector('#l-kind'), dw = d.querySelector('#l-donewrap');
    const syncKind = () => (dw.style.display = kindSel.value === '이슈' ? '' : 'none'); syncKind(); kindSel.onchange = syncKind;
    d.querySelector('#l-file').onchange = async (e) => {
      const files = [...e.target.files]; if (!files.length) return;
      d.querySelector('#l-err').textContent = `사진 ${files.length}장 올리는 중…`;
      for (const f of files) { try { l.photos.push(await S.uploadPhoto(f)); drawPh(); } catch (er) { d.querySelector('#l-err').textContent = er.message; return; } }
      d.querySelector('#l-err').textContent = ''; e.target.value = '';
    };
    d.querySelector('#ok').onclick = async () => {
      const text = d.querySelector('#l-text').value.trim();
      if (!text) { d.querySelector('#l-err').textContent = '내용을 넣어주세요.'; return; }
      const n = { ...l, date: d.querySelector('#l-date').value.trim(), kind: kindSel.value, text, result: d.querySelector('#l-res').value.trim(), note: '', done: kindSel.value === '이슈' && d.querySelector('#l-done').checked };
      if (await guard(() => S.saveLog(s.id, n), '저장했어요')) { const i = s.logs.findIndex((x) => x.id === n.id); i >= 0 ? (s.logs[i] = n) : s.logs.push(n); close(); render(); }
    };
    const del = d.querySelector('#del');
    if (del) del.onclick = () => confirmBox('이 기록을 지울까요?', async () => { if (await guard(() => S.deleteLog(s.id, l.id), '삭제했어요')) s.logs = s.logs.filter((x) => x.id !== l.id); });
  });
}
function editDoc(s, doc) {
  const isNew = !doc;
  doc = doc || { id: S.uid(), date: md(TODAY()), name: '', status: '', note: '' };
  dialog(`<h3>${isNew ? '서류 추가' : '서류 고치기'}</h3>
  <div class="f2"><div class="f"><label for="d-date">제출일</label><input id="d-date" value="${esc(doc.date)}"></div><div class="f"><label for="d-st">처리</label><input id="d-st" value="${esc(doc.status)}" placeholder="제출 완료"></div></div>
  <div class="f"><label for="d-name">서류명</label><input id="d-name" value="${esc(doc.name)}" placeholder="안전관리계획서"></div>
  <div class="f"><label for="d-note">비고 (어디에 냈는지 등)</label><input id="d-note" value="${esc(doc.note)}"></div>
  <div class="err" id="d-err"></div>
  <div class="dlg-f">${isNew ? '' : '<button class="btn dan" id="del">삭제</button>'}<span class="sp"></span><button class="btn" data-close>취소</button><button class="btn pri" id="ok">저장</button></div>`, (d, close) => {
    d.querySelector('#ok').onclick = async () => {
      const n = { ...doc, date: d.querySelector('#d-date').value.trim(), status: d.querySelector('#d-st').value.trim(), name: d.querySelector('#d-name').value.trim(), note: d.querySelector('#d-note').value.trim() };
      if (!n.name) { d.querySelector('#d-err').textContent = '서류명을 넣어주세요.'; return; }
      if (await guard(() => S.saveDoc(s.id, n), '저장했어요')) { const i = s.docs.findIndex((x) => x.id === n.id); i >= 0 ? (s.docs[i] = n) : s.docs.push(n); close(); render(); }
    };
    const del = d.querySelector('#del');
    if (del) del.onclick = () => confirmBox('이 서류 기록을 지울까요?', async () => { if (await guard(() => S.deleteDoc(s.id, doc.id), '삭제했어요')) s.docs = s.docs.filter((x) => x.id !== doc.id); });
  });
}
function editSecret(s) {
  const sec = (st.secrets && st.secrets[s.id]) || { amounts: {}, contact: '' };
  dialog(`<h3>금액·연락처 · ${esc(s.short)}</h3><p style="margin:0;color:var(--muted);font-size:13px">수정 모드에서만 보이는 칸이에요. (부가세 별도)</p>
  ${AMOUNT_KEYS.map((k, i) => `<div class="f"><label for="a${i}">${k}</label><input id="a${i}" value="${esc(sec.amounts?.[k] || '')}" placeholder="전기공사 : 000,000,000"></div>`).join('')}
  <div class="f"><label for="ct">연락처 (쿠팡 담당자 등)</label><textarea id="ct">${esc(sec.contact || '')}</textarea></div>
  <div class="dlg-f"><button class="btn" data-close>취소</button><button class="btn pri" id="ok">저장</button></div>`, (d, close) => {
    d.querySelector('#ok').onclick = async () => {
      const n = { amounts: {}, contact: d.querySelector('#ct').value.trim() };
      AMOUNT_KEYS.forEach((k, i) => { const v = d.querySelector('#a' + i).value.trim(); if (v) n.amounts[k] = v; });
      if (await guard(() => S.saveSecret(s.id, n), '저장했어요')) { st.secrets[s.id] = n; close(); render(); }
    };
  });
}

// ───── 엑셀 출력 ─────
async function excel(onlyId) {
  toast('엑셀 만드는 중…');
  try {
    if (!window.ExcelJS) await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js'; sc.onload = res; sc.onerror = () => rej(new Error('엑셀 프로그램을 못 불러왔어요')); document.head.appendChild(sc); });
    const wb = new ExcelJS.Workbook(); const F = { name: '맑은 고딕', size: 9 };
    const thin = { style: 'thin', color: { argb: 'FFB7C4BA' } }; const B = { top: thin, left: thin, bottom: thin, right: thin };
    const HEAD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F6F47' } }, SUBH = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2F0E7' } };
    const style = (row, fill, white) => row.eachCell({ includeEmpty: true }, (c) => { c.font = { ...F, bold: !!fill, color: white ? { argb: 'FFFFFFFF' } : undefined }; c.border = B; c.alignment = { vertical: 'middle', wrapText: true }; if (fill) c.fill = fill; });
    const sites = onlyId ? [siteById(onlyId)] : [...st.sites].sort((a, b) => (a.sort || 0) - (b.sort || 0));
    const stamp = `${TODAY().getFullYear()}.${TODAY().getMonth() + 1}.${TODAY().getDate()} 기준`;
    if (!onlyId) {
      const ws = wb.addWorksheet('현황', { pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: .3, right: .3, top: .4, bottom: .4, header: .2, footer: .2 } }, views: [{ state: 'frozen', xSplit: 3, ySplit: 3 }] });
      ws.columns = [{ width: 5 }, { width: 10 }, { width: 24 }, ...STAGES.map(() => ({ width: 8.5 })), { width: 26 }];
      ws.mergeCells(1, 1, 1, 18); ws.getCell('A1').value = `2026 쿠팡 공사 현황  (${stamp})`; ws.getCell('A1').font = { name: '맑은 고딕', size: 14, bold: true }; ws.getRow(1).height = 24;
      const h = ws.getRow(3); h.values = ['NO', '구분', '현장명', ...STAGES, '비고']; style(h, HEAD, true); h.height = 22;
      let n = 0;
      Object.keys(CATS).forEach((c) => {
        const list = sites.filter((s) => s.cat === c); if (!list.length) return;
        const r = ws.addRow([CATS[c]]); ws.mergeCells(r.number, 1, r.number, 18); style(r, SUBH);
        list.forEach((s) => { const row = ws.addRow([++n, s.kind || CATS[c], s.name + (s.closed ? ' (취소)' : ''), ...s.stages.map((v) => v || ''), s.memo || '']); style(row); row.eachCell((cc, ci) => { if (ci > 3 && ci < 18) cc.alignment = { ...cc.alignment, horizontal: 'center' }; }); });
      });
      ws.pageSetup.printTitlesRow = '3:3';
    }
    sites.forEach((s) => {
      const name = (s.short || s.name).replace(/[\\/?*[\]:]/g, '').slice(0, 28) || s.id;
      const ws = wb.addWorksheet(wb.worksheets.some((w) => w.name === name) ? name + '_' + s.id.slice(-3) : name, { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: .4, right: .4, top: .5, bottom: .5, header: .2, footer: .2 } } });
      ws.columns = [{ width: 8 }, { width: 46 }, { width: 22 }, { width: 22 }];
      ws.mergeCells('A1:D1'); ws.getCell('A1').value = s.name; ws.getCell('A1').font = { name: '맑은 고딕', size: 13, bold: true };
      ws.getCell('A2').value = `${CATS[s.cat]} · ${stamp}`; ws.getCell('A2').font = { ...F, color: { argb: 'FF5B6A60' } };
      let r = ws.addRow([]); r = ws.addRow(['기본 정보']); ws.mergeCells(r.number, 1, r.number, 4); style(r, HEAD, true);
      const sec = st.editing && st.secrets ? st.secrets[s.id] : null;
      const kv = [...INFO_KEYS.filter((k) => (s.info || {})[k]).map((k) => [k === '비고' ? '주소·비고' : k, s.info[k]]), ...(s.memo ? [['메모', s.memo]] : []), ...(sec ? AMOUNT_KEYS.filter((k) => sec.amounts?.[k]).map((k) => [k, sec.amounts[k]]) : [])];
      kv.forEach(([k, v]) => { const row = ws.addRow([k, v]); ws.mergeCells(row.number, 2, row.number, 4); style(row); row.getCell(1).fill = SUBH; });
      r = ws.addRow([]); r = ws.addRow(['진행 단계']); ws.mergeCells(r.number, 1, r.number, 4); style(r, HEAD, true);
      for (let i = 0; i < 14; i += 2) { const row = ws.addRow([STAGES[i], s.stages[i] || '', STAGES[i + 1], s.stages[i + 1] || '']); style(row); row.getCell(1).fill = SUBH; row.getCell(3).fill = SUBH; }
      r = ws.addRow([]); r = ws.addRow(['제출 서류']); ws.mergeCells(r.number, 1, r.number, 4); style(r, HEAD, true);
      style(ws.addRow(['제출일', '서류명', '처리', '비고']), SUBH);
      (s.docs.length ? s.docs : [{ date: '', name: '(없음)', status: '', note: '' }]).forEach((d) => style(ws.addRow([d.date, d.name, d.status, d.note])));
      r = ws.addRow([]); r = ws.addRow(['진행 기록·이슈']); ws.mergeCells(r.number, 1, r.number, 4); style(r, HEAD, true);
      style(ws.addRow(['날짜', '내용', '처리·답변', '상태']), SUBH);
      const logs = [...s.logs].sort((a, b) => (parseDate(a.date, s.year) || 0) - (parseDate(b.date, s.year) || 0));
      (logs.length ? logs : [{ date: '', text: '(없음)' }]).forEach((l) => style(ws.addRow([l.date, l.text + ((l.photos || []).length ? `\n(사진 ${l.photos.length}장)` : ''), [l.result, l.note].filter(Boolean).join('\n'), l.kind === '이슈' ? (l.done ? '해결' : '미해결') : ''])));
    });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `쿠팡_공사현황_${onlyId ? (siteById(onlyId).short + '_') : ''}${TODAY().getFullYear()}${String(TODAY().getMonth() + 1).padStart(2, '0')}${String(TODAY().getDate()).padStart(2, '0')}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    if (window.self !== window.top) toast('미리보기 창에서는 다운로드가 막혀 있어요. 실제 사이트 주소에서는 받아져요.');
    else toast('엑셀을 받았어요');
  } catch (e) { toast(e.message || '엑셀을 만들지 못했어요'); }
}

// ───── 클릭 처리 ─────
document.addEventListener('click', (e) => {
  const sg = e.target.closest('[data-site-go]'); if (sg && !$layer.contains(sg)) return go('site-' + sg.dataset.siteGo);
  const fd = e.target.closest('[data-feed]');
  if (fd && !$layer.contains(fd)) {
    const a = st.activity.find((x) => String(x.id) === fd.dataset.aid); if (!a) return;
    const s = siteById(a.site_id);
    if (fd.dataset.feed === 'del') { guard(() => S.deleteActivity(a.id), '목록에서 뺐어요').then((ok) => { if (ok) { st.activity = st.activity.filter((x) => x !== a); render(); } }); return; }
    if (!s) return;
    if (a.op === 'log') { const l = s.logs.find((x) => x.id === a.ref); return l ? editLog(s, l) : go('site-' + s.id); }
    if (a.op === 'doc') { const d = s.docs.find((x) => x.id === a.ref); return d ? editDoc(s, d) : go('site-' + s.id); }
    if (a.op === 'plan') return editPlan(s);
    if (a.op === 'stage') { const i = STAGES.findIndex((x) => (a.summary || '').startsWith(x + ':')); return i >= 0 ? editStage(s, i) : go('site-' + s.id); }
    return go('site-' + s.id);
  }
  const op = e.target.closest('[data-open]'); if (op && !$layer.contains(op)) { st.open = st.open === op.dataset.open ? null : op.dataset.open; return render(); }
  const t = e.target.closest('[data-site],[data-go],[data-scroll],[data-cat],[data-act],[data-lf],[data-mon],[data-day],[data-view]');
  if (!t || $layer.contains(t)) return;
  const id = (location.hash.match(/^#site-(.+)/) || [])[1]; const s = id && siteById(id);
  if (t.dataset.view) { $layer.innerHTML = `<div class="viewer"><img src="${esc(t.dataset.view)}" alt="현장 사진 크게 보기"></div>`; $layer.firstChild.onclick = () => ($layer.innerHTML = ''); return; }
  if (t.dataset.site && !t.dataset.act) return go('site-' + t.dataset.site);
  if (t.dataset.go) return go(t.dataset.go);
  if (t.dataset.scroll) return document.getElementById(t.dataset.scroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (t.dataset.cat) { st.cat = t.dataset.cat; return render(); }
  if (t.dataset.lf) { st.logFilter = t.dataset.lf; return render(); }
  if (t.dataset.mon !== undefined) { const v = +t.dataset.mon; const T = TODAY(); st.calMonth = v === 0 ? new Date(T.getFullYear(), T.getMonth(), 1) : new Date(st.calMonth.getFullYear(), st.calMonth.getMonth() + v, 1); st.calSel = v === 0 ? T : null; return render(); }
  if (t.dataset.day) { st.calSel = new Date(+t.dataset.day); return render(); }
  const a = t.dataset.act;
  if (a === 'excel') return excel();
  if (a === 'excel-one') return excel(id);
  if (!st.editing) { if (a === 'edit-stage') return; return askPass(); }
  if (a === 'add-site') return editSite(null);
  if (a === 'paste') return pasteChanges();
  if (!s) return;
  if (a === 'edit-stage') return editStage(s, +t.dataset.i);
  if (a === 'set-turn') { const tn = t.dataset.t; const info = { ...s.info, _turn: tn, _since: plan(s).turn === tn ? plan(s).since : md(TODAY()) }; guard(() => S.saveSite({ ...s, info }), '저장했어요').then((ok) => { if (ok) { s.info = info; render(); } }); return; }
  if (a === 'edit-plan') return editPlan(s);
  if (a === 'edit-site') return editSite(s);
  if (a === 'edit-secret') return editSecret(s);
  if (a === 'add-log') return editLog(s, null);
  if (a === 'edit-log') return editLog(s, s.logs.find((l) => l.id === t.dataset.id));
  if (a === 'toggle-log') { const l = s.logs.find((x) => x.id === t.dataset.id); const n = { ...l, done: !l.done }; guard(() => S.saveLog(s.id, n), n.done ? '해결 처리했어요' : '미해결로 바꿨어요').then((ok) => { if (ok) { l.done = n.done; render(); } }); return; }
  if (a === 'add-doc') return editDoc(s, null);
  if (a === 'edit-doc') return editDoc(s, s.docs.find((d) => d.id === t.dataset.id));
});
document.getElementById('editbtn').onclick = () => {
  if (st.editing) { st.editing = false; st.secrets = null; S.lock(); try { sessionStorage.removeItem('tsc-pw'); } catch (e) {} render(); toast('보기 모드로 돌아왔어요'); }
  else askPass();
};
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $layer.innerHTML = ''; });
window.addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); });

async function reload() {
  const data = await S.load();
  st.sites = data.sites.map((s) => ({ ...s, stages: (s.stages || []).concat(Array(14).fill('')).slice(0, 14), info: s.info || {}, logs: s.logs || [], docs: s.docs || [], short: s.short || s.name }));
  st.activity = data.activity || [];
  render();
}
// ───── 시작 ─────
async function boot() {
  if (S.mode === 'demo') document.getElementById('demonote').hidden = false;
  $app.innerHTML = '<div class="empty">불러오는 중…</div>';
  try {
    const data = await S.load();
    st.sites = data.sites.map((s) => ({ ...s, stages: (s.stages || []).concat(Array(14).fill('')).slice(0, 14), info: s.info || {}, logs: s.logs || [], docs: s.docs || [], short: s.short || s.name }));
    st.activity = data.activity || [];
  } catch (e) { $app.innerHTML = `<div class="panel"><div class="empty">데이터를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침 해주세요. (${esc(e.message)})</div></div>`; return; }
  try { st.secrets = (await S.unlock('')) || {}; } catch (e) { st.secrets = {}; }
  render();
}
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || S.mode !== 'live' || $layer.innerHTML) return;
  try { await reload(); } catch (e) {}
});
boot();
})();
