/* ---- HIS UI：藥局、檢驗、放射、護理、掛號、住院、急診、病歷室、系統管理，以及選單 ---- */
(function (G) {
'use strict';
const HIS = G.HIS, DB = HIS.DB, S = HIS.svc, UI = HIS.UI;
const { E, $, $$, st, flag, fdt, sexAge, table, kv, btn, opts } = UI;
const me = () => HIS.session.user, P = id => HIS.pt(id);
const pl = id => { const p = P(id); return `<a class="lnk" data-act="pt" data-id="${p.id}">${E(p.name)}</a>`; };
const tabs = (w, arr) => `<div class="tabs">${arr.map(t => `<a class="${w.state.tab === t[0] ? 'on' : ''}" data-act="t" data-id="${t[0]}">${t[1]}</a>`).join('')}</div>`;
const setTab = w => { w.act.t = el => { w.state.tab = el.dataset.id; UI.refresh(w); }; w.act.pt = el => UI.openPatient(el.dataset.id); };
const prio = o => o.priority && o.priority !== '一般' ? `<b class="bad">${E(o.priority)}</b>` : '';
const byPrio = (a, b) => ({ 'STAT': 0, '急件': 1, '一般': 2 }[a.priority] ?? 2) - ({ 'STAT': 0, '急件': 1, '一般': 2 }[b.priority] ?? 2);

/* ================= 藥局 ================= */
UI.openPharmacy = () => UI.win('pharm', { title: '藥局作業系統 Pharmacy', w: 1180, h: 560, live: true, state: { tab: 'queue' }, render: w => {
  setTab(w); const s = w.state, T = [['queue', '處方佇列'], ['done', '已發藥/退藥'], ['stock', '庫存管理'], ['log', '調劑/領藥紀錄']];
  let h = tabs(w, T), body = '';
  const rxInfo = r => { const o = DB.get('medication_orders', r.order_id), m = DB.one('medications', x => x.code === r.med_code); return { o, m }; };
  if (s.tab === 'queue') {
    const q = DB.where('prescriptions', r => ['待審核', '待調劑', '已調劑'].includes(r.status)).sort((a, b) => byPrio(a, b) || a.created_at.localeCompare(b.created_at));
    body = table([['處方號', r => r.id], ['時間', r => fdt(r.created_at)], ['病歷號', r => E(P(r.patient_id).chart_no)], ['病人', r => pl(r.patient_id)], ['性別/年齡', r => sexAge(P(r.patient_id))], ['過敏史', r => { const a = HIS.allergies(r.patient_id); return a.length ? `<span class="alg">${a.map(x => E(x.allergen)).join('、')}</span>` : '無'; }],
      ['藥品', r => { const { o, m } = rxInfo(r); const al = HIS.checkAllergy(r.patient_id, m); return `<b>${E(o.med_name)}</b> ${E(o.spec)} ${E(o.form)}${m.high_alert ? ' <b class="bad">★</b>' : ''}${al.length ? ` <b class="bad" title="${E(al.map(x => x.msg).join('；'))}">⚠過敏警示${o.allergy_override ? '（醫師已覆核：' + E(o.allergy_override) + '）' : ''}</b>` : ''}`; }],
      ['用法', r => { const o = rxInfo(r).o; return `${o.dose}${E(o.dose_unit)} ${o.route} ${o.freq}${o.prn ? ' PRN' : ''} × ${o.days}天 ${E(o.instruction)}`; }], ['數量', r => r.qty, 'num'], ['庫存', r => { const k = HIS.stockOf(r.med_code); return k < r.qty ? `<b class="bad">${k}（不足）</b>` : k; }, 'num'], ['優先', r => prio(r)], ['狀態', r => st(r.status)],
      ['動作', r => (r.status === '待審核' ? btn('review', '審核通過', { id: r.id, cls: 'pri' }) + btn('rej', '退回醫師', { id: r.id }) : r.status === '待調劑' ? btn('disp', '調劑', { id: r.id, cls: 'pri' }) : btn('hand', '發藥', { id: r.id, cls: 'pri' }))]], q, { empty: '目前沒有待處理處方', rowCls: r => r.priority !== '一般' ? 'abn' : '' });
  } else if (s.tab === 'done') {
    const q = DB.where('prescriptions', r => r.status === '已發藥').sort((a, b) => b.handed_at.localeCompare(a.handed_at)).slice(0, 100);
    body = table([['處方號', r => r.id], ['發藥時間', r => fdt(r.handed_at)], ['病人', r => pl(r.patient_id)], ['藥品', r => E(rxInfo(r).o.med_name) + ' ' + E(rxInfo(r).o.spec)], ['數量', r => r.qty, 'num'], ['已退', r => r.returned_qty, 'num'], ['調劑', r => E(HIS.staffName(r.dispensed_by))], ['發藥', r => E(HIS.staffName(r.handed_by))], ['', r => r.qty - r.returned_qty > 0 ? btn('ret', '退藥', { id: r.id }) : '']], q);
  } else if (s.tab === 'stock') {
    const inv = DB.all('inventory').slice().sort((a, b) => a.med_code.localeCompare(b.med_code) || a.expiry.localeCompare(b.expiry)), today = HIS.today(), soon = HIS.addDays(today, 90);
    body = `<div class="bar">進貨登錄：<select name="s_med">${opts(DB.all('medications').map(m => [m.code, `${m.code} ${m.name_zh} ${m.spec}`]))}</select> 批號<input name="s_lot" size="8"> 效期<input type="date" name="s_exp"> 數量<input name="s_qty" size="5">${btn('addstock', '入庫', { cls: 'pri' })}</div>` +
      table([['藥品代碼', i => i.med_code], ['藥名', i => E(DB.one('medications', m => m.code === i.med_code).name_zh)], ['規格', i => E(DB.one('medications', m => m.code === i.med_code).spec)], ['批號', i => E(i.lot_no)], ['效期', i => i.expiry < today ? `<b class="bad">${i.expiry} 已過期</b>` : i.expiry < soon ? `<b class="warnc">${i.expiry} 即將到期</b>` : i.expiry], ['庫存量', i => i.qty < 50 ? `<b class="bad">${i.qty}（低庫存）</b>` : i.qty, 'num'], ['位置', i => E(i.location)], ['入庫日', i => fdt(i.received_at)]], inv, { rowCls: i => i.expiry < today ? 'crit' : '' });
  } else {
    const l = DB.all('pharmacy_dispensing').slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 200);
    body = table([['時間', d => fdt(d.at)], ['類型', d => d.type === '退藥' ? `<b class="bad">退藥</b>` : E(d.type)], ['處方號', d => d.prescription_id], ['病人', d => pl(d.patient_id)], ['藥品', d => E(DB.one('medications', m => m.code === d.med_code).name_zh)], ['批號', d => E(d.lot_no)], ['數量', d => d.qty, 'num'], ['藥師', d => E(HIS.staffName(d.by))], ['備註', d => E(d.reason || '')]], l);
  }
  w.body.innerHTML = h + `<div class="scrollbox" style="height:calc(100% - 28px)">${body}</div>`;
  const A = w.act, ok = m => UI.status(m);
  A.review = el => { S.rxReview(el.dataset.id); ok('審核通過'); }; A.disp = el => { S.rxDispense(el.dataset.id); ok('調劑完成，已依效期先出扣庫存'); }; A.hand = el => { S.rxHandOut(el.dataset.id); ok('發藥完成，病人用藥紀錄已更新'); };
  A.rej = el => UI.ask('退回處方', '請輸入退回原因（將通知開單醫師）：', v => S.rxRejectToDoctor(el.dataset.id, v));
  A.ret = el => UI.form('退藥', '<table class="kv"><tr><th>數量</th><td><input name="q" size="5"></td></tr><tr><th>原因</th><td><input name="r" size="30"></td></tr></table>', v => S.rxReturn(el.dataset.id, v.q, v.r));
  A.addstock = () => { const v = UI.vals(w); S.addStock(v.s_med, v.s_lot, v.s_exp, v.s_qty); ok('入庫完成'); };
} });

/* ================= 檢驗科 LIS ================= */
UI.openLab = () => UI.win('lab', { title: '檢驗資訊系統 LIS', w: 1080, h: 520, live: true, state: { tab: 'recv' }, render: w => {
  setTab(w); const s = w.state, ST = HIS.ST; const T = [['recv', '待收件'], ['run', '檢驗中'], ['done', '已完成報告']];
  const f = { recv: o => o.status === ST.SENT, run: o => o.status === ST.RUN, done: o => o.report_status === '已發布' }[s.tab];
  const l = DB.where('lab_orders', f).sort((a, b) => s.tab === 'done' ? b.published_at.localeCompare(a.published_at) : byPrio(a, b) || a.sent_at.localeCompare(b.sent_at)).slice(0, 120);
  w.body.innerHTML = tabs(w, T) + `<div class="scrollbox" style="height:calc(100% - 28px)">${table([['醫囑號', o => o.id], ['送出', o => fdt(o.sent_at)], ['病歷號', o => E(P(o.patient_id).chart_no)], ['病人', o => pl(o.patient_id)], ['性別/年齡', o => sexAge(P(o.patient_id))], ['檢驗項目', o => `<b>${E(o.panel_name)}</b>`], ['檢體', o => E(o.specimen_type)], ['優先', prio], ['開單醫師', o => E(HIS.staffName(o.ordered_by))], ['報告狀態', o => st(o.report_status === '未開始' ? o.status : o.report_status)], ['', o => btn('work', o.status === ST.SENT ? '收件/處理' : '開啟', { id: o.id, cls: 'pri' })]], l, { dbl: 'work', rowCls: o => o.priority !== '一般' ? 'abn' : '', empty: '無資料' })}</div>`;
  w.act.work = el => UI.openLabWork(el.dataset.id); w.dbl.work = tr => UI.openLabWork(tr.dataset.id);
} });
UI.openLabWork = oid => { const o0 = DB.get('lab_orders', oid); UI.win('lw:' + oid, { title: `檢驗作業 ${P(o0.patient_id).name} ${o0.panel_name}`, w: 900, h: 580, render: w => {
  const o = DB.get('lab_orders', oid), p = P(o.patient_id), panel = DB.one('lab_panels', x => x.code === o.panel_code), sp = o.specimen_id ? DB.get('specimens', o.specimen_id) : null;
  const ST = HIS.ST, existing = {}; DB.where('lab_results', r => r.lab_order_id === oid).forEach(r => { existing[r.analyte] = r; });
  const pubd = o.report_status === '已發布', canEnter = o.status === ST.RUN && !pubd;
  let h = `<div class="bar">${UI.patLine(p)}　${E(HIS.age(p.birth))}　${prio(o)}</div><div class="scrollbox" style="height:calc(100% - 30px)">` + kv([['醫囑', `${E(o.id)} ${E(o.panel_name)}`], ['開單醫師', E(HIS.staffName(o.ordered_by))], ['醫囑送出', fdt(o.sent_at)], ['報告狀態', st(o.report_status === '未開始' ? o.status : o.report_status)], ['備註', E(o.note)], ['', '']], 3);
  if (o.status === ST.SENT) {
    h += `<div class="hd">檢體接收</div><table class="kv"><tr><th>檢體種類（確認）</th><td><select name="sptype">${opts([o.specimen_type, '全血(EDTA)', '血清', '血漿(NaF)', '尿液', '血液(Citrate)'].filter((x, i, a) => a.indexOf(x) === i), o.specimen_type)}</select></td><th>採檢時間</th><td><input name="collected" size="19" value="${HIS.now()}"></td><th>收件時間</th><td>${HIS.now()}（系統自動）</td><td>${btn('recv', '接收檢體', { cls: 'pri' })} ${btn('rejspec', '退件')}</td></tr></table>`;
  } else {
    h += sp ? `<div class="hd">檢體</div>${kv([['條碼', E(sp.barcode)], ['種類', E(sp.type)], ['採檢時間', fdt(sp.collected_at)], ['收件時間', fdt(sp.received_at)], ['收件人員', E(HIS.staffName(sp.received_by))], ['', '']], 3)}` : '';
    h += `<div class="hd">檢驗結果輸入（參考區間依性別預設，可修改；異常自動標示）</div><table class="grid"><thead><tr><th>項目</th><th>結果</th><th>單位</th><th>參考下限</th><th>參考上限</th><th>標示</th></tr></thead><tbody>` + panel.analytes.map(ac => {
      const a = DB.one('lab_items', x => x.code === ac), r = existing[ac], ref = HIS.refFor(a, p), lo = r ? r.ref_lo : ref.lo, hi = r ? r.ref_hi : ref.hi;
      const inp = a.type === 'q' ? `<select name="v_${ac}" data-chg="calc" data-a="${ac}" ${canEnter ? '' : 'disabled'}><option value=""></option>${[a.normal, a.abn].map(x => `<option ${r && r.value === x ? 'selected' : ''}>${E(x)}</option>`).join('')}</select>` : `<input name="v_${ac}" data-inp="calc" data-a="${ac}" size="8" value="${E(r ? r.value : '')}" ${canEnter ? '' : 'disabled'}>`;
      return `<tr id="row_${ac}"><td>${E(a.name)}</td><td>${inp}</td><td>${E(a.unit)}</td><td>${a.type === 'q' ? E(a.normal) : `<input name="lo_${ac}" data-inp="calc" data-a="${ac}" size="6" value="${lo ?? ''}" ${canEnter ? '' : 'disabled'}>`}</td><td>${a.type === 'q' ? '' : `<input name="hi_${ac}" data-inp="calc" data-a="${ac}" size="6" value="${hi ?? ''}" ${canEnter ? '' : 'disabled'}>`}</td><td id="fl_${ac}">${r ? flag(r.flag) || '正常' : ''}</td></tr>`;
    }).join('') + '</tbody></table>';
    h += `<div class="bar">${canEnter ? btn('save', '儲存結果') + btn('complete', '完成報告') : ''}${o.report_status === '已完成報告' ? btn('publish', '發布報告（傳回醫師工作站）', { cls: 'pri' }) : ''}${canEnter ? btn('rejspec', '退件') : ''}${pubd ? `<span class="ckok">✔ 已於 ${fdt(o.published_at)} 發布</span>` : ''}</div>`;
  }
  w.body.innerHTML = h + '</div>';
  const calc = el => { const ac = el.dataset.a, a = DB.one('lab_items', x => x.code === ac), v = UI.vals(w), val = v['v_' + ac]; if (val === '' || val == null) { $('#fl_' + ac, w.body).textContent = ''; return; } const f = HIS.flagOf(a, val, v['lo_' + ac] === '' || v['lo_' + ac] == null ? null : parseFloat(v['lo_' + ac]), v['hi_' + ac] === '' || v['hi_' + ac] == null ? null : parseFloat(v['hi_' + ac])); $('#fl_' + ac, w.body).innerHTML = f === 'N' ? '正常' : flag(f); };
  w.inp.calc = calc; w.chg.calc = calc;
  const collect = () => { const v = UI.vals(w), out = {}; panel.analytes.forEach(ac => { out[ac] = { value: v['v_' + ac], lo: v['lo_' + ac], hi: v['hi_' + ac] }; }); return out; };
  w.act.recv = () => { const v = UI.vals(w); S.receiveSpecimen(oid, { collected_at: v.collected, specimen_type: v.sptype }); UI.status('檢體已接收'); UI.refresh(w); };
  w.act.rejspec = () => UI.ask('檢體退件', '請輸入退件原因（如：溶血、量不足、標示不符）：', v => { S.rejectSpecimen(oid, v); UI.refresh(w); });
  w.act.save = () => { S.saveLabResults(oid, collect()); UI.status('結果已儲存'); UI.refresh(w); };
  w.act.complete = () => { S.saveLabResults(oid, collect()); S.completeLabReport(oid); UI.status('報告已完成，待發布'); UI.refresh(w); };
  w.act.publish = () => { S.publishLabReport(oid); UI.status('報告已發布並通知醫師'); UI.refresh(w); };
} }); };

/* ================= 放射 RIS/PACS ================= */
UI.openRadiology = () => UI.win('rad', { title: '放射資訊系統 RIS / PACS', w: 1100, h: 520, live: true, state: { tab: 'wait' }, render: w => {
  setTab(w); const s = w.state, T = [['wait', '待排程'], ['sched', '已排程/檢查中'], ['read', '待判讀/報告'], ['done', '已發布']];
  const f = { wait: o => o.exam_status === '待排程', sched: o => ['已排程', '檢查中'].includes(o.exam_status), read: o => ['待判讀', '報告完成'].includes(o.exam_status), done: o => o.exam_status === '已發布' }[s.tab];
  const l = DB.where('radiology_orders', f).sort((a, b) => byPrio(a, b) || (a.sent_at || '').localeCompare(b.sent_at || '')).slice(0, 100);
  w.body.innerHTML = tabs(w, T) + `<div class="scrollbox" style="height:calc(100% - 28px)">${table([['醫囑號', o => o.id], ['送出', o => fdt(o.sent_at)], ['病人', o => pl(o.patient_id)], ['性別/年齡', o => sexAge(P(o.patient_id))], ['檢查', o => `<b>${E(o.exam_name)}</b>`], ['種類', o => E(o.modality)], ['臨床問題', o => E(o.reason)], ['優先', prio], ['排程', o => o.scheduled_at ? fdt(o.scheduled_at) + ' ' + E(o.room || '') : ''], ['狀態', o => st(o.exam_status)], ['動作', o => {
    let h = ''; if (HIS.can('rad_exec')) { if (o.exam_status === '待排程') h += btn('sch', '排程', { id: o.id, cls: 'pri' }); if (o.exam_status === '已排程') h += btn('start', '開始檢查', { id: o.id, cls: 'pri' }); if (o.exam_status === '檢查中') h += btn('fin', '完成檢查', { id: o.id, cls: 'pri' }); }
    if (HIS.can('rad_report') && ['待判讀', '報告完成'].includes(o.exam_status)) h += btn('rep', '判讀/報告', { id: o.id, cls: 'pri' }); if (o.exam_status === '已發布') h += btn('view', '檢視', { id: o.id }); return h; }]], l, { empty: '無資料', rowCls: o => o.priority !== '一般' ? 'abn' : '' })}</div>`;
  w.act.sch = el => UI.form('檢查排程', `<table class="kv"><tr><th>檢查時間</th><td><input name="when" size="17" value="${HIS.now().slice(0, 16)}"></td></tr><tr><th>檢查室</th><td><select name="room">${opts(['X-ray-1', 'X-ray-2', 'CT-1', 'CT-2', 'MRI-1', 'US-1', 'US-2', 'ECHO-1'])}</select></td></tr></table>`, v => S.radSchedule(el.dataset.id, v));
  w.act.start = el => S.radStart(el.dataset.id); w.act.fin = el => S.radFinish(el.dataset.id); w.act.rep = el => UI.openRadWork(el.dataset.id); w.act.view = el => UI.openRadReport(el.dataset.id);
} });
UI.openRadWork = oid => { const o0 = DB.get('radiology_orders', oid); UI.win('rw:' + oid, { title: `影像判讀 ${P(o0.patient_id).name} ${o0.exam_name}`, w: 820, h: 540, render: w => {
  const o = DB.get('radiology_orders', oid), p = P(o.patient_id), r = DB.one('radiology_reports', x => x.order_id === oid), pub = r && r.status === '已發布';
  const prior = DB.where('radiology_reports', x => x.patient_id === o.patient_id && x.status === '已發布' && x.order_id !== oid).slice(-3);
  w.body.innerHTML = `<div class="bar">${UI.patLine(p)}　${E(HIS.age(p.birth))}</div><div class="scrollbox" style="height:calc(100% - 30px)">${kv([['檢查', E(o.exam_name)], ['種類', E(o.modality)], ['申請醫師', E(HIS.staffName(o.ordered_by))], ['臨床問題', E(o.reason)], ['檢查完成', fdt(o.finished_at)], ['狀態', st(o.exam_status)]], 3)}<div style="display:flex;gap:10px;margin-top:6px">${UI.radImg(o.modality, o.exam_code)}<div style="flex:1"><b>Findings</b><textarea name="findings" rows="6" style="width:100%" ${pub ? 'disabled' : ''}>${E(r ? r.findings : '')}</textarea><b>Impression</b><textarea name="impression" rows="3" style="width:100%" ${pub ? 'disabled' : ''}>${E(r ? r.impression : '')}</textarea></div></div>
  ${prior.length ? `<div class="hd">過去影像報告對照</div>${table([['日期', x => fdt(x.reported_at)], ['檢查', x => E(DB.get('radiology_orders', x.order_id).exam_name)], ['Impression', x => E(x.impression)]], prior)}` : ''}
  <div class="bar">${pub ? `<span class="ckok">✔ 已發布 ${fdt(r.published_at)}</span>` : btn('save', '儲存報告') + btn('pub', '簽署並發布', { cls: 'pri' })}</div></div>`;
  w.act.save = () => { S.radSaveReport(oid, UI.vals(w)); UI.status('報告已儲存'); UI.refresh(w); }; w.act.pub = () => { S.radSaveReport(oid, UI.vals(w)); S.radPublish(oid); UI.status('報告已發布並通知醫師'); UI.refresh(w); };
} }); };

/* ================= 護理處置執行 ================= */
UI.openNurse = () => UI.win('nurse', { title: '護理工作站：處置執行清單', w: 960, h: 440, live: true, render: w => {
  const l = DB.where('procedures', o => [HIS.ST.SENT, HIS.ST.RUN].includes(o.status)).sort((a, b) => byPrio(a, b) || a.sent_at.localeCompare(b.sent_at)), ST = HIS.ST;
  w.body.innerHTML = `<div class="scrollbox" style="height:100%">${table([['送出', o => fdt(o.sent_at)], ['病人', o => pl(o.patient_id)], ['床號', o => { const a = DB.one('admissions', x => x.patient_id === o.patient_id && ['住院中', '出院準備'].includes(x.status)); return a ? E(a.bed_id) : '門診/急診'; }], ['處置', o => `<b>${E(o.proc_type)}</b>`], ['內容', o => E(o.detail)], ['優先', prio], ['開立醫師', o => E(HIS.staffName(o.ordered_by))], ['狀態', o => st(o.status)], ['', o => o.status === ST.SENT ? btn('go', '開始執行', { id: o.id, cls: 'pri' }) : btn('fin', '完成', { id: o.id, cls: 'pri' })]], l, { empty: '目前沒有待執行處置' })}</div>`;
  w.act.pt = el => UI.openPatient(el.dataset.id); w.act.go = el => S.procExec(el.dataset.id); w.act.fin = el => UI.ask('完成處置', '請輸入執行結果/備註（如：ECG 竇性心律 78 bpm）：', v => S.procExec(el.dataset.id, v), { optional: true });
} });

/* ================= 掛號 / 新病人 ================= */
UI.openNewPatient = () => UI.win('newpt', { title: '新病人建檔', w: 620, h: 420, render: w => {
  w.body.innerHTML = `<div class="pad"><table class="kv"><tr><th>姓名*</th><td><input name="name"></td><th>性別*</th><td><select name="sex">${opts([['M', '男'], ['F', '女']])}</select></td></tr><tr><th>出生日期*</th><td><input type="date" name="birth"></td><th>身分證字號*（虛構）</th><td><input name="id_no"></td></tr><tr><th>手機</th><td><input name="phone"></td><th>血型</th><td><select name="blood">${opts(['未檢驗', 'A型 Rh+', 'B型 Rh+', 'O型 Rh+', 'AB型 Rh+', 'A型 Rh-', 'B型 Rh-', 'O型 Rh-', 'AB型 Rh-'])}</select></td></tr><tr><th>地址</th><td colspan="3"><input name="address" size="50"></td></tr><tr><th>緊急聯絡人</th><td><input name="emergency_name"></td><th>關係/電話</th><td><input name="emergency_rel" size="6"><input name="emergency_phone" size="12"></td></tr><tr><th>身高/體重</th><td><input name="height" size="4">cm <input name="weight" size="4">kg</td><th>保險身分</th><td><select name="ins_type">${opts(['健保', '自費', '榮民'])}</select></td></tr></table><div class="bar">${btn('save', '建立病歷號', { cls: 'pri' })}</div></div>`;
  w.act.save = () => { const v = UI.vals(w); v.id_no = (v.id_no || '').trim().toUpperCase(); if (v.height) v.height = +v.height; if (v.weight) v.weight = +v.weight; const p = S.createPatient(v); UI.alert(`建檔完成。病歷號：${p.chart_no}　${p.name}`); UI.refresh(w); };
} });
UI.openRegister = () => UI.win('register', { title: '掛號作業', w: 900, h: 480, state: { q: '', sel: null }, render: w => {
  const s = w.state, q = s.q.trim(), rs = q ? DB.where('patients', p => p.chart_no.includes(q) || p.name.includes(q) || p.id_no.includes(q.toUpperCase())).slice(0, 12) : [];
  const docs = DB.where('users', u => ['R-attending', 'R-resident'].includes(u.role_id) && u.dept_id !== 'DEP-ER'), sel = s.sel ? P(s.sel) : null;
  w.body.innerHTML = `<div class="pad"><div class="bar">病人搜尋（病歷號/姓名/身分證）：<input name="q" value="${E(s.q)}" size="16">${btn('find', '搜尋')}${btn('np', '新病人建檔')}</div>${rs.length ? table([['病歷號', p => E(p.chart_no)], ['姓名', p => E(p.name)], ['性別/年齡', p => sexAge(p)], ['身分證', p => HIS.maskId(p.id_no)], ['', p => btn('sel', '選取', { id: p.id })]], rs) : q ? '<div class="empty">查無病人，請先新病人建檔</div>' : ''}
  <div class="hd">掛號資料　${sel ? UI.patLine(sel) : '<span class="bad">尚未選取病人</span>'}</div><table class="kv"><tr><th>看診醫師</th><td><select name="doc">${opts(docs.map(d => [d.id, `${HIS.deptName(d.dept_id)} ${d.name}（${d.title}）`]))}</select></td><th>日期</th><td><input type="date" name="date" value="${HIS.today()}" min="${HIS.today()}"></td><th>診次</th><td><select name="session">${opts(['上午', '下午', '晚上'])}</select></td><td>${btn('reg', '掛號', { cls: 'pri', dis: !sel })}</td></tr></table></div>`;
  w.act.find = () => { s.q = $('[name=q]', w.body).value; UI.refresh(w); }; $('[name=q]', w.body).onkeydown = e => { if (e.key === 'Enter') w.act.find(); }; w.act.np = () => UI.openNewPatient();
  w.act.sel = el => { s.q = $('[name=q]', w.body).value; s.sel = el.dataset.id; UI.refresh(w); };
  w.act.reg = () => { const v = UI.vals(w), a = S.register({ patient_id: s.sel, doctor_id: v.doc, date: v.date, session: v.session }); UI.alert(`掛號成功：${P(s.sel).name}　${HIS.staffName(v.doc)}　${v.date} ${v.session}　${a.queue_no} 號`); };
} });

/* ================= 住院 / 床位 ================= */
UI.openInpatients = () => UI.win('inpt', { title: '住院病人清單', w: 1100, h: 500, live: true, state: { ward: '' }, render: w => {
  const s = w.state, l = DB.where('admissions', a => ['住院中', '出院準備'].includes(a.status) && (!s.ward || a.ward_id === s.ward)).sort((a, b) => a.bed_id.localeCompare(b.bed_id));
  w.body.innerHTML = `<div class="bar">病房 <select name="ward" data-chg="f">${opts(DB.all('wards').map(x => [x.id, x.name]), s.ward, '全部')}</select>　住院中 ${l.length} 人</div><div class="scrollbox" style="height:calc(100% - 30px)">${table([['床號', a => `<b>${E(a.bed_id)}</b>`], ['病歷號', a => E(P(a.patient_id).chart_no)], ['病人', a => pl(a.patient_id)], ['性別/年齡', a => sexAge(P(a.patient_id))], ['過敏', a => HIS.allergies(a.patient_id).length ? '<b class="bad">⚠</b>' : ''], ['入院診斷', a => E(a.admit_dx)], ['科別', a => E(HIS.deptName(a.dept_id))], ['主治', a => E(HIS.staffName(a.attending_id))], ['住院醫師', a => E(HIS.staffName(a.resident_id))], ['入院日', a => a.admit_time.slice(0, 10)], ['天數', a => Math.max(1, Math.ceil((Date.now() - new Date(a.admit_time.replace(' ', 'T'))) / 864e5)), 'num'], ['狀態', a => st(a.status)], ['', a => btn('ws', '病歷/醫囑', { id: a.encounter_id, cls: 'pri' })]], l, { dbl: 'wsd', empty: '無住院病人' })}</div>`;
  w.chg.f = () => { s.ward = UI.vals(w).ward; UI.refresh(w); }; w.act.pt = el => UI.openPatient(el.dataset.id); w.act.ws = el => UI.openWorkspace(el.dataset.id);
} });
UI.openBeds = () => UI.win('beds', { title: '病床管理', w: 980, h: 560, live: true, render: w => {
  const canSet = HIS.can('bed');
  w.body.innerHTML = `<div class="scrollbox" style="height:100%"><div class="legend">${['空床', '使用中', '清潔中', '保留床', '維修中'].map(x => st(x)).join(' ')}　${canSet ? '點選床位可變更狀態' : ''}</div>` + DB.all('wards').map(wd => {
    const bs = DB.where('beds', b => b.ward_id === wd.id), cnt = x => bs.filter(b => b.status === x).length;
    return `<div class="hd">${E(wd.name)}　${E(HIS.deptName(wd.dept_id))}　使用 ${cnt('使用中')}／${bs.length}　空床 ${cnt('空床')}</div><div class="bedrow">${bs.map(b => { const a = HIS.bedAdm(b.id), p = a ? P(a.patient_id) : null; return `<div class="bed b-${{ 空床: 'green', 使用中: 'red', 清潔中: 'orange', 保留床: 'blue', 維修中: 'gray' }[b.status]}" data-act="bed" data-id="${b.id}"><b>${E(b.id)}</b><br>${b.status}${p ? `<br>${E(p.name)}<br>${sexAge(p)}` : ''}</div>`; }).join('')}</div>`;
  }).join('') + '</div>';
  w.act.bed = el => { const b = DB.get('beds', el.dataset.id), a = HIS.bedAdm(b.id); if (a) { UI.dialog(`床位 ${b.id}`, `<div class="dmsg">${UI.patLine(P(a.patient_id))}<br>入院診斷：${E(a.admit_dx)}<br>主治：${E(HIS.staffName(a.attending_id))}　入院：${fdt(a.admit_time)}</div>`, [{ t: '開啟病人資料', primary: true, cb: () => UI.openPatient(a.patient_id) }, { t: '開啟病歷', cb: () => UI.openWorkspace(a.encounter_id) }, { t: '關閉' }]); return; }
    if (!canSet) return UI.alert(`床位 ${b.id}：${b.status}`); UI.form(`變更床位 ${b.id} 狀態`, `<table class="kv"><tr><th>目前狀態</th><td>${st(b.status)}</td></tr><tr><th>變更為</th><td><select name="s">${opts(['空床', '清潔中', '保留床', '維修中'], b.status)}</select></td></tr></table>`, v => S.setBed(b.id, v.s)); };
} });
UI.openAdmReq = () => UI.win('admreq', { title: '入院申請 / 床位分配', w: 1100, h: 480, live: true, render: w => {
  const rq = DB.where('admissions', a => a.status === '入院申請').sort((a, b) => a.requested_at.localeCompare(b.requested_at)), free = DB.where('beds', b => b.status === '空床');
  w.body.innerHTML = `<div class="hd">待分床入院申請（${rq.length}）</div>${table([['申請時間', a => fdt(a.requested_at)], ['病人', a => pl(a.patient_id)], ['性別/年齡', a => sexAge(P(a.patient_id))], ['入院科別', a => E(HIS.deptName(a.dept_id))], ['入院診斷', a => E(a.admit_dx)], ['原因', a => E(a.reason)], ['主治', a => E(HIS.staffName(a.attending_id))], ['分配床位', a => `<select name="bed_${a.id}">${opts(free.slice().sort((x, y) => (DB.get('wards', y.ward_id).dept_id === a.dept_id) - (DB.get('wards', x.ward_id).dept_id === a.dept_id) || x.id.localeCompare(y.id)).map(b => [b.id, `${b.id}（${DB.get('wards', b.ward_id).name}）`]))}</select>`], ['', a => btn('assign', '分床入院', { id: a.id, cls: 'pri' })]], rq, { empty: '目前沒有待分床的入院申請' })}<div class="note">空床 ${free.length} 張。分床後系統自動建立住院就診、入院病歷草稿及入院診斷，床位轉為「使用中」。</div>`;
  w.act.pt = el => UI.openPatient(el.dataset.id); w.act.assign = el => { const bed = UI.vals(w)['bed_' + el.dataset.id]; if (!bed) throw new Error('目前沒有空床可分配'); S.assignBed(el.dataset.id, bed); UI.status('已入住 ' + bed); };
} });

/* ================= 急診 ================= */
UI.openER = () => UI.win('er', { title: '急診工作站 ER', w: 1180, h: 580, live: true, state: { q: '', sel: '' }, render: w => {
  const s = w.state, canReg = HIS.can('er'), l = DB.where('encounters', e => e.type === 'ER' && e.status === '進行中').sort((a, b) => a.triage_level - b.triage_level || a.start_time.localeCompare(b.start_time)), now = Date.now();
  const cand = s.q ? DB.where('patients', p => p.chart_no.includes(s.q) || p.name.includes(s.q) || p.id_no.includes(s.q.toUpperCase())).slice(0, 25) : [];
  w.body.innerHTML = `${canReg ? `<div class="hd">急診掛號 / 檢傷分類</div><table class="kv"><tr><th>病人</th><td><input data-inp="q" name="q" size="12" value="${E(s.q)}" placeholder="病歷號/姓名"> <select name="pid" style="width:190px">${opts(cand.map(p => [p.id, `${p.chart_no} ${p.name} ${sexAge(p)}`]), s.sel)}</select></td><th>檢傷級數</th><td><select name="tri">${opts(Object.entries(HIS.TRIAGE), 3)}</select></td><th>主訴</th><td><input name="cc" size="22"></td><th>BP</th><td><input name="bp_sys" size="3">/<input name="bp_dia" size="3"> HR<input name="hr" size="3"> T<input name="temp" size="4"> SpO₂<input name="spo2" size="3"></td><td>${btn('reg', '掛號並檢傷', { cls: 'pri' })}</td></tr></table>` : ''}
  <div class="hd">急診看板（${l.length}）</div><div class="scrollbox" style="height:calc(100% - ${canReg ? 100 : 30}px)">${table([['級', e => UI.triBadge(e.triage_level)], ['病歷號', e => E(P(e.patient_id).chart_no)], ['病人', e => pl(e.patient_id)], ['性別/年齡', e => sexAge(P(e.patient_id))], ['過敏', e => HIS.allergies(e.patient_id).length ? '<b class="bad">⚠</b>' : ''], ['主訴', e => E(e.triage_cc)], ['到院', e => e.start_time.slice(11, 16)], ['等候(分)', e => Math.round((now - new Date(e.start_time.replace(' ', 'T'))) / 60000), 'num'], ['狀態', e => st(e.er_status)], ['醫師', e => E(HIS.staffName(e.doctor_id) || '—')], ['', e => (e.er_status === '候診' && HIS.can('opd') ? btn('take', '接診', { id: e.id, cls: 'pri' }) : '') + btn('ws', '開啟', { id: e.id })]], l, { empty: '目前沒有急診病人', dbl: 'wsd' })}</div>`;
  w.inp.q = el => { s.q = el.value; const c = el.value ? DB.where('patients', p => p.chart_no.includes(el.value) || p.name.includes(el.value) || p.id_no.includes(el.value.toUpperCase())).slice(0, 25) : []; $('[name=pid]', w.body).innerHTML = opts(c.map(p => [p.id, `${p.chart_no} ${p.name} ${sexAge(p)}`])); };
  w.act.pt = el => UI.openPatient(el.dataset.id); w.act.ws = el => UI.openWorkspace(el.dataset.id); w.act.take = el => { S.erTake(el.dataset.id); UI.openWorkspace(el.dataset.id); };
  w.act.reg = () => { const v = UI.vals(w); const e = S.erRegister({ patient_id: v.pid, triage: v.tri, cc: v.cc, vitals: { bp_sys: v.bp_sys, bp_dia: v.bp_dia, hr: v.hr, temp: v.temp, spo2: v.spo2 } }); s.q = ''; s.sel = ''; UI.status('急診掛號完成：' + HIS.TRIAGE[v.tri]); UI.refresh(w); };
} });

/* ================= 病歷室 ================= */
UI.openRecords = () => UI.win('records', { title: '病歷室：病歷查詢與版本管理', w: 1000, h: 520, state: { q: '' }, render: w => {
  const s = w.state, q = s.q.trim(), pids = q ? DB.where('patients', p => p.chart_no.includes(q) || p.name.includes(q) || p.id_no.includes(q.toUpperCase())).map(p => p.id) : [];
  const recs = q ? DB.where('medical_records', r => pids.includes(r.patient_id)).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 200) : [];
  w.body.innerHTML = `<div class="bar">病歷號/姓名/身分證：<input name="q" value="${E(s.q)}" size="14">${btn('go', '查詢', { cls: 'pri' })}　${q ? `共 ${recs.length} 份病歷` : ''}</div><div class="scrollbox" style="height:calc(100% - 30px)">${q ? table([['建立', r => fdt(r.created_at)], ['病人', r => pl(r.patient_id)], ['類型', r => E(r.type)], ['就診', r => r.encounter_id], ['作者', r => E(HIS.staffName(r.created_by))], ['簽署', r => r.signed_at ? fdt(r.signed_at) + ' ' + E(HIS.staffName(r.signed_by)) : '—'], ['版本', r => 'v' + r.version + '（' + DB.where('record_versions', v => v.record_id === r.id).length + ' 份簽署版）'], ['狀態', r => st(r.status)], ['', r => btn('view', '檢視/版本', { id: r.id, cls: 'pri' })]], recs, { empty: '查無病歷' }) : '<div class="empty">請輸入查詢條件。病歷檢視會寫入稽核紀錄。</div>'}</div>`;
  w.act.go = () => { s.q = $('[name=q]', w.body).value; UI.refresh(w); }; $('[name=q]', w.body).onkeydown = e => { if (e.key === 'Enter') w.act.go(); }; w.act.pt = el => UI.openPatient(el.dataset.id); w.act.view = el => UI.openRecordView(el.dataset.id);
} });

