/* 診所版核心服務：來客、掛號讀卡、病例引擎、完診(一次寫入)、批價、領藥、外送檢驗、日結、健保申報(檢核/模擬審查/申復)。
 * 所有健保規則為教學用簡化模擬，非真實健保署規範。 */
(function (G) {
'use strict';
const HIS = G.HIS, DB = HIS.DB, CL = HIS.CL, S = HIS.svc;
const err = m => { throw new Error(m); };
const me = () => (HIS.session && HIS.session.user) || err('尚未登入');
const need = p => { if (!HIS.can(p)) err('權限不足（需要權限：' + p + '）'); };
const P2 = n => String(n).padStart(2, '0');
const daysBetween = (a, b) => Math.round((new Date(b.slice(0, 10) + 'T12:00:00') - new Date(a.slice(0, 10) + 'T12:00:00')) / 864e5);
CL.daysBetween = daysBetween;
CL.REC_FIELDS = ['cc', 'hpi', 'ros', 'pmh', 'fh', 'sh', 'pe', 'exam', 'assessment', 'plan', 'edu', 'followup'];
CL.FIELD_LABEL = { cc: '主訴 CC', hpi: '現病史 HPI', ros: '系統回顧 ROS', pmh: '過去病史/過敏/用藥', fh: '家族史', sh: '社會史/TOCC', pe: '理學檢查 PE', exam: '檢查結果', assessment: '評估 Assessment', plan: '治療計畫 Plan', edu: '衛教', followup: '回診/追蹤' };
CL.CHR_NAME = { HTN: '高血壓', DM2: '第2型糖尿病', HLD: '高血脂', GOUT: '痛風', THY: '甲狀腺功能低下' };
CL.CHR_DRUG = { HTN: 'Amlodipine', DM2: 'Metformin', HLD: 'Atorvastatin', GOUT: 'Allopurinol', THY: 'Levothyroxine' };
const FREQN = { QD: 1, BID: 2, TID: 3, QID: 4, QHS: 1, Q4H: 6, Q6H: 4, Q8H: 3, Q12H: 2, STAT: 1, PRN: 3, HS: 1 };
CL.FREQ = Object.keys(FREQN);

/* ---------- 設定 / 營業日 ---------- */
CL.cfg = () => DB.get('cl_settings', 'CFG') || DB.all('cl_settings')[0] || {};
CL.today = () => CL.cfg().biz_date || HIS.today();
CL.now = () => CL.today() + ' ' + HIS.now().slice(11);
CL.at = (date, h, m) => date + ' ' + P2(h) + ':' + P2(m) + ':' + P2(Math.floor(Math.random() * 60));
CL.session = () => { const h = parseInt(HIS.now().slice(11, 13)); return h < 12 ? '上午' : h < 18 ? '下午' : '晚上'; };

/* ---------- 亂數（以種子可重現）---------- */
CL.hash = s => { let h = 2166136261 >>> 0; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
CL.rng = seed => { let a = CL.hash(seed); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const rnd = (r, a, b) => a + (b - a) * r();

/* ---------- 病例引擎：病人「說出口」的資料與隱藏真相 ---------- */
CL.genVitals = ap => {
  const c = CL.caseOf(ap.case_key), pt = ap.patient_id ? HIS.pt(ap.patient_id) : null, r = CL.rng(ap.seed + 'vit'), v = c.vit, htn = pt && (pt.chronic || []).includes('HTN');
  return { temp: +rnd(r, v.temp[0], v.temp[1]).toFixed(1), hr: Math.round(rnd(r, v.hr[0], v.hr[1])), bp_sys: Math.round(v.bp[0] + rnd(r, -6, 10) + (htn && c.k !== 'HTN' ? 8 : 0)), bp_dia: Math.round(v.bp[1] + rnd(r, -4, 6)), spo2: Math.round(rnd(r, v.spo2[0], v.spo2[1])), rr: Math.round(rnd(r, 14, 19) + (v.temp[1] > 38 ? 3 : 0) + (c.k === 'CP' ? 4 : 0)), weight: pt ? pt.weight : null, height: pt ? pt.height : null, pain: null };
};
const NR = { POC_GLU: [70, 125], CRP_POC: [0, 1], GLU_F: [70, 110], HBA1C: [4, 6], URIC: [3.5, 7.2], TSH: [0.35, 4.94] };
CL.testResult = (ap, code) => {
  const c = CL.caseOf(ap.case_key) || { res: {} }, sv = DB.one('cl_services', { code }), r = CL.rng(ap.seed + code), spec = c.res && c.res[code]; let val;
  if (spec !== undefined) val = Array.isArray(spec) ? (+rnd(r, spec[0], spec[1]).toFixed(spec[2])) + (spec[3] || '') : spec;
  else { const m = /^\[([\d.]+),([\d.]+),(\d)\](.*)$/.exec(sv.normal); val = m ? (+rnd(r, +m[1], +m[2]).toFixed(+m[3])) + m[4] : sv.normal.replace('{hr}', Math.round(rnd(r, 62, 84))); }
  let abn = false; const num = parseFloat(val);
  if (NR[code] && !isNaN(num)) abn = num < NR[code][0] || num > NR[code][1]; else if (/陽性|\(\+\)|\(2\+\)|E\. coli|ST 段/.test(val)) abn = true;
  if (code === 'LIPID') { const m = /LDL (\d+)/.exec(val); if (m && +m[1] >= 130) abn = true; }
  return { value: String(val), abnormal: abn };
};
CL.PE_SYS = ['一般外觀', '頭頸/咽喉', '耳鼻', '胸部聽診', '心臟', '腹部', '四肢/肌肉骨骼', '神經', '皮膚'];
CL.PE_DEFAULT = { '一般外觀': '意識清楚，無急性病容。', '頭頸/咽喉': '咽喉無明顯充血，頸部無腫塊，淋巴結無腫大。', '耳鼻': '耳膜及鼻黏膜無明顯異常。', '胸部聽診': '雙側呼吸音清晰，無囉音或哮鳴音。', '心臟': '心音規則，無雜音。', '腹部': '腹部柔軟，無壓痛，無反彈痛，腸音正常。', '四肢/肌肉骨骼': '四肢無水腫，關節活動正常。', '神經': '意識清楚，腦神經及肌力感覺無明顯異常。', '皮膚': '皮膚無明顯皮疹或病灶。' };
CL.peFinding = (ap, sys) => { const c = CL.caseOf(ap.case_key); return (c.pe && c.pe[sys]) || CL.PE_DEFAULT[sys]; };
CL.GENERIC_Q = [['有藥物過敏嗎？', 'allergy'], ['有哪些慢性病？平常有在吃什麼藥？', 'chronic'], ['有抽菸、喝酒、嚼檳榔嗎？', 'social'], ['最近有出國或接觸確診者嗎？', 'tocc']];
CL.questions = ap => CL.caseOf(ap.case_key).qa.map((q, i) => ({ i, q: q[0] })).concat(CL.GENERIC_Q.map((q, i) => ({ i: 100 + i, q: q[0] })));
CL.allergyText = pid => { const a = pid ? HIS.allergies(pid) : []; return a.length ? '我對' + a.map(x => x.allergen + '過敏（' + x.reaction + '）').join('、') + '。' : '沒有藥物過敏。'; };
CL.chronicText = pid => { const p = pid ? HIS.pt(pid) : null, ch = (p && p.chronic) || []; return ch.length ? '我有' + ch.map(k => CL.CHR_NAME[k]).join('、') + '，平常在吃' + ch.map(k => { const d = CL.drugBy(CL.CHR_DRUG[k]); return d ? d.name_zh : ''; }).join('、') + '。' : '沒有慢性病，平常沒有固定吃藥。'; };
CL.answer = (ap, i) => {
  const p = ap.patient_id ? HIS.pt(ap.patient_id) : (ap.new_patient || {}), c = CL.caseOf(ap.case_key);
  let a = i >= 100 ? CL.GENERIC_Q[i - 100][1] : c.qa[i][1];
  if (a === 'allergy') return CL.allergyText(ap.patient_id) .replace(/^沒有藥物過敏。$/, '沒有，沒有藥物過敏。');
  if (a === 'chronic') return CL.chronicText(ap.patient_id);
  if (a === 'social') return (p.social || '不抽菸、偶爾喝一點酒、不嚼檳榔。');
  if (a === 'tocc') return /URI|FLU|PHAR|BRON/.test(c.k) ? '最近沒有出國，但家人或同事有人也在咳嗽。' : '最近沒有出國，也沒有接觸確診者。';
  return a.replace(/請看病歷上的過敏記載。?/, CL.allergyText(ap.patient_id)).replace(/請看社會史記載。?/, p.social || '不抽菸，偶爾喝酒。').replace(/請看病歷慢性病史記載。?/, CL.chronicText(ap.patient_id));
};

/* ---------- 病人產生（虛構）---------- */
const SUR = '陳林黃張李王吳劉蔡楊許鄭謝郭洪曾邱廖賴周葉蘇莊呂江何蕭羅高潘簡朱鍾彭游詹胡施沈余趙盧梁顏柯孫魏翁戴范宋方鄧杜傅侯曹薛丁卓阮馬董温唐藍石蔣古紀姚連馮歐程湯田康姜白汪鄒尤巫黎涂龔嚴韓袁金童陸夏柳邵'.split('');
const GM = '志明,建宏,家豪,俊傑,冠宇,宗翰,承恩,柏翰,宇軒,彥廷,正雄,文彬,國樑,明德,金龍,清木,添財,健智,偉誠,嘉豪'.split(','), GF = '淑芬,美玲,雅婷,怡君,佩珊,宜庭,雅惠,淑惠,秀英,麗華,美鳳,玉蘭,惠美,靜怡,雅雯,怡萱,欣怡,詩涵,佳穎,秋香'.split(',');
const SOC = ['不抽菸、不喝酒、不嚼檳榔。', '已戒菸三年，偶爾社交飲酒。', '每天約半包菸，週末喝啤酒，不嚼檳榔。', '不抽菸，偶爾喝一點紅酒。', '不抽菸、不喝酒，退休在家。'];
const CITY = ['台北市大安區', '新北市板橋區', '桃園市中壢區', '台中市西屯區', '台南市東區', '高雄市前鎮區', '新竹市東區'];
CL.newPerson = (r, age, sex, chronic) => {
  const pick = a => a[Math.floor(r() * a.length)]; sex = sex || (r() < 0.5 ? 'M' : 'F');
  const by = parseInt(CL.today().slice(0, 4)) - age - (r() < 0.5 ? 0 : 1), birth = `${by}-${P2(1 + Math.floor(r() * 12))}-${P2(1 + Math.floor(r() * 28))}`;
  const h = sex === 'M' ? 163 + Math.floor(r() * 20) : 150 + Math.floor(r() * 17), w = Math.round((sex === 'M' ? 22 : 21) * Math.pow(h / 100, 2) * (0.85 + r() * 0.5));
  let idno; do { idno = String.fromCharCode(65 + Math.floor(r() * 26)) + (sex === 'M' ? '1' : '2') + String(10000000 + Math.floor(r() * 89999999)); } while (DB.one('patients', p => p.id_no === idno));
  const al = r() < 0.18 ? [pick([['盤尼西林', 'penicillin', '皮疹', '中度'], ['磺胺類藥物', 'sulfa', '全身紅疹', '中度'], ['阿斯匹靈/NSAID', 'nsaid', '氣喘發作', '中度'], ['頭孢菌素', 'cephalosporin', '蕁麻疹', '中度'], ['海鮮（蝦蟹）', '', '蕁麻疹', '輕度']])] : [];
  return { name: pick(SUR) + (sex === 'M' ? pick(GM) : pick(GF)), sex, birth, id_no: idno, phone: '09' + (10000000 + Math.floor(r() * 89999999)), address: pick(CITY) + pick(['中正路', '民生路', '和平路', '中山路', '成功路']) + (1 + Math.floor(r() * 300)) + '號', height: h, weight: w, blood: pick(['A型 Rh+', 'B型 Rh+', 'O型 Rh+', 'AB型 Rh+']), social: pick(SOC), chronic: chronic || [], allergies: al, exempt: '' };
};
CL.insertPatient = np => {
  const n = DB.all('patients').reduce((m, p) => Math.max(m, parseInt(p.chart_no) || 0), 0) + 1;
  const { allergies, ...row } = np; const p = DB.insert('patients', Object.assign({ chart_no: String(n).padStart(8, '0'), created_at: CL.now(), ins_type: '健保', notes: '', emergency_name: '', emergency_rel: '', emergency_phone: '' }, row));
  (allergies || []).forEach(a => DB.insert('allergies', { patient_id: p.id, allergen: a[0], allergen_class: a[1], reaction: a[2], severity: a[3], recorded_at: CL.now(), recorded_by: HIS.session ? HIS.session.user.id : 'SYSTEM' }));
  (p.chronic || []).forEach(k => DB.insert('medical_histories', { patient_id: p.id, kind: '慢性病', text: CL.CHR_NAME[k], since: String(parseInt(CL.today().slice(0, 4)) - 2 - Math.floor(Math.random() * 8)), recorded_at: CL.now(), recorded_by: 'SYSTEM' }));
  return p;
};

/* ---------- 來客（病人上門，自動生成主訴）---------- */
const eligible = (c, p) => { const a = HIS.ageN(p.birth), ar = c.age || [16, 95]; return a >= ar[0] && a <= ar[1] && (!c.sex || c.sex === p.sex) && (!c.chr || (p.chronic || []).includes(c.chr)); };
S.clArrive = (count, o) => {
  need('cl_arrive'); o = o || {}; const out = [];
  for (let i = 0; i < (count || 1); i++) {
    const seed = Math.random().toString(36).slice(2, 10), r = CL.rng(seed);
    let c = o.caseKey ? CL.caseOf(o.caseKey) : null;
    if (!c) { const tot = CL.CASES.reduce((s, x) => s + x.w, 0); let t = r() * tot; c = CL.CASES.find(x => (t -= x.w) < 0) || CL.CASES[0]; }
    let pool = DB.all('patients').filter(p => eligible(c, p) && !DB.one('appointments', a => a.patient_id === p.id && a.date === CL.today() && ['櫃台等候', '候診中'].includes(a.status)));
    let pid = null, np = null;
    if (pool.length && (c.chr || r() < 0.78)) pid = pool[Math.floor(r() * pool.length)].id;
    else { const ar = c.age || [16, 88]; np = CL.newPerson(r, Math.round(ar[0] + r() * (Math.min(ar[1], 88) - ar[0])), c.sex, c.chr ? [c.chr] : []); }
    const cs = r(), card = c.self ? '自費' : cs < 0.88 ? '正常' : cs < 0.94 ? '忘帶卡' : cs < 0.98 ? '欠費' : '過期';
    const a = DB.insert('appointments', { patient_id: pid, new_patient: np, case_key: c.k, speech: c.sp[Math.floor(r() * c.sp.length)], seed, card_state: card, date: CL.today(), session: CL.session(), status: '櫃台等候', arrived_at: CL.now(), doctor_id: null, dept_id: 'DEP-FM' });
    out.push(a);
  }
  return out;
};
S.clAutoArrive = () => { need('cl_arrive'); const c = CL.cfg(), now = Date.now(); if (!c.auto_arrive) return null; if (c.last_arrive && now - c.last_arrive < (c.arrive_sec || 25) * 900) return null;
  if (DB.where('appointments', a => a.date === CL.today() && ['櫃台等候', '候診中'].includes(a.status)).length >= (c.max_wait || 6)) return null;
  return DB.tx(() => { DB.update('cl_settings', 'CFG', { last_arrive: now }); return S.clArrive(1)[0]; }); };
S.clCancelAppt = (id, reason) => {
  need('cl_reg'); const a = DB.get('appointments', id); if (!['櫃台等候', '候診中'].includes(a.status)) err('此狀態無法取消'); if (!(reason || '').trim()) err('請填寫取消原因（如：病人離開、過號）');
  DB.update('appointments', id, { status: '取消', cancel_reason: reason }); HIS.audit('CANCEL', 'appointments', id, reason, a.patient_id);
};

/* ---------- 掛號 / 讀卡 ---------- */
CL.CARD_MODES = { '正常': ['讀卡'], '忘帶卡': ['補卡', '自費'], '欠費': ['欠費補繳', '自費'], '過期': ['補卡', '自費'], '自費': ['自費'] };
S.clRegister = (apptId, o) => {
  need('cl_reg'); const a = DB.get('appointments', apptId); if (!a || a.status !== '櫃台等候') err('此來客不在櫃台等候狀態');
  const doc = DB.get('users', o.doctor_id); if (!doc || !DB.get('roles', doc.role_id).perms.some(p => p === 'cl_doctor' || p === '*')) err('請選擇看診醫師');
  const mode = o.mode; if (!(CL.CARD_MODES[a.card_state] || []).includes(mode)) err(`健保卡狀態為「${a.card_state}」，可選擇：${(CL.CARD_MODES[a.card_state] || []).join('、')}`);
  return DB.tx(() => {
    let pid = a.patient_id;
    if (!pid) { const np = a.new_patient; if (DB.one('patients', p => p.id_no === np.id_no)) err('身分證字號已存在'); pid = CL.insertPatient(np).id; }
    const pt = HIS.pt(pid), ins = mode === '自費' ? '自費' : '健保', day = CL.today(), ses = a.session;
    const q = DB.where('appointments', x => x.doctor_id === doc.id && x.date === day && x.session === ses && x.queue_no).length + 1;
    let seq = null; if (mode === '讀卡' || mode === '欠費補繳') { const n = (pt.card_seq || 0) + 1; DB.update('patients', pid, { card_seq: n }); seq = String(n).padStart(4, '0'); }
    const prior = DB.where('encounters', e => e.patient_id === pid && e.status === '完診' && daysBetween(e.date, day) <= 180).length;
    DB.update('appointments', apptId, { patient_id: pid, new_patient: null, doctor_id: doc.id, queue_no: q, status: '候診中', ins, ic_seq: seq, card_mode: mode, makeup_due: mode === '補卡' ? HIS.addDays(day, 7) : null, visit_type: prior ? '複診' : '初診', reg_fee: CL.cfg().reg_fee, registered_at: CL.now(), registered_by: me().id });
    HIS.audit('REGISTER', 'appointments', apptId, `${mode} ${ins} ${doc.name} ${q}號`, pid); return DB.get('appointments', apptId);
  });
};
S.clMakeupCard = encId => { need('cl_reg'); const e = DB.get('encounters', encId); if (!e || e.ic_seq) err('此就診不需補卡'); const ap = DB.get('appointments', e.appt_id); if (ap.makeup_due && CL.today() > ap.makeup_due) err('已逾補卡期限（就診後 7 日內）'); const pt = HIS.pt(e.patient_id), n = (pt.card_seq || 0) + 1; DB.update('patients', pt.id, { card_seq: n }); const seq = String(n).padStart(4, '0'); DB.update('encounters', encId, { ic_seq: seq, makeup_done: CL.now() }); DB.update('appointments', ap.id, { ic_seq: seq }); HIS.audit('UPDATE', 'encounters', encId, '補卡完成 ' + seq, pt.id); return seq; };

/* ---------- 護理量測 ---------- */
S.clVitals = (apptId, v) => {
  need('cl_triage'); const a = DB.get('appointments', apptId); if (!a || a.status !== '候診中') err('病人不在候診中');
  const num = k => (v[k] === '' || v[k] == null ? null : Number(v[k])); const row = { patient_id: a.patient_id, appt_id: apptId, encounter_id: null, at: CL.now(), bp_sys: num('bp_sys'), bp_dia: num('bp_dia'), hr: num('hr'), rr: num('rr'), temp: num('temp'), spo2: num('spo2'), weight: num('weight'), height: num('height'), pain: num('pain'), recorded_by: me().id };
  if ([row.bp_sys, row.bp_dia, row.hr, row.temp, row.spo2].every(x => x == null)) err('請至少輸入一項生命徵象');
  if (row.bp_sys && row.bp_dia && row.bp_sys <= row.bp_dia) err('收縮壓必須大於舒張壓'); if (row.temp != null && (row.temp < 30 || row.temp > 43)) err('體溫數值超出合理範圍'); if (row.spo2 != null && (row.spo2 < 40 || row.spo2 > 100)) err('SpO2 數值超出合理範圍');
  const old = DB.one('vital_signs', x => x.appt_id === apptId); if (old) DB.update('vital_signs', old.id, row); else DB.insert('vital_signs', row);
  DB.update('appointments', apptId, { vitals_done: true }); HIS.audit('CREATE', 'vital_signs', apptId, '診前量測', a.patient_id);
};
S.clMeasure = apptId => { const a = DB.get('appointments', apptId); S.clVitals(apptId, CL.genVitals(a)); };

/* ---------- 計價 ---------- */
CL.drugCopay = pt => { for (const [lim, amt] of CL.cfg().drug_copay) if (pt <= lim) return amt; return 200; };
CL.calc = (v) => { // v: {ins, exempt, doctorIdx, items:[{kind,points,qty,amount_pt,self,self_amt,days}]}
  const cfg = CL.cfg(), nh = v.items.filter(i => !i.self), selfAmt = v.items.filter(i => i.self).reduce((s, i) => s + i.self_amt, 0);
  if (v.ins === '自費') return { exam_pt: 0, drug_pt: 0, disp_pt: 0, svc_pt: 0, total_pt: 0, copay_visit: 0, copay_drug: 0, copay: 0, reg_fee: cfg.reg_fee, self_exam: cfg.self_exam, self_amount: selfAmt + cfg.self_exam, cash_due: cfg.reg_fee + cfg.self_exam + selfAmt, claim_pt: 0 };
  const tier = cfg.exam_tiers.find(t => v.doctorIdx <= t[0]) || cfg.exam_tiers[cfg.exam_tiers.length - 1], exam = tier[1];
  const drugs = nh.filter(i => i.kind === 'drug'), drug_pt = drugs.reduce((s, i) => s + i.amount_pt, 0), maxd = drugs.reduce((m, i) => Math.max(m, i.days || 0), 0);
  const disp = drugs.length ? (cfg.disp_tiers.find(t => maxd <= t[0]) || cfg.disp_tiers[cfg.disp_tiers.length - 1])[1] : 0, svc = nh.filter(i => i.kind === 'svc').reduce((s, i) => s + i.amount_pt, 0);
  const total = exam + drug_pt + disp + svc, cv = v.exempt ? 0 : cfg.copay_visit, cd = v.exempt ? 0 : CL.drugCopay(drug_pt);
  return { exam_pt: exam, drug_pt, disp_pt: disp, svc_pt: svc, total_pt: total, copay_visit: cv, copay_drug: cd, copay: cv + cd, reg_fee: cfg.reg_fee, self_exam: 0, self_amount: selfAmt, cash_due: cv + cd + cfg.reg_fee + selfAmt, claim_pt: total - cv - cd };
};
CL.qty = (med, dose, freq, days) => med.fixed_qty ? 1 : Math.max(1, Math.ceil(dose * (FREQN[freq] || 1) * (freq === 'STAT' ? 1 : days)));
CL.buildItems = (ap, p, ins) => { // 由工作台草稿建立計價項目（含檢驗結果）
  const out = [];
  (p.drugs || []).forEach(d => { const m = DB.one('medications', x => x.code === d.code); if (!m) err('藥品不存在：' + d.code); const dose = Number(d.dose), days = parseInt(d.days) || 1;
    if (!(dose > 0)) err(`${m.name_zh}：單次劑量必須大於 0`); if (!FREQN[d.freq]) err(`${m.name_zh}：請選擇頻率`); if (days > m.max_days) err(`${m.name_zh}：給藥天數 ${days} 超過上限 ${m.max_days} 天${m.chronic ? '' : '（急性用藥）'}`);
    const qty = CL.qty(m, dose, d.freq, days), self = ins === '自費' || !!d.self; out.push({ kind: 'drug', code: m.code, name: m.name_zh + ' ' + m.spec, ingredient: m.ingredient, qty, unit: m.unit, dose, freq: d.freq, days, route: d.route || m.route, note: d.note || '', allergy_override: (d.allergy_override || '').trim(), unit_pt: m.price, amount_pt: self ? 0 : Math.round(m.price * qty), self, self_amt: self ? m.self_price * qty : 0, cost: +(m.cost * qty).toFixed(2), disp_status: '待領藥', med: m }); });
  (p.services || []).forEach(s => { const sv = DB.one('cl_services', x => x.code === s.code); if (!sv) err('項目不存在：' + s.code); const qty = parseInt(s.qty) || 1, self = ins === '自費' || !!s.self || !sv.nhi; const res = ['院內檢驗', '外送檢驗', '檢查', '自費檢驗'].includes(sv.type) ? CL.testResult(ap, sv.code) : { value: sv.normal, abnormal: false };
    out.push({ kind: 'svc', code: sv.code, name: sv.name, type: sv.type, qty, unit_pt: sv.points, amount_pt: self ? 0 : sv.points * qty, self, self_amt: self ? sv.self_price * qty : 0, cost: sv.cost * qty, result: res.value, abnormal: res.abnormal, result_status: sv.type === '外送檢驗' ? '待回報' : '已完成', ext_days: sv.ext_days, sv }); });
  return out;
};
CL.doctorIdx = (docId, date) => DB.where('encounters', e => e.doctor_id === docId && e.date === date && e.status === '完診').length + 1;

/* ---------- 健保規則（草稿即時提示 與 申報前檢核 共用）---------- */
CL.docScore = r => { const L = k => (r[k] || '').replace(/\s/g, '').length; return (L('hpi') >= 20 ? 20 : 0) + (L('pe') >= 12 ? 20 : 0) + (L('ros') >= 10 ? 10 : 0) + (L('pmh') >= 8 ? 10 : 0) + (L('assessment') >= 8 ? 15 : 0) + (L('plan') >= 10 ? 15 : 0) + (L('edu') >= 8 ? 5 : 0) + (L('followup') >= 4 ? 5 : 0); };
CL.rules = v => {
  const out = [], add = (code, level, msg, cut) => out.push({ code, level, msg, cut }), dxs = v.dx.map(d => d.icd), has = pre => dxs.some(c => pre.some(p => c.startsWith(p)));
  if (!v.dx.some(d => d.type === '主要')) add('R01', 'E', '缺少主要診斷');
  if (v.ins === '健保' && !v.ic_seq) add('R02', 'E', '尚未完成健保卡讀取/補卡（無就醫序號），不得申報');
  v.drugs.filter(d => !d.self).forEach(d => { const m = d.med;
    if (m.antibiotic && !has(CL.INF)) add('R03', 'W', `使用抗生素「${m.name_zh}」，但診斷（${dxs.join('、')}）不屬感染性診斷，易遭審查核減`, { type: 'drug', code: m.code, p: 0.9 });
    if (m.need.length && !has(m.need)) add('R04', 'W', `「${m.name_zh}」之適應症需診斷 ${m.need.join('/')}，目前診斷不符`, { type: 'drug', code: m.code, p: 0.8 });
    if (m.chronic && d.days > 14 && !has(CL.CHRONIC)) add('R05', 'W', `「${m.name_zh}」開立 ${d.days} 天慢性病連續處方，但診斷無慢性病`, { type: 'drug', code: m.code, p: 0.9 }); });
  v.svcs.filter(s => !s.self && s.sv.nhi).forEach(s => { const sv = s.sv;
    if (sv.need.length && !has(sv.need)) add('R06', 'W', `「${sv.name}」需診斷 ${sv.need.join('/')}，目前診斷不符`, { type: 'svc', code: sv.code, p: 0.9 });
    if (sv.freq_days) { const pr = DB.where('cl_items', it => it.patient_id === v.patient_id && it.kind === 'svc' && it.code === sv.code && !it.self && it.encounter_id !== v.encId && it.date <= v.date && daysBetween(it.date, v.date) < sv.freq_days)[0]; if (pr) add('R06', 'W', `「${sv.name}」${sv.freq_days} 日內不得重複申報（前次 ${pr.date}）`, { type: 'svc', code: sv.code, p: 0.9 }); } });
  const pd = v.dx.find(d => d.type === '主要');
  if (pd && v.ins === '健保') { const pr = DB.where('encounters', e => e.patient_id === v.patient_id && e.id !== v.encId && e.status === '完診' && e.ins === '健保' && daysBetween(e.date, v.date) >= 0 && daysBetween(e.date, v.date) <= 7 && (e.primary_icd || '').slice(0, 3) === pd.icd.slice(0, 3) && !CL.CHRONIC.some(c => pd.icd.startsWith(c)))[0]; if (pr) add('R07', 'W', `7 日內同病因重複就診（前次 ${pr.date}，${pr.primary_icd}），診察費可能遭核減`, { type: 'exam', p: 0.5 }); }
  const sc = CL.docScore(v.rec || {}); if (sc < 60 && v.ins === '健保') add('R08', 'W', `病歷記載完整度 ${sc} 分（<60）：S/O/A/P 記載不足，審查易核減診察費`, { type: 'exam', half: true, p: 0.6 });
  return out;
};
CL.viewOfEnc = enc => { const rec = HIS.encRecord(enc.id) || {}; return { encId: enc.id, patient_id: enc.patient_id, date: enc.date, ins: enc.ins, ic_seq: enc.ic_seq, rec, dx: DB.where('diagnoses', d => d.encounter_id === enc.id && d.status !== '已刪除').map(d => ({ icd: d.icd_code, type: d.type })),
  drugs: DB.where('cl_items', i => i.encounter_id === enc.id && i.kind === 'drug').map(i => ({ med: DB.one('medications', m => m.code === i.code), days: i.days, self: i.self })), svcs: DB.where('cl_items', i => i.encounter_id === enc.id && i.kind === 'svc').map(i => ({ sv: DB.one('cl_services', s => s.code === i.code), self: i.self })) }; };
CL.draftAlerts = (ap, p) => { // 工作台草稿即時提示
  const items = CL.buildItemsSafe(ap, p), v = { encId: null, patient_id: ap.patient_id, date: CL.today(), ins: ap.ins, ic_seq: ap.ic_seq, rec: p.record || {}, dx: p.dx || [], drugs: items.filter(i => i.kind === 'drug').map(i => ({ med: i.med, days: i.days, self: i.self })), svcs: items.filter(i => i.kind === 'svc').map(i => ({ sv: i.sv, self: i.self })) };
  const out = CL.rules(v).filter(r => r.code !== 'R02');
  const pt = HIS.pt(ap.patient_id); items.filter(i => i.kind === 'drug').forEach(i => { HIS.checkAllergy(pt.id, i.med).forEach(a => out.push({ code: 'ALG', level: 'E', msg: a.msg + (i.allergy_override ? `（已填覆核原因：${i.allergy_override}）` : '，須填過敏覆核原因才能完診') })); });
  const dup = {}; items.filter(i => i.kind === 'drug').forEach(i => { if (dup[i.ingredient]) out.push({ code: 'DUP', level: 'E', msg: `重複用藥：${i.ingredient}` }); dup[i.ingredient] = 1; });
  return out;
};
CL.buildItemsSafe = (ap, p) => { const ok = { drugs: [], services: [] }; (p.drugs || []).forEach(d => { try { CL.buildItems(ap, { drugs: [d], services: [] }, ap.ins).forEach(i => ok.drugs.push(i)); } catch (e) { /* 草稿中的錯誤由完診時回報 */ } }); (p.services || []).forEach(s => { try { CL.buildItems(ap, { drugs: [], services: [s] }, ap.ins).forEach(i => ok.services.push(i)); } catch (e) { } }); return ok.drugs.concat(ok.services); };

/* ---------- 完診（一次寫入，不存在做到一半的診）---------- */
CL.unfilled = t => /＿|（[^（）]*\/[^（）]*）/.test(t || '');
S.clCompleteVisit = (apptId, p, ctx) => {
  ctx = ctx || {}; if (!ctx.seed) need('cl_doctor'); const ap = DB.get('appointments', apptId); if (!ap) err('掛號資料不存在');
  if (ap.status !== '候診中') err(ap.status === '已看診' ? '此病人已完診' : '病人不在候診中（狀態：' + ap.status + '）');
  const u = ctx.doctor || me(); if (!ctx.seed && ap.doctor_id !== u.id && !HIS.can('*')) err('此為其他醫師的診');
  const r = p.record || {}; if (!(r.cc || '').trim()) err('請填寫主訴(CC)'); if ((r.hpi || '').trim().length < 8) err('現病史(HPI)至少需 8 字（S 由醫師依問診自行記載）'); if (!(r.assessment || '').trim()) err('請填寫評估(Assessment)'); if (!(r.plan || '').trim()) err('請填寫治療計畫(Plan)');
  if (!p.ignoreBlank) { const bad = CL.REC_FIELDS.filter(k => CL.unfilled(r[k])); if (bad.length) err('範本尚有未填的標記（＿ 或（有/無））：' + bad.map(k => CL.FIELD_LABEL[k]).join('、') + '。請修改後再完診。'); }
  const dx = (p.dx || []).filter(d => d.icd); if (dx.filter(d => d.type === '主要').length !== 1) err('必須有且僅有 1 個主要診斷'); dx.forEach(d => { if (!DB.one('icd10', x => x.code === d.icd)) err('ICD 診斷碼不存在：' + d.icd); }); if (new Set(dx.map(d => d.icd)).size !== dx.length) err('診斷重複');
  const items = CL.buildItems(ap, p, ap.ins), pt = HIS.pt(ap.patient_id), seenIng = {};
  items.filter(i => i.kind === 'drug').forEach(i => { if (seenIng[i.ingredient]) err('重複用藥：' + i.ingredient); seenIng[i.ingredient] = 1; if (i.med.controlled && i.days > 7) err(i.med.name_zh + '為管制藥品，限 7 日內'); const al = HIS.checkAllergy(pt.id, i.med); if (al.length && !i.allergy_override) err('過敏警示：' + al.map(x => x.msg).join('；') + '。若仍要開立請填寫過敏覆核原因'); });
  if (items.some(i => i.kind === 'svc' && i.code === 'CERT') && !items.some(i => i.code === 'CERT')) err('項目錯誤');
  if ((p.refer && (p.refer.to || p.refer.reason)) && !((p.refer.to || '').trim() && (p.refer.reason || '').trim())) err('轉診須填寫轉診院所及原因');
  const when = ctx.when || CL.now(), date = when.slice(0, 10);
  return DB.tx(() => {
    const idx = CL.doctorIdx(u.id, date), enc = DB.insert('encounters', { patient_id: pt.id, type: 'CLINIC', dept_id: 'DEP-FM', doctor_id: u.id, appt_id: apptId, date, start_time: ctx.start || ap.registered_at || when, end_time: when, status: '完診', ins: ap.ins, ic_seq: ap.ic_seq || null, visit_no: idx, primary_icd: dx.find(d => d.type === '主要').icd, refer: p.refer && p.refer.to ? p.refer : null, claim_id: null, disp_status: items.some(i => i.kind === 'drug') ? '待領藥' : '無需領藥', tpl_used: p.tpl_used || '' });
    DB.where('vital_signs', v => v.appt_id === apptId).forEach(v => DB.update('vital_signs', v.id, { encounter_id: enc.id }));
    const rec = DB.insert('medical_records', Object.assign({ patient_id: pt.id, encounter_id: enc.id, type: '診所門診SOAP', status: '已簽署', version: 1, created_at: ap.registered_at || when, created_by: u.id, updated_at: when, updated_by: u.id, signed_by: u.id, signed_at: when }, Object.fromEntries(CL.REC_FIELDS.map(k => [k, (r[k] || '').trim()]))));
    DB.insert('record_versions', Object.assign({ record_id: rec.id, patient_id: pt.id, version: 1, saved_at: when, saved_by: u.id, reason: '完診簽署', status: '已簽署' }, Object.fromEntries(CL.REC_FIELDS.map(k => [k, (r[k] || '').trim()]))));
    dx.forEach(d => { const x = DB.one('icd10', c => c.code === d.icd); DB.insert('diagnoses', { patient_id: pt.id, encounter_id: enc.id, record_id: rec.id, icd_code: x.code, zh: x.zh, en: x.en, type: d.type, status: d.status || '確診', scope: '', date, doctor_id: u.id }); });
    items.forEach(i => { const { med, sv, ...row } = i; DB.insert('cl_items', Object.assign(row, { encounter_id: enc.id, patient_id: pt.id, date, doctor_id: u.id, result_due: i.result_status === '待回報' ? HIS.addDays(date, i.ext_days || 2) : null })); });
    const ch = CL.calc({ ins: ap.ins, exempt: pt.exempt, doctorIdx: idx, items }); const charge = DB.insert('cl_charges', Object.assign({ encounter_id: enc.id, patient_id: pt.id, date, ins: ap.ins, status: '待批價', created_at: when }, ch));
    DB.update('appointments', apptId, { status: '已看診', encounter_id: enc.id }); if (!ctx.seed) HIS.audit('COMPLETE_VISIT', 'encounters', enc.id, `完診 ${enc.primary_icd} 藥${items.filter(i => i.kind === 'drug').length} 項目${items.filter(i => i.kind === 'svc').length} 點數${ch.total_pt}`, pt.id);
    return { encounter: enc, charge };
  });
};

/* ---------- 批價 / 領藥 / 進貨 ---------- */
S.clPay = (encId, o) => {
  need('cl_bill'); const ch = DB.one('cl_charges', { encounter_id: encId }); if (!ch) err('找不到費用'); if (ch.status !== '待批價') err('此就診已批價'); const rec = Number(o.received);
  if (!(rec >= ch.cash_due)) err(`收款不足：應收 ${ch.cash_due} 元`); DB.update('cl_charges', ch.id, { status: '已批價', paid_at: CL.now(), paid_by: me().id, method: o.method || '現金', received: rec, change: rec - ch.cash_due });
  const e = DB.get('encounters', encId); if (e.disp_status === '無需領藥') DB.update('encounters', encId, { disp_status: '無需領藥' }); HIS.audit('PAY', 'cl_charges', ch.id, `收款 ${ch.cash_due} 元`, ch.patient_id); return DB.get('cl_charges', ch.id);
};
S.clDispense = encId => {
  need('cl_disp'); const e = DB.get('encounters', encId), ch = DB.one('cl_charges', { encounter_id: encId }); if (e.disp_status !== '待領藥') err('此就診無待領藥品或已領藥'); if (ch.status !== '已批價') err('病人尚未批價，不可領藥');
  const its = DB.where('cl_items', i => i.encounter_id === encId && i.kind === 'drug' && i.disp_status === '待領藥'), pt = HIS.pt(e.patient_id), today = CL.today();
  its.forEach(i => { const m = DB.one('medications', x => x.code === i.code); const al = HIS.checkAllergy(pt.id, m); if (al.length && !i.allergy_override) err('藥師審核：' + al[0].msg); const lots = DB.where('inventory', x => x.med_code === i.code && x.qty > 0 && x.expiry >= today); if (lots.reduce((s, l) => s + l.qty, 0) < i.qty) err(`庫存不足：${i.name} 需 ${i.qty}，有效庫存 ${lots.reduce((s, l) => s + l.qty, 0)}（過期批號不可調劑）`); });
  return DB.tx(() => { its.forEach(i => { let left = i.qty; DB.where('inventory', x => x.med_code === i.code && x.qty > 0 && x.expiry >= today).sort((a, b) => a.expiry.localeCompare(b.expiry)).forEach(l => { if (left <= 0) return; const q = Math.min(l.qty, left); DB.update('inventory', l.id, { qty: l.qty - q }); DB.insert('pharmacy_dispensing', { encounter_id: encId, item_id: i.id, patient_id: pt.id, med_code: i.code, lot_no: l.lot_no, inventory_id: l.id, qty: q, type: '調劑', by: me().id, at: CL.now() }); left -= q; }); DB.update('cl_items', i.id, { disp_status: '已領藥' }); });
    DB.update('encounters', encId, { disp_status: '已領藥', dispensed_at: CL.now(), dispensed_by: me().id }); HIS.audit('DISPENSE', 'encounters', encId, `調劑 ${its.length} 項`, pt.id); });
};
S.clAddStock = (code, lot, expiry, qty, cost) => { need('cl_disp'); qty = parseInt(qty); const m = DB.one('medications', x => x.code === code); if (!m) err('藥品代碼不存在'); if (!lot || !expiry || !(qty > 0)) err('批號、效期、數量必填'); return DB.insert('inventory', { med_code: code, lot_no: lot, expiry, qty, cost: cost || m.cost, location: '藥櫃', received_at: CL.now() }); };

/* ---------- 外送檢驗回報 / 醫師閱報 ---------- */
CL.rollLabs = () => { const d = CL.today(); DB.where('cl_items', i => i.result_status === '待回報' && i.result_due <= d).forEach(i => DB.update('cl_items', i.id, { result_status: '已回報', reported_at: CL.now() })); };
S.clReviewLab = (itemId, note) => { need('cl_doctor'); const i = DB.get('cl_items', itemId); if (i.result_status !== '已回報') err('報告尚未回報'); DB.update('cl_items', itemId, { reviewed_by: me().id, reviewed_at: CL.now(), review_note: note || '', result_status: '已閱' }); HIS.audit('VIEW', 'cl_items', itemId, '醫師閱讀外送檢驗報告：' + (note || ''), i.patient_id); };

/* ---------- 日結 ---------- */
CL.dayStats = date => {
  const encs = DB.where('encounters', e => e.date === date && e.status === '完診'), ch = DB.where('cl_charges', c => c.date === date), it = DB.where('cl_items', i => i.date === date);
  const sum = (a, k) => a.reduce((s, x) => s + (x[k] || 0), 0), pv = CL.cfg().point_value, nh = ch.filter(c => c.ins === '健保');
  const drugCost = sum(it.filter(i => i.kind === 'drug'), 'cost'), svcCost = sum(it.filter(i => i.kind === 'svc'), 'cost'), cash = sum(ch.filter(c => c.status === '已批價'), 'cash_due');
  const estNhi = Math.round(sum(nh, 'claim_pt') * pv);
  return { date, visits: encs.length, nhi_visits: nh.length, self_visits: ch.length - nh.length, exam_pt: sum(nh, 'exam_pt'), drug_pt: sum(nh, 'drug_pt'), disp_pt: sum(nh, 'disp_pt'), svc_pt: sum(nh, 'svc_pt'), total_pt: sum(nh, 'total_pt'), claim_pt: sum(nh, 'claim_pt'), cash, copay_total: sum(nh, 'copay'), reg_total: sum(ch, 'reg_fee'), self_total: sum(ch, 'self_amount'), est_nhi: estNhi, drug_cost: Math.round(drugCost), svc_cost: Math.round(svcCost), gross: cash + estNhi - Math.round(drugCost + svcCost) };
};
S.clCloseDay = () => {
  need('cl_bill'); const d = CL.today(), as = DB.where('appointments', a => a.date === d && ['櫃台等候', '候診中'].includes(a.status));
  if (as.length) err(`尚有 ${as.length} 位病人未處理（櫃台等候/候診中），請完診或取消後才能日結`);
  const unp = DB.where('cl_charges', c => c.date === d && c.status === '待批價').length; if (unp) err(`尚有 ${unp} 筆費用未批價`);
  const undisp = DB.where('encounters', e => e.date === d && e.disp_status === '待領藥').length; if (undisp) err(`尚有 ${undisp} 位病人未領藥`);
  const st = CL.dayStats(d); return DB.tx(() => { DB.insert('cl_closes', Object.assign(st, { closed_at: CL.now(), closed_by: me().id })); const next = HIS.addDays(d, 1); DB.update('cl_settings', 'CFG', { biz_date: next }); CL.rollLabs();
    DB.where('cl_claims', c => c.status === '已送出' && c.review_due && c.review_due <= next).forEach(c => CL.reviewClaim(c.id)); HIS.audit('CLOSE_DAY', 'cl_closes', d, `日結 ${st.visits} 人次 現金 ${st.cash}`); return st; });
};
S.clSetting = patch => { need('*'); DB.update('cl_settings', 'CFG', patch); HIS.audit('UPDATE', 'cl_settings', 'CFG', JSON.stringify(patch)); };

/* ---------- 健保申報 ---------- */
CL.periodOf = date => date.slice(0, 4) + date.slice(5, 7);
CL.eligibleEncs = period => DB.where('encounters', e => e.ins === '健保' && e.status === '完診' && !e.claim_id && CL.periodOf(e.date) === period && (DB.one('cl_charges', { encounter_id: e.id }) || {}).status === '已批價');
S.clPeriods = () => { const m = {}; DB.where('encounters', e => e.ins === '健保' && e.status === '完診' && !e.claim_id).forEach(e => { m[CL.periodOf(e.date)] = (m[CL.periodOf(e.date)] || 0) + 1; }); return Object.keys(m).sort().map(p => ({ period: p, n: m[p] })); };
const lineFromEnc = (e, claimId) => {
  const ch = DB.one('cl_charges', { encounter_id: e.id }), v = CL.viewOfEnc(e), iss = CL.rules(v), pd = v.dx.find(d => d.type === '主要');
  return { claim_id: claimId, encounter_id: e.id, patient_id: e.patient_id, date: e.date, ic_seq: e.ic_seq, icd: pd ? pd.icd : '', exam_pt: ch.exam_pt, drug_pt: ch.drug_pt, disp_pt: ch.disp_pt, svc_pt: ch.svc_pt, total_pt: ch.total_pt, copay: ch.copay, claim_pt: ch.claim_pt, issues: iss, status: '正常', cut_pt: 0, cuts: [] };
};
const sumClaim = id => { const ls = DB.where('cl_claim_lines', l => l.claim_id === id && l.status !== '暫不申報'); const sum = k => ls.reduce((s, l) => s + (l[k] || 0), 0); return { visit_count: ls.length, total_pt: sum('total_pt'), copay: sum('copay'), points_claimed: sum('claim_pt'), points_cut: sum('cut_pt') }; };
S.clClaimCreate = period => {
  need('cl_claim'); if (!/^\d{6}$/.test(period)) err('費用年月格式錯誤'); if (DB.one('cl_claims', c => c.period === period && c.status === '草稿')) err('此費用年月已有草稿，請先處理');
  const es = CL.eligibleEncs(period); if (!es.length) err('此費用年月沒有可申報的就診（需為健保、已批價、未申報）');
  return DB.tx(() => { const c = DB.insert('cl_claims', { period, status: '草稿', created_at: CL.now(), created_by: me().id, seq: DB.where('cl_claims', x => x.period === period).length + 1 }); es.forEach(e => DB.insert('cl_claim_lines', lineFromEnc(e, c.id))); DB.update('cl_claims', c.id, sumClaim(c.id)); HIS.audit('CREATE', 'cl_claims', c.id, `建立 ${period} 申報 ${es.length} 筆`); return DB.get('cl_claims', c.id); });
};
S.clClaimRecheck = claimId => { need('cl_claim'); const c = DB.get('cl_claims', claimId); if (c.status !== '草稿') err('僅草稿可重新檢核'); DB.where('cl_claim_lines', l => l.claim_id === claimId).forEach(l => { const e = DB.get('encounters', l.encounter_id); const n = lineFromEnc(e, claimId); DB.update('cl_claim_lines', l.id, { issues: n.issues, ic_seq: n.ic_seq, icd: n.icd }); }); DB.update('cl_claims', claimId, sumClaim(claimId)); };
S.clLineExclude = (lineId, reason) => { need('cl_claim'); if (!(reason || '').trim()) err('請填寫暫不申報原因'); const l = DB.get('cl_claim_lines', lineId); DB.update('cl_claim_lines', lineId, { status: l.status === '暫不申報' ? '正常' : '暫不申報', exclude_reason: reason }); DB.update('cl_claims', l.claim_id, sumClaim(l.claim_id)); };
S.clClaimSubmit = claimId => {
  need('cl_claim'); const c = DB.get('cl_claims', claimId); if (c.status !== '草稿') err('此申報已送出'); const ls = DB.where('cl_claim_lines', l => l.claim_id === claimId && l.status === '正常'); if (!ls.length) err('沒有可送出的明細');
  const bad = ls.filter(l => l.issues.some(i => i.level === 'E')); if (bad.length) err(`尚有 ${bad.length} 筆明細有「錯誤」等級檢核問題（如缺就醫序號），請修正或標示暫不申報後再送出`);
  return DB.tx(() => { ls.forEach(l => DB.update('encounters', l.encounter_id, { claim_id: claimId })); DB.update('cl_claims', claimId, Object.assign(sumClaim(claimId), { status: '已送出', submitted_at: CL.now(), review_due: HIS.addDays(CL.today(), 3) })); HIS.audit('SUBMIT', 'cl_claims', claimId, `送出 ${c.period} 申報 ${ls.length} 筆`); });
};
CL.reviewClaim = claimId => { // 模擬審查：依檢核問題之核減機率（以明細 id 為種子，可重現）
  const c = DB.get('cl_claims', claimId); if (c.status !== '已送出') return; const pv = CL.cfg().point_value;
  DB.where('cl_claim_lines', l => l.claim_id === claimId && l.status === '正常').forEach(l => { const r = CL.rng(l.id + 'review'), cuts = [];
    l.issues.filter(i => i.level === 'W' && i.cut).forEach(i => { if (r() < i.cut.p) { const it = i.cut.type === 'exam' ? null : DB.one('cl_items', x => x.encounter_id === l.encounter_id && x.code === i.cut.code); const pt = i.cut.type === 'exam' ? Math.round(l.exam_pt * (i.cut.half ? 0.5 : 1)) : (it ? it.amount_pt : 0); if (pt > 0) cuts.push({ rule: i.code, pt, text: i.msg }); } });
    let cut = Math.min(l.claim_pt, cuts.reduce((s, x) => s + x.pt, 0)); DB.update('cl_claim_lines', l.id, { status: cut ? '核減' : '核付', cut_pt: cut, cuts }); });
  const t = sumClaim(claimId), paid = t.points_claimed - t.points_cut; DB.update('cl_claims', claimId, Object.assign(t, { status: '已核付', reviewed_at: CL.now(), points_paid: paid, amount_paid: Math.round(paid * pv) })); HIS.audit('REVIEW', 'cl_claims', claimId, `模擬審查完成 核減 ${t.points_cut} 點`);
};
S.clClaimReviewNow = claimId => { need('cl_claim'); const c = DB.get('cl_claims', claimId); if (c.status !== '已送出') err('此申報尚未送出或已審查'); DB.tx(() => CL.reviewClaim(claimId)); };
S.clAppeal = (lineId, text) => {
  need('cl_claim'); const l = DB.get('cl_claim_lines', lineId); if (l.status !== '核減') err('僅核減明細可申復'); if ((text || '').trim().length < 20) err('申復理由至少 20 字，請具體說明醫療必要性（引用病歷內容）');
  const r = CL.rng(l.id + 'appeal'), win = r() < 0.5 + Math.min(0.3, (text.trim().length - 20) / 200); const pv = CL.cfg().point_value;
  DB.tx(() => { DB.update('cl_claim_lines', lineId, { status: win ? '申復核付' : '申復駁回', appeal_text: text, appeal_result: win ? '申復成功，恢復核付' : '申復駁回，維持核減', cut_pt: win ? 0 : l.cut_pt }); const t = sumClaim(l.claim_id), paid = t.points_claimed - t.points_cut; DB.update('cl_claims', l.claim_id, Object.assign(t, { points_paid: paid, amount_paid: Math.round(paid * pv) })); HIS.audit('APPEAL', 'cl_claim_lines', lineId, win ? '申復成功' : '申復駁回'); }); return win;
};
/* 病歷修訂（診斷）：申報前更正，保留版本 */
S.clAmendDx = (encId, dx, reason) => {
  need('cl_doctor'); if (!(reason || '').trim()) err('請填寫修訂原因'); const e = DB.get('encounters', encId); if (e.claim_id) err('已送出申報，無法修改診斷'); if (dx.filter(d => d.type === '主要').length !== 1) err('必須有且僅有 1 個主要診斷');
  dx.forEach(d => { if (!DB.one('icd10', x => x.code === d.icd)) err('ICD 診斷碼不存在：' + d.icd); });
  return DB.tx(() => { DB.where('diagnoses', d => d.encounter_id === encId && d.status !== '已刪除').forEach(d => DB.update('diagnoses', d.id, { status: '已刪除' })); dx.forEach(d => { const x = DB.one('icd10', c => c.code === d.icd); DB.insert('diagnoses', { patient_id: e.patient_id, encounter_id: encId, icd_code: x.code, zh: x.zh, en: x.en, type: d.type, status: d.status || '確診', scope: '', date: e.date, doctor_id: me().id }); });
    const rec = HIS.encRecord(encId); DB.update('medical_records', rec.id, { version: rec.version + 1, updated_at: CL.now(), updated_by: me().id }); const n = DB.get('medical_records', rec.id);
    DB.insert('record_versions', Object.assign({ record_id: rec.id, patient_id: e.patient_id, version: n.version, saved_at: CL.now(), saved_by: me().id, reason: '診斷修訂：' + reason, status: '已簽署' }, Object.fromEntries(CL.REC_FIELDS.map(k => [k, n[k]])))); DB.update('encounters', encId, { primary_icd: dx.find(d => d.type === '主要').icd }); HIS.audit('AMEND', 'encounters', encId, '診斷修訂：' + reason, e.patient_id); });
};

/* ---------- 範本 ---------- */
CL.applyTpl = (t, ctx) => { const f = {}, vit = ctx.vitals ? [ctx.vitals.bp_sys && `BP ${ctx.vitals.bp_sys}/${ctx.vitals.bp_dia} mmHg`, ctx.vitals.hr && `HR ${ctx.vitals.hr}`, ctx.vitals.rr && `RR ${ctx.vitals.rr}`, ctx.vitals.temp && `BT ${ctx.vitals.temp}°C`, ctx.vitals.spo2 && `SpO₂ ${ctx.vitals.spo2}%`].filter(Boolean).join('，') : '（尚未量測）';
  CL.REC_FIELDS.forEach(k => { f[k] = String((t.f || {})[k] || '').replace(/\{\{name\}\}/g, ctx.name || '').replace(/\{\{age\}\}/g, ctx.age || '').replace(/\{\{sex\}\}/g, ctx.sex || '').replace(/\{\{vitals\}\}/g, vit); }); return f; };
CL.autofill = (txt, r) => String(txt).replace(/（([^（）/]+)\/([^（）]+)）/g, (m, a) => a).replace(/＿(?=天|週|日|個月|小時|分鐘|次|cm|mg|mcg)/g, () => String(2 + Math.floor(r() * 3))).replace(/＿/g, '').replace(/[ ]{2,}/g, ' ');
S.clTplSave = t => { need('cl_tpl'); if (!(t.name || '').trim()) err('範本名稱必填'); const row = { name: t.name.trim(), cat: t.cat || '自訂', f: t.f || {}, dx: t.dx || [], rx: t.rx || [], sv: t.sv || [], builtin: !!t.builtin, updated_at: CL.now(), updated_by: me().id };
  (row.dx || []).forEach(c => { if (!DB.one('icd10', x => x.code === c)) err('範本中的 ICD 不存在：' + c); }); (row.rx || []).forEach(x => { const [ing, , ,] = x.split('|'); if (!CL.drugBy(ing)) err('範本中的藥品不存在：' + ing); }); (row.sv || []).forEach(c => { if (!DB.one('cl_services', s => s.code === c)) err('範本中的項目不存在：' + c); });
  if (t.id) { DB.update('templates', t.id, row); HIS.audit('UPDATE', 'templates', t.id, row.name); return DB.get('templates', t.id); } const n = DB.insert('templates', Object.assign(row, { key: 'U' + Date.now().toString(36), created_by: me().id })); HIS.audit('CREATE', 'templates', n.id, row.name); return n; };
S.clTplDelete = id => { need('cl_tpl'); const t = DB.get('templates', id); DB.update('templates', id, { deleted: true }); HIS.audit('DELETE', 'templates', id, t.name); };
S.clTplRestore = () => { need('cl_tpl'); let n = 0; CL.TEMPLATES.forEach(t => { const ex = DB.one('templates', x => x.key === t.key); if (!ex) { DB.insert('templates', Object.assign({}, t)); n++; } else if (ex.deleted) { DB.update('templates', ex.id, { deleted: false }); n++; } }); return n; };
S.clTplImport = json => { need('cl_tpl'); let arr; try { arr = JSON.parse(json); } catch (e) { err('JSON 格式錯誤'); } if (!Array.isArray(arr)) err('匯入內容須為範本陣列'); let n = 0; arr.forEach(t => { S.clTplSave({ name: t.name, cat: t.cat, f: t.f, dx: t.dx, rx: t.rx, sv: t.sv }); n++; }); return n; };
S.clTplExport = () => JSON.stringify(DB.where('templates', t => !t.deleted).map(t => ({ name: t.name, cat: t.cat, f: t.f, dx: t.dx, rx: t.rx, sv: t.sv })), null, 1);

/* ---------- 資料一致性（診所）---------- */
S.clConsistency = () => {
  const R = [], chk = (name, bad) => R.push({ name, ok: !bad.length, bad: bad.slice(0, 20), n: bad.length }), E = DB.all('encounters'), pts = new Set(DB.all('patients').map(p => p.id));
  chk('不存在「看診中/進行中」的半完成就診（診為一次寫入）', DB.all('appointments').filter(a => a.status === '看診中').map(a => a.id).concat(E.filter(e => e.status !== '完診').map(e => e.id)));
  chk('每筆完診都有已簽署病歷、1 個主要診斷與費用', E.filter(e => !HIS.encRecord(e.id) || HIS.encRecord(e.id).status !== '已簽署' || DB.where('diagnoses', d => d.encounter_id === e.id && d.type === '主要' && d.status !== '已刪除').length !== 1 || !DB.one('cl_charges', { encounter_id: e.id })).map(e => e.id));
  chk('就診皆對應存在的病人', E.filter(e => !pts.has(e.patient_id)).map(e => e.id));
  chk('費用點數 = 診察+藥費+藥事+檢驗處置；申請點數 = 合計-部分負擔', DB.all('cl_charges').filter(c => c.ins === '健保' && (c.total_pt !== c.exam_pt + c.drug_pt + c.disp_pt + c.svc_pt || c.claim_pt !== c.total_pt - c.copay)).map(c => c.id));
  chk('藥費/檢驗點數與明細相符', DB.all('cl_charges').filter(c => { if (c.ins !== '健保') return false; const it = DB.where('cl_items', i => i.encounter_id === c.encounter_id && !i.self); return it.filter(i => i.kind === 'drug').reduce((s, i) => s + i.amount_pt, 0) !== c.drug_pt || it.filter(i => i.kind === 'svc').reduce((s, i) => s + i.amount_pt, 0) !== c.svc_pt; }).map(c => c.id));
  chk('已領藥者必定已批價', E.filter(e => e.disp_status === '已領藥' && (DB.one('cl_charges', { encounter_id: e.id }) || {}).status !== '已批價').map(e => e.id));
  chk('已領藥項目皆有調劑紀錄且庫存不為負', DB.all('cl_items').filter(i => i.kind === 'drug' && i.disp_status === '已領藥' && !DB.one('pharmacy_dispensing', d => d.item_id === i.id)).map(i => i.id).concat(DB.all('inventory').filter(i => i.qty < 0).map(i => i.id)));
  chk('申報明細的就診存在且申報總點數相符', DB.all('cl_claims').filter(c => c.status !== '草稿' && c.points_claimed !== DB.where('cl_claim_lines', l => l.claim_id === c.id && l.status !== '暫不申報').reduce((s, l) => s + l.claim_pt, 0)).map(c => c.id).concat(DB.all('cl_claim_lines').filter(l => !DB.get('encounters', l.encounter_id)).map(l => l.id)));
  chk('已申報之就診不得再被其他申報納入', (() => { const m = {}; DB.all('cl_claim_lines').filter(l => { const c = DB.get('cl_claims', l.claim_id); return c && c.status !== '草稿' && l.status !== '暫不申報'; }).forEach(l => { m[l.encounter_id] = (m[l.encounter_id] || 0) + 1; }); return Object.keys(m).filter(k => m[k] > 1); })());
  chk('病人身分證字號不重複', (() => { const m = {}, d = []; DB.all('patients').forEach(p => { if (m[p.id_no]) d.push(p.id); m[p.id_no] = 1; }); return d; })());
  chk('操作紀錄不為空', DB.all('audit_logs').length ? [] : ['audit_logs 為空']);
  return R;
};

/* ---------- 版本切換 ---------- */
HIS.setEdition = (ed, o) => { DB.use(ed, o); HIS.REC_FIELDS = ed === 'clinic' ? CL.REC_FIELDS : HIS.REC_FIELDS_HOSP; };
})(typeof globalThis !== 'undefined' ? globalThis : window);
