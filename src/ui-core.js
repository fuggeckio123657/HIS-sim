/* ---- HIS UI core：視窗管理、對話框、通用元件、登入與選單 ---- */
(function (G) {
'use strict';
const HIS = G.HIS, DB = HIS.DB, S = HIS.svc;
const UI = HIS.UI = { open: {} };
const E = UI.E = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = UI.$ = (s, r) => (r || document).querySelector(s);
const $$ = UI.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));

/* ---------- 狀態色 ---------- */
const SC = { '草稿': 'gray', '待簽署': 'orange', '已簽署': 'blue', '已送出': 'blue', '執行中': 'purple', '已完成': 'green', '已取消': 'red', '取消': 'red',
  '已掛號': 'blue', '候診中': 'orange', '看診中': 'purple', '已看診': 'green', '進行中': 'purple', '完成': 'green', '修訂中': 'orange',
  '待審核': 'orange', '待調劑': 'blue', '已調劑': 'purple', '已發藥': 'green', '待排程': 'orange', '已排程': 'blue', '檢查中': 'purple', '待判讀': 'orange', '報告完成': 'blue', '已發布': 'green',
  '空床': 'green', '使用中': 'red', '清潔中': 'orange', '保留床': 'blue', '維修中': 'gray', '入院申請': 'orange', '住院中': 'purple', '出院準備': 'blue', '已出院': 'green',
  '檢驗中': 'purple', '輸入中': 'purple', '已完成報告': 'blue', '未開始': 'gray', '候診': 'orange', '診治中': 'purple', '留觀': 'blue', '轉住院': 'blue', '離院': 'green', '已刪除': 'red', '確診': 'green', '疑似': 'orange', '慢性': 'blue', '已排除': 'gray', '已解決': 'gray' };
const st = UI.st = s => `<span class="st s-${SC[s] || 'gray'}">${E(s)}</span>`;
const flag = UI.flag = f => f && f !== 'N' ? `<b class="fl fl-${f}">${f === 'A' ? 'A 異常' : f}</b>` : '';
const fdt = UI.fdt = s => (s ? s.slice(0, 16) : '');
const sexAge = UI.sexAge = p => (p.sex === 'M' ? '男' : '女') + ' ' + HIS.age(p.birth);
UI.algHtml = pid => { const a = HIS.allergies(pid); return a.length ? `<span class="alg" title="${E(a.map(x => x.allergen + '：' + x.reaction).join('；'))}">⚠ 過敏：${a.map(x => E(x.allergen)).join('、')}</span>` : '<span class="noalg">無已知藥物過敏</span>'; };
const TRI = { 1: '#d00000', 2: '#ff6a00', 3: '#e6c200', 4: '#2e9b2e', 5: '#3b78c4' };
UI.triBadge = l => `<span class="tri" style="background:${TRI[l] || '#888'}">${l || '-'}</span>`;