/* ================= 系統管理 ================= */
UI.openAudit = () => UI.win('audit', { title: '操作紀錄 Audit Log', w: 1150, h: 540, live: true, state: { f: {} }, render: w => {
  const f = w.state.f; let l = DB.all('audit_logs'); const has = (a, b) => String(a || '').toLowerCase().includes(String(b).toLowerCase());
  if (f.user) l = l.filter(x => has(x.emp_no + x.user_name, f.user)); if (f.action) l = l.filter(x => x.action === f.action); if (f.chart) { const ids = DB.where('patients', p => p.chart_no.includes(f.chart) || p.name.includes(f.chart)).map(p => p.id); l = l.filter(x => ids.includes(x.patient_id)); } if (f.date) l = l.filter(x => x.at.startsWith(f.date)); if (f.tbl) l = l.filter(x => x.table_name === f.tbl);
  const actions = [...new Set(DB.all('audit_logs').map(x => x.action))].sort();
  w.body.innerHTML = `<div class="bar">使用者<input name="user" size="8" value="${E(f.user || '')}"> 動作<select name="action">${opts(actions, f.action, '全部')}</select> 資料表<select name="tbl">${opts(DB.tables, f.tbl, '全部')}</select> 病人<input name="chart" size="8" value="${E(f.chart || '')}"> 日期<input type="date" name="date" value="${E(f.date || '')}"> ${btn('go', '篩選', { cls: 'pri' })}${btn('clr', '清除')}　符合 ${l.length} / 共 ${DB.all('audit_logs').length} 筆（僅顯示最新 300 筆）</div><div class="scrollbox" style="height:calc(100% - 30px)">${table([['時間', x => x.at], ['員編', x => E(x.emp_no)], ['姓名', x => E(x.user_name)], ['角色', x => E(x.role)], ['工作站', x => E(x.ws)], ['動作', x => `<b>${E(x.action)}</b>`], ['資料表', x => E(x.table_name)], ['記錄ID', x => E(x.record_id)], ['病人', x => x.patient_id ? E(P(x.patient_id).name) : ''], ['說明', x => E(x.detail)]], l.slice().reverse().slice(0, 300), { rowCls: x => /FAIL|CRITICAL|AMEND|REJECT/.test(x.action) ? 'abn' : '' })}</div>`;
  w.act.go = () => { w.state.f = UI.vals(w); UI.refresh(w); }; w.act.clr = () => { w.state.f = {}; UI.refresh(w); };
} });
UI.openUsers = () => UI.win('users', { title: '使用者與權限管理', w: 900, h: 460, live: true, render: w => {
  w.body.innerHTML = `<div class="scrollbox" style="height:55%">${table([['員工編號', u => E(u.emp_no)], ['姓名', u => E(u.name)], ['職稱', u => E(u.title)], ['科別', u => E(HIS.deptName(u.dept_id))], ['角色', u => E(DB.get('roles', u.role_id).name)], ['啟用', u => u.active ? '✔' : '<b class="bad">停用</b>'], ['', u => btn('tog', u.active ? '停用' : '啟用', { id: u.id }) + btn('pw', '重設密碼為 1234', { id: u.id })]], DB.all('users'))}</div><div class="hd">角色權限</div><div class="scrollbox" style="height:35%">${table([['角色', r => E(r.name)], ['權限代碼', r => E(r.perms.join(', '))]], DB.all('roles'))}</div>`;
  w.act.tog = el => { const u = DB.get('users', el.dataset.id); if (u.id === me().id) throw new Error('不可停用自己的帳號'); DB.update('users', u.id, { active: !u.active }); HIS.audit('UPDATE', 'users', u.id, (u.active ? '啟用' : '停用') + u.emp_no); };
  w.act.pw = el => { DB.update('users', el.dataset.id, { pw: HIS.hash('1234') }); HIS.audit('UPDATE', 'users', el.dataset.id, '重設密碼'); UI.status('密碼已重設'); };
} });
UI.openConsistency = () => UI.win('consist', { title: '資料一致性檢查', w: 820, h: 520, render: w => {
  const r = w.state.r || S.consistency(); w.state.r = null;
  w.body.innerHTML = `<div class="bar">${btn('run', '重新檢查', { cls: 'pri' })}　${r.filter(x => !x.ok).length ? `<b class="bad">發現 ${r.filter(x => !x.ok).length} 項異常</b>` : '<span class="ckok">全部通過</span>'}（${r.length} 項規則）</div><div class="scrollbox" style="height:calc(100% - 30px)">${table([['結果', x => x.ok ? '<span class="ckok">✔ 通過</span>' : '<b class="bad">✗ 異常</b>'], ['檢查規則', x => E(x.name)], ['異常筆數', x => x.n, 'num'], ['範例ID', x => E(x.bad.slice(0, 6).join(', '))]], r, { rowCls: x => x.ok ? '' : 'crit' })}</div>`;
  w.act.run = () => { HIS.audit('CHECK', '*', '', '執行資料一致性檢查'); UI.refresh(w); };
} });
UI.openAdminTools = () => UI.win('admintools', { title: '系統工具：資料匯入 / 資料庫結構 / 重置', w: 920, h: 600, render: w => {
  const rows = DB.tables.map(t => `<tr><td>${t}</td><td class="num">${DB.all(t).length}</td></tr>`).join('');
  w.body.innerHTML = `<div class="scrollbox" style="height:100%"><div class="hd">ICD-10-CM 診斷碼匯入（每行：代碼,中文名稱,英文名稱；現有 ${DB.all('icd10').length} 筆）</div><textarea name="icd" rows="4" style="width:98%" placeholder="E10.9,第1型糖尿病，無併發症,Type 1 diabetes mellitus without complications"></textarea>${btn('impicd', '匯入診斷碼', { cls: 'pri' })}
  <div class="hd">藥品目錄匯入（每行：中文名,成分,規格,劑型,途徑,單位,分類[,過敏類別]；可由食藥署公開資料轉換；現有 ${DB.all('medications').length} 項）</div><textarea name="drug" rows="4" style="width:98%" placeholder="舒肝樂,Silymarin,140mg,膠囊,PO,顆,保肝"></textarea>${btn('impdrug', '匯入藥品', { cls: 'pri' })}
  <div class="hd">資料庫結構（共 ${DB.tables.length} 張資料表，儲存於瀏覽器 ${DB.usingMemory() ? '記憶體（目前環境不支援 localStorage）' : 'localStorage'}）</div><div style="display:flex;gap:12px"><table class="grid" style="width:260px"><thead><tr><th>資料表</th><th>筆數</th></tr></thead><tbody>${rows}</tbody></table><div class="note" style="flex:1">資料層位於 <code>core.js</code> 的 <code>HIS.DB</code>（all/get/where/insert/update），所有業務規則位於 <code>HIS.svc</code>。未來改接 FastAPI + PostgreSQL 時，只需把 HIS.DB 換成呼叫 REST/FHIR 的實作，介面與業務服務不變。每筆資料均有唯一 ID，並以 *_id 欄位建立外鍵關聯。</div></div>
  <div class="hd">危險操作</div>${btn('reset', '重置為初始虛構資料', { cls: 'danger' })}</div>`;
  const lines = v => v.split('\n').map(x => x.trim()).filter(Boolean);
  w.act.impicd = () => { let n = 0; lines(UI.vals(w).icd).forEach(l => { const [c, zh, en] = l.split(','); if (c && zh && !DB.one('icd10', x => x.code === c.trim())) { DB.insert('icd10', { code: c.trim(), zh: zh.trim(), en: (en || '').trim(), imported: true }); n++; } }); HIS.audit('IMPORT', 'icd10', '', `匯入 ${n} 筆`); UI.alert(`已匯入 ${n} 筆診斷碼`); UI.refresh(w); };
  w.act.impdrug = () => { let n = 0; lines(UI.vals(w).drug).forEach(l => { const f = l.split(','); if (f.length < 7) return; const code = 'X' + String(DB.all('medications').length + 1).padStart(4, '0'); DB.insert('medications', { code, name_zh: f[0], ingredient: f[1], spec: f[2], form: f[3], route: HIS.ROUTES.includes(f[4]) ? f[4] : 'PO', unit: f[5], class: f[6], allergy_class: f[7] || '', high_alert: false, imported: true }); n++; }); HIS.audit('IMPORT', 'medications', '', `匯入 ${n} 筆`); UI.alert(`已匯入 ${n} 項藥品（尚無庫存，請由藥局進貨）`); UI.refresh(w); };
  w.act.reset = () => UI.confirm('這會清除所有資料（包含您新增的紀錄）並重新產生虛構資料，之後需重新登入。確定？', () => { UI.closeAll(); HIS.seed(); HIS.session = null; location.reload(); });
} });
UI.openAbout = () => UI.alert(`${HIS.HOSPITAL} HIS｜${HIS.VERSION}\n\n所有病人、員工、病歷皆為虛構，僅供教育及娛樂用途。\n\n【已實作】登入/角色權限、病人查詢與資料、掛號、門診看診流程（SOAP、生命徵象、診斷、CPOE 藥物/檢驗/影像/處置/會診）、病歷簽署與版本修訂、藥局（審核/調劑/發藥/退藥/庫存批號效期）、LIS（收件/結果/參考區間/異常標示/報告發布）、RIS（排程/檢查/判讀/發布，示意圖）、護理處置執行、住院（入院申請/分床/病程/出院/床位狀態）、急診（檢傷/接診/留觀/轉住院/離院）、病歷室、操作紀錄、一致性檢查、ICD/藥品匯入。\n\n【尚未實作】批價與健保申報、手術室(OR)排程與麻醉紀錄、住院每日醫囑的重複排程/用藥給藥紀錄(MAR)、ICU 專屬監測、真實 DICOM/PACS、HL7 FHIR 介面、後端伺服器與 PostgreSQL（目前為瀏覽器 localStorage 持久化）、主治醫師對住院醫師病歷加簽流程。`, '關於系統與功能完成度');

