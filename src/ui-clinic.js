/* ---- 診所版 UI（一）：首頁/流程導覽、櫃台掛號、護理量測、批價、藥局、外送檢驗報告、日結 ---- */
(function (G) {
'use strict';
const HIS = G.HIS, DB = HIS.DB, S = HIS.svc, CL = HIS.CL, UI = HIS.UI;
const { E, $, $$, st, fdt, table, kv, btn, opts } = UI;
const me = () => HIS.session.user, today = () => CL.today();
const NT = n => 'NT$ ' + Math.round(n).toLocaleString();
const APS = { '櫃台等候': 'orange', '候診中': 'blue', '已看診': 'green', '取消': 'red' };
UI.stc = s => `<span class="st s-${APS[s] || 'gray'}">${E(s)}</span>`;
const apName = a => a.patient_id ? HIS.pt(a.patient_id).name : (a.new_patient ? a.new_patient.name + '（新病人）' : '');
UI.clApName = apName;
const todayAps = () => DB.where('appointments', a => a.date === today() && a.dept_id === 'DEP-FM');
const docs = () => DB.where('users', u => { const r = DB.get('roles', u.role_id); return r.perms.includes('cl_doctor') || r.perms.includes('*'); });

/* ---------- 首頁 / 流程導覽 ---------- */
UI.openClinicHome = () => UI.win('cl-home', { title: '診所首頁／今日流程', w: 760, h: 520, live: true, render: w => {
  const c = CL.cfg(), aps = todayAps(), wait = aps.filter(a => a.status === '櫃台等候').length, queue = aps.filter(a => a.status === '候診中'), nov = queue.filter(a => !a.vitals_done).length;
  const unpaid = DB.where('cl_charges', x => x.status === '待批價').length, undisp = DB.where('encounters', e => e.disp_status === '待領藥' && (DB.one('cl_charges', { encounter_id: e.id }) || {}).status === '已批價').length;
  const done = DB.where('encounters', e => e.date === today() && e.status === '完診').length, per = S.clPeriods().length, rep = DB.where('cl_items', i => i.result_status === '已回報').length;
  const steps = [['① 櫃台掛號／讀卡', 'cl_reg', wait, '來客在櫃台等候，請讀健保卡並安排醫師', 'openClReg'], ['② 護理量測', 'cl_triage', nov, '量血壓、體溫、脈搏、SpO₂', 'openClTriage'], ['③ 診間看診', 'cl_doctor', queue.length, '問診、理學檢查、寫 SOAP、開藥、完診', 'openClDoctor'],
    ['④ 批價收費', 'cl_bill', unpaid, '診察費＋藥費＋部分負擔＋掛號費', 'openClBill'], ['⑤ 藥局領藥', 'cl_disp', undisp, '審核過敏、調劑、扣庫存', 'openClPharm'], ['⑥ 外送檢驗報告', 'cl_doctor', rep, '外送報告回來後由醫師閱讀', 'openClLab'], ['⑦ 日結', 'cl_bill', null, '當日收入、成本、點數統計；結束後進入下一營業日', 'openClClose'], ['⑧ 月健保申報', 'cl_claim', per, '建立申報、檢核、送出、審查、申復', 'openClClaim']];
  w.body.innerHTML = `<div class="pad"><div class="hd">${E(c.clinic_name)}　營業日 <b>${E(today())}</b>　${E(CL.session())}診　登入：${E(me().name)}（${E(me().title)}）</div>
  <div class="cl-stats"><div><b>${wait}</b>櫃台等候</div><div><b>${queue.length}</b>候診中</div><div><b>${done}</b>今日完診</div><div><b>${unpaid}</b>待批價</div><div><b>${undisp}</b>待領藥</div></div>
  <div class="bar">自動來客：<label><input type="checkbox" data-chg="auto" ${c.auto_arrive ? 'checked' : ''}> 開啟（約每 ${c.arrive_sec || 25} 秒來 1 位，候位 ≥ ${c.max_wait || 6} 人暫停）</label>　${btn('arrive', '＋ 立即來 1 位病人')}　${btn('arrive3', '＋ 來 3 位')}</div>
  <div class="hd">診所一天的流程（點選步驟開啟對應作業；每個步驟需要的角色不同，可用不同帳號/不同裝置分工）</div>
  ${table([['步驟', r => `<b>${r[0]}</b>`], ['說明', r => E(r[3])], ['待處理', r => r[2] == null ? '' : (r[2] ? `<b class="bad">${r[2]}</b>` : '0'), 'num'], ['', r => HIS.can(r[1]) ? btn('go', '開啟', { id: r[4] }) : '<span class="muted">（此角色無權限）</span>']], steps.map(r => Object.assign([...r], { id: r[4] })))}
  <div class="note">提示：新手可用「院長」帳號（C001）一人包辦全部流程；想體驗分工，請開 4 個瀏覽器分頁／裝置，分別用護理師、櫃台、醫師、藥師登入（需以 node server.js 啟動，詳見說明）。診間內<b>沒有「看診到一半」的狀態</b>：按下「完診」才會一次寫入病歷、診斷、處方與費用，中途離開只會保留你本機的草稿。</div></div>`;
  w.act.go = el => UI[el.dataset.id](); w.act.arrive = () => { S.clArrive(1); UI.status('有 1 位病人來到櫃台'); }; w.act.arrive3 = () => { S.clArrive(3); UI.status('有 3 位病人來到櫃台'); };
  w.chg.auto = el => S.clSetting({ auto_arrive: el.checked });
} });
let arrTimer = null;
UI.clStart = () => { UI.clStop(); arrTimer = setInterval(() => { if (!HIS.session || HIS.edition !== 'clinic' || !HIS.can('cl_arrive') || document.hidden) return; try { S.clAutoArrive(); } catch (e) { /* 忽略 */ } }, 3000); };
UI.clStop = () => { if (arrTimer) clearInterval(arrTimer); arrTimer = null; };

/* ---------- 櫃台掛號 / 讀卡 ---------- */
UI.openClReg = () => UI.win('cl-reg', { title: '櫃台掛號／健保卡讀取', w: 980, h: 560, live: true, render: w => {
  const aps = todayAps().filter(a => a.status === '櫃台等候'), q = todayAps().filter(a => a.status === '候診中').sort((a, b) => (a.queue_no || 0) - (b.queue_no || 0));
  const mk = DB.where('encounters', e => e.ins === '健保' && !e.ic_seq && e.status === '完診' && !e.claim_id);
  w.body.innerHTML = `<div class="bar">${btn('arrive', '＋ 手動新增來客')}　<span class="muted">病人來到櫃台 → 檢視健保卡狀況 → 讀卡掛號／補卡／自費 → 進入候診</span></div><div class="scrollbox" style="height:calc(100% - 34px)">
  <div class="hd">櫃台等候（${aps.length}）</div>${table([['到達', a => fdt(a.arrived_at).slice(11)], ['姓名', a => `<b>${E(apName(a))}</b>`], ['性別/年齡', a => { const p = a.patient_id ? HIS.pt(a.patient_id) : a.new_patient; return p ? UI.sexAge(p) : ''; }], ['病歷號', a => a.patient_id ? E(HIS.pt(a.patient_id).chart_no) : '<span class="muted">新病人</span>'], ['健保卡狀況', a => a.card_state === '正常' ? '正常' : `<b class="bad">${E(a.card_state)}</b>`], ['', a => btn('reg', '掛號', { id: a.id, cls: 'pri' }) + ' ' + btn('cancel', '取消', { id: a.id })]], aps, { empty: '目前沒有人在櫃台等候' })}
  <div class="hd">候診隊伍（${q.length}）</div>${table([['號碼', a => a.queue_no], ['姓名', a => E(apName(a))], ['醫師', a => E(HIS.staffName(a.doctor_id))], ['身分', a => a.ins === '自費' ? '<b class="bad">自費</b>' : '健保'], ['讀卡', a => E(a.card_mode || '') + (a.ic_seq ? ' 序號 ' + a.ic_seq : '')], ['類型', a => E(a.visit_type || '')], ['量測', a => a.vitals_done ? '✓' : '<span class="muted">未量</span>'], ['', a => btn('cancel', '取消', { id: a.id })]], q, { empty: '無' })}
  <div class="hd">待補卡（就診時未讀卡，須於 7 日內補登；逾期無法申報）（${mk.length}）</div>${table([['就診日', e => e.date], ['姓名', e => E(HIS.pt(e.patient_id).name)], ['補卡期限', e => { const a = DB.get('appointments', e.appt_id); return E(a.makeup_due || ''); }], ['', e => btn('mk', '補登健保卡', { id: e.id })]], mk, { empty: '無' })}</div>`;
  w.act.arrive = () => { S.clArrive(1); };
  w.act.reg = el => { const a = DB.get('appointments', el.dataset.id), modes = CL.CARD_MODES[a.card_state] || [], p = a.patient_id ? HIS.pt(a.patient_id) : a.new_patient, ds = docs();
    const hint = { '正常': '健保卡正常，請讀卡。', '忘帶卡': '病人忘記帶健保卡：可「補卡」（7 日內持卡補登，健保照常申報）或改「自費」。', '欠費': '健保卡有欠費紀錄：須「欠費補繳」才能以健保看診，或改自費。', '過期': '健保卡已過期：可補卡（請病人換新卡）或自費。', '自費': '自費病人。' }[a.card_state];
    UI.form('掛號：' + E(apName(a)), `${kv([['姓名', E(p.name)], ['性別/年齡', UI.sexAge(p)], ['身分證(虛構)', E(HIS.maskId ? HIS.maskId(p.id_no) : p.id_no)], ['健保卡狀況', E(a.card_state)]], 2)}<div class="note">${E(hint)}</div>
    <table class="kv"><tr><th>看診醫師</th><td><select name="doctor_id">${opts(ds.map(d => [d.id, d.name + '（今日已掛 ' + todayAps().filter(x => x.doctor_id === d.id && x.queue_no).length + '）']), ds[0] && ds[0].id)}</select></td></tr>
    <tr><th>讀卡方式</th><td><select name="mode">${opts(modes)}</select></td></tr></table>`, o => { S.clRegister(a.id, o); UI.status('掛號完成'); }); };
  w.act.cancel = el => UI.ask('取消來客', '請填寫原因（如：病人離開、過號、掛錯）', v => S.clCancelAppt(el.dataset.id, v));
  w.act.mk = el => UI.confirm('確認病人已持健保卡到院，補登就醫序號？', () => { S.clMakeupCard(el.dataset.id); UI.status('補卡完成'); });
} });

/* ---------- 護理量測 ---------- */
UI.openClTriage = () => UI.win('cl-triage', { title: '護理量測（生命徵象）', w: 860, h: 460, live: true, render: w => {
  const q = todayAps().filter(a => a.status === '候診中').sort((a, b) => (a.queue_no || 0) - (b.queue_no || 0));
  const V = a => DB.one('vital_signs', v => v.appt_id === a.id);
  w.body.innerHTML = `<div class="bar">${btn('all', '全部未量測者：一鍵自動量測')}　<span class="muted">模擬量測儀器取得數值；也可手動輸入。體溫、血壓偏高會在醫師畫面顯示警示色。</span></div><div class="scrollbox" style="height:calc(100% - 34px)">${table([['號', a => a.queue_no], ['姓名', a => `<b>${E(apName(a))}</b>`], ['醫師', a => E(HIS.staffName(a.doctor_id))], ['BP', a => { const v = V(a); return v ? `${v.bp_sys}/${v.bp_dia}` : ''; }], ['HR', a => { const v = V(a); return v ? v.hr : ''; }], ['BT', a => { const v = V(a); return v ? (v.temp >= 37.5 ? `<b class="bad">${v.temp}</b>` : v.temp) : ''; }], ['SpO₂', a => { const v = V(a); return v ? v.spo2 : ''; }], ['', a => a.vitals_done ? '<span class="muted">已量測</span> ' + btn('man', '重新輸入', { id: a.id }) : btn('auto', '自動量測', { id: a.id, cls: 'pri' }) + ' ' + btn('man', '手動輸入', { id: a.id })]], q, { empty: '沒有候診中的病人（需先由櫃台掛號）' })}</div>`;
  w.act.auto = el => { S.clMeasure(el.dataset.id); }; w.act.all = () => { q.filter(a => !a.vitals_done).forEach(a => S.clMeasure(a.id)); };
  w.act.man = el => { const v = V(DB.get('appointments', el.dataset.id)) || {}; const f = (n, l, val, sz) => `<tr><th>${l}</th><td><input name="${n}" value="${E(val == null ? '' : val)}" size="${sz || 6}"></td></tr>`;
    UI.form('手動輸入生命徵象', `<table class="kv">${f('bp_sys', '收縮壓', v.bp_sys)}${f('bp_dia', '舒張壓', v.bp_dia)}${f('hr', '脈搏', v.hr)}${f('rr', '呼吸', v.rr)}${f('temp', '體溫 °C', v.temp)}${f('spo2', 'SpO₂ %', v.spo2)}${f('weight', '體重 kg', v.weight)}${f('pain', '疼痛 0-10', v.pain)}</table>`, o => S.clVitals(el.dataset.id, o)); };
} });

/* ---------- 批價 ---------- */
const chargeRows = e => DB.where('cl_items', i => i.encounter_id === e).map(i => [i.kind === 'drug' ? '藥品' : (i.type || '處置'), i.name, i.kind === 'drug' ? `${i.dose}×${i.freq}×${i.days}天，共 ${i.qty}${i.unit}` : '×' + i.qty, i.self ? '自費 ' + NT(i.self_amt) : i.amount_pt + ' 點']);
UI.chargeDetail = (encId) => { const ch = DB.one('cl_charges', { encounter_id: encId }), e = DB.get('encounters', encId); if (!ch) return '';
  const rows = ch.ins === '自費' ? [] : [['診察費（今日第 ' + e.visit_no + ' 診）', ch.exam_pt], ['藥費', ch.drug_pt], ['藥事服務費', ch.disp_pt], ['檢驗／處置', ch.svc_pt], ['合計點數', ch.total_pt]];
  return `${table([['類別', r => E(r[0])], ['項目', r => E(r[1])], ['用量', r => E(r[2])], ['金額', r => E(r[3]), 'num']], chargeRows(encId), { empty: '無藥品/處置（僅診察）' })}
  ${ch.ins === '自費' ? kv([['自費診察費', NT(ch.self_exam)], ['自費項目', NT(ch.self_amount)], ['掛號費', NT(ch.reg_fee)], ['應收', `<b>${NT(ch.cash_due)}</b>`]], 4) : kv(rows.map(r => [r[0], r[1] + ' 點']).concat([['門診部分負擔', NT(ch.copay_visit)], ['藥品部分負擔', NT(ch.copay_drug)], ['掛號費', NT(ch.reg_fee)], ['自費項目', NT(ch.self_amount)], ['應收現金', `<b>${NT(ch.cash_due)}</b>`], ['申報健保點數', ch.claim_pt + ' 點']]), 4)}`; };
UI.openClBill = () => UI.win('cl-bill', { title: '批價收費', w: 900, h: 560, live: true, state: { sel: null }, render: w => {
  const L = DB.where('cl_charges', c => c.status === '待批價'), sel = w.state.sel && DB.one('cl_charges', { encounter_id: w.state.sel, status: '待批價' }) ? w.state.sel : (L[0] && L[0].encounter_id);
  const done = DB.where('cl_charges', c => c.date === today() && c.status === '已批價').slice(-6).reverse();
  w.body.innerHTML = `<div style="display:flex;gap:8px;height:100%"><div style="width:300px" class="scrollbox"><div class="hd">待批價（${L.length}）</div>${table([['姓名', c => `<b>${E(HIS.pt(c.patient_id).name)}</b>`], ['身分', c => c.ins], ['應收', c => NT(c.cash_due), 'num'], ['', c => btn('pick', '選', { id: c.encounter_id })]], L, { empty: '沒有待批價病人', rowCls: c => c.encounter_id === sel ? 'sel' : '' })}
  <div class="hd">今日已收（最近）</div>${table([['姓名', c => E(HIS.pt(c.patient_id).name)], ['實收', c => NT(c.cash_due), 'num']], done, { empty: '無' })}</div>
  <div style="flex:1" class="scrollbox">${sel ? (() => { const e = DB.get('encounters', sel), ch = DB.one('cl_charges', { encounter_id: sel }), p = HIS.pt(e.patient_id); return `<div class="hd">${UI.patLine(p)}　${E(e.ins)}${p.exempt ? `　<b class="bad">免部分負擔：${E(p.exempt)}</b>` : ''}</div>${UI.chargeDetail(sel)}
    <div class="bar">收款方式 <select name="method">${opts(['現金', '行動支付', '信用卡'])}</select>　實收 <input name="received" size="8" value="${ch.cash_due}"> 　${btn('pay', '收款並列印收據', { cls: 'pri', id: sel })}</div>` })() : '<div class="empty">請由左側選擇病人</div>'}</div></div>`;
  w.act.pick = el => { w.state.sel = el.dataset.id; }; w.act.pay = el => { const v = UI.vals(w), r = S.clPay(el.dataset.id, { received: v.received, method: v.method }); w.state.sel = null; const e = DB.get('encounters', el.dataset.id);
    UI.alert(`收款完成：應收 ${NT(r.cash_due)}，實收 ${NT(r.received)}，找零 ${NT(r.change)}。\n${e.disp_status === '待領藥' ? '請病人至藥局領藥。' : '本次無需領藥，病人可離院。'}`, '收據'); };
} });

/* ---------- 藥局 ---------- */
UI.openClPharm = () => UI.win('cl-pharm', { title: '藥局：領藥與庫存', w: 1000, h: 600, live: true, state: { q: '' }, render: w => {
  const L = DB.where('encounters', e => e.disp_status === '待領藥' && e.status === '完診').sort((a, b) => a.end_time.localeCompare(b.end_time)), q = (w.state.q || '').toLowerCase();
  const ms = DB.all('medications').filter(m => !q || (m.name_zh + m.ingredient + m.code).toLowerCase().includes(q)), stock = c => DB.where('inventory', i => i.med_code === c && i.qty > 0), tot = c => stock(c).filter(i => i.expiry >= today()).reduce((s, i) => s + i.qty, 0);
  w.body.innerHTML = `<div style="display:flex;gap:8px;height:100%"><div style="width:420px" class="scrollbox"><div class="hd">待領藥（${L.length}）</div>${table([['姓名', e => `<b>${E(HIS.pt(e.patient_id).name)}</b>`], ['批價', e => ((DB.one('cl_charges', { encounter_id: e.id }) || {}).status === '已批價') ? '已批價' : '<b class="bad">未批價</b>'], ['藥品', e => E(DB.where('cl_items', i => i.encounter_id === e.id && i.kind === 'drug').map(i => i.name.split(' ')[0] + '×' + i.qty).join('、'))], ['', e => btn('disp', '調劑發藥', { id: e.id, cls: 'pri' })]], L, { empty: '沒有待領藥病人' })}
  <div class="note">藥師審核：過敏警示、庫存是否足夠、過期批號不可調劑；病人未批價不可領藥。</div></div>
  <div style="flex:1" class="scrollbox"><div class="bar">搜尋藥品 <input data-inp="q" value="${E(w.state.q)}" size="14">　${btn('add', '進貨')}</div>${table([['藥品', m => E(m.name_zh + ' ' + m.spec)], ['成分', m => E(m.ingredient)], ['有效庫存', m => { const t = tot(m.code); return t < 200 ? `<b class="bad">${t}</b>` : t; }, 'num'], ['批號/效期', m => E(stock(m.code).map(i => i.lot_no + '(' + i.expiry.slice(2) + (i.expiry < today() ? ' 過期' : '') + ')').join('、'))]], ms.slice(0, 120), { empty: '無' })}</div></div>`;
  w.inp.q = el => { w.state.q = el.value; UI.refresh(w); const i = $('[data-inp=q]', w.body); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } };
  w.act.disp = el => { const r = DB.get('encounters', el.dataset.id), its = DB.where('cl_items', i => i.encounter_id === r.id && i.kind === 'drug'); UI.dialog('藥師核對：' + HIS.pt(r.patient_id).name, `<div class="note">${UI.algHtml(r.patient_id)}</div>` + table([['藥品', i => E(i.name)], ['用法', i => `${i.dose} ${E(i.freq)} × ${i.days} 天`], ['數量', i => i.qty + E(i.unit)], ['有效庫存', i => tot(i.code), 'num']], its), [{ t: '核對無誤，發藥', primary: true, cb: () => { S.clDispense(r.id); UI.status('已調劑發藥'); } }, { t: '取消' }]); };
  w.act.add = () => UI.form('藥品進貨', `<table class="kv"><tr><th>藥品</th><td><select name="code">${opts(DB.all('medications').map(m => [m.code, m.name_zh + ' ' + m.spec]))}</select></td></tr><tr><th>批號</th><td><input name="lot" value="L${Date.now().toString().slice(-6)}"></td></tr><tr><th>效期</th><td><input type="date" name="exp" value="${HIS.addDays(today(), 540)}"></td></tr><tr><th>數量</th><td><input name="qty" value="500" size="6"></td></tr></table>`, o => { S.clAddStock(o.code, o.lot, o.exp, o.qty); UI.status('進貨完成'); });
} });

/* ---------- 外送檢驗報告 ---------- */
UI.openClLab = () => UI.win('cl-lab', { title: '外送檢驗／報告閱讀', w: 900, h: 460, live: true, render: w => {
  const its = DB.where('cl_items', i => i.kind === 'svc' && i.type === '外送檢驗').sort((a, b) => (b.date).localeCompare(a.date)).slice(0, 60);
  w.body.innerHTML = `<div class="note">外送檢驗需數日才回報；營業日結後依日數自動回報。回報後請醫師閱讀並處理（異常者須通知病人回診）。</div><div class="scrollbox" style="height:calc(100% - 40px)">${table([['開單日', i => i.date], ['病人', i => E(HIS.pt(i.patient_id).name)], ['項目', i => E(i.name)], ['狀態', i => i.result_status === '待回報' ? `預計 ${E(i.result_due)} 回報` : i.result_status === '已回報' ? '<b class="bad">待閱讀</b>' : '已閱'], ['結果', i => i.result_status === '待回報' ? '' : (i.abnormal ? `<b class="bad">${E(i.result)}</b>` : E(i.result))], ['', i => i.result_status === '已回報' && HIS.can('cl_doctor') ? btn('rev', '閱讀並註記', { id: i.id, cls: 'pri' }) : E(i.review_note || '')]], its, { empty: '沒有外送檢驗' })}</div>`;
  w.act.rev = el => UI.ask('閱讀報告', '處理意見（如：數值偏高，通知病人兩週內回診）', v => S.clReviewLab(el.dataset.id, v), { optional: true });
} });

/* ---------- 日結 ---------- */
UI.openClClose = () => UI.win('cl-close', { title: '日結與營運報表', w: 940, h: 600, live: true, render: w => {
  const d = today(), s = CL.dayStats(d), aps = todayAps().filter(a => ['櫃台等候', '候診中'].includes(a.status)).length, unp = DB.where('cl_charges', c => c.date === d && c.status === '待批價').length, und = DB.where('encounters', e => e.date === d && e.disp_status === '待領藥').length;
  const hist = DB.all('cl_closes').slice(-14).reverse(), blocked = aps + unp + und;
  w.body.innerHTML = `<div class="scrollbox" style="height:100%"><div class="hd">${d} 當日統計（未日結）</div>${kv([['看診人次', s.visits], ['健保／自費', s.nhi_visits + ' ／ ' + s.self_visits], ['診察費點數', s.exam_pt], ['藥費點數', s.drug_pt], ['藥事服務費點數', s.disp_pt], ['檢驗處置點數', s.svc_pt], ['申報點數合計', s.claim_pt], ['預估健保收入', NT(s.est_nhi)], ['現金收入（含部分負擔/掛號/自費）', NT(s.cash)], ['藥品成本', NT(s.drug_cost)], ['檢驗成本', NT(s.svc_cost)], ['預估毛利', `<b>${NT(s.gross)}</b>`]], 4)}
  <div class="bar">${btn('close', '執行日結 → 進入下一營業日', { cls: 'pri', dis: !HIS.can('cl_bill') })}　${blocked ? `<span class="bad">尚有 ${aps} 人未處理、${unp} 筆未批價、${und} 人未領藥，無法日結</span>` : '<span class="muted">所有病人已處理完畢，可日結</span>'}</div>
  <div class="hd">歷史日結</div>${table([['日期', r => r.date], ['人次', r => r.visits, 'num'], ['健保/自費', r => r.nhi_visits + '/' + r.self_visits], ['申報點數', r => r.claim_pt, 'num'], ['現金', r => NT(r.cash), 'num'], ['預估健保收入', r => NT(r.est_nhi), 'num'], ['成本', r => NT(r.drug_cost + r.svc_cost), 'num'], ['毛利', r => NT(r.gross), 'num'], ['結帳人', r => E(HIS.staffName(r.closed_by))]], hist, { empty: '尚無日結' })}</div>`;
  w.act.close = () => UI.confirm('日結後營業日將前進一天，當日資料不可再變更。確定？', () => { const r = S.clCloseDay(); UI.alert(`${r.date} 日結完成：${r.visits} 人次，現金 ${NT(r.cash)}，預估毛利 ${NT(r.gross)}。\n現在是 ${today()}。`, '日結完成'); });
} });
})(typeof globalThis !== 'undefined' ? globalThis : window);