/* 通用表格：cols=[[標題, fn(row,i), class]] */
UI.table = (cols, rows, o = {}) => {
  if (!rows.length) return `<div class="empty">${o.empty || '（無資料）'}</div>`;
  return `<table class="grid sortable ${o.cls || ''}"><thead><tr>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr data-id="${E(r.id || '')}" class="${E(o.rowCls ? o.rowCls(r) : '')}" ${o.dbl ? `data-dbl="${o.dbl}"` : ''}>${cols.map(c => `<td class="${c[2] || ''}">${c[1](r, i)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
};
UI.kv = (pairs, cols = 4) => { let h = '<table class="kv"><tbody>'; for (let i = 0; i < pairs.length; i += cols) { h += '<tr>'; for (let j = 0; j < cols; j++) { const p = pairs[i + j]; h += p ? `<th>${p[0]}</th><td>${p[1] == null || p[1] === '' ? '-' : p[1]}</td>` : '<th></th><td></td>'; } h += '</tr>'; } return h + '</tbody></table>'; };
UI.btn = (act, label, o = {}) => `<button class="btn ${o.cls || ''}" data-act="${act}" ${o.id ? `data-id="${E(o.id)}"` : ''} ${o.dis ? 'disabled' : ''} ${o.title ? `title="${E(o.title)}"` : ''}>${label}</button>`;
UI.opts = (arr, sel, blank) => (blank != null ? `<option value="">${E(blank)}</option>` : '') + arr.map(a => { const v = Array.isArray(a) ? a[0] : a, l = Array.isArray(a) ? a[1] : a; return `<option value="${E(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${E(l)}</option>`; }).join('');
UI.patLine = p => `<b>${E(p.name)}</b>　${E(p.chart_no)}　${sexAge(p)}　${E(p.blood || '')}　${UI.algHtml(p.id)}`;

/* ---------- 狀態列 / 對話框 ---------- */
UI.status = (m, bad) => { const el = $('#sbmsg'); if (el) { el.textContent = (bad ? '✗ ' : '') + m; el.className = bad ? 'bad' : ''; } };
UI.dialog = (title, html, buttons) => {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="dlg"><div class="dt">${E(title)}</div><div class="db">${html}</div><div class="df"></div></div>`;
  const f = $('.df', m);
  (buttons || [{ t: '確定' }]).forEach(b => { const x = document.createElement('button'); x.className = 'btn ' + (b.primary ? 'pri' : ''); x.textContent = b.t; x.onclick = () => { let r; try { r = b.cb && b.cb(m); } catch (e) { UI.status(e.message, true); const eb = $('.dlgerr', m); if (eb) eb.textContent = e.message; return; } if (r !== false) m.remove(); }; f.appendChild(x); });
  document.body.appendChild(m); const fi = $('input,textarea,select', m); if (fi) fi.focus(); return m;
};
UI.alert = (msg, title) => UI.dialog(title || '系統訊息', `<div class="dmsg">${E(msg).replace(/\n/g, '<br>')}</div>`, [{ t: '確定', primary: true }]);
UI.confirm = (msg, cb) => UI.dialog('請確認', `<div class="dmsg">${E(msg).replace(/\n/g, '<br>')}</div>`, [{ t: '確定', primary: true, cb: () => { cb(); } }, { t: '取消' }]);
UI.ask = (title, label, cb, o = {}) => UI.dialog(title, `<div class="dmsg">${E(label)}</div><textarea class="dta" name="v" rows="${o.rows || 3}">${E(o.value || '')}</textarea><div class="dlgerr bad"></div>`, [{ t: '確定', primary: true, cb: m => { const v = $('[name=v]', m).value.trim(); if (!v && !o.optional) throw new Error('此欄位為必填'); cb(v); } }, { t: '取消' }]);
UI.form = (title, html, cb) => UI.dialog(title, html + '<div class="dlgerr bad"></div>', [{ t: '確定', primary: true, cb: m => { const o = {}; $$('[name]', m).forEach(e => { o[e.name] = e.type === 'checkbox' ? e.checked : e.value; }); cb(o); } }, { t: '取消' }]);
UI.safe = fn => { try { return fn(); } catch (e) { console.error(e); UI.status(e.message, true); UI.alert(e.message, '作業失敗'); return undefined; } };

/* ---------- 視窗管理 ---------- */
const wins = UI.wins = {}; let zTop = 20, casc = 0;
function focusWin(w) { if (w.min) toggleMin(w); w.el.style.zIndex = ++zTop; Object.values(wins).forEach(x => x.el.classList.toggle('active', x === w)); renderTask(); }
function toggleMin(w) { w.min = !w.min; w.el.style.display = w.min ? 'none' : ''; renderTask(); }
function closeWin(w) { delete wins[w.key]; w.el.remove(); renderTask(); }
UI.closeAll = () => Object.values(wins).forEach(closeWin);
function renderTask() { const t = $('#taskbar'); if (!t) return; t.innerHTML = Object.values(wins).map(w => `<button class="tbtn ${w.el.classList.contains('active') && !w.min ? 'on' : ''}" data-k="${E(w.key)}" title="${E(w.title)}">${E(w.title)}</button>`).join(''); }
UI.refresh = w => {
  if (!w || !wins[w.key]) return; const b = w.body, sx = b.scrollTop, scrolls = $$('.scrollbox', b).map(e => e.scrollTop);
  w.act = {}; w.chg = {}; w.inp = {}; w.dbl = {};
  try { w.render(w); } catch (e) { console.error(e); b.innerHTML = `<div class="empty bad">畫面載入錯誤：${E(e.message)}</div>`; }
  b.scrollTop = sx; $$('.scrollbox', b).forEach((e, i) => { if (scrolls[i]) e.scrollTop = scrolls[i]; });
};
UI.win = (key, o) => {
  let w = wins[key];
  if (w) { if (o.render) w.render = o.render; focusWin(w); UI.refresh(w); return w; }
  const el = document.createElement('div'); el.className = 'win';
  const dw = $('#desktop'), W = Math.min(o.w || 900, dw.clientWidth - 6), H = Math.min(o.h || 560, dw.clientHeight - 6);
  const off = (casc++ % 8) * 24; el.style.cssText = `width:${W}px;height:${H}px;left:${Math.min(8 + off, Math.max(0, dw.clientWidth - W))}px;top:${Math.min(4 + off, Math.max(0, dw.clientHeight - H))}px`;
  el.innerHTML = `<div class="wt"><span class="wtt">${E(o.title)}</span><span class="wbtn"><button data-w="min" title="最小化">_</button><button data-w="max" title="最大化">□</button><button data-w="close" title="關閉">×</button></span></div><div class="wbody"></div><div class="wgrip"></div>`;
  dw.appendChild(el);
  w = { key, el, body: $('.wbody', el), title: o.title, render: o.render, live: !!o.live, state: o.state || {}, act: {}, chg: {}, inp: {}, dbl: {}, min: false, max: false, pid: o.pid, encId: o.encId, auto: !!o.auto, pre: o.pre };
  wins[key] = w;
  el.addEventListener('mousedown', () => { if (!el.classList.contains('active')) focusWin(w); });
  const t = $('.wt', el);
  t.addEventListener('mousedown', e => { if (e.target.closest('button') || w.max) return; const sx = e.clientX - el.offsetLeft, sy = e.clientY - el.offsetTop; const mv = ev => { el.style.left = Math.max(-W + 60, ev.clientX - sx) + 'px'; el.style.top = Math.max(0, ev.clientY - sy) + 'px'; }; const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); }; document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up); });
  t.addEventListener('dblclick', e => { if (!e.target.closest('button')) $('[data-w=max]', el).click(); });
  $('.wgrip', el).addEventListener('mousedown', e => { e.preventDefault(); const sx = e.clientX, sy = e.clientY, sw = el.offsetWidth, sh = el.offsetHeight; const mv = ev => { el.style.width = Math.max(360, sw + ev.clientX - sx) + 'px'; el.style.height = Math.max(200, sh + ev.clientY - sy) + 'px'; }; const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); }; document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up); });
  el.addEventListener('click', e => {
    const wb = e.target.closest('[data-w]'); if (wb) { const k = wb.dataset.w; if (k === 'close') closeWin(w); else if (k === 'min') toggleMin(w); else { w.max = !w.max; el.classList.toggle('max', w.max); } return; }
    const a = e.target.closest('[data-act]'); if (a && !a.disabled && w.act[a.dataset.act]) { e.preventDefault(); UI.safe(() => { w.act[a.dataset.act](a, e); if (w.auto && wins[w.key]) { if (w.pre) { try { w.pre(w); } catch (x) { /* 暫存失敗不阻擋 */ } } UI.refresh(w); } }); }
  });
  el.addEventListener('dblclick', e => { const r = e.target.closest('[data-dbl]'); if (r && w.dbl[r.dataset.dbl]) UI.safe(() => w.dbl[r.dataset.dbl](r)); });
  el.addEventListener('change', e => { const a = e.target.closest('[data-chg]'); if (a && w.chg[a.dataset.chg]) UI.safe(() => w.chg[a.dataset.chg](a, e)); });
  el.addEventListener('input', e => { const a = e.target.closest('[data-inp]'); if (a && w.inp[a.dataset.inp]) UI.safe(() => w.inp[a.dataset.inp](a, e)); });
  focusWin(w); UI.refresh(w); return w;
};
UI.vals = w => { const o = {}; $$('[name]', w.body).forEach(e => { if (e.type === 'radio' && !e.checked) return; o[e.name] = e.type === 'checkbox' ? e.checked : e.value; }); return o; };
// 表格排序（點選欄位標題）
document.addEventListener('click', e => {
  const th = e.target.closest('table.sortable th'); if (!th) return; const tb = th.closest('table'), i = th.cellIndex, asc = th.dataset.s !== 'a';
  $$('th', tb).forEach(x => delete x.dataset.s); th.dataset.s = asc ? 'a' : 'd';
  const rows = $$('tbody tr', tb), key = r => { const t = r.cells[i].textContent.trim(), n = parseFloat(t); return /^-?\d+(\.\d+)?/.test(t) && !isNaN(n) ? n : t; };
  rows.sort((a, b) => { const x = key(a), y = key(b); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'zh-Hant')) * (asc ? 1 : -1); }); rows.forEach(r => $('tbody', tb).appendChild(r));
});
// 資料異動 → 即時更新「live」視窗（避免打斷輸入中的視窗）
let tmr = null;
DB.onchange(() => { clearTimeout(tmr); tmr = setTimeout(() => { Object.values(wins).forEach(w => { if (!w.live) return; const a = document.activeElement; if (a && w.body.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return; UI.refresh(w); }); updateBadges(); }, 40); });

/* ---------- 選單 / 登入 ---------- */
UI.menus = [];
UI.defMenu = (title, items, ed) => UI.menus.push({ t: title, items, ed: ed || 'hospital' });
function buildMenus() {
  const bar = $('#menubar'); bar.innerHTML = '';
  UI.menus.filter(m => m.ed === HIS.edition).forEach(m => {
    const its = m.items.filter(i => !i[1] || HIS.can(i[1]) || (Array.isArray(i[1]) && i[1].some(p => HIS.can(p)))); if (!its.length) return;
    const d = document.createElement('div'); d.className = 'mi';
    d.innerHTML = `<span>${m.t}</span><div class="mdd">${its.map((i, k) => i[0] === '-' ? '<hr>' : `<a data-i="${k}">${i[0]}</a>`).join('')}</div>`;
    d.addEventListener('click', e => { const a = e.target.closest('a'); if (a) { d.classList.remove('hot'); UI.safe(() => its[+a.dataset.i][2]()); } });
    d.addEventListener('mouseenter', () => d.classList.add('hot')); d.addEventListener('mouseleave', () => d.classList.remove('hot'));
    bar.appendChild(d);
  });
}
function buildToolbar() {
  const tb = $('#toolbar'); tb.innerHTML = '';
  UI.tools.filter(t => (t[3] || 'hospital') === HIS.edition).filter(t => !t[1] || (Array.isArray(t[1]) ? t[1].some(x => HIS.can(x)) : HIS.can(t[1]))).forEach(t => { const b = document.createElement('button'); b.className = 'tool'; b.innerHTML = t[0]; b.onclick = () => UI.safe(t[2]); tb.appendChild(b); });
}
UI.tools = [];
function updateBadges() { if (!HIS.session) return; if (HIS.edition === 'clinic') { const el = $('#msgbadge'); if (el) el.textContent = ''; return; } const n = S.unreadMsgs().length; const el = $('#msgbadge'); if (el) { el.textContent = n ? `✉ 未讀訊息 ${n}` : '✉ 無未讀訊息'; el.className = n ? 'unread' : ''; } }
UI.enter = () => {
  const s = HIS.session, u = s.user, r = DB.get('roles', u.role_id);
  $('#login').hidden = true; $('#app').hidden = false;
  $('#tb-info').innerHTML = `<b>${E(HIS.edition === 'clinic' ? HIS.CL.cfg().clinic_name : HIS.HOSPITAL)}</b> ${HIS.edition === 'clinic' ? '診所' : ''}HIS｜使用者：<b>${E(u.name)}</b>　員工編號：${E(u.emp_no)}　職稱：${E(u.title)}　科別：${E(HIS.deptName(u.dept_id))}　角色：${E(r.name)}　工作站：<b>${E(s.ws)}</b>　登入時間：${E(s.loginAt)}　${E(HIS.VERSION)}`;
  buildMenus(); buildToolbar(); updateBadges(); UI.status('登入成功。所有資料皆為虛構，僅供教育及娛樂用途。');
  if (HIS.edition === 'clinic') UI.openClinicHome(); else UI.openWorklist();
};
UI.logout = () => { UI.closeAll(); if (UI.clStop) UI.clStop(); S.logout(); $('#app').hidden = true; $('#login').hidden = false; $('#lg-pw').value = ''; $('#lg-err').textContent = ''; };
setInterval(() => { const c = $('#sbclock'); if (c) c.textContent = HIS.now(); }, 1000);

const CL_WS = ['診間1', '診間2', '護理站', '櫃台', '藥局'];
UI.loadEdition = async ed => {
  UI.edLoading = true; $('#lg-err').textContent = ''; $('#lg-btn').disabled = true; $('#lg-demo').innerHTML = '<div class="empty">載入資料中…</div>';
  try {
    if (ed === 'clinic' && await HIS.remote.probe()) { await HIS.remote.attach('clinic'); }
    else { HIS.remote.detach(); HIS.setEdition(ed); if (ed === 'clinic') HIS.CL.ensureSeed(); else HIS.ensureSeed(); }
  } catch (e) { console.error(e); $('#lg-err').textContent = '載入失敗：' + e.message; }
  try { localStorage.setItem('his.edition', ed); } catch (e) { }
  $('#lg-ed').value = ed; $('#lg-title').innerHTML = ed === 'clinic' ? '<b>康健家庭醫學科診所</b><br>診所版 HIS（入門版：掛號 → 看診 → 批價領藥 → 日結 → 健保申報）' : '<b>臺灣綜合醫學中心</b><br>HIS - Hospital Information System';
  $('#lg-ws').innerHTML = UI.opts(ed === 'clinic' ? CL_WS : HIS.WORKSTATIONS); $('#lg-btn').disabled = false; UI.edLoading = false; UI.renderDemo();
};
UI.renderDemo = () => {
  const rows = DB.all('users').map(u => `<tr data-emp="${E(u.emp_no)}"><td>${E(u.emp_no)}</td><td>${E(u.name)}</td><td>${E(DB.get('roles', u.role_id).name)}</td><td>${E(HIS.deptName(u.dept_id))}</td></tr>`).join('');
  $('#lg-demo').innerHTML = `<table class="grid"><thead><tr><th>員工編號</th><th>姓名</th><th>角色</th><th>科別</th></tr></thead><tbody>${rows}</tbody></table>`;
};
UI.netStatus = () => { const el = $('#sbnet'); if (!el) return; const r = HIS.remote; el.textContent = r.active ? `⇄ 區網同步：${r.status}（在線 ${r.online || 1} 台）` : (HIS.edition === 'clinic' ? '單機模式（未連線同步伺服器）' : ''); el.className = r.active && !/已連線/.test(r.status) ? 'bad' : ''; };
UI.initLogin = () => {
  HIS.remote.onstatus = UI.netStatus;
  $('#lg-demo').onclick = e => { const tr = e.target.closest('tr[data-emp]'); if (!tr) return; $('#lg-emp').value = tr.dataset.emp; $('#lg-pw').value = '1234'; const u = DB.one('users', x => x.emp_no === tr.dataset.emp), r = u.role_id;
    if (HIS.edition === 'clinic') { $('#lg-ws').value = r === 'R-pharm' ? '藥局' : r === 'R-counter' ? '櫃台' : r === 'R-nurse' ? '護理站' : u.emp_no === 'C002' ? '診間2' : '診間1'; return; }
    const ws = r === 'R-pharm' ? 'PHAR-01' : r === 'R-lab' ? 'LAB-01' : r === 'R-radtech' || r === 'R-radiologist' ? 'RAD-01' : r === 'R-reg' ? 'REG-01' : r === 'R-mr' ? 'MR-01' : r === 'R-admin' ? 'IT-01' : u.dept_id === 'DEP-ER' ? 'ER-01' : r === 'R-nurse' ? 'WARD-5A-01' : 'OPD-101'; $('#lg-ws').value = ws; };
  const go = () => { if (UI.edLoading) return; try { S.login($('#lg-emp').value, $('#lg-pw').value, $('#lg-ws').value); UI.enter(); UI.netStatus(); } catch (e) { $('#lg-err').textContent = e.message; } };
  $('#lg-btn').onclick = go; $('#lg-pw').onkeydown = e => { if (e.key === 'Enter') go(); }; $('#lg-emp').onkeydown = e => { if (e.key === 'Enter') $('#lg-pw').focus(); };
  $('#lg-ed').onchange = () => UI.loadEdition($('#lg-ed').value);
  $('#taskbar').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; const w = wins[b.dataset.k]; if (!w) return; if (w.min) focusWin(w); else if (w.el.classList.contains('active')) toggleMin(w); else focusWin(w); };
  $('#menubar').addEventListener('click', () => { }); $('#msgbadge').onclick = () => { if (HIS.edition === 'hospital') UI.openMessages(); };
  let ed = 'clinic'; try { ed = localStorage.getItem('his.edition') || 'clinic'; } catch (e) { } UI.loadEdition(ed);
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
