/* ---- 診所版 UI（二）：診間（候診清單、看診工作台、完診、診後回顧、病歷檢視）---- */
(function (G) {
'use strict';
const HIS = G.HIS, DB = HIS.DB, S = HIS.svc, CL = HIS.CL, UI = HIS.UI;
const { E, $, $$, table, kv, btn, opts } = UI;
const me = () => HIS.session.user, today = () => CL.today(), NT = n => 'NT$ ' + Math.round(n).toLocaleString();
const dkey = id => 'clinic.draft.' + id;
const loadDraft = id => { try { const s = localStorage.getItem(dkey(id)); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
const saveDraft = (id, d) => { try { localStorage.setItem(dkey(id), JSON.stringify(d)); } catch (e) { /* 無法暫存也不影響看診 */ } };
const dropDraft = id => { try { localStorage.removeItem(dkey(id)); } catch (e) { } };
const newDraft = () => ({ record: Object.fromEntries(CL.REC_FIELDS.map(k => [k, ''])), dx: [], drugs: [], services: [], refer: { to: '', reason: '' }, tpl_used: '', log: [], pe_seen: {} });
const encDx = id => DB.where('diagnoses', d => d.encounter_id === id && d.status !== '已刪除');

/* ---------- 歷次病歷（唯讀）---------- */
UI.clRecordDialog = encId => { const e = DB.get('encounters', encId), r = HIS.encRecord(encId) || {}, p = HIS.pt(e.patient_id), its = DB.where('cl_items', i => i.encounter_id === encId);
  UI.dialog(`病歷 ${e.date} ${p.name}`, `<div class="scrollbox" style="max-height:60vh;min-width:640px">${kv([['日期', e.date], ['醫師', E(HIS.staffName(e.doctor_id))], ['身分', e.ins + (e.ic_seq ? ' 序號' + e.ic_seq : '')], ['範本', E(e.tpl_used || '')]], 4)}
  ${CL.REC_FIELDS.map(k => `<div class="hd">${E(CL.FIELD_LABEL[k])}</div><div class="rtxt">${E(r[k] || '').replace(/\n/g, '<br>') || '<span class="muted">（空白）</span>'}</div>`).join('')}
  <div class="hd">診斷</div>${table([['類型', d => d.type], ['ICD', d => E(d.icd_code)], ['名稱', d => E(d.zh)]], encDx(encId))}
  <div class="hd">處方／處置</div>${table([['項目', i => E(i.name)], ['內容', i => i.kind === 'drug' ? `${i.dose} ${E(i.freq)} × ${i.days} 天（${i.qty}${E(i.unit)}）` : '×' + i.qty + (i.result ? '　結果：' + E(i.result) : '')], ['', i => i.self ? '自費' : '']], its, { empty: '無' })}</div>`, [{ t: '關閉', primary: true }]); };

/* ---------- 診間候診清單 ---------- */
UI.openClDoctor = () => UI.win('cl-doctor', { title: '診間：候診清單', w: 920, h: 560, live: true, render: w => {
  const mine = HIS.can('*') ? () => true : a => a.doctor_id === me().id, aps = DB.where('appointments', a => a.date === today() && a.status === '候診中' && mine(a)).sort((a, b) => a.queue_no - b.queue_no);
  const done = DB.where('encounters', e => e.date === today() && e.status === '完診' && (HIS.can('*') || e.doctor_id === me().id)).reverse();
  w.body.innerHTML = `<div class="scrollbox" style="height:100%"><div class="hd">候診（${aps.length}）　<span class="muted">病人說的話只有進診間才會聽到；S/O/A/P 需由你自己輸入</span></div>${table([['號', a => a.queue_no], ['姓名', a => `<b>${E(UI.clApName(a))}</b>`], ['性別/年齡', a => UI.sexAge(HIS.pt(a.patient_id))], ['類型', a => E(a.visit_type || '')], ['身分', a => a.ins === '自費' ? '<b class="bad">自費</b>' : '健保'], ['生命徵象', a => a.vitals_done ? '✓' : '<span class="muted">未量</span>'], ['草稿', a => loadDraft(a.id) ? '<b>有草稿</b>' : ''], ['', a => btn('see', '叫號看診', { id: a.id, cls: 'pri' })]], aps, { empty: '目前沒有候診病人（等櫃台掛號、護理量測）' })}
  <div class="hd">今日已完診（${done.length}）</div>${table([['時間', e => e.end_time.slice(11, 16)], ['姓名', e => E(HIS.pt(e.patient_id).name)], ['主診斷', e => E(e.primary_icd)], ['領藥', e => E(e.disp_status)], ['', e => btn('rec', '病歷', { id: e.id }) + ' ' + btn('dx', '修訂診斷', { id: e.id, dis: !!e.claim_id })]], done, { empty: '無' })}</div>`;
  w.act.see = el => UI.openClVisit(el.dataset.id); w.act.rec = el => UI.clRecordDialog(el.dataset.id);
  w.act.dx = el => { const id = el.dataset.id, cur = encDx(id); UI.form('修訂診斷（須填原因，保留版本）', `<table class="kv"><tr><th>主要診斷 ICD</th><td><input name="main" value="${E((cur.find(d => d.type === '主要') || {}).icd_code || '')}" size="10"></td></tr><tr><th>次要診斷（逗號分隔）</th><td><input name="sub" value="${E(cur.filter(d => d.type !== '主要').map(d => d.icd_code).join(','))}" size="30"></td></tr><tr><th>修訂原因</th><td><input name="why" size="30"></td></tr></table>`, o => { const dx = [{ icd: o.main.trim(), type: '主要' }].concat(o.sub.split(',').map(x => x.trim()).filter(Boolean).map(x => ({ icd: x, type: '次要' }))); S.clAmendDx(id, dx, o.why); }); };
} });

/* ---------- 看診工作台 ---------- */
UI.openClVisit = apptId => {
  const ap0 = DB.get('appointments', apptId); if (!ap0 || ap0.status !== '候診中') { UI.alert('此病人不在候診中（可能已完診或被取消）。'); return; }
  const d = loadDraft(apptId) || newDraft(); if (!d.log) d.log = []; if (!d.pe_seen) d.pe_seen = {};
  UI.win('cl-visit:' + apptId, { title: '看診：' + UI.clApName(ap0), w: 1240, h: 720, state: { d, tab: 'S' }, render: w => {
    const ap = DB.get('appointments', apptId); if (!ap || ap.status !== '候診中') { w.body.innerHTML = '<div class="empty">此病人已不在候診中（已完診或被取消）。</div>'; dropDraft(apptId); return; }
    const p = HIS.pt(ap.patient_id), v = DB.one('vital_signs', x => x.appt_id === apptId), d = w.state.d, R = d.record, save = () => saveDraft(apptId, d);
    if (!ap || ap.status !== '候診中') { w.body.innerHTML = '<div class="empty">此病人已不在候診中（已完診或被取消）。</div>'; dropDraft(apptId); return; }
    const hist = DB.where('encounters', e => e.patient_id === p.id && e.status === '完診').sort((a, b) => b.end_time.localeCompare(a.end_time)).slice(0, 4);
    const items = CL.buildItemsSafe(ap, d), alerts = CL.draftAlerts(ap, d), score = CL.docScore(R), tpls = DB.where('templates', t => !t.deleted).sort((a, b) => (a.cat || '').localeCompare(b.cat || '', 'zh-Hant'));
    const tests = items.filter(i => i.kind === 'svc' && ['院內檢驗', '外送檢驗', '檢查', '自費檢驗'].includes(i.type));
    const field = (k, rows) => `<div class="fld"><label>${E(CL.FIELD_LABEL[k])}</label><textarea data-inp="rec" data-k="${k}" rows="${rows}" spellcheck="false">${E(R[k])}</textarea></div>`;
    const dl = (id, arr) => `<datalist id="${id}">${arr.map(x => `<option value="${E(x)}"></option>`).join('')}</datalist>`;
    const vit = v ? `BP ${v.bp_sys}/${v.bp_dia}　HR ${v.hr}　BT ${v.temp >= 37.5 ? `<b class="bad">${v.temp}</b>` : v.temp}°C　SpO₂ ${v.spo2}%${v.rr ? '　RR ' + v.rr : ''}` : '<b class="bad">尚未量測生命徵象</b>（可請護理站量測）';
    w.body.innerHTML = `<div class="vis"><div class="vis-l scrollbox">
      <div class="vcard">${UI.patLine(p)}<br>${(p.chronic || []).map(k => `<span class="chip">${E(CL.CHR_NAME[k])}</span>`).join('')}${p.exempt ? `<span class="chip">免部分負擔：${E(p.exempt)}</span>` : ''}<span class="chip">${E(ap.visit_type || '')}</span>${ap.ins === '自費' ? '<span class="chip bad">自費</span>' : ''}<div class="vit">${vit}</div></div>
      <div class="hd">病人說：</div><div class="bubble pt">「${E(ap.speech)}」</div>
      <div class="hd">問診（點選要問的問題；答案只會出現在對話紀錄，需由你整理後自行輸入 S）</div>
      <div class="qs">${CL.questions(ap).map(q => `<button class="btn q ${d.log.some(l => l.i === q.i) ? 'asked' : ''}" data-act="ask" data-i="${q.i}">${E(q.q)}</button>`).join('')}</div>
      <div class="chat">${d.log.map(l => `<div class="bubble dr">醫：${E(l.q)}</div><div class="bubble pt">病：${E(l.a)}</div>`).join('') || '<div class="muted">（尚未問診）</div>'}</div>
      <div class="hd">理學檢查（點選部位查看發現，再由你記錄於 PE）</div>
      <div class="qs">${CL.PE_SYS.map(s => `<button class="btn q ${d.pe_seen[s] ? 'asked' : ''}" data-act="pe" data-s="${E(s)}">${E(s)}</button>`).join('')}</div>
      <div class="chat">${CL.PE_SYS.filter(s => d.pe_seen[s]).map(s => `<div class="bubble pe"><b>${E(s)}</b>：${E(d.pe_seen[s])}</div>`).join('') || '<div class="muted">（尚未檢查）</div>'}</div>
      ${Object.keys(d.pe_seen).length ? btn('pe2rec', '↳ 把已檢查的發現附加到 PE 欄') : ''}
      <div class="hd">歷次就診</div>${table([['日期', e => e.date], ['診斷', e => E(encDx(e.id).map(x => x.zh).join('、'))], ['', e => btn('rec', '看', { id: e.id })]], hist, { empty: '首次就診' })}
      ${hist[0] ? `<div class="muted">上次處方：${E(DB.where('cl_items', i => i.encounter_id === hist[0].id && i.kind === 'drug').map(i => i.name.split(' ')[0]).join('、') || '無')}</div>` : ''}</div>
    <div class="vis-m scrollbox">
      <div class="sec">S　主觀資料（Subjective）<span class="muted">　依問診結果自行輸入</span></div>${field('cc', 2)}${field('hpi', 4)}${field('ros', 2)}${field('pmh', 2)}${field('fh', 1)}${field('sh', 2)}
      <div class="sec">O　客觀資料（Objective）</div>${field('pe', 4)}${field('exam', 3)}<div class="bar">${btn('vit2rec', '插入生命徵象到檢查結果')}${tests.length ? ' ' + btn('res2rec', '↳ 把檢驗/檢查結果寫入檢查結果欄') : ''}</div>
      ${tests.length ? table([['項目', i => E(i.name)], ['結果', i => i.result_status === '待回報' ? `<span class="muted">外送，約 ${i.ext_days} 日後回報</span>` : (i.abnormal ? `<b class="bad">${E(i.result)}</b>` : E(i.result))]], tests) : ''}
      <div class="sec">A　評估（Assessment）</div>${field('assessment', 3)}
      <div class="bar">診斷：<input data-chg="dxadd" list="dl-icd" size="34" placeholder="輸入 ICD 或名稱搜尋，Enter 加入">${dl('dl-icd', DB.all('icd10').map(x => x.code + ' ' + x.zh))}</div>
      ${table([['類型', (x, i) => `<select data-chg="dxtype" data-i="${i}">${opts(['主要', '次要'], x.type)}</select>`], ['ICD', x => E(x.icd)], ['名稱', x => E((DB.one('icd10', c => c.code === x.icd) || {}).zh || '')], ['', (x, i) => btn('dxdel', '刪', { id: i })]], d.dx, { empty: '尚未加入診斷（需 1 個主要診斷）' })}
      <div class="sec">P　計畫（Plan）</div>${field('plan', 3)}${field('edu', 2)}${field('followup', 1)}
      <div class="bar">處方：<input data-chg="rxadd" list="dl-med" size="30" placeholder="藥名或成分，Enter 加入">${dl('dl-med', DB.all('medications').map(m => m.name_zh + ' ' + m.ingredient + ' ' + m.spec + ' [' + m.code + ']'))}</div>
      ${table([['藥品', x => { const m = DB.one('medications', c => c.code === x.code); return E(m.name_zh + ' ' + m.spec) + (m.antibiotic ? ' <span class="chip">抗生素</span>' : ''); }], ['單次', (x, i) => `<input data-chg="rx" data-i="${i}" data-f="dose" value="${E(x.dose)}" size="3">`], ['頻率', (x, i) => `<select data-chg="rx" data-i="${i}" data-f="freq">${opts(CL.FREQ, x.freq)}</select>`], ['天數', (x, i) => `<input data-chg="rx" data-i="${i}" data-f="days" value="${E(x.days)}" size="3">`], ['總量', (x, i) => { const m = DB.one('medications', c => c.code === x.code); return CL.qty(m, +x.dose || 0, x.freq, +x.days || 1) + E(m.unit); }], ['備註', (x, i) => `<input data-chg="rx" data-i="${i}" data-f="note" value="${E(x.note || '')}" size="10" placeholder="如：飯後">`], ['自費', (x, i) => `<input type="checkbox" data-chg="rx" data-i="${i}" data-f="self" ${x.self ? 'checked' : ''}>`], ['過敏覆核原因', (x, i) => { const m = DB.one('medications', c => c.code === x.code); return HIS.checkAllergy(p.id, m).length ? `<input data-chg="rx" data-i="${i}" data-f="allergy_override" value="${E(x.allergy_override || '')}" size="12" placeholder="必填">` : ''; }], ['', (x, i) => btn('rxdel', '刪', { id: i })]], d.drugs, { empty: '無處方' })}
      <div class="bar">檢驗／處置：<input data-chg="svadd" list="dl-sv" size="30" placeholder="項目名稱，Enter 加入">${dl('dl-sv', DB.all('cl_services').filter(s => s.type !== '診察').map(s => s.name + ' [' + s.code + ']'))}</div>
      ${table([['項目', x => { const s = DB.one('cl_services', c => c.code === x.code); return E(s.name) + ` <span class="muted">${E(s.type)}${s.nhi ? '' : '・自費'}</span>`; }], ['數量', (x, i) => `<input data-chg="sv" data-i="${i}" data-f="qty" value="${E(x.qty || 1)}" size="3">`], ['自費', (x, i) => `<input type="checkbox" data-chg="sv" data-i="${i}" data-f="self" ${x.self ? 'checked' : ''}>`], ['', (x, i) => btn('svdel', '刪', { id: i })]], d.services, { empty: '無檢驗／處置' })}
      <div class="bar">轉診：院所 <input name="refer_to" data-inp="refer" data-k="to" value="${E(d.refer.to)}" size="14"> 原因 <input name="refer_reason" data-inp="refer" data-k="reason" value="${E(d.refer.reason)}" size="24"></div>
    </div>
    <div class="vis-r scrollbox"><div class="hd">範本</div><select name="tpl" style="width:100%">${opts(tpls.map(t => [t.id, (t.cat ? t.cat + '｜' : '') + t.name]), null, '— 選擇範本 —')}</select><div class="bar">${btn('tpl', '套用範本', { cls: 'pri' })} ${btn('tplsave', '另存為範本')}</div>
      <div class="hd">即時提示</div><div class="alerts">${alerts.length ? alerts.map(a => `<div class="al al-${a.level}"><b>${E(a.code)}</b> ${E(a.msg)}</div>`).join('') : '<div class="muted">目前無健保/用藥警示</div>'}${CL.unfilled(Object.values(R).join('')) ? '<div class="al al-E"><b>範本</b> 病歷仍有未填標記（＿ 或 （有/無）），完診前須改掉</div>' : ''}</div>
      <div class="hd">病歷記載完整度</div><div class="meter"><i style="width:${score}%" class="${score < 60 ? 'lo' : ''}"></i></div><div>${score} / 100 ${score < 60 ? '<b class="bad">（&lt;60 審查易核減）</b>' : ''}</div>
      <div class="bar" style="margin-top:12px">${btn('finish', '完診', { cls: 'pri big' })}</div><div class="bar">${btn('drop', '清除草稿')}</div>
      <div class="note">草稿只存在你這台電腦；按「完診」才會一次寫入病歷、診斷、處方與費用。</div></div></div>`;
    const sync = () => { $$('textarea[data-k]', w.body).forEach(t => { R[t.dataset.k] = t.value; }); save(); };
    w.inp.rec = el => { R[el.dataset.k] = el.value; save(); const s = $('.vis-r', w.body), sc = CL.docScore(R); if (s) { const m = $('.meter i', s); m.style.width = sc + '%'; m.className = sc < 60 ? 'lo' : ''; m.parentNode.nextElementSibling.innerHTML = sc + ' / 100 ' + (sc < 60 ? '<b class="bad">（&lt;60 審查易核減）</b>' : ''); } };
    w.inp.refer = el => { d.refer[el.dataset.k] = el.value; save(); };
    const redo = () => { sync(); UI.refresh(w); }, append = (k, t) => { R[k] = (R[k] ? R[k].replace(/\s+$/, '') + '\n' : '') + t; };
    w.act.ask = el => { sync(); const i = +el.dataset.i, q = CL.questions(ap).find(x => x.i === i); if (!d.log.some(l => l.i === i)) d.log.push({ i, q: q.q, a: CL.answer(ap, i) }); save(); UI.refresh(w); };
    w.act.pe = el => { sync(); d.pe_seen[el.dataset.s] = CL.peFinding(ap, el.dataset.s); save(); UI.refresh(w); };
    w.act.pe2rec = () => { sync(); CL.PE_SYS.filter(s => d.pe_seen[s]).forEach(s => { if (!R.pe.includes(d.pe_seen[s])) append('pe', `${s}：${d.pe_seen[s]}`); }); redo(); };
    w.act.vit2rec = () => { sync(); if (v) append('exam', `生命徵象：BP ${v.bp_sys}/${v.bp_dia} mmHg，HR ${v.hr}，BT ${v.temp}°C，SpO₂ ${v.spo2}%`); redo(); };
    w.act.res2rec = () => { sync(); tests.forEach(i => { const t = i.result_status === '待回報' ? `${i.name}：已外送，待回報` : `${i.name}：${i.result}`; if (!R.exam.includes(t)) append('exam', t); }); redo(); };
    w.act.rec = el => UI.clRecordDialog(el.dataset.id);
    const pickCode = v => { const m = /\[([^\]]+)\]\s*$/.exec(v); return m ? m[1] : null; };
    w.chg.dxadd = el => { const code = el.value.trim().split(' ')[0].toUpperCase(); if (!el.value.trim()) return; const x = DB.one('icd10', c => c.code.toUpperCase() === code); if (!x) { UI.status('找不到此診斷碼：' + el.value, true); return; } if (d.dx.some(y => y.icd === x.code)) { UI.status('已加入此診斷'); return; } sync(); d.dx.push({ icd: x.code, type: d.dx.some(y => y.type === '主要') ? '次要' : '主要', status: '確診' }); save(); UI.refresh(w); };
    w.chg.dxtype = el => { sync(); const i = +el.dataset.i; if (el.value === '主要') d.dx.forEach(x => { x.type = '次要'; }); d.dx[i].type = el.value; if (!d.dx.some(x => x.type === '主要') && d.dx[0]) d.dx[0].type = '主要'; save(); UI.refresh(w); };
    w.act.dxdel = el => { sync(); d.dx.splice(+el.dataset.id, 1); if (d.dx.length && !d.dx.some(x => x.type === '主要')) d.dx[0].type = '主要'; save(); };
    w.chg.rxadd = el => { const code = pickCode(el.value) || (DB.all('medications').find(m => (m.name_zh + m.ingredient).toLowerCase().includes(el.value.trim().toLowerCase())) || {}).code; const m = code && DB.one('medications', x => x.code === code); if (!el.value.trim()) return; if (!m) { UI.status('找不到此藥品：' + el.value, true); return; } if (d.drugs.some(x => DB.one('medications', c => c.code === x.code).ingredient === m.ingredient)) { UI.status('已有相同成分藥品（重複用藥）', true); return; } sync(); d.drugs.push({ code: m.code, dose: m.def.dose, freq: m.def.freq, days: m.def.days, note: '', self: false }); save(); UI.refresh(w); };
    w.chg.rx = el => { sync(); const x = d.drugs[+el.dataset.i], f = el.dataset.f; x[f] = el.type === 'checkbox' ? el.checked : el.value; save(); UI.refresh(w); };
    w.act.rxdel = el => { sync(); d.drugs.splice(+el.dataset.id, 1); save(); };
    w.chg.svadd = el => { if (!el.value.trim()) return; const code = pickCode(el.value) || (DB.all('cl_services').find(s => s.name.includes(el.value.trim())) || {}).code; if (!code || !DB.one('cl_services', s => s.code === code)) { UI.status('找不到此項目：' + el.value, true); return; } sync(); const ex = d.services.find(x => x.code === code); if (ex) ex.qty = (+ex.qty || 1) + 1; else d.services.push({ code, qty: 1, self: false }); save(); UI.refresh(w); };
    w.chg.sv = el => { sync(); const x = d.services[+el.dataset.i], f = el.dataset.f; x[f] = el.type === 'checkbox' ? el.checked : el.value; save(); UI.refresh(w); };
    w.act.svdel = el => { sync(); d.services.splice(+el.dataset.id, 1); save(); };
    /* 範本 */
    w.act.tpl = () => { sync(); const id = $('[name=tpl]', w.body).value; if (!id) { UI.status('請先選擇範本', true); return; } const t = DB.get('templates', id);
      UI.form('套用範本：' + t.name, `<div class="note">範本中的「＿」「（有/無）」是待填標記；完診前必須由你填寫或改掉。</div><label><input type="checkbox" name="over" ${Object.values(R).some(x => x.trim()) ? '' : 'checked'}> 覆蓋已輸入的內容（未勾選＝只填入空白欄位）</label><br><label><input type="checkbox" name="orders" checked> 同時帶入建議診斷、處方、檢驗</label><br><label><input type="checkbox" name="auto"> 標記一鍵帶入預設值（無/第一個選項；示範用，仍建議逐項確認）</label>`, o => {
        const f = CL.applyTpl(t, { name: p.name, age: HIS.age(p.birth), sex: p.sex === 'M' ? '男' : '女', vitals: v });
        CL.REC_FIELDS.forEach(k => { let val = f[k]; if (o.auto) val = CL.autofill(val, Math.random); if (o.over || !R[k].trim()) R[k] = val; });
        if (o.orders) { const dxs = (t.dx || []).filter(c => DB.one('icd10', x => x.code === c)); if (o.over || !d.dx.length) d.dx = dxs.map((c, i) => ({ icd: c, type: i ? '次要' : '主要', status: '確診' }));
          (t.rx || []).forEach(s => { const [ing, dose, freq, days] = s.split('|'), m = CL.drugBy(ing); if (!m || d.drugs.some(x => DB.one('medications', c => c.code === x.code).ingredient === m.ingredient)) return; if (HIS.checkAllergy(p.id, m).length) { UI.status('已略過過敏藥品：' + m.name_zh, true); return; } d.drugs.push({ code: m.code, dose: parseFloat(dose) || m.def.dose, freq: freq || m.def.freq, days: parseInt(days) || m.def.days, note: '', self: false }); });
          (t.sv || []).forEach(c => { if (!d.services.some(x => x.code === c) && DB.one('cl_services', s => s.code === c)) d.services.push({ code: c, qty: 1, self: false }); }); }
        d.tpl_used = t.name; save(); setTimeout(() => UI.refresh(w), 0); }); };
    w.act.tplsave = () => { sync(); UI.form('另存為範本', `<table class="kv"><tr><th>名稱</th><td><input name="name" size="24"></td></tr><tr><th>分類</th><td><input name="cat" value="自訂" size="12"></td></tr></table><div class="note">會存入目前 S/O/A/P 文字（姓名/年齡/生命徵象請改為 {{name}} {{age}} {{vitals}} 才會自動代入）、診斷、處方與檢驗。</div>`, o => {
      S.clTplSave({ name: o.name, cat: o.cat, f: Object.assign({}, R), dx: d.dx.map(x => x.icd), rx: d.drugs.map(x => { const m = DB.one('medications', c => c.code === x.code); return `${m.ingredient}|${x.dose}|${x.freq}|${x.days}`; }), sv: d.services.map(x => x.code) }); UI.status('範本已儲存'); setTimeout(() => UI.refresh(w), 0); }); };
    w.act.drop = () => UI.confirm('清除此病人的草稿（所有已輸入內容與問診紀錄）？', () => { dropDraft(apptId); w.state.d = newDraft(); setTimeout(() => UI.refresh(w), 0); });
    /* 完診 */
    w.act.finish = () => { sync(); const p2 = { record: R, dx: d.dx, drugs: d.drugs, services: d.services, refer: d.refer, tpl_used: d.tpl_used }; let est = '';
      try { const its = CL.buildItems(ap, p2, ap.ins), ch = CL.calc({ ins: ap.ins, exempt: p.exempt, doctorIdx: CL.doctorIdx(ap.doctor_id, today()), items: its }); est = `${table([['項目', i => E(i.name)], ['內容', i => i.kind === 'drug' ? `${i.qty}${E(i.unit)}` : '×' + i.qty], ['', i => i.self ? '自費' : i.amount_pt + ' 點']], its, { empty: '僅診察' })}${kv([['申報點數', ch.total_pt], ['病人應收現金', `<b>${NT(ch.cash_due)}</b>`]], 4)}`; } catch (e) { est = `<div class="bad">${E(e.message)}</div>`; }
      UI.dialog('完診確認', `<div style="min-width:520px">${kv([['病人', E(p.name)], ['主要診斷', E(d.dx.filter(x => x.type === '主要').map(x => x.icd).join(''))], ['處方', d.drugs.length + ' 項'], ['檢驗/處置', d.services.length + ' 項']], 4)}${est}<div class="note">完診後病歷即簽署寫入，病人進入批價/領藥；診斷僅能在日後以「修訂」留版本更正。</div><div class="dlgerr bad"></div></div>`,
        [{ t: '確認完診', primary: true, cb: () => { const r = S.clCompleteVisit(apptId, p2); dropDraft(apptId); w.el.querySelector('[data-w=close]').click(); setTimeout(() => UI.clReview(r.encounter.id), 0); } }, { t: '返回修改' }]); };
  } });
};

/* ---------- 診後回顧 ---------- */
UI.clReview = encId => { const e = DB.get('encounters', encId), rec = HIS.encRecord(encId), iss = CL.rules(CL.viewOfEnc(e)).filter(r => r.code !== 'R02'), sc = CL.docScore(rec || {}), p = HIS.pt(e.patient_id);
  UI.dialog('診後回顧：' + p.name, `<div style="min-width:560px"><div class="hd">已完診，病歷已簽署。病人請至櫃台批價 → 藥局領藥。</div>${UI.chargeDetail(encId)}<div class="hd">健保審查風險提示（模擬）</div>${iss.length ? iss.map(a => `<div class="al al-${a.level}"><b>${E(a.code)}</b> ${E(a.msg)}</div>`).join('') : '<div class="muted">此筆病歷與處方沒有檢核問題，申報風險低。</div>'}<div>病歷完整度：<b>${sc}</b> / 100</div></div>`, [{ t: '關閉', primary: true }]); };
})(typeof globalThis !== 'undefined' ? globalThis : window);
