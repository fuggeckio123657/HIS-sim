/* 診所版種子資料：全部為虛構。以真正的服務（掛號→量測→完診→批價→領藥→日結→申報）回放過去兩個月，
 * 因此歷史資料與玩家實際操作產生的資料完全同一套規則，帳務一致。 */
(function (G) {
'use strict';
const HIS = G.HIS, DB = HIS.DB, CL = HIS.CL, S = HIS.svc;

CL.DEFAULT_CFG = () => ({ id: 'CFG', clinic_name: '康健家庭醫學科診所', biz_date: HIS.today(), point_value: 0.95, reg_fee: 100, copay_visit: 50, self_exam: 400,
  exam_tiers: [[30, 350], [50, 300], [75, 250], [9999, 200]], disp_tiers: [[7, 48], [14, 53], [28, 60], [9999, 64]],
  drug_copay: [[100, 0], [200, 20], [300, 40], [400, 60], [500, 80], [600, 100], [700, 120], [800, 140], [900, 160], [1000, 180]],
  auto_arrive: true, arrive_sec: 25 });

const rng = seed => CL.rng(String(seed));

CL.seedStatic = () => {
  const ins = (t, r) => DB.insert(t, r);
  [['R-owner', '院長（負責醫師）', ['*']],
    ['R-doctor', '醫師', ['patient', 'cl_doctor', 'cl_tpl', 'cl_arrive', 'cl_claim']],
    ['R-nurse', '護理師', ['patient', 'cl_triage', 'cl_arrive']],
    ['R-counter', '櫃台／批價', ['patient', 'cl_reg', 'cl_bill', 'cl_claim', 'cl_arrive']],
    ['R-pharm', '藥師', ['patient', 'cl_disp']]].forEach(([id, name, perms]) => ins('roles', { id, name, perms }));
  ins('departments', { id: 'DEP-FM', name: '家庭醫學科', kind: '臨床' }); ins('departments', { id: 'DEP-ADM', name: '行政', kind: '行政' });
  const U = (emp, name, role, title, extra) => ins('users', Object.assign({ id: 'U-' + emp, emp_no: emp, name, role_id: role, dept_id: role === 'R-counter' ? 'DEP-ADM' : 'DEP-FM', title, pw: HIS.hash('1234'), active: true }, extra || {}));
  U('C001', '林仁和', 'R-owner', '院長／家醫科專科醫師'); U('C002', '陳怡君', 'R-doctor', '家醫科醫師'); U('C003', '張雅婷', 'R-nurse', '護理師');
  U('C004', '王淑芬', 'R-counter', '櫃台／批價'); U('C005', '許志豪', 'R-pharm', '藥師');
  CL.ICD.forEach(x => ins('icd10', Object.assign({}, x)));
  CL.DRUGS.forEach(x => ins('medications', Object.assign({}, x)));
  CL.SERVICES.forEach(x => ins('cl_services', Object.assign({}, x)));
  CL.TEMPLATES.forEach(x => ins('templates', JSON.parse(JSON.stringify(x))));
  ins('cl_settings', CL.DEFAULT_CFG());
};

CL.seedPatients = n => {
  const r = rng('clinic-patients'); let made = 0;
  while (made < n) {
    const age = 20 + Math.floor(Math.pow(r(), 0.8) * 66), chr = [];
    const old = age >= 50, x = r();
    if (old ? x < 0.5 : x < 0.1) chr.push('HTN'); if (old ? r() < 0.28 : r() < 0.04) chr.push('DM2'); if (old ? r() < 0.3 : r() < 0.05) chr.push('HLD'); if (r() < 0.05 && age > 30) chr.push('GOUT'); if (r() < 0.04) chr.push('THY');
    const np = CL.newPerson(r, age, null, chr); if (r() < 0.06) np.exempt = r() < 0.5 ? '低收入戶' : '重大傷病'; CL.insertPatient(np); made++;
  }
};

/* ---- 回放一筆完整就診（走正式服務）---- */
const parseRx = (t, pt) => t.rx.map(s => { const [ing, dose, freq, days] = s.split('|'), m = CL.drugBy(ing); return m && !HIS.checkAllergy(pt.id, m).length ? { code: m.code, dose: parseFloat(dose) || m.def.dose, freq: freq || m.def.freq, days: parseInt(days) || m.def.days } : null; }).filter(Boolean);
CL.replayVisit = (doc, r, date, k, o) => {
  o = o || {}; const a = S.clArrive(1, o.caseKey ? { caseKey: o.caseKey } : {})[0], c = CL.caseOf(a.case_key);
  DB.update('appointments', a.id, { card_state: o.self ? '自費' : '正常', date });
  const reg = S.clRegister(a.id, { doctor_id: doc.id, mode: o.self ? '自費' : '讀卡' }); S.clMeasure(a.id);
  const ap = DB.get('appointments', a.id), pt = HIS.pt(ap.patient_id), t = DB.one('templates', x => x.key === c.tpl) || DB.one('templates', x => x.key === 'GEN_ACUTE');
  const vit = DB.one('vital_signs', v => v.appt_id === a.id), f = CL.applyTpl(t, { name: pt.name, age: HIS.age(pt.birth), sex: pt.sex === 'M' ? '男' : '女', vitals: vit });
  CL.REC_FIELDS.forEach(key => { f[key] = CL.autofill(f[key], r); });
  if (r() < 0.08) Object.assign(f, { hpi: '上呼吸道症狀數天，求診。', ros: '', pmh: '', pe: '', edu: '', followup: '' });
  let dx = [c.icd[0]].concat((t.dx || []).filter(x => x !== c.icd[0])).slice(0, 3).map((x, i) => ({ icd: x, type: i ? '次要' : '主要' }));
  const when = date + ` ${String(9 + Math.floor(k / 3)).padStart(2, '0')}:${String((k % 3) * 20 + Math.floor(r() * 15)).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}`;
  const p = { record: f, dx, drugs: parseRx(t, pt), services: (t.sv || []).filter(s => DB.one('cl_services', x => x.code === s)).map(code => ({ code, qty: 1 })), ignoreBlank: true, tpl_used: t.name };
  const res = S.clCompleteVisit(a.id, p, { seed: true, doctor: doc, when, start: when });
  const enc = res.encounter; S.clPay(enc.id, { received: res.charge.cash_due, method: '現金' }); if (enc.disp_status === '待領藥') S.clDispense(enc.id); return enc;
};

CL.seed = function (opt) {
  opt = opt || {}; const days = opt.days == null ? 62 : opt.days;
  DB.reset(); DB.quiet(() => {
    CL.seedStatic(); CL.seedPatients(opt.patients || 80);
    const owner = DB.get('users', 'U-C001'), doc2 = DB.get('users', 'U-C002'), docs = [owner, doc2], keep = HIS.session;
    HIS.session = { user: owner, ws: 'SEED' };
    DB.all('medications').forEach((m, i) => { DB.insert('inventory', { med_code: m.code, lot_no: 'L' + String(2600 + i), expiry: HIS.addDays(HIS.today(), 300 + (i % 9) * 20), qty: 4000, cost: m.cost, location: '藥櫃', received_at: HIS.addDays(HIS.today(), -days - 3) + ' 08:00:00' }); });
    const R = rng('clinic-history'), t0 = HIS.addDays(HIS.today(), -days);
    // 申報起點：兩個月前整月；回放從該月 1 日開始
    const d0 = new Date(HIS.today() + 'T12:00:00'); d0.setMonth(d0.getMonth() - 2, 1); const start = HIS.fmt(d0).slice(0, 10), mon = new Date(start + 'T12:00:00'); mon.setMonth(mon.getMonth() + 1, 3);
    const claimDay = HIS.fmt(mon).slice(0, 10), per = start.slice(0, 4) + start.slice(5, 7); let claimed = false;
    DB.update('cl_settings', 'CFG', { biz_date: start });
    let guard = 0; while (CL.today() < HIS.today() && guard++ < 200) {
      const d = CL.today(), wd = new Date(d + 'T12:00:00').getDay();
      if (!claimed && d >= claimDay) { claimed = true; try { const c = S.clClaimCreate(per); S.clClaimRecheck(c.id); S.clClaimSubmit(c.id); } catch (e) { /* 無可申報就略過 */ } }
      if (wd === 0) { DB.update('cl_settings', 'CFG', { biz_date: HIS.addDays(d, 1) }); CL.rollLabs(); continue; }
      const n = 3 + Math.floor(R() * 5) + (wd === 1 ? 2 : 0);
      for (let k = 0; k < n; k++) { try { CL.replayVisit(docs[R() < 0.62 ? 0 : 1], R, d, k, { self: R() < 0.05 }); } catch (e) { console.error('seed visit failed', d, e.message); DB.where('appointments', x => x.date === d && ['櫃台等候', '候診中'].includes(x.status)).forEach(x => DB.update('appointments', x.id, { status: '取消', cancel_reason: '種子略過' })); } }
      S.clCloseDay();
    }
    // 今日：留 3 位病人在櫃台
    S.clArrive(3); HIS.session = keep;
    DB.insert('inventory', { med_code: CL.drugBy('Amoxicillin').code, lot_no: 'L-EXP', expiry: HIS.addDays(HIS.today(), -20), qty: 120, cost: 0.5, location: '藥櫃', received_at: HIS.addDays(HIS.today(), -400) + ' 08:00:00' });
    DB.all('audit_logs').length = 0; // 歷史回放的操作紀錄不保留（節省瀏覽器儲存空間）
    DB.insert('audit_logs', { at: HIS.now(), user_id: null, emp_no: 'SYSTEM', user_name: '系統', role: '-', ws: '-', action: 'SEED', table_name: '*', record_id: '', patient_id: '', detail: '診所版初始化虛構資料（回放約兩個月營業）' });
  });
};
CL.ensureSeed = () => { if (!DB.hasData()) CL.seed(); };
})(typeof globalThis !== 'undefined' ? globalThis : window);
