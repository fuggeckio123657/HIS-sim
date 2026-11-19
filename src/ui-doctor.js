/* ---- HIS UI：醫師工作站與共用視窗（病人查詢、病人資料、候診、看診工作區、報告檢視、會診、病歷版本） ---- */
(function (G) {
'use strict';
const HIS = G.HIS, DB = HIS.DB, S = HIS.svc, UI = HIS.UI;
const { E, $, $$, st, flag, fdt, sexAge, table, kv, btn, opts } = UI;
const me = () => HIS.session.user;
const FL = { cc: '主訴 CC', hpi: '現病史 HPI', pmh: '過去病史 PMH', fh: '家族史 FH', sh: '社會史 SH', ros: '系統回顧 ROS', pe: '身體檢查 PE', assessment: '評估 Assessment', plan: '治療計畫 Plan' };
const FROWS = { cc: 2, hpi: 4, pmh: 2, fh: 2, sh: 2, ros: 3, pe: 4, assessment: 3, plan: 4 };
const TPL = {
  '上呼吸道感染': { cc: '流鼻水、咳嗽、喉嚨痛 ＿天', hpi: '＿天前開始出現流鼻水、喉嚨痛及咳嗽，無明顯發燒，食慾尚可。', ros: '無呼吸喘、無胸痛、無腹瀉嘔吐、無皮疹。', pe: '咽喉紅腫，扁桃腺無膿點；雙肺呼吸音清晰，無囉音。', assessment: 'Acute upper respiratory infection', plan: '症狀治療；多休息多喝水；若發燒超過 3 天或呼吸喘請回診。' },
  '高血壓追蹤': { cc: '高血壓定期回診', hpi: '高血壓病史，規則服藥，居家血壓約＿/＿ mmHg，無頭痛頭暈胸悶。', ros: '無胸痛、心悸、視力模糊、下肢水腫。', pe: '心音規則無雜音；雙肺呼吸音清；下肢無水腫。', assessment: 'Essential hypertension，控制（良好/尚可/不佳）', plan: '續用降血壓藥物；低鹽飲食；居家血壓監測；＿週後回診。' },
  '糖尿病追蹤': { cc: '糖尿病回診，追蹤血糖', hpi: '第2型糖尿病，自測飯前血糖約＿mg/dL，無三多症狀、無低血糖。', ros: '無視力改變、足部麻木或傷口。', pe: '足部無潰瘍，足背脈搏可；心肺聽診正常。', assessment: 'Type 2 diabetes mellitus', plan: '續用降血糖藥；飲食運動衛教；抽血 HbA1c、血脂、腎功能；3 個月回診。' },
  '腹痛': { cc: '腹痛 ＿天', hpi: '＿天前開始（上/下/左/右）腹痛，性質為（悶/絞/刺）痛，伴隨（噁心/嘔吐/腹瀉/發燒）。', ros: '無血便、黑便、體重減輕、泌尿道症狀。', pe: '腹部（柔軟/緊繃），（壓痛/反彈痛）位置＿；腸音正常。', assessment: 'Abdominal pain，鑑別診斷：＿', plan: '抽血、腹部影像檢查；症狀治療；若加劇請立即回診/急診。' },
  '胸痛': { cc: '胸痛 ＿分鐘/小時', hpi: '胸痛性質＿，位置＿，（有/無）放射痛，（有/無）冒冷汗、呼吸喘。', ros: '無咳嗽發燒、無下肢腫脹。', pe: '心音規則，無雜音；雙肺呼吸音對稱；胸壁（有/無）壓痛。', assessment: 'Chest pain，r/o ACS / PE / GERD', plan: '心電圖、心肌酵素、胸部 X 光；觀察生命徵象。' },
  '下背痛': { cc: '下背痛 ＿週', hpi: '（搬重物/姿勢不良）後下背痛，彎腰加劇，（有/無）下肢放射痛或麻木，無大小便異常。', ros: '無發燒、體重減輕。', pe: '腰椎旁肌肉壓痛；直膝抬腿試驗＿；下肢肌力 5/5。', assessment: 'Low back pain', plan: '消炎止痛、肌肉鬆弛劑；復健；避免提重物；＿週後回診。' },
  '住院病程(SOAP)': { cc: '', hpi: 'S：病人主訴＿；夜間睡眠＿；食慾＿。', pe: 'O：T/P/R/BP＿；理學檢查＿；檢驗/影像＿。', assessment: 'A：＿，病況（改善/穩定/惡化）。', plan: 'P：續現行治療；追蹤＿；預計出院日＿。' }
};
UI.openWorklist = () => UI.win('worklist', { title: '我的工作清單', w: 520, h: 420, live: true, render: w => {
  const u = me(), items = S.worklist(), unread = S.unreadMsgs();
  w.body.innerHTML = `<div class="pad"><div class="hd">${E(u.name)}（${E(u.title)}）　${E(HIS.today())}</div>
  ${table([['項目', r => E(r[0])], ['待處理', r => r[1] ? `<b class="bad">${r[1]}</b>` : '0', 'num'], ['', r => btn('go', '開啟', { id: r[2] })]], items.map(r => Object.assign([...r], { id: r[2] })), { empty: '本角色無待辦項目' })}
  <div class="hd" style="margin-top:8px">系統訊息（未讀 ${unread.length}）</div>
  ${table([['時間', r => fdt(r.at)], ['內容', r => E(r.text)]], unread.slice(-6).reverse(), { empty: '無未讀訊息' })}${btn('msgs', '開啟系統訊息')}</div>`;
  w.act.go = el => { const m = { opd: 'openAppt', results: 'openResults', consult: 'openConsults', er: 'openER', pharm: 'openPharmacy', lab: 'openLab', rad: 'openRadiology', nurse: 'openNurse', adt: 'openAdmReq', reg: 'openAppt', beds: 'openBeds' }[el.dataset.id]; if (m && UI[m]) UI[m](); };
  w.act.msgs = () => UI.openMessages();
} });
UI.openMessages = () => UI.win('messages', { title: '系統訊息', w: 640, h: 380, live: true, render: w => {
  const ms = DB.where('messages', m => m.to_user === me().id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 80);
  w.body.innerHTML = `<div class="bar">${btn('readall', '全部標示已讀')}</div><div class="scrollbox">${table([['時間', r => fdt(r.at)], ['狀態', r => r.read ? '已讀' : '<b class="bad">未讀</b>'], ['訊息', r => E(r.text)]], ms, { empty: '無訊息', rowCls: r => r.read ? '' : 'unrd' })}</div>`;
  w.act.readall = () => { ms.filter(m => !m.read).forEach(m => DB.update('messages', m.id, { read: true })); };
} });

/* ---------- 病人查詢 ---------- */
UI.openSearch = () => UI.win('search', { title: '病人查詢', w: 1000, h: 520, state: { q: {}, rs: null }, render: w => {
  const q = w.state.q, rs = w.state.rs, docs = DB.where('users', u => DB.get('roles', u.role_id).perms.includes('opd') && u.dept_id !== 'DEP-ER' || u.id === 'U-D011');
  const enc = DB.all('encounters');
  w.body.innerHTML = `<div class="form"><table class="kv"><tr>
  <th>病歷號</th><td><input name="chart" value="${E(q.chart || '')}" size="10"></td><th>姓名</th><td><input name="name" value="${E(q.name || '')}" size="10"></td><th>身分證號(虛構)</th><td><input name="idno" value="${E(q.idno || '')}" size="11"></td><th>就診日期</th><td><input type="date" name="date" value="${E(q.date || '')}"></td></tr><tr>
  <th>科別</th><td><select name="dept">${opts(DB.where('departments', d => d.kind === '臨床').map(d => [d.id, d.name]), q.dept, '全部')}</select></td><th>主治/醫師</th><td><select name="doctor">${opts(docs.map(d => [d.id, d.name + '（' + HIS.deptName(d.dept_id) + '）']), q.doctor, '全部')}</select></td><th>住院床號</th><td><input name="bed" value="${E(q.bed || '')}" size="8" placeholder="如 5A-03"></td><td colspan="2">${btn('go', '查詢', { cls: 'pri' })} ${btn('clr', '清除')}</td></tr></table></div>
  <div class="hd">查詢結果：${rs ? rs.length + ' 筆' + (rs.length >= 300 ? '（僅顯示前300筆）' : '') : '請輸入條件後查詢（未輸入條件將列出全部病人）'}</div><div class="scrollbox" style="height:calc(100% - 118px)">${rs ? table([
    ['病歷號', p => E(p.chart_no)], ['姓名', p => `<b>${E(p.name)}</b>`], ['性別', p => p.sex === 'M' ? '男' : '女'], ['年齡', p => HIS.age(p.birth)], ['出生日期', p => p.birth], ['身分證號', p => HIS.maskId(p.id_no)], ['血型', p => E(p.blood)], ['過敏', p => HIS.allergies(p.id).length ? '<b class="bad">有</b>' : ''],
    ['最近就診', p => { const e = enc.filter(x => x.patient_id === p.id).sort((a, b) => b.start_time.localeCompare(a.start_time))[0]; return e ? `${e.start_time.slice(0, 10)} ${HIS.deptName(e.dept_id)}` : ''; }],
    ['住院床號', p => { const a = DB.one('admissions', x => x.patient_id === p.id && ['住院中', '出院準備'].includes(x.status)); return a ? `<b>${E(a.bed_id)}</b>` : ''; }], ['', p => btn('open', '開啟', { id: p.id })]], rs, { dbl: 'open', empty: '查無符合條件之病人' }) : ''}</div>`;
  const read = () => { w.state.q = {}; $$('[name]', w.body).forEach(e => { w.state.q[e.name] = e.value; }); };
  w.act.go = () => { read(); const c = {}; Object.keys(w.state.q).forEach(k => { if (w.state.q[k]) c[k] = w.state.q[k]; }); w.state.rs = S.searchPatients(c); UI.refresh(w); UI.status('查詢完成：' + w.state.rs.length + ' 筆'); };
  w.act.clr = () => { w.state.q = {}; w.state.rs = null; UI.refresh(w); };
  w.act.open = el => UI.openPatient(el.dataset.id); w.dbl.open = tr => UI.openPatient(tr.dataset.id);
  $$('input[name]', w.body).forEach(i => { i.onkeydown = e => { if (e.key === 'Enter') w.act.go(); }; });
} });

/* ---------- 病人基本資料 ---------- */
UI.openPatient = pid => { S.viewPatient(pid); const p = HIS.pt(pid); UI.win('pt:' + pid, { title: `病人資料 ${p.chart_no} ${p.name}`, w: 1000, h: 620, live: true, pid, state: {}, render: w => {
  const p = HIS.pt(pid), al = HIS.allergies(pid), hs = DB.where('medical_histories', h => h.patient_id === pid), encs = DB.where('encounters', e => e.patient_id === pid).sort((a, b) => b.start_time.localeCompare(a.start_time));
  const adm = DB.one('admissions', a => a.patient_id === pid && ['住院中', '出院準備'].includes(a.status));
  const open = encs.find(e => e.status !== '完成' && me().id && (e.doctor_id === me().id || HIS.can('*')));
  const hk = k => hs.filter(h => h.kind === k).map(h => E(h.text) + (h.since ? `（${E(h.since)}）` : '')).join('；') || '無';
  const canH = HIS.can('opd');
  w.body.innerHTML = `<div class="bar">${UI.patLine(p)}　${adm ? `<b>住院中：${E(adm.bed_id)}</b>` : ''}　${open ? btn('ws', '進入看診工作區', { id: open.id, cls: 'pri' }) : ''}</div><div class="scrollbox" style="height:calc(100% - 30px)">
  <div class="hd">基本資料</div>${kv([['病歷號', E(p.chart_no)], ['姓名', E(p.name)], ['性別', p.sex === 'M' ? '男' : '女'], ['出生日期', p.birth], ['年齡', HIS.age(p.birth)], ['身分證字號', HIS.maskId(p.id_no)], ['血型', E(p.blood)], ['保險身分', E(p.ins_type)], ['身高(cm)', p.height], ['體重(kg)', p.weight], ['BMI', p.height ? (p.weight / Math.pow(p.height / 100, 2)).toFixed(1) : ''], ['建檔日期', fdt(p.created_at)], ['手機', E(p.phone)], ['住家電話', E(p.tel)], ['地址', E(p.address)], ['', ''], ['緊急聯絡人', `${E(p.emergency_name)}（${E(p.emergency_rel)}）`], ['緊急聯絡電話', E(p.emergency_phone)], ['特殊註記', E(p.notes)], ['', '']])}
  <div class="hd">過敏史 ${canH ? btn('addalg', '＋新增過敏') : ''}</div>${table([['過敏原', a => E(a.allergen)], ['類別代碼', a => E(a.allergen_class || '非藥物')], ['反應', a => E(a.reaction)], ['嚴重度', a => a.severity === '重度' ? `<b class="bad">${E(a.severity)}</b>` : E(a.severity)], ['登錄日期', a => fdt(a.recorded_at)], ['登錄者', a => E(HIS.staffName(a.recorded_by))]], al, { empty: '無已知過敏' })}
  <div class="hd">病史 ${canH ? btn('addh', '＋新增病史') : ''}</div>${kv([['慢性病史', hk('慢性病')], ['長期用藥', hk('長期用藥')], ['過去病史', hk('過去病史')], ['手術史', hk('手術史')], ['家族病史', hk('家族史')], ['社會史', hk('社會史')]], 2)}
  <div class="hd">就診紀錄（${encs.length}）</div>${table([['日期', e => fdt(e.start_time)], ['類型', e => ({ OPD: '門診', ER: '急診', IPD: '住院' }[e.type])], ['科別', e => E(HIS.deptName(e.dept_id))], ['醫師', e => E(HIS.staffName(e.doctor_id))], ['主要診斷', e => { const d = DB.where('diagnoses', x => x.encounter_id === e.id && x.type === '主要' && x.status !== '已刪除')[0]; return d ? `${E(d.icd_code)} ${E(d.zh)}` : ''; }], ['狀態', e => st(e.status)], ['', e => HIS.can('emr') || HIS.can('records') ? btn('enc', '開啟', { id: e.id }) : '']], encs, { dbl: 'enc' })}
  </div>`;
  w.act.ws = el => UI.openWorkspace(el.dataset.id); w.act.enc = el => UI.openWorkspace(el.dataset.id); w.dbl.enc = tr => UI.openWorkspace(tr.dataset.id);
  w.act.addalg = () => UI.form('新增過敏史', `<table class="kv"><tr><th>過敏原</th><td><input name="allergen"></td></tr><tr><th>藥理類別</th><td><select name="allergen_class">${opts([['', '非藥物'], ['penicillin', 'penicillin 青黴素'], ['cephalosporin', 'cephalosporin 頭孢'], ['sulfa', 'sulfa 磺胺'], ['nsaid', 'NSAID/阿斯匹靈'], ['quinolone', 'quinolone 奎諾酮'], ['macrolide', 'macrolide 大環內酯']])}</select></td></tr><tr><th>反應</th><td><input name="reaction"></td></tr><tr><th>嚴重度</th><td><select name="severity">${opts(['輕度', '中度', '重度'])}</select></td></tr></table>`, v => { if (!v.allergen || !v.reaction) throw new Error('過敏原與反應必填'); S.addAllergy(pid, v); });
  w.act.addh = () => UI.form('新增病史', `<table class="kv"><tr><th>類別</th><td><select name="kind">${opts(['慢性病', '長期用藥', '過去病史', '手術史', '家族史', '社會史'])}</select></td></tr><tr><th>內容</th><td><input name="text" size="40"></td></tr><tr><th>起始年份</th><td><input name="since" size="6"></td></tr></table>`, v => { if (!v.text) throw new Error('內容必填'); S.addHistory(pid, v); });
} }); };

/* ---------- 門診候診清單 / 掛號清單 ---------- */
UI.openAppt = () => UI.win('appt', { title: HIS.can('opd') ? '門診候診清單' : '今日掛號清單', w: 1050, h: 520, live: true, state: { date: HIS.today(), dept: HIS.can('opd') ? me().dept_id : '', doc: '' }, render: w => {
  const s = w.state, list = DB.where('appointments', a => a.date === s.date && (!s.dept || a.dept_id === s.dept) && (!s.doc || a.doctor_id === s.doc)).sort((a, b) => a.doctor_id.localeCompare(b.doctor_id) || a.session.localeCompare(b.session) || a.queue_no - b.queue_no);
  const docs = DB.where('users', u => ['R-attending', 'R-resident'].includes(u.role_id) && u.dept_id !== 'DEP-ER' && (!s.dept || u.dept_id === s.dept));
  w.body.innerHTML = `<div class="bar">日期 <input type="date" name="date" value="${s.date}" data-chg="f"> 科別 <select name="dept" data-chg="f">${opts(DB.where('departments', d => d.kind === '臨床' && d.id !== 'DEP-ER').map(d => [d.id, d.name]), s.dept, '全部')}</select> 醫師 <select name="doc" data-chg="f">${opts(docs.map(d => [d.id, d.name]), s.doc, '全部')}</select>　共 ${list.length} 筆　${HIS.can('reg') ? btn('newreg', '＋新增掛號') : ''}</div>
  <div class="scrollbox" style="height:calc(100% - 30px)">${table([['診間醫師', a => E(HIS.staffName(a.doctor_id))], ['科別', a => E(HIS.deptName(a.dept_id))], ['診次', a => E(a.session)], ['號', a => a.queue_no, 'num'], ['病歷號', a => E(HIS.pt(a.patient_id).chart_no)], ['姓名', a => `<a class="lnk" data-act="pt" data-id="${a.patient_id}">${E(HIS.pt(a.patient_id).name)}</a>`], ['性別/年齡', a => sexAge(HIS.pt(a.patient_id))], ['過敏', a => HIS.allergies(a.patient_id).length ? '<b class="bad">⚠</b>' : ''], ['狀態', a => st(a.status)], ['動作', a => {
    let h = ''; if (HIS.can('opd') && !['取消', '已看診'].includes(a.status)) h += btn('start', a.encounter_id ? '繼續看診' : '開始看診', { id: a.id, cls: 'pri' });
    if (a.status === '已看診' && a.encounter_id) h += btn('view', '檢視', { id: a.encounter_id }); if (HIS.can('reg') && a.status === '已掛號') h += btn('ci', '報到', { id: a.id }); if (HIS.can('reg') && ['已掛號', '候診中'].includes(a.status)) h += btn('cx', '取消', { id: a.id }); return h; }]], list, { empty: '當日無掛號資料' })}</div>`;
  w.chg.f = () => { Object.assign(s, UI.vals(w)); if (s.doc && DB.get('users', s.doc).dept_id !== s.dept && s.dept) s.doc = ''; UI.refresh(w); };
  w.act.pt = el => UI.openPatient(el.dataset.id); w.act.view = el => UI.openWorkspace(el.dataset.id); w.act.newreg = () => UI.openRegister();
  w.act.start = el => { const e = S.startVisit(el.dataset.id); UI.openWorkspace(e.id); }; w.act.ci = el => S.checkin(el.dataset.id);
  w.act.cx = el => UI.confirm('確定取消此掛號？', () => UI.safe(() => S.cancelAppt(el.dataset.id)));
} });

/* ---------- 報告檢視 ---------- */
UI.radImg = (mod, code) => {
  const ell = (cx, cy, rx, ry, o) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${o}"/>`;
  let body = '';
  if (code === 'CXR') body = ell(80, 110, 38, 62, .35) + ell(160, 110, 38, 62, .35) + '<rect x="115" y="30" width="10" height="150" fill="#ddd" opacity=".5"/>' + ell(130, 130, 28, 32, .45);
  else if (mod === 'CT' || mod === 'MRI') body = '<circle cx="120" cy="105" r="75" fill="none" stroke="#ccc" stroke-width="5"/>' + ell(120, 105, 62, 55, .25) + ell(100, 100, 18, 26, .4) + ell(142, 100, 18, 26, .4);
  else if (mod === 'Ultrasound') body = '<path d="M120 10 L20 190 L220 190 Z" fill="#555" opacity=".7"/>' + ell(110, 110, 30, 20, .35) + ell(150, 130, 20, 14, .25);
  else body = '<rect x="95" y="20" width="50" height="160" rx="12" fill="#ddd" opacity=".4"/>' + ell(120, 60, 22, 14, .5) + ell(120, 100, 22, 14, .5) + ell(120, 140, 22, 14, .5);
  return `<svg viewBox="0 0 240 200" width="240" height="200" style="background:#111;border:1px solid #444">${body}<text x="6" y="14" fill="#9c9" font-size="10">${E(mod)} 示意圖（虛構，非真實影像）</text></svg>`;
};
UI.openLabReport = oid => { const o = DB.get('lab_orders', oid); UI.win('lr:' + oid, { title: `檢驗報告 ${HIS.pt(o.patient_id).name} ${o.panel_name}`, w: 860, h: 520, live: true, render: w => {
  const o = DB.get('lab_orders', oid), p = HIS.pt(o.patient_id), published = o.report_status === '已發布', staff = HIS.can('lab') || HIS.can('records') || HIS.can('*');
  if (!published && !staff) { w.body.innerHTML = `<div class="pad"><div class="empty">此報告尚未發布（狀態：${E(o.report_status)}）。檢驗科發布後將通知開單醫師。</div></div>`; return; }
  if (published && o.ordered_by === me().id) S.markViewed('lab', oid);
  const sp = o.specimen_id ? DB.get('specimens', o.specimen_id) : null, rs = DB.where('lab_results', r => r.lab_order_id === oid);
  const prev = DB.where('lab_orders', x => x.patient_id === o.patient_id && x.panel_code === o.panel_code && x.report_status === '已發布' && x.id !== oid).sort((a, b) => b.published_at.localeCompare(a.published_at)).slice(0, 3);
  w.body.innerHTML = `<div class="bar">${UI.patLine(p)}</div><div class="scrollbox" style="height:calc(100% - 30px)">${kv([['檢驗項目', E(o.panel_name)], ['檢體', E(o.specimen_type)], ['醫囑時間', fdt(o.ordered_at)], ['開單醫師', E(HIS.staffName(o.ordered_by))], ['採檢時間', sp ? fdt(sp.collected_at) : '-'], ['收件時間', sp ? fdt(sp.received_at) : '-'], ['檢體條碼', sp ? E(sp.barcode) : '-'], ['報告狀態', st(o.report_status)], ['發布時間', fdt(o.published_at)], ['檢驗師', E(HIS.staffName(o.published_by || o.completed_by))]], 4)}
  ${table([['項目', r => E(r.name)], ['結果', r => `<b class="${r.flag && r.flag !== 'N' ? 'bad' : ''}">${E(r.value)}</b>`, 'num'], ['標示', r => flag(r.flag)], ['單位', r => E(r.unit)], ['參考區間', r => r.ref_text ? E(r.ref_text) : `${r.ref_lo == null ? '' : r.ref_lo} – ${r.ref_hi == null ? '' : r.ref_hi}`]], rs, { rowCls: r => r.flag === 'HH' || r.flag === 'LL' ? 'crit' : r.flag && r.flag !== 'N' ? 'abn' : '' })}
  ${prev.length ? `<div class="hd">歷次對照（同項目）</div><table class="grid"><thead><tr><th>項目</th><th>本次</th>${prev.map(x => `<th>${x.published_at.slice(0, 10)}</th>`).join('')}</tr></thead><tbody>${rs.map(r => `<tr><td>${E(r.name)}</td><td class="num">${E(r.value)} ${flag(r.flag)}</td>${prev.map(x => { const y = DB.one('lab_results', z => z.lab_order_id === x.id && z.analyte === r.analyte); return `<td class="num">${y ? E(y.value) + ' ' + flag(y.flag) : '-'}</td>`; }).join('')}</tr>`).join('')}</tbody></table>` : ''}</div>`;
} }); };
UI.openRadReport = oid => { const o = DB.get('radiology_orders', oid); UI.win('rr:' + oid, { title: `影像報告 ${HIS.pt(o.patient_id).name} ${o.exam_name}`, w: 780, h: 500, live: true, render: w => {
  const o = DB.get('radiology_orders', oid), p = HIS.pt(o.patient_id), r = DB.one('radiology_reports', x => x.order_id === oid);
  const vis = (r && r.status === '已發布') || HIS.can('rad_report') || HIS.can('rad_exec') || HIS.can('records');
  if (r && r.status === '已發布' && o.ordered_by === me().id) S.markViewed('rad', oid);
  w.body.innerHTML = `<div class="bar">${UI.patLine(p)}</div><div class="scrollbox" style="height:calc(100% - 30px)">${kv([['檢查項目', E(o.exam_name)], ['檢查種類', E(o.modality)], ['申請醫師', E(HIS.staffName(o.ordered_by))], ['申請時間', fdt(o.ordered_at)], ['臨床問題', E(o.reason)], ['檢查狀態', st(o.exam_status)], ['排程', o.scheduled_at ? fdt(o.scheduled_at) + ' ' + E(o.room || '') : ''], ['判讀醫師', r ? E(HIS.staffName(r.radiologist_id)) : '']], 4)}
  <div style="display:flex;gap:10px;margin-top:6px">${UI.radImg(o.modality, o.exam_code)}<div style="flex:1">${vis && r ? `<div class="hd">Findings</div><div class="txt">${E(r.findings)}</div><div class="hd">Impression</div><div class="txt"><b>${E(r.impression)}</b></div><div class="note">報告狀態：${st(r.status)}　${r.published_at ? '發布：' + fdt(r.published_at) : ''}</div>` : '<div class="empty">報告尚未發布</div>'}</div></div></div>`;
} }); };

/* ---------- 結果追蹤（醫師） ---------- */
UI.openResults = () => UI.win('results', { title: '檢驗/影像結果追蹤', w: 980, h: 500, live: true, state: { mine: HIS.can('cpoe'), chart: '' }, render: w => {
  const s = w.state, u = me(), pid = s.chart ? DB.where('patients', p => p.chart_no.includes(s.chart) || p.name.includes(s.chart)).map(p => p.id) : null;
  const f = o => (!s.mine || o.ordered_by === u.id) && (!pid || pid.includes(o.patient_id));
  const labs = DB.where('lab_orders', o => f(o) && o.status !== '已取消').sort((a, b) => b.ordered_at.localeCompare(a.ordered_at)).slice(0, 100), rads = DB.where('radiology_orders', o => f(o) && o.status !== '已取消').sort((a, b) => b.ordered_at.localeCompare(a.ordered_at)).slice(0, 60);
  const abn = o => { const n = DB.where('lab_results', r => r.lab_order_id === o.id && r.flag && r.flag !== 'N'); return n.length ? `<b class="bad">${n.length} 項${n.some(r => r.flag === 'HH' || r.flag === 'LL') ? '（危急值）' : ''}</b>` : (o.report_status === '已發布' ? '正常' : ''); };
  w.body.innerHTML = `<div class="bar"><label><input type="checkbox" name="mine" data-chg="f" ${s.mine ? 'checked' : ''}> 僅我開立</label>　病人 <input name="chart" value="${E(s.chart)}" size="10" placeholder="病歷號/姓名" data-chg="f"></div><div class="scrollbox" style="height:calc(100% - 30px)"><div class="hd">檢驗（${labs.length}）</div>${table([['開立時間', o => fdt(o.ordered_at)], ['病人', o => E(HIS.pt(o.patient_id).name) + ' ' + E(HIS.pt(o.patient_id).chart_no)], ['項目', o => E(o.panel_name)], ['報告狀態', o => st(o.report_status === '未開始' ? o.status : o.report_status)], ['異常', abn], ['已閱', o => o.report_status === '已發布' ? (o.viewed_at ? fdt(o.viewed_at) : '<b class="bad">未閱</b>') : ''], ['', o => o.report_status === '已發布' ? btn('lab', '檢閱', { id: o.id, cls: 'pri' }) : '']], labs, { rowCls: o => o.report_status === '已發布' && !o.viewed_at && o.ordered_by === u.id ? 'unrd' : '' })}
  <div class="hd">影像（${rads.length}）</div>${table([['開立時間', o => fdt(o.ordered_at)], ['病人', o => E(HIS.pt(o.patient_id).name) + ' ' + E(HIS.pt(o.patient_id).chart_no)], ['檢查', o => E(o.exam_name)], ['檢查狀態', o => st(o.exam_status)], ['已閱', o => o.exam_status === '已發布' ? (o.viewed_at ? fdt(o.viewed_at) : '<b class="bad">未閱</b>') : ''], ['', o => o.exam_status === '已發布' ? btn('rad', '檢閱', { id: o.id, cls: 'pri' }) : '']], rads, { rowCls: o => o.exam_status === '已發布' && !o.viewed_at && o.ordered_by === u.id ? 'unrd' : '' })}</div>`;
  w.chg.f = () => { const v = UI.vals(w); s.mine = v.mine; s.chart = v.chart; UI.refresh(w); }; w.act.lab = el => UI.openLabReport(el.dataset.id); w.act.rad = el => UI.openRadReport(el.dataset.id);
} });

/* ---------- 會診 ---------- */
UI.openConsults = () => UI.win('consults', { title: '會診作業', w: 900, h: 460, live: true, state: { tab: 'in' }, render: w => {
  const u = me(), s = w.state, list = DB.where('consultations', c => s.tab === 'in' ? c.to_dept === u.dept_id : c.from_doctor === u.id).sort((a, b) => b.sent_at.localeCompare(a.sent_at));
  w.body.innerHTML = `<div class="tabs"><a class="${s.tab === 'in' ? 'on' : ''}" data-act="t" data-id="in">收到的會診（${HIS.deptName(u.dept_id)}）</a><a class="${s.tab === 'out' ? 'on' : ''}" data-act="t" data-id="out">我發出的會診</a></div><div class="scrollbox" style="height:calc(100% - 28px)">${table([['時間', c => fdt(c.sent_at)], ['病人', c => `<a class="lnk" data-act="pt" data-id="${c.patient_id}">${E(HIS.pt(c.patient_id).name)}</a>`], ['申請科別', c => E(HIS.deptName(c.from_dept))], ['受會診科別', c => E(HIS.deptName(c.to_dept))], ['緊急度', c => c.urgency === '急件' ? '<b class="bad">急件</b>' : E(c.urgency)], ['原因', c => E(c.reason)], ['狀態', c => st(c.status)], ['回覆', c => E(c.reply || '')], ['', c => c.status === '已送出' && s.tab === 'in' ? btn('reply', '回覆', { id: c.id, cls: 'pri' }) : btn('ws', '病歷', { id: DB.get('encounters', c.encounter_id) ? c.encounter_id : '' })]], list, { empty: '無會診資料' })}</div>`;
  w.act.t = el => { s.tab = el.dataset.id; UI.refresh(w); }; w.act.pt = el => UI.openPatient(el.dataset.id); w.act.ws = el => { if (el.dataset.id) UI.openWorkspace(el.dataset.id); };
  w.act.reply = el => UI.ask('會診回覆', '請輸入會診意見與建議：', v => S.replyConsult(el.dataset.id, v), { rows: 5 });
} });

/* ---------- 病歷檢視 / 版本比對 ---------- */
UI.openRecordView = rid => { const r = DB.get('medical_records', rid); UI.win('rv:' + rid, { title: `病歷檢視 ${HIS.pt(r.patient_id).name} ${r.type}`, w: 900, h: 560, state: { ver: null }, live: true, render: w => {
  const r = DB.get('medical_records', rid), vs = DB.where('record_versions', v => v.record_id === rid).sort((a, b) => a.version - b.version), s = w.state;
  const cur = vs.find(v => v.version === s.ver) || vs[vs.length - 1] || r, prev = vs.find(v => v.version === cur.version - 1);
  S.viewPatient && 0; HIS.audit('VIEW', 'medical_records', rid, '檢視病歷', r.patient_id);
  w.body.innerHTML = `<div class="bar">${UI.patLine(HIS.pt(r.patient_id))}</div><div class="scrollbox" style="height:calc(100% - 30px)">${kv([['病歷類型', E(r.type)], ['狀態', st(r.status)], ['目前版本', 'v' + r.version], ['就診', E(r.encounter_id)], ['建立', `${fdt(r.created_at)} ${E(HIS.staffName(r.created_by))}`], ['最後修改', `${fdt(r.updated_at)} ${E(HIS.staffName(r.updated_by))}`], ['簽署', r.signed_at ? `${fdt(r.signed_at)} ${E(HIS.staffName(r.signed_by))}` : '未簽署'], ['', '']])}
  <div class="hd">版本歷程（簽署後修改不覆寫，保留每一版）</div>${table([['版本', v => 'v' + v.version], ['簽署時間', v => fdt(v.saved_at)], ['簽署者', v => E(HIS.staffName(v.saved_by))], ['修訂原因', v => E(v.reason)], ['', v => btn('ver', v.version === cur.version ? '檢視中' : '檢視', { id: v.version, dis: v.version === cur.version })]], vs, { empty: '尚無已簽署版本' })}
  <div class="hd">內容${vs.length ? ' — 版本 v' + cur.version + (prev ? '（黃底為與前一版相異之欄位）' : '') : '（未簽署草稿）'}</div>${HIS.REC_FIELDS.map(k => { const ch = prev && (prev[k] || '') !== (cur[k] || ''); return `<div class="fld ${ch ? 'chg' : ''}"><b>${FL[k]}</b><div class="txt">${E(cur[k] || '（空白）').replace(/\n/g, '<br>')}</div></div>`; }).join('')}</div>`;
  w.act.ver = el => { s.ver = +el.dataset.id; UI.refresh(w); };
} }); };

/* ================= 看診工作區 ================= */
UI.openWorkspace = encId => { const e = DB.get('encounters', encId), p = HIS.pt(e.patient_id); S.viewPatient(p.id);
  UI.win('ws:' + encId, { title: `${{ OPD: '門診', ER: '急診', IPD: '住院' }[e.type]}工作區 ${p.chart_no} ${p.name}`, w: 1120, h: 640, live: false, auto: true, pre: w => autosave(w), encId, state: { tab: e.type === 'IPD' || e.type === 'ER' ? 'soap' : 'soap', ord: 'med', rec: null, amend: null, medq: '', icdq: '' }, render: renderWs }); };
const wsEnc = w => DB.get('encounters', w.encId);
function autosave(w) {
  if (w.state.tab !== 'soap') return; const enc = wsEnc(w), rec = DB.get('medical_records', w.state.rec); if (!rec || enc.status === '完成' || !$('[name=cc]', w.body)) return;
  if (rec.status === '已簽署' && !w.state.amend) return; const v = UI.vals(w), f = {}; let ch = false; HIS.REC_FIELDS.forEach(k => { if (v[k] !== undefined) { f[k] = v[k]; if ((rec[k] || '') !== v[k]) ch = true; } });
  if (ch) S.saveRecord(rec.id, f, rec.status === '已簽署' ? w.state.amend : undefined);
}
function renderWs(w) {
  const enc = wsEnc(w), p = HIS.pt(enc.patient_id), s = w.state, canEdit = enc.status !== '完成' && HIS.can('emr');
  const recs = DB.where('medical_records', r => r.encounter_id === enc.id && r.status !== '作廢').sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (!s.rec || !recs.find(r => r.id === s.rec)) s.rec = recs.length ? recs[recs.length - 1].id : null;
  const rec = s.rec ? DB.get('medical_records', s.rec) : null, adm = enc.admission_id ? DB.get('admissions', enc.admission_id) : null;
  const orders = HIS.encOrders(enc.id), unsent = orders.filter(x => [HIS.ST.DRAFT, HIS.ST.PEND, HIS.ST.SIGNED].includes(x.o.status)).length;
  const dxn = DB.where('diagnoses', d => d.encounter_id === enc.id && d.status !== '已刪除').length, vsn = DB.where('vital_signs', v => v.encounter_id === enc.id).length;
  const tabs = [['info', '病人資料'], ['hist', '歷史就診'], ['soap', '病歷'], ['vs', `生命徵象(${vsn})`], ['dx', `診斷(${dxn})`], ['ord', `醫囑(${orders.length})`], ['res', '檢驗/影像結果'], ['med', '用藥紀錄']];
  const ck = (ok, t) => `<span class="${ok ? 'ckok' : 'ckno'}">${ok ? '✔' : '○'} ${t}</span>`;
  let foot = '';
  if (canEdit) {
    if (enc.type === 'ER' && !enc.doctor_id && HIS.can('opd')) foot += btn('erTake', '接診', { cls: 'pri' });
    if (enc.type !== 'IPD') foot += btn('signAll', '簽署並送出醫囑') + btn('signRec', '簽署病歷') + btn('finish', enc.type === 'ER' ? '離院（完成就診）' : '完成就診', { cls: 'pri' });
    if (enc.type === 'ER' && HIS.can('er')) foot += btn('erObs', '轉留觀') + btn('reqAdm', '轉住院（入院申請）');
    if (enc.type === 'OPD' && HIS.can('ipd')) foot += btn('reqAdm', '申請入院');
    if (enc.type === 'IPD') foot += btn('signAll', '簽署並送出醫囑') + btn('newProg', '＋病程紀錄') + (!recs.find(r => r.type === '出院病歷') ? btn('newDis', '＋出院病歷') : '') + (adm && adm.status === '住院中' ? btn('prep', '出院準備') : '') + btn('discharge', '辦理出院', { cls: 'pri' });
  }
  const checklist = enc.type === 'IPD' ? `${ck(rec && rec.status === '已簽署', '病歷已簽署')}${ck(!unsent, '醫囑已送出')}` : `${ck(vsn > 0, '生命徵象')}${ck(rec && rec.cc && rec.assessment, 'SOAP')}${ck(DB.where('diagnoses', d => d.encounter_id === enc.id && d.type === '主要' && d.status !== '已刪除').length, '主要診斷')}${ck(orders.length > 0 && !unsent, '醫囑已送出' + (unsent ? `（${unsent}筆未送）` : ''))}${ck(rec && rec.status === '已簽署', '病歷簽署')}${ck(enc.status === '完成', '完成就診')}`;
  w.body.innerHTML = `<div class="wshead">${UI.patLine(p)}　身高${p.height || '-'}cm 體重${p.weight || '-'}kg<br><span class="sm">${{ OPD: '門診', ER: '急診', IPD: '住院' }[enc.type]}｜${E(HIS.deptName(enc.dept_id))}｜醫師：${E(HIS.staffName(enc.doctor_id) || '待接診')}｜就診：${fdt(enc.start_time)}｜${st(enc.status)}${enc.type === 'ER' ? `｜檢傷 ${UI.triBadge(enc.triage_level)} ${E(enc.triage_cc || '')} ｜急診狀態：${st(enc.er_status)}` : ''}${adm ? `｜床號 <b>${E(adm.bed_id)}</b> ${st(adm.status)}｜入院診斷 ${E(adm.admit_dx)}` : ''}</span></div>
  <div class="tabs">${tabs.map(t => `<a class="${s.tab === t[0] ? 'on' : ''}" data-act="tab" data-id="${t[0]}">${t[1]}</a>`).join('')}<span class="cklist">${checklist}</span></div>
  <div class="wsbody">${TABS[s.tab](w, enc, p, canEdit, recs, rec, adm)}</div><div class="wsfoot">${foot || '<span class="sm">此就診已完成，僅供檢視。</span>'}</div>`;
  const act = w.act;
  act.tab = el => { UI.safe(() => autosave(w)); s.tab = el.dataset.id; UI.refresh(w); };
  act.signAll = () => { autosave(w); const n = S.signSendOrders(enc.id); UI.status(`已簽署並送出 ${n} 筆醫囑，藥局/檢驗科/放射科/護理端已收到`); };
  act.signRec = () => { autosave(w); S.signRecord(s.rec); s.amend = null; UI.status('病歷已簽署'); };
  act.finish = () => { autosave(w); UI.confirm('確定完成此次就診？完成後不可再開立醫囑。', () => UI.safe(() => { S.completeEncounter(enc.id); UI.status('就診已完成'); })); };
  act.erTake = () => S.erTake(enc.id); act.erObs = () => { S.erDispose(enc.id, '留觀'); };
  act.newProg = () => { const r = S.createRecord(enc.id, '病程紀錄'); s.rec = r.id; s.tab = 'soap'; UI.refresh(w); };
  act.newDis = () => { const r = S.createRecord(enc.id, '出院病歷'); s.rec = r.id; s.tab = 'soap'; UI.refresh(w); };
  act.prep = () => S.dischargePrep(enc.admission_id);
  act.reqAdm = () => UI.form('入院申請', `<table class="kv"><tr><th>入院科別</th><td><select name="dept_id">${opts(DB.where('departments', d => d.kind === '臨床' && d.id !== 'DEP-ER').map(d => [d.id, d.name]), enc.dept_id === 'DEP-ER' ? 'DEP-IM' : enc.dept_id)}</select></td></tr><tr><th>入院診斷</th><td><input name="dx" size="36"></td></tr><tr><th>入院原因</th><td><textarea name="reason" rows="3" cols="36"></textarea></td></tr></table>`, v => { const d = { dept_id: v.dept_id, dx: v.dx, reason: v.reason, attending_id: DB.one('users', u => u.dept_id === v.dept_id && u.role_id === 'R-attending').id, resident_id: (DB.one('users', u => u.dept_id === v.dept_id && u.role_id === 'R-resident') || {}).id }; if (enc.type === 'ER') S.erDispose(enc.id, '轉住院', d); else S.requestAdmission(enc.id, d); UI.alert('入院申請已送出，待批價掛號/病房人員分配床位。'); });
  act.discharge = () => { autosave(w); UI.form('辦理出院', `<table class="kv"><tr><th>出院診斷</th><td><input name="dx" size="36" value="${E(adm ? adm.admit_dx : '')}"></td></tr><tr><th>出院動向</th><td><select name="disposition">${opts(['出院返家', '出院返家並門診追蹤', '轉居家護理', '轉院', '自動出院'])}</select></td></tr></table><div class="note">需先簽署「出院病歷」且無未送出醫囑。</div>`, v => { S.discharge(enc.admission_id, v); UI.status('出院完成，床位轉為清潔中'); }); };
  TABS_ACT[s.tab] && TABS_ACT[s.tab](w, enc, p, canEdit, recs, rec, adm);
}
const TABS = {}, TABS_ACT = {};

TABS.info = (w, enc, p) => { const hs = DB.where('medical_histories', h => h.patient_id === p.id), hk = k => hs.filter(h => h.kind === k).map(h => E(h.text)).join('；') || '無';
  return kv([['病歷號', E(p.chart_no)], ['姓名', E(p.name)], ['性別/年齡', sexAge(p)], ['出生日期', p.birth], ['身分證', HIS.maskId(p.id_no)], ['血型', E(p.blood)], ['保險', E(p.ins_type)], ['聯絡', E(p.phone)], ['緊急聯絡人', `${E(p.emergency_name)}（${E(p.emergency_rel)}）${E(p.emergency_phone)}`], ['慢性病史', hk('慢性病')], ['長期用藥', hk('長期用藥')], ['手術史', hk('手術史')], ['家族史', hk('家族史')], ['社會史', hk('社會史')], ['過去病史', hk('過去病史')], ['特殊註記', E(p.notes)]], 4) +
  `<div class="hd">過敏史</div>${table([['過敏原', a => E(a.allergen)], ['類別', a => E(a.allergen_class || '非藥物')], ['反應', a => E(a.reaction)], ['嚴重度', a => E(a.severity)]], HIS.allergies(p.id), { empty: '無已知過敏' })}<div class="note"><a class="lnk" data-act="openpt">開啟完整病人資料視窗（可新增過敏/病史）</a></div>`; };
TABS_ACT.info = w => { w.act.openpt = () => UI.openPatient(wsEnc(w).patient_id); };

TABS.hist = (w, enc, p) => {
  const encs = DB.where('encounters', e => e.patient_id === p.id && e.id !== enc.id).sort((a, b) => b.start_time.localeCompare(a.start_time));
  const dxs = DB.where('diagnoses', d => d.patient_id === p.id && d.encounter_id !== enc.id && d.status !== '已刪除').sort((a, b) => b.date.localeCompare(a.date));
  const mos = DB.where('medication_orders', o => o.patient_id === p.id && o.encounter_id !== enc.id && o.status !== '已取消').sort((a, b) => b.ordered_at.localeCompare(a.ordered_at)).slice(0, 25);
  const los = DB.where('lab_orders', o => o.patient_id === p.id && o.report_status === '已發布').sort((a, b) => b.published_at.localeCompare(a.published_at)).slice(0, 20);
  return `<div class="hd">過去就診與病歷（${encs.length}）</div>${table([['日期', e => fdt(e.start_time)], ['類型', e => ({ OPD: '門診', ER: '急診', IPD: '住院' }[e.type])], ['科別', e => E(HIS.deptName(e.dept_id))], ['醫師', e => E(HIS.staffName(e.doctor_id))], ['主訴/評估', e => { const r = HIS.encRecord(e.id); return r ? E((r.cc || '').slice(0, 24)) + (r.assessment ? '／' + E(r.assessment.slice(0, 30)) : '') : ''; }], ['', e => { const r = HIS.encRecord(e.id); return r ? btn('rec', '檢視病歷', { id: r.id }) : ''; }]], encs, { empty: '無歷史就診' })}
  <div class="hd">過去診斷（${dxs.length}）</div>${table([['日期', d => d.date], ['ICD-10', d => E(d.icd_code)], ['診斷', d => E(d.zh)], ['類型', d => E(d.type)], ['狀態', d => st(d.status)], ['醫師', d => E(HIS.staffName(d.doctor_id))]], dxs)}
  <div class="hd">過去處方（近25筆）</div>${table([['日期', o => fdt(o.ordered_at)], ['藥品', o => E(o.med_name) + ' ' + E(o.spec)], ['用法', o => `${o.dose}${E(o.dose_unit)} ${o.route} ${o.freq} × ${o.days}天`], ['總量', o => o.total_qty], ['狀態', o => st(o.status)]], mos)}
  <div class="hd">過去檢驗（近20筆）</div>${table([['發布時間', o => fdt(o.published_at)], ['項目', o => E(o.panel_name)], ['異常', o => { const n = DB.where('lab_results', r => r.lab_order_id === o.id && r.flag && r.flag !== 'N'); return n.length ? `<b class="bad">${n.map(r => E(r.name + '=' + r.value + r.flag)).join('、')}</b>` : '正常'; }], ['', o => btn('lab', '檢閱', { id: o.id })]], los)}`;
};
TABS_ACT.hist = w => { w.act.rec = el => UI.openRecordView(el.dataset.id); w.act.lab = el => UI.openLabReport(el.dataset.id); };

TABS.soap = (w, enc, p, canEdit, recs, rec) => {
  if (!rec) return `<div class="empty">本次就診尚無病歷。</div>`;
  const s = w.state, signed = rec.status === '已簽署', ro = !canEdit || (signed && !s.amend);
  const picker = recs.length > 1 || enc.type === 'IPD' ? `<div class="picker">${recs.map(r => `<a class="${r.id === rec.id ? 'on' : ''}" data-act="pickrec" data-id="${r.id}">${E(r.type)} ${r.created_at.slice(5, 16)} ${r.status === '已簽署' ? '✔' : '✎'}</a>`).join('')}</div>` : '';
  return `${picker}<div class="bar sm">病歷類型：<b>${E(rec.type)}</b>｜狀態：${st(rec.status)}｜版本：v${rec.version}｜建立：${fdt(rec.created_at)} ${E(HIS.staffName(rec.created_by))}｜修改：${fdt(rec.updated_at)} ${E(HIS.staffName(rec.updated_by))}｜簽署：${rec.signed_at ? fdt(rec.signed_at) + ' ' + E(HIS.staffName(rec.signed_by)) : '未簽署'}${s.amend ? `｜<b class="bad">修訂中（原因：${E(s.amend)}）</b>` : ''}</div>
  ${!ro ? `<div class="bar">範本：<select data-chg="tpl">${opts(Object.keys(TPL), '', '— 套用常用範本（會覆寫空白欄位）—')}</select>　${btn('savesoap', '儲存草稿')}</div>` : ''}
  <div class="soap">${HIS.REC_FIELDS.map(k => `<div class="fld"><b>${FL[k]}</b><textarea name="${k}" rows="${FROWS[k]}" ${ro ? 'disabled' : ''}>${E(rec[k] || '')}</textarea></div>`).join('')}</div>
  <div class="bar">${canEdit && signed && !s.amend ? btn('amend', '修訂病歷（保留原版本）') : ''}${canEdit && signed && s.amend ? btn('savesoap', '儲存修訂') + btn('cancelamend', '取消修訂') : ''}${btn('vers', '版本歷程/檢視')}</div>`;
};
TABS_ACT.soap = (w, enc, p, canEdit, recs, rec) => {
  const s = w.state; w.act.pickrec = el => { autosave(w); s.rec = el.dataset.id; s.amend = null; UI.refresh(w); };
  w.chg.tpl = el => { const t = TPL[el.value]; if (!t) return; HIS.REC_FIELDS.forEach(k => { const e = $(`[name=${k}]`, w.body); if (e && t[k] && !e.value.trim()) e.value = t[k]; }); el.value = ''; };
  w.act.savesoap = () => { const v = UI.vals(w), f = {}; HIS.REC_FIELDS.forEach(k => { f[k] = v[k]; }); const cur = DB.get('medical_records', rec.id); S.saveRecord(rec.id, f, cur.status === '已簽署' ? s.amend : undefined); UI.status('病歷已儲存'); UI.refresh(w); };
  w.act.amend = () => UI.ask('修訂已簽署病歷', '依規定，簽署後的病歷不得直接覆寫。請輸入修訂原因（原版本將保留）：', v => { s.amend = v; UI.refresh(w); });
  w.act.cancelamend = () => { s.amend = null; UI.refresh(w); }; w.act.vers = () => UI.openRecordView(rec.id);
};

TABS.vs = (w, enc, p, canEdit) => {
  const vs = DB.where('vital_signs', v => v.encounter_id === enc.id).sort((a, b) => b.at.localeCompare(a.at));
  const ab = (v, k) => { const x = v[k]; if (x == null) return ''; const bad = k === 'bp_sys' ? x >= 140 || x < 90 : k === 'hr' ? x > 100 || x < 50 : k === 'temp' ? x >= 38 || x < 35.5 : k === 'spo2' ? x < 94 : k === 'rr' ? x > 24 || x < 10 : false; return bad ? `<b class="bad">${x}</b>` : x; };
  return `${canEdit && (HIS.can('vitals') || HIS.can('ward')) ? `<table class="kv"><tr><th>收縮壓</th><td><input name="bp_sys" size="4"></td><th>舒張壓</th><td><input name="bp_dia" size="4"></td><th>心跳</th><td><input name="hr" size="4"></td><th>呼吸</th><td><input name="rr" size="4"></td><th>體溫°C</th><td><input name="temp" size="4"></td><th>SpO₂%</th><td><input name="spo2" size="4"></td><th>疼痛(0-10)</th><td><input name="pain" size="3"></td><td>${btn('addvs', '記錄生命徵象', { cls: 'pri' })}</td></tr></table>` : ''}
  ${table([['時間', v => fdt(v.at)], ['血壓', v => `${ab(v, 'bp_sys') || '-'}/${v.bp_dia ?? '-'}`], ['心跳', v => ab(v, 'hr')], ['呼吸', v => ab(v, 'rr')], ['體溫', v => ab(v, 'temp')], ['SpO₂', v => ab(v, 'spo2')], ['疼痛', v => v.pain ?? ''], ['記錄者', v => E(HIS.staffName(v.recorded_by))]], vs, { empty: '本次就診尚無生命徵象紀錄' })}`;
};
TABS_ACT.vs = (w, enc) => { w.act.addvs = () => { S.addVitals(enc.id, UI.vals(w)); UI.status('生命徵象已記錄'); UI.refresh(w); }; };

TABS.dx = (w, enc, p, canEdit) => {
  const s = w.state, dx = DB.where('diagnoses', d => d.encounter_id === enc.id && d.status !== '已刪除'), q = (s.icdq || '').toLowerCase();
  const list = DB.all('icd10').filter(i => !q || i.code.toLowerCase().includes(q) || i.zh.includes(q) || i.en.toLowerCase().includes(q)).slice(0, 80);
  return `${canEdit ? `<div class="split"><div><b>ICD-10-CM 診斷碼搜尋</b>（代碼／中文／英文；共 ${DB.all('icd10').length} 筆，可由管理者匯入完整檔）<br><input data-inp="icdq" value="${E(s.icdq || '')}" placeholder="如 I10、高血壓、diabetes" size="36"><br><select name="icdlist" size="9" style="width:100%" data-chg="icdsel">${list.map(i => `<option value="${E(i.code)}">${E(i.code)}　${E(i.zh)} / ${E(i.en)}</option>`).join('')}</select></div>
  <div><b>加入診斷</b><table class="kv"><tr><th>ICD-10</th><td><input name="icd_code" size="10"> <span id="icdzh" class="sm"></span></td></tr><tr><th>類型</th><td><select name="dtype">${opts(['主要', '次要', '鑑別'])}</select></td></tr><tr><th>狀態</th><td><select name="dstatus">${opts(['確診', '疑似', '慢性', '已排除', '已解決'])}</select></td></tr>${enc.type === 'IPD' ? `<tr><th>診斷階段</th><td><select name="dscope">${opts(['病程診斷', '入院診斷', '出院診斷'])}</select></td></tr>` : ''}</table>${btn('adddx', '加入診斷', { cls: 'pri' })}</div></div>` : ''}
  <div class="hd">本次診斷</div>${table([['ICD-10-CM', d => E(d.icd_code)], ['中文名稱', d => E(d.zh)], ['英文名稱', d => E(d.en)], ['類型', d => d.type === '主要' ? '<b>主要</b>' : E(d.type)], ['狀態', d => st(d.status)], ['階段', d => E(d.scope)], ['日期', d => d.date], ['診斷醫師', d => E(HIS.staffName(d.doctor_id))], ['', d => canEdit ? btn('deldx', '刪除', { id: d.id }) : '']], dx, { empty: '尚未建立診斷' })}`;
};
TABS_ACT.dx = (w, enc) => {
  const s = w.state;
  w.inp.icdq = el => { s.icdq = el.value; const q = el.value.toLowerCase(), l = $('[name=icdlist]', w.body); l.innerHTML = DB.all('icd10').filter(i => !q || i.code.toLowerCase().includes(q) || i.zh.includes(q) || i.en.toLowerCase().includes(q)).slice(0, 80).map(i => `<option value="${E(i.code)}">${E(i.code)}　${E(i.zh)} / ${E(i.en)}</option>`).join(''); };
  w.chg.icdsel = el => { $('[name=icd_code]', w.body).value = el.value; const i = DB.one('icd10', x => x.code === el.value); $('#icdzh', w.body).textContent = i ? i.zh : ''; };
  w.act.adddx = () => { const v = UI.vals(w); S.addDx(enc.id, { icd_code: (v.icd_code || '').trim().toUpperCase(), type: v.dtype, status: v.dstatus, scope: v.dscope || '' }); UI.status('診斷已加入'); UI.refresh(w); };
  w.act.deldx = el => UI.confirm('確定刪除此診斷？（將保留稽核紀錄）', () => UI.safe(() => S.delDx(el.dataset.id)));
};

/* ---------- 醫囑 CPOE ---------- */
const QUICKLAB = ['CBC', 'DIFF', 'CRP', 'ESR', 'AST', 'ALT', 'BUN', 'CREA', 'NA', 'K', 'GLU', 'HBA1C', 'LIPID', 'UA', 'BCX', 'UCX', 'PT', 'APTT', 'TROP'];
const medOpts = q => { q = (q || '').toLowerCase(); return DB.all('medications').filter(m => !q || m.code.toLowerCase().includes(q) || m.name_zh.includes(q) || m.ingredient.toLowerCase().includes(q) || (m.class || '').includes(q)).slice(0, 70).map(m => `<option value="${E(m.code)}">${E(m.code)}　${E(m.name_zh)}　${E(m.ingredient)} ${E(m.spec)}　${E(m.form)}　庫存${HIS.stockOf(m.code)}${m.high_alert ? '　★高警訊' : ''}</option>`).join(''); };
TABS.ord = (w, enc, p, canEdit) => {
  const s = w.state, orders = HIS.encOrders(enc.id), sub = [['med', '藥物醫囑'], ['lab', '檢驗醫囑'], ['rad', '影像醫囑'], ['proc', '其他處置'], ['cons', '會診']];
  let form = '';
  if (canEdit && HIS.can('cpoe')) {
    if (s.ord === 'med') form = `<div class="split"><div><b>藥品目錄搜尋</b>（代碼／名稱／成分；目錄 ${DB.all('medications').length} 項，可匯入食藥署資料）<br><input data-inp="medq" value="${E(s.medq || '')}" size="40" placeholder="如 amlodipine、抗生素、A0001"><br><select name="medlist" size="8" style="width:100%" data-chg="medsel">${medOpts(s.medq)}</select></div>
      <div><table class="kv"><tr><th>藥品</th><td colspan="3"><input type="hidden" name="med_code"><span id="medname" class="sm">（請由左側選擇藥品）</span></td></tr><tr><th>單次劑量</th><td><input name="dose" size="4" value="1"> <span id="dunit"></span></td><th>途徑</th><td><select name="route">${opts(HIS.ROUTES)}</select></td></tr><tr><th>頻率</th><td><select name="freq">${opts(Object.keys(HIS.FREQ), 'BID')}</select></td><th>天數</th><td><input name="days" size="4" value="${enc.type === 'IPD' ? 3 : 7}"></td></tr><tr><th>預估總量</th><td id="medtotal">-</td><th>優先</th><td><select name="priority">${opts(['一般', '急件', 'STAT'])}</select></td></tr><tr><th>用藥指示</th><td colspan="3"><input name="instruction" size="34" placeholder="如 飯後服用、PRN 疼痛時使用"></td></tr><tr><th>處方備註</th><td colspan="3"><input name="note" size="34"></td></tr><tr><th>過敏覆核原因</th><td colspan="3"><input name="allergy_override" size="34" placeholder="僅在出現過敏警示且仍須開立時填寫"></td></tr></table><div id="medwarn"></div>${btn('addmed', '加入藥物醫囑（草稿）', { cls: 'pri' })}</div></div>`;
    else if (s.ord === 'lab') form = `<div>快速開單：${QUICKLAB.map(c => `<button class="btn" data-act="qlab" data-id="${c}">${c}</button>`).join('')}</div><table class="kv"><tr><th>所有檢驗項目</th><td><select name="panel_code">${opts(DB.all('lab_panels').map(x => [x.code, `${x.code}　${x.zh}（${x.specimen}）`]))}</select></td><th>優先</th><td><select name="priority">${opts(['一般', '急件', 'STAT'])}</select></td><th>備註</th><td><input name="note" size="24"></td><td>${btn('addlab', '加入檢驗醫囑', { cls: 'pri' })}</td></tr></table>`;
    else if (s.ord === 'rad') form = `<table class="kv"><tr><th>檢查項目</th><td><select name="exam_code">${opts(DB.all('radiology_catalog').map(x => [x.code, `${x.zh}（${x.modality}）`]))}</select></td><th>優先</th><td><select name="priority">${opts(['一般', '急件', 'STAT'])}</select></td></tr><tr><th>臨床問題/目的</th><td colspan="3"><input name="reason" size="60"></td></tr></table>${btn('addrad', '加入影像醫囑', { cls: 'pri' })}`;
    else if (s.ord === 'proc') form = `<table class="kv"><tr><th>處置類型</th><td><select name="proc_type">${opts(HIS.PROC_TYPES)}</select></td><th>內容</th><td><input name="detail" size="44" placeholder="如 12導程心電圖／生理食鹽水500mL IV drip／氧氣 2L/min nasal cannula"></td><th>優先</th><td><select name="priority">${opts(['一般', '急件', 'STAT'])}</select></td><td>${btn('addproc', '加入處置醫囑', { cls: 'pri' })}</td></tr></table>`;
    else form = `<table class="kv"><tr><th>會診科別</th><td><select name="to_dept">${opts(DB.where('departments', d => d.kind === '臨床' && d.id !== enc.dept_id).map(d => [d.id, d.name]))}</select></td><th>緊急度</th><td><select name="urgency">${opts(['一般', '急件'])}</select></td></tr><tr><th>會診原因</th><td colspan="3"><input name="reason" size="60"></td></tr></table>${btn('addcons', '送出會診申請', { cls: 'pri' })}`;
  }
  const cons = DB.where('consultations', c => c.encounter_id === enc.id);
  const cancellable = o => [HIS.ST.DRAFT, HIS.ST.PEND, HIS.ST.SIGNED, HIS.ST.SENT].includes(o.status);
  return `<div class="picker">${sub.map(t => `<a class="${s.ord === t[0] ? 'on' : ''}" data-act="sub" data-id="${t[0]}">${t[1]}</a>`).join('')}</div>${form}
  <div class="hd">本次就診醫囑（${orders.length}）　${canEdit ? btn('pend', '草稿→待簽署') : ''}</div>${table([['類別', x => x.kindName], ['醫囑內容', x => E(x.text)], ['優先', x => x.o.priority === '一般' ? '' : `<b class="bad">${E(x.o.priority)}</b>`], ['狀態', x => st(x.o.status) + (x.kind === 'rad' && x.o.exam_status ? ` <span class="sm">${E(x.o.exam_status)}</span>` : '') + (x.kind === 'lab' && x.o.report_status !== '未開始' ? ` <span class="sm">${E(x.o.report_status)}</span>` : '')], ['開立', x => `${E(HIS.staffName(x.o.ordered_by))} ${x.o.ordered_at.slice(5, 16)}`], ['簽署', x => x.o.signed_at ? fdt(x.o.signed_at) : ''], ['動作', x => (cancellable(x.o) && canEdit ? `<button class="btn" data-act="cancel" data-id="${x.o.id}" data-k="${x.kind}">取消</button>` : '') + (x.kind === 'lab' && x.o.report_status === '已發布' ? btn('lab', '看報告', { id: x.o.id }) : '') + (x.kind === 'rad' && x.o.exam_status === '已發布' ? btn('rad', '看報告', { id: x.o.id }) : '')]], orders, { empty: '尚未開立醫囑' })}
  ${cons.length ? `<div class="hd">會診</div>${table([['科別', c => E(HIS.deptName(c.to_dept))], ['原因', c => E(c.reason)], ['緊急度', c => E(c.urgency)], ['狀態', c => st(c.status)], ['回覆', c => E(c.reply || '')]], cons)}` : ''}`;
};
TABS_ACT.ord = (w, enc) => {
  const s = w.state, A = w.act, done = m => { UI.status(m); UI.refresh(w); };
  A.sub = el => { s.ord = el.dataset.id; UI.refresh(w); }; A.pend = () => { S.pendSign(enc.id); done('草稿醫囑已轉為待簽署'); };
  const med = () => DB.one('medications', m => m.code === $('[name=med_code]', w.body).value);
  const upd = () => { const m = med(); if (!m) return; const v = UI.vals(w), per = HIS.FREQ[v.freq] || 0, tot = Math.max(1, Math.ceil((+v.dose || 0) * (v.freq === 'PRN' ? 3 : per) * (parseInt(v.days) || 1))); $('#medtotal', w.body).textContent = `${tot} ${m.unit}`; };
  w.inp.medq = el => { s.medq = el.value; $('[name=medlist]', w.body).innerHTML = medOpts(el.value); };
  w.chg.medsel = el => { const m = DB.one('medications', x => x.code === el.value); $('[name=med_code]', w.body).value = m.code; $('#medname', w.body).innerHTML = `<b>${E(m.name_zh)}</b> ${E(m.ingredient)} ${E(m.spec)} ${E(m.form)}${m.high_alert ? ' <b class="bad">★高警訊藥品</b>' : ''}`; $('#dunit', w.body).textContent = m.unit; $('[name=route]', w.body).value = m.route;
    const al = HIS.checkAllergy(enc.patient_id, m), stock = HIS.stockOf(m.code); $('#medwarn', w.body).innerHTML = al.map(a => `<div class="warn ${a.level === '禁忌' ? 'crit' : ''}">⚠ ${E(a.level)}：${E(a.msg)}</div>`).join('') + (stock <= 0 ? '<div class="warn">⚠ 目前藥局無庫存</div>' : ''); upd(); };
  ['dose', 'freq', 'days'].forEach(n => { const e = $(`[name=${n}]`, w.body); if (e) { e.oninput = upd; e.onchange = upd; } });
  A.addmed = () => { const v = UI.vals(w); S.addMedOrder(enc.id, v); done('藥物醫囑已加入（草稿）'); };
  A.addlab = () => { const v = UI.vals(w); S.addLabOrder(enc.id, v); done('檢驗醫囑已加入（草稿）'); };
  A.qlab = el => { S.addLabOrder(enc.id, { panel_code: el.dataset.id }); done(el.dataset.id + ' 檢驗醫囑已加入（草稿）'); };
  A.addrad = () => { S.addRadOrder(enc.id, UI.vals(w)); done('影像醫囑已加入（草稿）'); }; A.addproc = () => { S.addProcOrder(enc.id, UI.vals(w)); done('處置醫囑已加入（草稿）'); };
  A.addcons = () => { S.addConsult(enc.id, UI.vals(w)); done('會診申請已送出'); };
  A.cancel = el => UI.ask('取消醫囑', '請輸入取消原因：', v => { S.cancelOrder(el.dataset.k, el.dataset.id, v); UI.status('醫囑已取消'); UI.refresh(w); });
  A.lab = el => UI.openLabReport(el.dataset.id); A.rad = el => UI.openRadReport(el.dataset.id);
};

TABS.res = (w, enc, p) => {
  const labs = DB.where('lab_orders', o => o.patient_id === p.id && o.status !== '已取消').sort((a, b) => b.ordered_at.localeCompare(a.ordered_at)).slice(0, 40), rads = DB.where('radiology_orders', o => o.patient_id === p.id && o.status !== '已取消').sort((a, b) => b.ordered_at.localeCompare(a.ordered_at)).slice(0, 20);
  const abn = o => { const n = DB.where('lab_results', r => r.lab_order_id === o.id && r.flag && r.flag !== 'N'); return o.report_status !== '已發布' ? '' : n.length ? `<b class="bad">${n.map(r => E(r.name + ' ' + r.value + ' ' + r.flag)).join('、')}</b>` : '正常'; };
  return `<div class="hd">檢驗結果（跨就診）</div>${table([['開立', o => fdt(o.ordered_at)], ['就診', o => o.encounter_id === enc.id ? '<b>本次</b>' : o.encounter_id], ['項目', o => E(o.panel_name)], ['狀態', o => st(o.report_status === '未開始' ? o.status : o.report_status)], ['結果摘要', abn], ['已閱', o => o.report_status === '已發布' ? (o.viewed_at ? '✔' : '<b class="bad">未閱</b>') : ''], ['', o => o.report_status === '已發布' ? btn('lab', '檢閱', { id: o.id, cls: 'pri' }) : '']], labs, { rowCls: o => o.report_status === '已發布' && !o.viewed_at ? 'unrd' : '' })}
  <div class="hd">影像報告</div>${table([['開立', o => fdt(o.ordered_at)], ['檢查', o => E(o.exam_name)], ['狀態', o => st(o.exam_status)], ['', o => o.exam_status === '已發布' ? btn('rad', '檢閱', { id: o.id, cls: 'pri' }) : '']], rads)}`;
};
TABS_ACT.res = w => { w.act.lab = el => UI.openLabReport(el.dataset.id); w.act.rad = el => UI.openRadReport(el.dataset.id); };
TABS.med = (w, enc, p) => {
  const mos = DB.where('medication_orders', o => o.patient_id === p.id && o.status !== '已取消').sort((a, b) => b.ordered_at.localeCompare(a.ordered_at)).slice(0, 60);
  return `<div class="hd">病人用藥紀錄（處方→藥局發藥）</div>${table([['開立', o => fdt(o.ordered_at)], ['藥品', o => E(o.med_name) + ' ' + E(o.spec)], ['用法', o => `${o.dose}${E(o.dose_unit)} ${o.route} ${o.freq} × ${o.days}天`], ['總量', o => o.total_qty], ['醫囑狀態', o => st(o.status)], ['藥局', o => { const r = DB.one('prescriptions', x => x.order_id === o.id); return r ? st(r.status) : ''; }], ['批號', o => { const r = DB.one('prescriptions', x => x.order_id === o.id), d = r && DB.one('pharmacy_dispensing', x => x.prescription_id === r.id && x.type === '調劑'); return d ? E(d.lot_no) : ''; }], ['發藥', o => { const r = DB.one('prescriptions', x => x.order_id === o.id); return r && r.handed_at ? fdt(r.handed_at) + ' ' + E(HIS.staffName(r.handed_by)) : ''; }]], mos, { empty: '無用藥紀錄' })}`;
};
UI.TABS_EXT = { TABS, TABS_ACT };
})(typeof globalThis !== 'undefined' ? globalThis : window);
