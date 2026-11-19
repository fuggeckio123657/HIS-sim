/* ---- 診所版 UI（三）：健保申報、範本管理、病人、設定／一致性檢查、選單 ---- */
(function (G) {
'use strict';
const HIS = G.HIS, DB = HIS.DB, S = HIS.svc, CL = HIS.CL, UI = HIS.UI;
const { E, $, $$, table, kv, btn, opts } = UI;
const NT = n => 'NT$ ' + Math.round(n || 0).toLocaleString(), today = () => CL.today();
const CS = { '草稿': 'gray', '已送出': 'blue', '已核付': 'green' };
const LS = { '正常': 'gray', '暫不申報': 'orange', '核減': 'red', '核付': 'green', '申復核付': 'green', '申復駁回': 'red' };
const stc = (s, m) => `<span class="st s-${m[s] || 'gray'}">${E(s)}</span>`;
const issueHtml = l => (l.issues || []).map(i => `<span class="chip ${i.level === 'E' ? 'bad' : ''}" title="${E(i.msg)}">${i.code}</span>`).join('');

/* ---------- 健保申報 ---------- */
UI.openClClaim = () => UI.win('cl-claim', { title: '健保申報', w: 900, h: 560, live: true, render: w => {
  const ps = S.clPeriods(), cs = DB.all('cl_claims').slice().reverse();
  w.body.innerHTML = `<div class="scrollbox" style="height:100%"><div class="note">教學用簡化版：每月可申報「健保身分、已批價、已讀卡（有就醫序號）」的就診。流程：建立申報草稿 → 檢核（錯誤須修正或暫不申報）→ 送出 → 模擬審查（約 3 個營業日後，或手動立即審查）→ 核減可申復。所有規則皆為虛構簡化。</div>
  <div class="hd">可申報的費用年月</div>${table([['費用年月', r => r.period], ['未申報就診數', r => r.n, 'num'], ['', r => btn('mk', '建立申報草稿', { id: r.period, cls: 'pri' })]], ps.map(r => Object.assign({ id: r.period }, r)), { empty: '沒有未申報的就診' })}
  <div class="hd">申報紀錄</div>${table([['費用年月', c => c.period], ['狀態', c => stc(c.status, CS)], ['件數', c => c.visit_count, 'num'], ['申請點數', c => c.points_claimed, 'num'], ['核減點數', c => c.points_cut ? `<b class="bad">${c.points_cut}</b>` : 0, 'num'], ['核付金額', c => c.status === '已核付' ? NT(c.amount_paid) : ''], ['送出', c => (c.submitted_at || '').slice(0, 10)], ['', c => btn('open', '開啟', { id: c.id })]], cs, { empty: '尚無申報', dbl: 'open' })}</div>`;
  w.act.mk = el => { const c = S.clClaimCreate(el.dataset.id); UI.openClaimDetail(c.id); }; w.act.open = el => UI.openClaimDetail(el.dataset.id); w.dbl.open = tr => UI.openClaimDetail(tr.dataset.id);
} });
UI.openClaimDetail = id => UI.win('cl-claim:' + id, { title: '申報明細', w: 1040, h: 620, live: true, state: { f: 'all' }, render: w => {
  const c = DB.get('cl_claims', id), all = DB.where('cl_claim_lines', l => l.claim_id === id), f = w.state.f, ls = all.filter(l => f === 'all' || (f === 'iss' ? (l.issues || []).length : l.status === f)), draft = c.status === '草稿', errs = all.filter(l => l.status === '正常' && l.issues.some(i => i.level === 'E')).length;
  w.body.innerHTML = `<div class="bar">${kv([['費用年月', c.period], ['狀態', stc(c.status, CS)], ['件數', c.visit_count], ['申請點數', c.points_claimed], ['核減點數', c.points_cut || 0], ['核付', c.status === '已核付' ? NT(c.amount_paid) + '（' + c.points_paid + ' 點）' : '-']], 6)}</div>
  <div class="bar">${draft ? btn('re', '重新檢核') + ' ' + btn('sub', '送出申報', { cls: 'pri' }) + (errs ? `　<span class="bad">尚有 ${errs} 筆錯誤等級問題</span>` : '') : ''}${c.status === '已送出' ? btn('rev', '立即模擬審查', { cls: 'pri' }) + ` <span class="muted">（預計 ${E(c.review_due || '')} 後日結時自動審查）</span>` : ''}　顯示：<select data-chg="f">${opts([['all', '全部'], ['iss', '有檢核問題'], ['正常', '正常'], ['暫不申報', '暫不申報'], ['核減', '核減'], ['申復核付', '申復核付'], ['申復駁回', '申復駁回']], f)}</select></div>
  <div class="scrollbox" style="height:calc(100% - 96px)">${table([['就診日', l => l.date], ['病人', l => E(HIS.pt(l.patient_id).name)], ['主診斷', l => E(l.icd)], ['診察', l => l.exam_pt, 'num'], ['藥費', l => l.drug_pt, 'num'], ['藥事', l => l.disp_pt, 'num'], ['處置', l => l.svc_pt, 'num'], ['申請', l => l.claim_pt, 'num'], ['檢核', l => issueHtml(l)], ['狀態', l => stc(l.status, LS) + (l.cut_pt ? ` <b class="bad">-${l.cut_pt}</b>` : '')], ['', l => btn('view', '詳', { id: l.id }) + (draft ? ' ' + btn('ex', l.status === '暫不申報' ? '恢復' : '暫不申報', { id: l.id }) : '') + (l.status === '核減' ? ' ' + btn('ap', '申復', { id: l.id }) : '')]], ls.slice(0, 400), { empty: '無明細' })}${ls.length > 400 ? '<div class="muted">僅顯示前 400 筆，請用篩選縮小範圍</div>' : ''}</div>`;
  w.chg.f = el => { w.state.f = el.value; }; w.act.re = () => { S.clClaimRecheck(id); UI.status('已重新檢核'); }; w.act.sub = () => UI.confirm('送出後不可再修改明細。確定送出？', () => { S.clClaimSubmit(id); UI.status('申報已送出'); }); w.act.rev = () => { S.clClaimReviewNow(id); UI.status('審查完成'); };
  w.act.ex = el => { const l = DB.get('cl_claim_lines', el.dataset.id); UI.ask(l.status === '暫不申報' ? '恢復申報' : '暫不申報', '請填寫原因（如：待補卡、診斷待確認）', v => S.clLineExclude(l.id, v)); };
  w.act.view = el => { const l = DB.get('cl_claim_lines', el.dataset.id), e = DB.get('encounters', l.encounter_id); UI.dialog('明細：' + HIS.pt(l.patient_id).name + ' ' + l.date, `<div style="min-width:560px">${(l.issues || []).map(i => `<div class="al al-${i.level}"><b>${E(i.code)}</b> ${E(i.msg)}</div>`).join('') || '<div class="muted">無檢核問題</div>'}${(l.cuts || []).map(x => `<div class="al al-E"><b>核減 ${x.pt} 點</b> ${E(x.text)}</div>`).join('')}${l.appeal_text ? `<div class="hd">申復</div><div>${E(l.appeal_text)}</div><b>${E(l.appeal_result)}</b>` : ''}${UI.chargeDetail(e.id)}</div>`, [{ t: '看病歷', cb: () => { UI.clRecordDialog(e.id); return false; } }, { t: '關閉', primary: true }]); };
  w.act.ap = el => UI.ask('申復', '請具體說明醫療必要性並引用病歷內容（至少 20 字；越具體成功率越高）', v => { const ok = S.clAppeal(el.dataset.id, v); UI.alert(ok ? '申復成功，恢復核付。' : '申復被駁回，維持核減。', '申復結果'); }, { rows: 5 });
} });

/* ---------- 範本管理 ---------- */
const FN = CL.FIELD_LABEL;
UI.openClTpl = () => UI.win('cl-tpl', { title: '範本管理（SOAP／處方／檢驗）', w: 940, h: 580, live: true, state: { q: '' }, render: w => {
  const q = (w.state.q || '').toLowerCase(), L = DB.where('templates', t => !t.deleted && (!q || (t.name + t.cat).toLowerCase().includes(q))).sort((a, b) => (a.cat || '').localeCompare(b.cat || '', 'zh-Hant'));
  w.body.innerHTML = `<div class="bar">搜尋 <input data-inp="q" value="${E(w.state.q)}" size="12">　${btn('new', '＋ 新增範本', { cls: 'pri' })} ${btn('restore', '還原內建範本')} ${btn('imp', '匯入 JSON')} ${btn('exp', '匯出 JSON')}　<span class="muted">共 ${L.length} 個；範本內「＿」「（有/無）」為完診前必須填的標記，{{name}} {{age}} {{sex}} {{vitals}} 會自動代入</span></div><div class="scrollbox" style="height:calc(100% - 34px)">${table([['分類', t => E(t.cat)], ['名稱', t => `<b>${E(t.name)}</b>`], ['診斷', t => E((t.dx || []).join(','))], ['處方', t => (t.rx || []).length], ['檢驗', t => (t.sv || []).length], ['來源', t => t.builtin ? '內建' : '自訂'], ['', t => btn('edit', '編輯', { id: t.id }) + ' ' + btn('dup', '複製', { id: t.id }) + ' ' + btn('del', '刪除', { id: t.id })]], L, { dbl: 'edit', empty: '無範本' })}</div>`;
  w.inp.q = el => { w.state.q = el.value; UI.refresh(w); const i = $('[data-inp=q]', w.body); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } };
  const form = t => UI.dialog(t.id ? '編輯範本' : '新增範本', `<div class="scrollbox" style="max-height:65vh;min-width:680px"><table class="kv"><tr><th>名稱</th><td><input name="name" value="${E(t.name || '')}" size="30"></td><th>分類</th><td><input name="cat" value="${E(t.cat || '自訂')}" size="12"></td></tr></table>
    ${CL.REC_FIELDS.map(k => `<div class="fld"><label>${E(FN[k])}</label><textarea name="f_${k}" rows="${['hpi', 'pe', 'plan'].includes(k) ? 3 : 2}">${E((t.f || {})[k] || '')}</textarea></div>`).join('')}
    <div class="fld"><label>建議診斷（ICD，逗號分隔，第一個為主要）</label><input name="dx" value="${E((t.dx || []).join(','))}" size="60"></div>
    <div class="fld"><label>建議處方（每行：成分|單次劑量|頻率|天數，例：Amlodipine|1|QD|28）</label><textarea name="rx" rows="4">${E((t.rx || []).join('\n'))}</textarea></div>
    <div class="fld"><label>建議檢驗／處置（代碼，逗號分隔）</label><input name="sv" value="${E((t.sv || []).join(','))}" size="60"></div><div class="dlgerr bad"></div></div>`,
    [{ t: '儲存', primary: true, cb: m => { const g = n => $(`[name=${n}]`, m).value, f = {}; CL.REC_FIELDS.forEach(k => { f[k] = g('f_' + k); }); const sp = s => s.split(/[,，\s]+/).map(x => x.trim()).filter(Boolean);
      S.clTplSave({ id: t.id, name: g('name'), cat: g('cat'), f, dx: sp(g('dx')), rx: g('rx').split('\n').map(x => x.trim()).filter(Boolean), sv: sp(g('sv')), builtin: t.builtin && !!t.id }); UI.status('範本已儲存'); } }, { t: '取消' }]);
  w.act.new = () => form({}); w.act.edit = el => form(DB.get('templates', el.dataset.id)); w.dbl.edit = tr => form(DB.get('templates', tr.dataset.id));
  w.act.dup = el => { const t = DB.get('templates', el.dataset.id); form({ name: t.name + '（複本）', cat: t.cat, f: t.f, dx: t.dx, rx: t.rx, sv: t.sv }); };
  w.act.del = el => UI.confirm('刪除此範本？（內建範本可用「還原內建範本」找回）', () => S.clTplDelete(el.dataset.id));
  w.act.restore = () => { const n = S.clTplRestore(); UI.alert('已還原／補回 ' + n + ' 個內建範本。'); };
  w.act.exp = () => UI.dialog('匯出範本 JSON', `<textarea class="dta" rows="16" cols="80" readonly>${E(S.clTplExport())}</textarea><div class="note">全選複製後存檔；可在其他診所匯入。</div>`, [{ t: '關閉', primary: true }]);
  w.act.imp = () => UI.dialog('匯入範本 JSON', '<textarea class="dta" name="j" rows="14" cols="80" placeholder="貼上匯出的 JSON 陣列"></textarea><div class="dlgerr bad"></div>', [{ t: '匯入', primary: true, cb: m => { const n = S.clTplImport($('[name=j]', m).value); UI.status('已匯入 ' + n + ' 個範本'); } }, { t: '取消' }]);
} });

/* ---------- 病人 ---------- */
UI.openClPatients = () => UI.win('cl-pts', { title: '病人資料／歷次就診', w: 900, h: 540, live: true, state: { q: '' }, render: w => {
  const q = (w.state.q || '').trim().toLowerCase(), L = DB.all('patients').filter(p => !q || (p.name + p.chart_no + p.id_no).toLowerCase().includes(q)).slice(0, 80);
  w.body.innerHTML = `<div class="bar">姓名／病歷號 <input data-inp="q" value="${E(w.state.q)}" size="14">　共 ${DB.all('patients').length} 位病人（顯示前 80）</div><div class="scrollbox" style="height:calc(100% - 34px)">${table([['病歷號', p => E(p.chart_no)], ['姓名', p => `<b>${E(p.name)}</b>`], ['性別/年齡', p => UI.sexAge(p)], ['慢性病', p => E((p.chronic || []).map(k => CL.CHR_NAME[k]).join('、'))], ['過敏', p => HIS.allergies(p.id).length ? `<b class="bad">${E(HIS.allergies(p.id).map(a => a.allergen).join('、'))}</b>` : ''], ['免部分負擔', p => E(p.exempt || '')], ['就診', p => DB.where('encounters', e => e.patient_id === p.id).length, 'num'], ['', p => btn('open', '就診紀錄', { id: p.id })]], L, { dbl: 'open', empty: '無' })}</div>`;
  w.inp.q = el => { w.state.q = el.value; UI.refresh(w); const i = $('[data-inp=q]', w.body); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } };
  const op = id => { const p = HIS.pt(id), es = DB.where('encounters', e => e.patient_id === id).sort((a, b) => b.end_time.localeCompare(a.end_time)); UI.dialog('就診紀錄：' + p.name, `<div style="min-width:620px"><div>${UI.patLine(p)}</div>${table([['日期', e => e.date], ['醫師', e => E(HIS.staffName(e.doctor_id))], ['診斷', e => E(DB.where('diagnoses', d => d.encounter_id === e.id && d.status !== '已刪除').map(d => d.zh).join('、'))], ['身分', e => e.ins], ['', e => btn('r', '病歷', { id: e.id })]], es, { empty: '尚無就診' })}</div>`, [{ t: '關閉', primary: true }]);
    $$('.modal [data-act=r]').forEach(b => { b.onclick = () => UI.clRecordDialog(b.dataset.id); }); };
  w.act.open = el => op(el.dataset.id); w.dbl.open = tr => op(tr.dataset.id);
} });