/* ================= 選單與工具列 ================= */
UI.defMenu('系統(S)', [['我的工作清單', null, () => UI.openWorklist()], ['系統訊息', null, () => UI.openMessages()], ['-'], ['關於 / 功能完成度', null, () => UI.openAbout()], ['登出 / 換人登入', null, () => UI.logout()]]);
UI.defMenu('病人(P)', [['病人查詢', 'patient', () => UI.openSearch()], ['新病人建檔', 'reg', () => UI.openNewPatient()], ['掛號作業', 'reg', () => UI.openRegister()]]);
UI.defMenu('門診(O)', [['門診候診清單', 'opd', () => UI.openAppt()], ['今日掛號清單', 'reg', () => UI.openAppt()], ['檢驗/影像結果追蹤', 'cpoe', () => UI.openResults()], ['會診作業', 'consult', () => UI.openConsults()]]);
UI.defMenu('住院(I)', [['住院病人清單', ['ipd', 'ipd_view'], () => UI.openInpatients()], ['病床管理', ['ipd', 'ipd_view', 'bed'], () => UI.openBeds()], ['入院申請/分床', 'adt', () => UI.openAdmReq()]]);
UI.defMenu('急診(E)', [['急診看板/檢傷', 'er', () => UI.openER()]]);
UI.defMenu('護理(N)', [['處置執行清單', 'nurse_exec', () => UI.openNurse()]]);
UI.defMenu('藥局(M)', [['藥局作業', 'pharm', () => UI.openPharmacy()]]);
UI.defMenu('檢驗(L)', [['檢驗作業 LIS', 'lab', () => UI.openLab()], ['檢驗報告查詢', 'lab_view', () => { UI.openResults(); }]]);
UI.defMenu('放射(R)', [['放射作業 RIS', ['rad_exec', 'rad_report'], () => UI.openRadiology()], ['影像報告查詢', 'rad_view', () => UI.openResults()]]);
UI.defMenu('病歷室(H)', [['病歷查詢/版本', 'records', () => UI.openRecords()]]);
UI.defMenu('管理(A)', [['操作紀錄', 'admin', () => UI.openAudit()], ['使用者與權限', 'admin', () => UI.openUsers()], ['資料一致性檢查', 'admin', () => UI.openConsistency()], ['系統工具/資料匯入', 'admin', () => UI.openAdminTools()]]);
UI.tools.push(['病人查詢', 'patient', () => UI.openSearch()], ['候診/掛號清單', ['opd', 'reg'], () => UI.openAppt()], ['結果追蹤', 'cpoe', () => UI.openResults()], ['會診', 'consult', () => UI.openConsults()], ['住院清單', 'ipd', () => UI.openInpatients()], ['急診', 'er', () => UI.openER()], ['護理處置', 'nurse_exec', () => UI.openNurse()], ['藥局', 'pharm', () => UI.openPharmacy()], ['檢驗', 'lab', () => UI.openLab()], ['放射', 'rad_exec', () => UI.openRadiology()], ['判讀', 'rad_report', () => UI.openRadiology()], ['病歷室', 'records', () => UI.openRecords()], ['操作紀錄', 'admin', () => UI.openAudit()]);
})(typeof globalThis !== 'undefined' ? globalThis : window);