/* ---------- 設定／一致性 ---------- */
UI.openClSettings = () => UI.win('cl-set', { title: '診所設定／資料一致性檢查', w: 860, h: 600, live: true, render: w => {
  const c = CL.cfg(), admin = HIS.can('*'), R = S.clConsistency();
  const inp = (n, v, sz) => `<input name="${n}" value="${E(v)}" size="${sz || 8}" ${admin ? '' : 'disabled'}>`, js = x => JSON.stringify(x);
  w.body.innerHTML = `<div class="scrollbox" style="height:100%"><div class="hd">費用參數（虛構／教學簡化；僅院長可修改）</div>${kv([['診所名稱', inp('clinic_name', c.clinic_name, 16)], ['每點金額（元）', inp('point_value', c.point_value)], ['掛號費', inp('reg_fee', c.reg_fee)], ['門診部分負擔', inp('copay_visit', c.copay_visit)], ['自費診察費', inp('self_exam', c.self_exam)], ['來客間隔（秒）', inp('arrive_sec', c.arrive_sec)], ['候位上限', inp('max_wait', c.max_wait || 6)]], 4)}
  ${kv([['診察費分級 [[人次上限,點數],…]', inp('exam_tiers', js(c.exam_tiers), 40)], ['藥事服務費 [[天數上限,點數],…]', inp('disp_tiers', js(c.disp_tiers), 40)], ['藥品部分負擔 [[藥費點數上限,金額],…]', inp('drug_copay', js(c.drug_copay), 60)]], 1)}
  ${admin ? `<div class="bar">${btn('save', '儲存設定', { cls: 'pri' })}　${btn('reset', '重設全部資料（重新產生虛構資料）')}</div>` : ''}
  <div class="hd">資料一致性檢查</div>${table([['檢查項目', r => E(r.name)], ['結果', r => r.ok ? '<b class="ok">通過</b>' : `<b class="bad">異常 ${r.n}</b>`], ['問題 ID（前幾筆）', r => E(r.bad.slice(0, 4).join(', '))]], R)}
  <div class="hd">關於</div><div class="note">${E(HIS.VERSION)}。全部人物、院所、藥品、健保碼與規則皆為虛構／簡化，僅供教育及娛樂，與真實健保署規範無關。區網同步：${HIS.remote.active ? '已連線（' + E(HIS.remote.status) + '）' : '未連線（單機）'}。</div></div>`;
  w.act.save = () => { const v = UI.vals(w), n = k => Number(v[k]), p = {}; if (v.clinic_name) p.clinic_name = v.clinic_name; ['point_value', 'reg_fee', 'copay_visit', 'self_exam', 'arrive_sec', 'max_wait'].forEach(k => { if (!(n(k) >= 0)) throw new Error('數值格式錯誤：' + k); p[k] = n(k); }); ['exam_tiers', 'disp_tiers', 'drug_copay'].forEach(k => { let a; try { a = JSON.parse(v[k]); } catch (e) { throw new Error('分級格式錯誤：' + k); } if (!Array.isArray(a) || !a.length || a.some(x => !Array.isArray(x) || x.length !== 2 || isNaN(x[0]) || isNaN(x[1]))) throw new Error('分級格式錯誤：' + k); p[k] = a; }); S.clSetting(p); UI.status('設定已儲存'); };
  w.act.reset = () => UI.confirm('這會清除所有資料（含你的操作）並重新產生虛構資料；若為區網同步模式，所有連線裝置的資料都會被重設。確定？', async () => { UI.closeAll(); HIS.session = null; if (HIS.remote.active) { await HIS.remote.resetServer(); } else { CL.seed(); } location.reload(); });
} });

/* ---------- 選單／工具列 ---------- */
const C = 'clinic';
UI.defMenu('診所(C)', [['首頁／今日流程', null, () => UI.openClinicHome()], ['病人資料', 'patient', () => UI.openClPatients()], ['-'], ['登出', null, () => UI.logout()]], C);
UI.defMenu('前台(F)', [['櫃台掛號／讀卡', 'cl_reg', () => UI.openClReg()], ['護理量測', 'cl_triage', () => UI.openClTriage()], ['批價收費', 'cl_bill', () => UI.openClBill()]], C);
UI.defMenu('診間(D)', [['候診清單／看診', 'cl_doctor', () => UI.openClDoctor()], ['外送檢驗報告', 'cl_doctor', () => UI.openClLab()], ['範本管理', 'cl_tpl', () => UI.openClTpl()]], C);
UI.defMenu('藥局(M)', [['領藥與庫存', 'cl_disp', () => UI.openClPharm()]], C);
UI.defMenu('帳務(B)', [['日結與報表', 'cl_bill', () => UI.openClClose()], ['健保申報', 'cl_claim', () => UI.openClClaim()]], C);
UI.defMenu('系統(S)', [['設定／一致性檢查', null, () => UI.openClSettings()]], C);
UI.tools.push(['首頁', null, () => UI.openClinicHome(), C], ['掛號', 'cl_reg', () => UI.openClReg(), C], ['量測', 'cl_triage', () => UI.openClTriage(), C], ['診間', 'cl_doctor', () => UI.openClDoctor(), C], ['批價', 'cl_bill', () => UI.openClBill(), C], ['藥局', 'cl_disp', () => UI.openClPharm(), C], ['日結', 'cl_bill', () => UI.openClClose(), C], ['申報', 'cl_claim', () => UI.openClClaim(), C], ['範本', 'cl_tpl', () => UI.openClTpl(), C]);
const _enter = UI.enter; UI.enter = () => { _enter(); if (HIS.edition === 'clinic') UI.clStart(); };
})(typeof globalThis !== 'undefined' ? globalThis : window);
