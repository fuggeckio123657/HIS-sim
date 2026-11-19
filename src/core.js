/* HIS core: 資料層(DB) + 業務服務(svc)。與介面無關，可在瀏覽器或 Node 執行。
 * 資料層介面(DB.all/get/where/insert/update)是未來接 FastAPI/PostgreSQL 的替換點。 */
(function (G) {
'use strict';
const HIS = G.HIS = G.HIS || {};
const P = n => String(n).padStart(2, '0');
HIS.fmt = d => `${d.getFullYear()}-${P(d.getMonth() + 1)}-${P(d.getDate())} ${P(d.getHours())}:${P(d.getMinutes())}:${P(d.getSeconds())}`;
HIS.now = () => HIS.fmt(new Date());
HIS.today = () => HIS.now().slice(0, 10);
HIS.addDays = (s, n) => { const d = new Date(s.slice(0, 10) + 'T12:00:00'); d.setDate(d.getDate() + n); return HIS.fmt(d).slice(0, 10); };
HIS.age = (birth, ref) => {
  const b = new Date(birth + 'T00:00:00'), r = new Date((ref || HIS.today()) + 'T00:00:00');
  let y = r.getFullYear() - b.getFullYear(); const m = r.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && r.getDate() < b.getDate())) y--;
  if (y < 2) { const mo = (r.getFullYear() - b.getFullYear()) * 12 + r.getMonth() - b.getMonth() - (r.getDate() < b.getDate() ? 1 : 0); return mo + '個月'; }
  return y + '歲';
};
HIS.ageN = (birth) => parseInt(HIS.age(birth)) || 0;

/* ---------- 持久化儲存（支援多版本命名空間、遠端同步鉤子） ---------- */
const localStore = (() => {
  try { const t = '__t'; localStorage.setItem(t, '1'); localStorage.removeItem(t); return localStorage; }
  catch (e) { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, _mem: true }; }
})();
let store = localStore, PFX = 'his.v1.', persist = true;
const TABLES = ['roles', 'departments', 'users', 'patients', 'allergies', 'medical_histories', 'appointments', 'encounters',
  'vital_signs', 'medical_records', 'record_versions', 'diagnoses', 'icd10', 'medications', 'medication_orders', 'prescriptions',
  'pharmacy_dispensing', 'inventory', 'lab_items', 'lab_panels', 'lab_orders', 'specimens', 'lab_results', 'radiology_catalog',
  'radiology_orders', 'radiology_reports', 'procedures', 'consultations', 'wards', 'beds', 'admissions', 'messages', 'audit_logs',
  /* 診所版 */ 'templates', 'cl_services', 'cl_items', 'cl_charges', 'cl_claims', 'cl_claim_lines', 'cl_settings', 'cl_closes'];
const IDP = { roles: 'R', departments: 'DEP', users: 'U', patients: 'PT', allergies: 'AL', medical_histories: 'MH', appointments: 'APT',
  encounters: 'ENC', vital_signs: 'VS', medical_records: 'MR', record_versions: 'RV', diagnoses: 'DX', icd10: 'ICD', medications: 'MED',
  medication_orders: 'MO', prescriptions: 'RX', pharmacy_dispensing: 'DSP', inventory: 'INV', lab_items: 'LI', lab_panels: 'LP',
  lab_orders: 'LO', specimens: 'SP', lab_results: 'LR', radiology_catalog: 'RC', radiology_orders: 'RO', radiology_reports: 'RR',
  procedures: 'PR', consultations: 'CS', wards: 'W', beds: 'B', admissions: 'ADM', messages: 'MSG', audit_logs: 'LOG',
  templates: 'TP', cl_services: 'SV', cl_items: 'CI', cl_charges: 'CH', cl_claims: 'CM', cl_claim_lines: 'CLL', cl_settings: 'CST', cl_closes: 'DC' };
let cache = {}; const dirty = new Set(); let bulk = false, meta = null, applying = false, txLog = null; const listeners = [];
const DB = HIS.DB = {
  tables: TABLES, edition: 'hospital', sink: null, idTag: null,
  /* 切換版本：hospital 沿用 'his.v1.' 以保留既有資料；clinic 使用獨立命名空間 */
  use(ed, o) { o = o || {}; DB.edition = ed; PFX = ed === 'clinic' ? 'clinic.v1.' : 'his.v1.'; cache = {}; meta = null; dirty.clear();
    persist = !o.remote; store = o.remote ? { getItem: () => null, setItem() { }, removeItem() { }, _mem: true } : localStore; DB.idTag = o.remote ? (o.tag || Math.random().toString(36).slice(2, 5)) : null; HIS.edition = ed; DB.emit('*'); },
  load(t) { if (!cache[t]) { const s = persist ? store.getItem(PFX + t) : null; cache[t] = s ? JSON.parse(s) : []; } return cache[t]; },
  flush(t) { if (!persist) return; if (bulk) { dirty.add(t); return; } store.setItem(PFX + t, JSON.stringify(cache[t])); },
  all: t => DB.load(t),
  get: (t, id) => DB.load(t).find(r => r.id === id),
  where(t, f) { const a = DB.load(t); return typeof f === 'function' ? a.filter(f) : a.filter(r => Object.keys(f).every(k => r[k] === f[k])); },
  one(t, f) { return DB.where(t, f)[0]; },
  nextId(t) {
    if (!meta) meta = persist ? JSON.parse(store.getItem(PFX + 'meta') || '{}') : {};
    meta[t] = (meta[t] || 0) + 1;
    if (persist) { if (!bulk) store.setItem(PFX + 'meta', JSON.stringify(meta)); else dirty.add('__meta'); }
    return IDP[t] + (DB.idTag ? DB.idTag + '-' : '') + String(meta[t]).padStart(6, '0');
  },
  insert(t, row) { DB.load(t); row.id = row.id || DB.nextId(t); cache[t].push(row); DB.flush(t); if (txLog) { txLog.ops.push({ o: 'i', t, row }); txLog.undo.push(() => { const i = cache[t].indexOf(row); if (i >= 0) cache[t].splice(i, 1); }); } else if (DB.sink && !applying && !bulk) DB.sink({ o: 'i', t, row }); DB.emit(t); return row; },
  update(t, id, patch) { const r = DB.get(t, id); if (!r) throw new Error(`資料不存在：${t}/${id}`); if (txLog) { const old = {}; Object.keys(patch).forEach(k => { old[k] = r[k]; }); txLog.undo.push(() => { Object.keys(old).forEach(k => { if (old[k] === undefined) delete r[k]; else r[k] = old[k]; }); }); txLog.ops.push({ o: 'u', t, id, patch }); } Object.assign(r, patch); DB.flush(t); if (!txLog && DB.sink && !applying && !bulk) DB.sink({ o: 'u', t, id, patch }); DB.emit(t); return r; },
  onchange(fn) { listeners.push(fn); },
  emit(t) { if (!bulk) listeners.forEach(f => { try { f(t); } catch (e) { console.error(e); } }); },
  bulk(fn) { bulk = true; try { fn(); } finally { bulk = false; if (persist) { dirty.forEach(t => { if (t === '__meta') store.setItem(PFX + 'meta', JSON.stringify(meta)); else store.setItem(PFX + t, JSON.stringify(cache[t])); }); } dirty.clear(); DB.emit('*'); } },
  /* 交易：全部成功才寫入；任何一步丟錯就整批還原（診所「完診」用，避免出現做到一半的診） */
  tx(fn) { if (txLog) return fn(); txLog = { ops: [], undo: [] }; const L = txLog; let res, ok = false; bulk = true;
    try { res = fn(); ok = true; } finally { bulk = false; txLog = null;
      if (!ok) { L.undo.reverse().forEach(u => u()); dirty.clear(); }
      else { if (persist) { TABLES.forEach(t => { if (cache[t]) store.setItem(PFX + t, JSON.stringify(cache[t])); }); if (meta) store.setItem(PFX + 'meta', JSON.stringify(meta)); } dirty.clear(); if (DB.sink) L.ops.forEach(o => DB.sink(o)); DB.emit('*'); } }
    return res; },
  /* 大量寫入（種子）：暫停持久化，結束後一次寫入；不送出同步 */
  quiet(fn) { TABLES.forEach(t => DB.load(t)); if (!meta) meta = persist ? JSON.parse(store.getItem(PFX + 'meta') || '{}') : {}; const p0 = persist, s0 = DB.sink; persist = false; DB.sink = null;
    try { fn(); } finally { persist = p0; DB.sink = s0; if (persist) { TABLES.forEach(t => store.setItem(PFX + t, JSON.stringify(cache[t]))); store.setItem(PFX + 'meta', JSON.stringify(meta)); } DB.emit('*'); } },
  hasData() { return DB.load('patients').length > 0; },
  reset() { TABLES.forEach(t => { store.removeItem(PFX + t); delete cache[t]; }); store.removeItem(PFX + 'meta'); meta = null; },
  usingMemory: () => !!localStore._mem,
  /* 遠端同步：完整快照 / 套用他人的變更 */
  snapshot() { const o = {}; TABLES.forEach(t => { o[t] = DB.load(t); }); return o; },
  loadSnapshot(o) { cache = {}; TABLES.forEach(t => { cache[t] = (o && o[t]) || []; }); if (persist) TABLES.forEach(t => store.setItem(PFX + t, JSON.stringify(cache[t]))); DB.emit('*'); },
  applyRemote(ops) { applying = true; try { ops.forEach(op => { DB.load(op.t); if (op.o === 'i') { if (!cache[op.t].some(r => r.id === op.row.id)) cache[op.t].push(op.row); } else { const r = DB.get(op.t, op.id); if (r) Object.assign(r, op.patch); } }); } finally { applying = false; } DB.emit('*'); }
};

/* ---------- 會話 / 權限 / 稽核 ---------- */
HIS.hash = s => { let x = 5381; for (const c of 'his$' + s) x = ((x * 33) ^ c.charCodeAt(0)) >>> 0; return x.toString(16); };
HIS.session = null;
HIS.can = p => { const u = HIS.session && HIS.session.user; if (!u) return false; const r = DB.get('roles', u.role_id); return !!r && (r.perms.includes('*') || r.perms.includes(p)); };
const err = m => { throw new Error(m); };
const me = () => (HIS.session && HIS.session.user) || err('尚未登入');
const need = p => { if (!HIS.can(p)) err('權限不足（需要權限：' + p + '）'); };
HIS.audit = (action, table, rid, detail, pid) => {
  const s = HIS.session, u = s && s.user;
  DB.insert('audit_logs', { at: HIS.now(), user_id: u ? u.id : null, emp_no: u ? u.emp_no : '-', user_name: u ? u.name : '-', role: u ? DB.get('roles', u.role_id).name : '-',
    ws: s ? s.ws : '-', action, table_name: table || '', record_id: rid || '', patient_id: pid || '', detail: detail || '' });
};
const audit = HIS.audit;

/* ---------- 常數 ---------- */
HIS.ST = { DRAFT: '草稿', PEND: '待簽署', SIGNED: '已簽署', SENT: '已送出', RUN: '執行中', DONE: '已完成', CANCEL: '已取消' };
const ST = HIS.ST;
HIS.FREQ = { QD: 1, BID: 2, TID: 3, QID: 4, QHS: 1, Q4H: 6, Q6H: 4, Q8H: 3, Q12H: 2, QOD: 0.5, QW: 1 / 7, STAT: 1, PRN: 1, HS: 1 };
HIS.ROUTES = ['PO', 'IV', 'IM', 'SC', 'PR', 'TOP', 'INH'];
const msg = (to, text, ref) => DB.insert('messages', { to_user: to, text, at: HIS.now(), read: false, ref: ref || '' });
HIS.msg = msg;
const setSt = (t, id, st, extra) => DB.update(t, id, Object.assign({ status: st }, extra || {}));

const S = HIS.svc = {};

/* ---------- 登入 ---------- */
S.login = (emp, pw, ws) => {
  const u = DB.one('users', x => x.emp_no.toLowerCase() === String(emp).trim().toLowerCase());
  if (!u || u.pw !== HIS.hash(pw) || u.active === false) { HIS.session = null; audit('LOGIN_FAIL', 'users', '', '帳號：' + emp); err('員工編號或密碼錯誤'); }
  HIS.session = { user: u, ws, loginAt: HIS.now() };
  audit('LOGIN', 'users', u.id, '工作站 ' + ws);
  return HIS.session;
};
S.logout = () => { if (HIS.session) audit('LOGOUT', 'users', HIS.session.user.id, ''); HIS.session = null; };

/* ---------- 病人 ---------- */
HIS.pt = id => DB.get('patients', id);
HIS.staff = id => DB.get('users', id);
HIS.staffName = id => { const u = DB.get('users', id); return u ? u.name : (id || ''); };
HIS.deptName = id => { const d = DB.get('departments', id); return d ? d.name : (id || ''); };
HIS.maskId = s => s ? s.slice(0, 2) + '****' + s.slice(-4) : '';
HIS.allergies = pid => DB.where('allergies', { patient_id: pid });
S.searchPatients = q => {
  need('patient');
  let r = DB.all('patients');
  const has = (s, x) => String(s || '').toLowerCase().includes(String(x).trim().toLowerCase());
  if (q.chart) r = r.filter(p => has(p.chart_no, q.chart));
  if (q.name) r = r.filter(p => has(p.name, q.name));
  if (q.idno) r = r.filter(p => has(p.id_no, q.idno));
  const enc = DB.all('encounters');
  if (q.date) { const s = new Set(enc.filter(e => e.start_time.slice(0, 10) === q.date).map(e => e.patient_id)); r = r.filter(p => s.has(p.id)); }
  if (q.dept) { const s = new Set(enc.filter(e => e.dept_id === q.dept).map(e => e.patient_id)); r = r.filter(p => s.has(p.id)); }
  if (q.doctor) { const s = new Set(enc.filter(e => e.doctor_id === q.doctor).map(e => e.patient_id)); r = r.filter(p => s.has(p.id)); }
  if (q.bed) {
    const s = new Set(DB.all('admissions').filter(a => a.status !== '已出院' && a.status !== '入院申請' && has(a.bed_id, q.bed)).map(a => a.patient_id)); r = r.filter(p => s.has(p.id));
  }
  audit('SEARCH', 'patients', '', JSON.stringify(q));
  return r.slice(0, 300);
};
S.createPatient = d => {
  need('reg');
  if (!d.name || !d.birth || !d.sex || !d.id_no) err('姓名、性別、出生日期、身分證字號為必填');
  if (DB.one('patients', p => p.id_no === d.id_no)) err('身分證字號已存在，請先查詢是否重複建檔');
  const n = DB.all('patients').reduce((m, p) => Math.max(m, parseInt(p.chart_no)), 0) + 1;
  const p = DB.insert('patients', Object.assign({ chart_no: String(n).padStart(8, '0'), created_at: HIS.now(), blood: '未檢驗', ins_type: '健保' }, d));
  audit('CREATE', 'patients', p.id, '新病人建檔 ' + p.chart_no, p.id); return p;
};
S.updatePatient = (id, patch) => { need('reg'); DB.update('patients', id, patch); audit('UPDATE', 'patients', id, JSON.stringify(patch), id); };
S.addAllergy = (pid, a) => { if (!HIS.can('opd') && !HIS.can('reg') && !HIS.can('ward')) err('權限不足'); const r = DB.insert('allergies', Object.assign({ patient_id: pid, recorded_at: HIS.now(), recorded_by: me().id }, a)); audit('CREATE', 'allergies', r.id, a.allergen, pid); return r; };
S.addHistory = (pid, h) => { need('opd'); const r = DB.insert('medical_histories', Object.assign({ patient_id: pid, recorded_at: HIS.now(), recorded_by: me().id }, h)); audit('CREATE', 'medical_histories', r.id, h.kind + ' ' + h.text, pid); return r; };
S.viewPatient = id => audit('VIEW', 'patients', id, '開啟病人資料', id);

/* ---------- 掛號 / 門診 ---------- */
S.register = ({ patient_id, doctor_id, date, session }) => {
  need('reg');
  const doc = HIS.staff(doctor_id); if (!doc) err('請選擇醫師');
  if (DB.one('appointments', a => a.patient_id === patient_id && a.date === date && a.doctor_id === doctor_id && a.session === session && a.status !== '取消')) err('該病人在同一診次已有掛號');
  const q = DB.where('appointments', a => a.doctor_id === doctor_id && a.date === date && a.session === session).length + 1;
  const a = DB.insert('appointments', { patient_id, doctor_id, dept_id: doc.dept_id, date, session, queue_no: q, status: '已掛號', created_at: HIS.now(), created_by: me().id });
  audit('CREATE', 'appointments', a.id, `${date} ${session} ${q}號`, patient_id); return a;
};
S.checkin = id => { need('reg'); const a = DB.get('appointments', id); if (a.status !== '已掛號') err('狀態不符'); DB.update('appointments', id, { status: '候診中', checkin_at: HIS.now() }); audit('UPDATE', 'appointments', id, '報到', a.patient_id); };
S.cancelAppt = id => { need('reg'); const a = DB.get('appointments', id); if (!['已掛號', '候診中'].includes(a.status)) err('此狀態無法取消'); DB.update('appointments', id, { status: '取消' }); audit('UPDATE', 'appointments', id, '取消掛號', a.patient_id); };
HIS.encRecord = encId => DB.where('medical_records', r => r.encounter_id === encId && r.status !== '作廢')[0];
S.startVisit = apptId => {
  need('opd'); const u = me(), a = DB.get('appointments', apptId); if (!a) err('掛號不存在');
  if (a.encounter_id) return DB.get('encounters', a.encounter_id);
  if (a.status === '取消') err('此掛號已取消');
  if (a.dept_id !== u.dept_id && !HIS.can('*')) err('非本科病人，無法開始看診');
  const e = DB.insert('encounters', { patient_id: a.patient_id, type: 'OPD', dept_id: a.dept_id, doctor_id: u.id, appt_id: a.id, start_time: HIS.now(), end_time: null, status: '進行中' });
  DB.update('appointments', apptId, { status: '看診中', encounter_id: e.id });
  DB.insert('medical_records', { patient_id: a.patient_id, encounter_id: e.id, type: '門診SOAP', status: '草稿', version: 1, cc: '', hpi: '', pmh: '', fh: '', sh: '', ros: '', pe: '', assessment: '', plan: '', created_at: HIS.now(), created_by: u.id, updated_at: HIS.now(), updated_by: u.id });
  audit('CREATE', 'encounters', e.id, '開始門診看診', a.patient_id); return e;
};
S.addVitals = (encId, v) => {
  if (!HIS.can('vitals') && !HIS.can('ward')) err('權限不足');
  const e = DB.get('encounters', encId);
  const num = k => (v[k] === '' || v[k] == null ? null : Number(v[k]));
  const row = { patient_id: e.patient_id, encounter_id: encId, at: HIS.now(), bp_sys: num('bp_sys'), bp_dia: num('bp_dia'), hr: num('hr'), rr: num('rr'), temp: num('temp'), spo2: num('spo2'), weight: num('weight'), height: num('height'), pain: num('pain'), recorded_by: me().id };
  if ([row.bp_sys, row.bp_dia, row.hr, row.rr, row.temp, row.spo2].every(x => x == null)) err('請至少輸入一項生命徵象');
  if (row.bp_sys && row.bp_dia && row.bp_sys <= row.bp_dia) err('收縮壓必須大於舒張壓');
  if (row.temp != null && (row.temp < 30 || row.temp > 43)) err('體溫數值超出合理範圍');
  if (row.spo2 != null && (row.spo2 < 40 || row.spo2 > 100)) err('SpO2 數值超出合理範圍');
  const r = DB.insert('vital_signs', row); audit('CREATE', 'vital_signs', r.id, '', e.patient_id); return r;
};
HIS.encOpen = encId => { const e = DB.get('encounters', encId); return e && e.status !== '完成'; };
S.completeEncounter = encId => {
  need('opd'); const e = DB.get('encounters', encId); if (e.status === '完成') err('此次就診已完成');
  const rec = HIS.encRecord(encId);
  if (!rec || rec.status !== '已簽署') err('病歷尚未簽署，無法完成就診');
  if (!DB.where('diagnoses', d => d.encounter_id === encId && d.type === '主要' && d.status !== '已刪除').length) err('尚未建立主要診斷');
  const dr = [...DB.all('medication_orders'), ...DB.all('lab_orders'), ...DB.all('radiology_orders'), ...DB.all('procedures')].filter(o => o.encounter_id === encId && (o.status === ST.DRAFT || o.status === ST.PEND || o.status === ST.SIGNED));
  if (dr.length) err(`尚有 ${dr.length} 筆醫囑未送出（草稿/待簽署/已簽署），請先簽署送出或取消`);
  DB.update('encounters', encId, { status: '完成', end_time: HIS.now() });
  if (e.appt_id) DB.update('appointments', e.appt_id, { status: '已看診' });
  audit('UPDATE', 'encounters', encId, '完成就診', e.patient_id);
};

/* ---------- 病歷 EMR（簽署後保留版本） ---------- */
const HOSP_FIELDS = ['cc', 'hpi', 'pmh', 'fh', 'sh', 'ros', 'pe', 'assessment', 'plan'];
HIS.REC_FIELDS_HOSP = HOSP_FIELDS;
HIS.REC_FIELDS = HOSP_FIELDS;
const FIELDSNOW = () => HIS.REC_FIELDS;
S.saveRecord = (id, f, reason) => {
  need('emr'); const r = DB.get('medical_records', id), u = me();
  if (r.status === '已簽署') {
    if (!reason) err('已簽署病歷修改須填寫修訂原因');
    DB.update('medical_records', id, Object.assign({}, pick(f), { status: '修訂中', version: r.version + 1, pending_reason: reason, updated_at: HIS.now(), updated_by: u.id }));
    audit('AMEND', 'medical_records', id, `修訂至 v${r.version + 1}：${reason}`, r.patient_id);
  } else {
    DB.update('medical_records', id, Object.assign({}, pick(f), { updated_at: HIS.now(), updated_by: u.id }));
    audit('UPDATE', 'medical_records', id, '儲存病歷草稿', r.patient_id);
  }
};
const pick = f => { const o = {}; FIELDSNOW().forEach(k => { if (f[k] !== undefined) o[k] = f[k]; }); return o; };
S.signRecord = id => {
  need('sign'); const r = DB.get('medical_records', id), u = me();
  if (r.status === '已簽署') err('此病歷已簽署');
  if (!(r.cc || '').trim() || !(r.assessment || '').trim()) err('主訴(CC)與評估(Assessment)為必填，無法簽署');
  const why = r.pending_reason || '初次簽署';
  DB.update('medical_records', id, { status: '已簽署', signed_by: u.id, signed_at: HIS.now(), pending_reason: null });
  const n = DB.get('medical_records', id);
  DB.insert('record_versions', Object.assign({ record_id: id, patient_id: r.patient_id, version: n.version, saved_at: HIS.now(), saved_by: u.id, reason: why, status: '已簽署' }, pick(n)));
  audit('SIGN', 'medical_records', id, `簽署 v${n.version}`, r.patient_id);
};
S.createRecord = (encId, type) => {
  need('emr'); const e = DB.get('encounters', encId), u = me();
  const r = DB.insert('medical_records', { patient_id: e.patient_id, encounter_id: encId, admission_id: e.admission_id || null, type, status: '草稿', version: 1, cc: '', hpi: '', pmh: '', fh: '', sh: '', ros: '', pe: '', assessment: '', plan: '', created_at: HIS.now(), created_by: u.id, updated_at: HIS.now(), updated_by: u.id });
  audit('CREATE', 'medical_records', r.id, type, e.patient_id); return r;
};

/* ---------- 診斷 ---------- */
S.addDx = (encId, d) => {
  need('emr'); const e = DB.get('encounters', encId), u = me();
  const icd = DB.one('icd10', x => x.code === d.icd_code); if (!icd) err('ICD-10-CM 診斷碼不存在於診斷檔');
  if (d.type === '主要' && DB.where('diagnoses', x => x.encounter_id === encId && x.type === '主要' && x.status !== '已刪除' && (x.scope || '') === (d.scope || '')).length) err('本次就診已有主要診斷，請改為次要或先刪除原主要診斷');
  if (DB.where('diagnoses', x => x.encounter_id === encId && x.icd_code === d.icd_code && x.status !== '已刪除' && (x.scope || '') === (d.scope || '')).length) err('此診斷已存在');
  const r = DB.insert('diagnoses', { patient_id: e.patient_id, encounter_id: encId, admission_id: e.admission_id || null, record_id: d.record_id || null, icd_code: icd.code, zh: icd.zh, en: icd.en, type: d.type, status: d.status || '確診', scope: d.scope || '', date: HIS.today(), doctor_id: u.id });
  audit('CREATE', 'diagnoses', r.id, icd.code + ' ' + icd.zh, e.patient_id); return r;
};
S.delDx = id => { need('emr'); const d = DB.get('diagnoses', id); DB.update('diagnoses', id, { status: '已刪除' }); audit('DELETE', 'diagnoses', id, d.icd_code, d.patient_id); };

/* ---------- 醫囑 CPOE ---------- */
HIS.checkAllergy = (pid, med) => {
  const out = [], cls = (med.allergy_class || '').split(',').filter(Boolean);
  HIS.allergies(pid).forEach(a => {
    const k = (a.allergen_class || '').toLowerCase();
    if (cls.includes(k)) out.push({ level: '禁忌', msg: `病人對「${a.allergen}」過敏（${a.reaction}，${a.severity}），${med.name_zh} 屬 ${k} 類` });
    else if (k === 'penicillin' && cls.includes('cephalosporin')) out.push({ level: '注意', msg: `病人對青黴素類過敏，${med.name_zh} 為頭孢類，可能有交叉過敏` });
  });
  return out;
};
const dupe = (t, encId, key, val) => DB.where(t, o => o.encounter_id === encId && o[key] === val && o.status !== ST.CANCEL && o.status !== ST.DONE).length;
S.addMedOrder = (encId, d) => {
  need('cpoe'); const e = DB.get('encounters', encId), u = me(); if (!e || e.status === '完成') err('就診已完成，無法開立醫囑');
  const m = DB.one('medications', x => x.code === d.med_code); if (!m) err('請先選擇藥品');
  const dose = Number(d.dose); if (!(dose > 0)) err('單次劑量必須大於 0');
  if (!HIS.ROUTES.includes(d.route)) err('給藥途徑不正確');
  if (!HIS.FREQ[d.freq]) err('請選擇給藥頻率');
  const inpt = e.type === 'IPD';
  let days = parseInt(d.days);
  if (e.type === 'OPD' && !(days > 0)) err('門診處方須輸入使用天數');
  if (!(days > 0)) days = 1;
  const al = HIS.checkAllergy(e.patient_id, m);
  if (al.length && !(d.allergy_override || '').trim()) err('過敏警示：' + al.map(x => x.msg).join('；') + '。若仍要開立請填寫「過敏覆核原因」');
  if (dupe('medication_orders', encId, 'med_code', m.code)) err('本次就診已開立相同藥品，請勿重複');
  const per = HIS.FREQ[d.freq];
  const total = d.freq === 'PRN' ? Math.max(1, Math.ceil(dose * (parseInt(d.prn_qty) || 3) * days)) : Math.max(1, Math.ceil(dose * per * days));
  const start = d.start_time || HIS.now(), stop = HIS.fmt(new Date(new Date(start.replace(' ', 'T')).getTime() + days * 86400000));
  const o = DB.insert('medication_orders', { patient_id: e.patient_id, encounter_id: encId, admission_id: e.admission_id || null, med_code: m.code, med_name: m.name_zh, ingredient: m.ingredient, spec: m.spec, form: m.form,
    dose, dose_unit: m.unit, route: d.route, freq: d.freq, days, total_qty: total, start_time: start, stop_time: stop, prn: d.freq === 'PRN', instruction: d.instruction || '', note: d.note || '',
    allergy_override: (d.allergy_override || '').trim(), priority: d.priority || '一般', inpatient: inpt, status: ST.DRAFT, ordered_by: u.id, ordered_at: HIS.now() });
  audit('CREATE', 'medication_orders', o.id, `${m.name_zh} ${dose}${m.unit} ${d.route} ${d.freq}×${days}d`, e.patient_id); return o;
};
S.addLabOrder = (encId, d) => {
  need('cpoe'); const e = DB.get('encounters', encId), u = me(); if (e.status === '完成') err('就診已完成，無法開立醫囑');
  const p = DB.one('lab_panels', x => x.code === d.panel_code); if (!p) err('請選擇檢驗項目');
  if (dupe('lab_orders', encId, 'panel_code', p.code)) err('本次就診已開立相同檢驗');
  const o = DB.insert('lab_orders', { patient_id: e.patient_id, encounter_id: encId, admission_id: e.admission_id || null, panel_code: p.code, panel_name: p.zh, specimen_type: p.specimen, priority: d.priority || '一般', note: d.note || '',
    status: ST.DRAFT, report_status: '未開始', ordered_by: u.id, ordered_at: HIS.now() });
  audit('CREATE', 'lab_orders', o.id, p.code + ' ' + p.zh, e.patient_id); return o;
};
S.addRadOrder = (encId, d) => {
  need('cpoe'); const e = DB.get('encounters', encId), u = me(); if (e.status === '完成') err('就診已完成，無法開立醫囑');
  const c = DB.one('radiology_catalog', x => x.code === d.exam_code); if (!c) err('請選擇影像檢查');
  if (!(d.reason || '').trim()) err('影像檢查須填寫臨床問題/檢查目的');
  if (dupe('radiology_orders', encId, 'exam_code', c.code)) err('本次就診已開立相同檢查');
  const o = DB.insert('radiology_orders', { patient_id: e.patient_id, encounter_id: encId, admission_id: e.admission_id || null, exam_code: c.code, exam_name: c.zh, modality: c.modality, reason: d.reason, priority: d.priority || '一般',
    status: ST.DRAFT, exam_status: '未送出', ordered_by: u.id, ordered_at: HIS.now() });
  audit('CREATE', 'radiology_orders', o.id, c.code + ' ' + c.zh, e.patient_id); return o;
};
HIS.PROC_TYPES = ['心電圖', '傷口處理', '注射', '輸液', '氧氣治療', '復健'];
S.addProcOrder = (encId, d) => {
  need('cpoe'); const e = DB.get('encounters', encId), u = me(); if (e.status === '完成') err('就診已完成，無法開立醫囑');
  if (!HIS.PROC_TYPES.includes(d.proc_type)) err('請選擇處置類型');
  if (!(d.detail || '').trim()) err('請輸入處置內容');
  const o = DB.insert('procedures', { patient_id: e.patient_id, encounter_id: encId, admission_id: e.admission_id || null, proc_type: d.proc_type, detail: d.detail, priority: d.priority || '一般', status: ST.DRAFT, ordered_by: u.id, ordered_at: HIS.now() });
  audit('CREATE', 'procedures', o.id, d.proc_type + ' ' + d.detail, e.patient_id); return o;
};
const OT = { med: 'medication_orders', lab: 'lab_orders', rad: 'radiology_orders', proc: 'procedures' };
HIS.OT = OT;
HIS.encOrders = encId => {
  const out = [];
  DB.where('medication_orders', o => o.encounter_id === encId).forEach(o => out.push({ kind: 'med', kindName: '藥物', o, text: `${o.med_name} ${o.spec}　${o.dose}${o.dose_unit} ${o.route} ${o.freq}${o.prn ? '(PRN)' : ''} × ${o.days}天　共${o.total_qty}${o.dose_unit}` }));
  DB.where('lab_orders', o => o.encounter_id === encId).forEach(o => out.push({ kind: 'lab', kindName: '檢驗', o, text: `${o.panel_name}（${o.specimen_type}）${o.priority !== '一般' ? '【' + o.priority + '】' : ''}` }));
  DB.where('radiology_orders', o => o.encounter_id === encId).forEach(o => out.push({ kind: 'rad', kindName: '影像', o, text: `${o.exam_name}　目的：${o.reason}` }));
  DB.where('procedures', o => o.encounter_id === encId).forEach(o => out.push({ kind: 'proc', kindName: '處置', o, text: `${o.proc_type}：${o.detail}` }));
  return out.sort((a, b) => a.o.ordered_at.localeCompare(b.o.ordered_at));
};
S.pendSign = (encId) => { need('cpoe'); HIS.encOrders(encId).filter(x => x.o.status === ST.DRAFT).forEach(x => DB.update(OT[x.kind], x.o.id, { status: ST.PEND })); audit('UPDATE', 'encounters', encId, '醫囑轉待簽署', DB.get('encounters', encId).patient_id); };
S.signSendOrders = encId => {
  need('sign'); const u = me(), e = DB.get('encounters', encId); let n = 0;
  HIS.encOrders(encId).filter(x => x.o.status === ST.DRAFT || x.o.status === ST.PEND).forEach(x => {
    const t = OT[x.kind], id = x.o.id;
    DB.update(t, id, { status: ST.SIGNED, signed_by: u.id, signed_at: HIS.now() }); audit('SIGN', t, id, '醫囑簽署', e.patient_id);
    send(x.kind, id, e); n++;
  });
  if (!n) err('沒有可簽署的醫囑'); return n;
};
function send(kind, id, e) {
  const t = OT[kind], o = DB.get(t, id), at = HIS.now();
  if (kind === 'med') {
    DB.update(t, id, { status: ST.SENT, sent_at: at });
    DB.insert('prescriptions', { order_id: id, patient_id: o.patient_id, encounter_id: o.encounter_id, med_code: o.med_code, qty: o.total_qty, returned_qty: 0, status: '待審核', priority: o.priority, created_at: at });
  } else if (kind === 'rad') DB.update(t, id, { status: ST.SENT, sent_at: at, exam_status: '待排程' });
  else DB.update(t, id, { status: ST.SENT, sent_at: at });
  audit('SEND', t, id, '醫囑送出', e.patient_id);
}
S.cancelOrder = (kind, id, reason) => {
  need('cpoe'); const t = OT[kind], o = DB.get(t, id);
  if (!reason || !reason.trim()) err('取消醫囑須填寫原因');
  if ([ST.RUN, ST.DONE, ST.CANCEL].includes(o.status)) err('此醫囑狀態為「' + o.status + '」，無法取消');
  if (kind === 'med') { const rx = DB.one('prescriptions', r => r.order_id === id); if (rx && rx.status !== '待審核') err('藥局已開始處理此處方，請聯絡藥局退藥'); if (rx) DB.update('prescriptions', rx.id, { status: '已取消' }); }
  if (kind === 'rad' && o.exam_status !== '待排程' && o.exam_status !== '未送出') err('影像檢查已排程/進行，無法取消');
  DB.update(t, id, { status: ST.CANCEL, cancel_reason: reason, cancelled_by: me().id, cancelled_at: HIS.now() });
  audit('CANCEL', t, id, reason, o.patient_id);
};

/* ---------- 藥局 ---------- */
HIS.stockOf = code => DB.where('inventory', i => i.med_code === code).reduce((s, i) => s + i.qty, 0);
S.rxReview = id => {
  need('pharm'); const rx = DB.get('prescriptions', id); if (rx.status !== '待審核') err('處方狀態不是待審核');
  const m = DB.one('medications', x => x.code === rx.med_code), o = DB.get('medication_orders', rx.order_id);
  const al = HIS.checkAllergy(rx.patient_id, m);
  if (al.some(a => a.level === '禁忌') && !o.allergy_override) err('藥師審核：過敏禁忌且醫師未提供覆核原因，請退回處方');
  DB.update('prescriptions', id, { status: '待調劑', reviewed_by: me().id, reviewed_at: HIS.now() }); audit('REVIEW', 'prescriptions', id, '藥師審核通過', rx.patient_id);
};
S.rxRejectToDoctor = (id, reason) => {
  need('pharm'); if (!reason) err('須填寫退回原因'); const rx = DB.get('prescriptions', id); if (rx.status !== '待審核') err('僅待審核處方可退回');
  DB.update('prescriptions', id, { status: '已取消', note: '藥師退回：' + reason }); DB.update('medication_orders', rx.order_id, { status: ST.CANCEL, cancel_reason: '藥師退回：' + reason, cancelled_by: me().id, cancelled_at: HIS.now() });
  const o = DB.get('medication_orders', rx.order_id); msg(o.ordered_by, `處方被藥師退回：${o.med_name}（${HIS.pt(o.patient_id).name}）原因：${reason}`, o.id); audit('REJECT', 'prescriptions', id, reason, rx.patient_id);
};
S.rxDispense = id => { // 調劑：依效期先出(FEFO)扣庫存並記錄批號
  need('pharm'); const rx = DB.get('prescriptions', id); if (rx.status !== '待調劑') err('處方須先審核（狀態：' + rx.status + '）');
  if (HIS.stockOf(rx.med_code) < rx.qty) err(`庫存不足：需 ${rx.qty}，現有 ${HIS.stockOf(rx.med_code)}`);
  let need_ = rx.qty; const lots = DB.where('inventory', i => i.med_code === rx.med_code && i.qty > 0 && i.expiry >= HIS.today()).sort((a, b) => a.expiry.localeCompare(b.expiry));
  if (lots.reduce((s, l) => s + l.qty, 0) < rx.qty) err('有效期限內庫存不足（過期批號不得調劑）');
  lots.forEach(l => { if (need_ <= 0) return; const q = Math.min(l.qty, need_); DB.update('inventory', l.id, { qty: l.qty - q }); DB.insert('pharmacy_dispensing', { prescription_id: id, patient_id: rx.patient_id, med_code: rx.med_code, lot_no: l.lot_no, inventory_id: l.id, qty: q, type: '調劑', by: me().id, at: HIS.now() }); need_ -= q; });
  DB.update('prescriptions', id, { status: '已調劑', dispensed_by: me().id, dispensed_at: HIS.now() }); DB.update('medication_orders', rx.order_id, { status: ST.RUN });
  audit('DISPENSE', 'prescriptions', id, '調劑 ' + rx.qty, rx.patient_id);
};
S.rxHandOut = id => {
  need('pharm'); const rx = DB.get('prescriptions', id); if (rx.status !== '已調劑') err('須先完成調劑');
  DB.update('prescriptions', id, { status: '已發藥', handed_by: me().id, handed_at: HIS.now() }); DB.update('medication_orders', rx.order_id, { status: ST.DONE, completed_at: HIS.now() });
  DB.insert('pharmacy_dispensing', { prescription_id: id, patient_id: rx.patient_id, med_code: rx.med_code, lot_no: '', qty: rx.qty, type: '發藥', by: me().id, at: HIS.now() });
  const o = DB.get('medication_orders', rx.order_id); msg(o.ordered_by, `${HIS.pt(rx.patient_id).name} 的 ${o.med_name} 已發藥`, o.id); audit('HANDOUT', 'prescriptions', id, '完成發藥', rx.patient_id);
};
S.rxReturn = (id, qty, reason) => {
  need('pharm'); const rx = DB.get('prescriptions', id); qty = parseInt(qty); if (rx.status !== '已發藥') err('僅已發藥處方可退藥');
  if (!(qty > 0) || qty > rx.qty - rx.returned_qty) err('退藥數量不正確（最多 ' + (rx.qty - rx.returned_qty) + '）'); if (!reason) err('須填寫退藥原因');
  const lot = DB.where('pharmacy_dispensing', d => d.prescription_id === id && d.type === '調劑')[0];
  if (lot && lot.inventory_id) { const inv = DB.get('inventory', lot.inventory_id); DB.update('inventory', inv.id, { qty: inv.qty + qty }); }
  DB.insert('pharmacy_dispensing', { prescription_id: id, patient_id: rx.patient_id, med_code: rx.med_code, lot_no: lot ? lot.lot_no : '', inventory_id: lot ? lot.inventory_id : null, qty, type: '退藥', reason, by: me().id, at: HIS.now() });
  DB.update('prescriptions', id, { returned_qty: rx.returned_qty + qty }); audit('RETURN', 'prescriptions', id, `退藥 ${qty}：${reason}`, rx.patient_id);
};
S.addStock = (code, lot, expiry, qty) => {
  need('pharm'); qty = parseInt(qty); if (!DB.one('medications', m => m.code === code)) err('藥品代碼不存在'); if (!lot || !expiry || !(qty > 0)) err('批號、效期、數量必填');
  const i = DB.insert('inventory', { med_code: code, lot_no: lot, expiry, qty, location: '藥庫', received_at: HIS.now() }); audit('CREATE', 'inventory', i.id, `進貨 ${code} ${lot} ×${qty}`); return i;
};

/* ---------- 檢驗 LIS ---------- */
HIS.refFor = (a, p) => { const f = p.sex === 'F'; return { lo: f ? a.lo_f : a.lo_m, hi: f ? a.hi_f : a.hi_m }; };
HIS.flagOf = (a, v, lo, hi) => {
  if (a.type === 'q') { const norm = (a.normal || '').split('/'); return norm.includes(String(v).trim()) ? 'N' : 'A'; }
  const n = parseFloat(v); if (isNaN(n)) return '';
  if (a.crit_hi != null && n >= a.crit_hi) return 'HH'; if (a.crit_lo != null && n <= a.crit_lo) return 'LL';
  if (hi != null && n > hi) return 'H'; if (lo != null && n < lo) return 'L'; return 'N';
};
S.receiveSpecimen = (orderId, { collected_at, specimen_type }) => {
  need('lab'); const o = DB.get('lab_orders', orderId); if (o.status !== ST.SENT) err('醫囑狀態不是「已送出」，無法收件');
  if (!collected_at) err('請輸入採檢時間'); const now = HIS.now(); if (collected_at.slice(0, 16) > now.slice(0, 16)) err('採檢時間不可晚於現在');
  if (collected_at.slice(0, 16) < o.sent_at.slice(0, 16)) err('採檢時間不可早於醫囑送出時間');
  const sp = DB.insert('specimens', { lab_order_id: orderId, patient_id: o.patient_id, barcode: 'S' + Date.now().toString().slice(-9) + Math.floor(Math.random() * 90 + 10), type: specimen_type || o.specimen_type, collected_at, received_at: now, collected_by: me().id, received_by: me().id, status: '已接收' });
  DB.update('lab_orders', orderId, { status: ST.RUN, specimen_id: sp.id, report_status: '檢驗中' }); audit('RECEIVE', 'specimens', sp.id, o.panel_name, o.patient_id); return sp;
};
S.rejectSpecimen = (orderId, reason) => { need('lab'); const o = DB.get('lab_orders', orderId); if (!reason) err('須填寫原因'); DB.update('lab_orders', orderId, { status: ST.CANCEL, cancel_reason: '檢驗科退件：' + reason }); msg(o.ordered_by, `檢驗退件：${o.panel_name}（${HIS.pt(o.patient_id).name}）${reason}`, o.id); audit('REJECT', 'lab_orders', orderId, reason, o.patient_id); };
S.saveLabResults = (orderId, vals) => { // vals: {analyte_code:{value,lo,hi}}
  need('lab'); const o = DB.get('lab_orders', orderId), p = HIS.pt(o.patient_id); if (o.status !== ST.RUN) err('須先接收檢體'); if (o.report_status === '已發布') err('報告已發布');
  const panel = DB.one('lab_panels', x => x.code === o.panel_code); let cnt = 0;
  panel.analytes.forEach(ac => {
    const a = DB.one('lab_items', x => x.code === ac), v = vals[ac]; if (!v || String(v.value).trim() === '') return;
    if (a.type !== 'q' && isNaN(parseFloat(v.value))) err(`${a.name} 必須為數值`);
    const ref = HIS.refFor(a, p), lo = v.lo !== undefined && v.lo !== '' ? parseFloat(v.lo) : ref.lo, hi = v.hi !== undefined && v.hi !== '' ? parseFloat(v.hi) : ref.hi;
    const row = { lab_order_id: orderId, patient_id: o.patient_id, analyte: ac, name: a.name, value: String(v.value).trim(), unit: a.unit, ref_lo: lo == null ? null : lo, ref_hi: hi == null ? null : hi, ref_text: a.normal || '', flag: HIS.flagOf(a, v.value, lo, hi), entered_by: me().id, entered_at: HIS.now() };
    const ex = DB.one('lab_results', r => r.lab_order_id === orderId && r.analyte === ac);
    if (ex) DB.update('lab_results', ex.id, row); else DB.insert('lab_results', row); cnt++;
  });
  if (!cnt) err('尚未輸入任何結果'); DB.update('lab_orders', orderId, { report_status: '輸入中' }); audit('UPDATE', 'lab_results', orderId, `輸入結果 ${cnt} 項`, o.patient_id);
};
S.completeLabReport = orderId => {
  need('lab'); const o = DB.get('lab_orders', orderId), panel = DB.one('lab_panels', x => x.code === o.panel_code);
  const have = DB.where('lab_results', r => r.lab_order_id === orderId).map(r => r.analyte), miss = panel.analytes.filter(a => !have.includes(a));
  if (miss.length) err('尚有未輸入的項目：' + miss.join(', ')); if (o.status !== ST.RUN) err('醫囑狀態錯誤');
  DB.update('lab_orders', orderId, { report_status: '已完成報告', completed_by: me().id, report_completed_at: HIS.now() }); audit('COMPLETE', 'lab_orders', orderId, '完成報告', o.patient_id);
};
S.publishLabReport = orderId => {
  need('lab'); const o = DB.get('lab_orders', orderId); if (o.report_status !== '已完成報告') err('須先完成報告才能發布');
  DB.update('lab_orders', orderId, { report_status: '已發布', status: ST.DONE, published_by: me().id, published_at: HIS.now() });
  const rs = DB.where('lab_results', r => r.lab_order_id === orderId), crit = rs.filter(r => r.flag === 'HH' || r.flag === 'LL');
  msg(o.ordered_by, `${crit.length ? '【危急值】' : ''}檢驗報告已發布：${HIS.pt(o.patient_id).name} ${o.panel_name}${crit.length ? ' ' + crit.map(r => r.name + '=' + r.value).join(',') : ''}`, o.id);
  if (crit.length) audit('CRITICAL', 'lab_orders', orderId, '危急值通報 ' + crit.map(r => r.name + '=' + r.value).join(','), o.patient_id);
  audit('PUBLISH', 'lab_orders', orderId, '發布報告', o.patient_id);
};
S.markViewed = (kind, id) => { const t = kind === 'lab' ? 'lab_orders' : 'radiology_orders'; const o = DB.get(t, id); if (o && !o.viewed_at && HIS.can('cpoe')) { DB.update(t, id, { viewed_at: HIS.now(), viewed_by: me().id }); audit('VIEW', t, id, '醫師已閱報告', o.patient_id); } };

/* ---------- 放射 RIS ---------- */
S.radSchedule = (id, { when, room }) => {
  need('rad_exec'); const o = DB.get('radiology_orders', id); if (o.exam_status !== '待排程') err('狀態不是待排程'); if (!when || !room) err('請輸入排程時間與檢查室');
  DB.update('radiology_orders', id, { exam_status: '已排程', scheduled_at: when, room }); audit('UPDATE', 'radiology_orders', id, `排程 ${when} ${room}`, o.patient_id);
};
S.radStart = id => { need('rad_exec'); const o = DB.get('radiology_orders', id); if (o.exam_status !== '已排程') err('須先排程'); DB.update('radiology_orders', id, { exam_status: '檢查中', status: ST.RUN, started_at: HIS.now(), tech_id: me().id }); audit('UPDATE', 'radiology_orders', id, '開始檢查', o.patient_id); };
S.radFinish = id => { need('rad_exec'); const o = DB.get('radiology_orders', id); if (o.exam_status !== '檢查中') err('檢查尚未開始'); DB.update('radiology_orders', id, { exam_status: '待判讀', finished_at: HIS.now() }); audit('UPDATE', 'radiology_orders', id, '檢查完成，待判讀', o.patient_id); };
S.radSaveReport = (id, { findings, impression }) => {
  need('rad_report'); const o = DB.get('radiology_orders', id); if (!['待判讀', '報告完成'].includes(o.exam_status)) err('檢查尚未完成，無法判讀');
  if (!(findings || '').trim() || !(impression || '').trim()) err('Findings 與 Impression 皆為必填');
  let r = DB.one('radiology_reports', x => x.order_id === id);
  if (r && r.status === '已發布') err('報告已發布');
  if (r) DB.update('radiology_reports', r.id, { findings, impression, radiologist_id: me().id, reported_at: HIS.now() });
  else r = DB.insert('radiology_reports', { order_id: id, patient_id: o.patient_id, findings, impression, radiologist_id: me().id, reported_at: HIS.now(), status: '草稿' });
  audit('UPDATE', 'radiology_reports', r.id, '儲存影像報告', o.patient_id); return r;
};
S.radPublish = id => {
  need('rad_report'); const o = DB.get('radiology_orders', id), r = DB.one('radiology_reports', x => x.order_id === id); if (!r) err('尚未撰寫報告');
  DB.update('radiology_reports', r.id, { status: '已發布', published_at: HIS.now(), signed_by: me().id }); DB.update('radiology_orders', id, { exam_status: '已發布', status: ST.DONE });
  msg(o.ordered_by, `影像報告已發布：${HIS.pt(o.patient_id).name} ${o.exam_name}`, id); audit('PUBLISH', 'radiology_reports', r.id, '發布影像報告', o.patient_id);
};

/* ---------- 處置執行（護理）/ 會診 ---------- */
S.procExec = (id, note) => {
  need('nurse_exec'); const o = DB.get('procedures', id); if (o.status !== ST.SENT && o.status !== ST.RUN) err('處置狀態不正確');
  if (o.status === ST.SENT) { DB.update('procedures', id, { status: ST.RUN, started_by: me().id, started_at: HIS.now() }); audit('UPDATE', 'procedures', id, '開始執行', o.patient_id); return; }
  DB.update('procedures', id, { status: ST.DONE, executed_by: me().id, executed_at: HIS.now(), result_note: note || '' }); audit('COMPLETE', 'procedures', id, '處置完成 ' + (note || ''), o.patient_id);
};
S.addConsult = (encId, { to_dept, reason, urgency }) => {
  need('consult'); const e = DB.get('encounters', encId); if (!to_dept || !(reason || '').trim()) err('請選擇會診科別並填寫會診原因');
  if (to_dept === e.dept_id) err('不可會診本科');
  const c = DB.insert('consultations', { patient_id: e.patient_id, encounter_id: encId, from_dept: e.dept_id, from_doctor: me().id, to_dept, reason, urgency: urgency || '一般', status: '已送出', sent_at: HIS.now() });
  DB.where('users', u => u.dept_id === to_dept && DB.get('roles', u.role_id).perms.includes('consult')).forEach(u => msg(u.id, `新會診申請：${HIS.pt(e.patient_id).name}（${HIS.deptName(e.dept_id)}）`, c.id)); audit('CREATE', 'consultations', c.id, '會診 ' + HIS.deptName(to_dept), e.patient_id); return c;
};
S.replyConsult = (id, reply) => {
  need('consult'); const c = DB.get('consultations', id); if (!(reply || '').trim()) err('請輸入會診回覆');
  if (me().dept_id !== c.to_dept && !HIS.can('*')) err('非受會診科別醫師');
  DB.update('consultations', id, { status: '已完成', reply, replied_by: me().id, replied_at: HIS.now() }); msg(c.from_doctor, `會診已回覆：${HIS.pt(c.patient_id).name}`, id); audit('UPDATE', 'consultations', id, '會診回覆', c.patient_id);
};

/* ---------- 住院 IPD / ADT ---------- */
HIS.bedAdm = bedId => DB.one('admissions', a => a.bed_id === bedId && a.status !== '已出院');
S.requestAdmission = (encId, d) => {
  need('ipd'); const e = DB.get('encounters', encId), u = me();
  if (DB.one('admissions', a => a.patient_id === e.patient_id && ['入院申請', '住院中', '出院準備'].includes(a.status))) err('此病人已有進行中的住院/入院申請');
  if (!d.dept_id || !(d.dx || '').trim() || !(d.reason || '').trim()) err('入院科別、入院診斷、入院原因必填');
  const a = DB.insert('admissions', { patient_id: e.patient_id, source_encounter_id: encId, dept_id: d.dept_id, attending_id: d.attending_id || u.id, resident_id: d.resident_id || null, admit_dx: d.dx, reason: d.reason, ward_pref: d.ward_pref || '', status: '入院申請', requested_at: HIS.now(), requested_by: u.id });
  audit('CREATE', 'admissions', a.id, '入院申請 ' + d.dx, e.patient_id); return a;
};
S.assignBed = (admId, bedId) => {
  need('adt'); const a = DB.get('admissions', admId), b = DB.get('beds', bedId); if (a.status !== '入院申請') err('僅入院申請可分配床位');
  if (b.status !== '空床') err('床位狀態為「' + b.status + '」，無法分配');
  const e = DB.insert('encounters', { patient_id: a.patient_id, type: 'IPD', dept_id: a.dept_id, doctor_id: a.attending_id, admission_id: admId, start_time: HIS.now(), end_time: null, status: '進行中' });
  DB.update('admissions', admId, { status: '住院中', bed_id: bedId, ward_id: b.ward_id, admit_time: HIS.now(), encounter_id: e.id }); DB.update('beds', bedId, { status: '使用中' });
  DB.insert('medical_records', { patient_id: a.patient_id, encounter_id: e.id, admission_id: admId, type: '入院病歷', status: '草稿', version: 1, cc: '', hpi: '', pmh: '', fh: '', sh: '', ros: '', pe: '', assessment: '', plan: '', created_at: HIS.now(), created_by: a.attending_id, updated_at: HIS.now(), updated_by: a.attending_id });
  DB.insert('diagnoses', { patient_id: a.patient_id, encounter_id: e.id, admission_id: admId, icd_code: '', zh: a.admit_dx, en: '', type: '主要', status: '確診', scope: '入院診斷', date: HIS.today(), doctor_id: a.attending_id });
  msg(a.attending_id, `病人 ${HIS.pt(a.patient_id).name} 已入住 ${bedId}`, admId); audit('ADMIT', 'admissions', admId, '入住 ' + bedId, a.patient_id); return e;
};
S.setBed = (bedId, st) => {
  if (!HIS.can('bed')) err('權限不足'); const b = DB.get('beds', bedId); if (b.status === '使用中') err('使用中床位不可直接變更，請辦理出院/轉床');
  if (!['空床', '清潔中', '保留床', '維修中'].includes(st)) err('狀態不正確'); DB.update('beds', bedId, { status: st }); audit('UPDATE', 'beds', bedId, `床位狀態 ${b.status}→${st}`);
};
S.dischargePrep = admId => { need('ipd'); const a = DB.get('admissions', admId); if (a.status !== '住院中') err('僅住院中可進入出院準備'); DB.update('admissions', admId, { status: '出院準備', discharge_plan_at: HIS.now() }); audit('UPDATE', 'admissions', admId, '出院準備', a.patient_id); };
S.discharge = (admId, { dx, disposition }) => {
  need('ipd'); const a = DB.get('admissions', admId); if (!['住院中', '出院準備'].includes(a.status)) err('此住院狀態無法出院');
  const ds = DB.one('medical_records', r => r.admission_id === admId && r.type === '出院病歷' && r.status === '已簽署');
  if (!ds) err('須先完成並簽署「出院病歷」才能辦理出院'); if (!(dx || '').trim()) err('請輸入出院診斷');
  const open = [...DB.all('lab_orders'), ...DB.all('radiology_orders'), ...DB.all('procedures')].filter(o => o.admission_id === admId && [ST.DRAFT, ST.PEND, ST.SIGNED].includes(o.status));
  if (open.length) err(`尚有 ${open.length} 筆未送出的醫囑`);
  DB.update('admissions', admId, { status: '已出院', discharge_time: HIS.now(), discharge_dx: dx, disposition: disposition || '出院返家' });
  DB.update('beds', a.bed_id, { status: '清潔中' }); if (a.encounter_id) DB.update('encounters', a.encounter_id, { status: '完成', end_time: HIS.now() });
  DB.where('medication_orders', o => o.admission_id === admId && [ST.SENT, ST.RUN].includes(o.status)).forEach(o => { DB.update('medication_orders', o.id, { status: ST.CANCEL, cancel_reason: '出院自動停止' }); });
  audit('DISCHARGE', 'admissions', admId, '出院 ' + dx, a.patient_id);
};

/* ---------- 急診 ER ---------- */
HIS.TRIAGE = { 1: '第1級 復甦急救', 2: '第2級 危急', 3: '第3級 緊急', 4: '第4級 次緊急', 5: '第5級 非緊急' };
S.erRegister = ({ patient_id, triage, cc, vitals }) => {
  need('er'); const u = me(); if (!patient_id) err('請選擇病人'); if (!(cc || '').trim()) err('請輸入檢傷主訴');
  if (DB.one('encounters', e => e.patient_id === patient_id && e.type === 'ER' && e.status !== '完成')) err('此病人已有進行中的急診就診');
  const e = DB.insert('encounters', { patient_id, type: 'ER', dept_id: 'DEP-ER', doctor_id: u.dept_id === 'DEP-ER' && HIS.can('opd') ? u.id : null, start_time: HIS.now(), end_time: null, status: '進行中', triage_level: Number(triage), er_status: '候診', triage_cc: cc });
  if (vitals) { try { S.addVitals(e.id, vitals); } catch (x) { /* 檢傷時生命徵象可略 */ } }
  audit('CREATE', 'encounters', e.id, `急診檢傷 第${triage}級 ${cc}`, patient_id); return e;
};
S.erTake = encId => {
  need('opd'); const e = DB.get('encounters', encId), u = me(); if (e.type !== 'ER') err('非急診就診');
  DB.update('encounters', encId, { doctor_id: u.id, er_status: '診治中' });
  if (!HIS.encRecord(encId)) DB.insert('medical_records', { patient_id: e.patient_id, encounter_id: encId, type: '急診病歷', status: '草稿', version: 1, cc: e.triage_cc || '', hpi: '', pmh: '', fh: '', sh: '', ros: '', pe: '', assessment: '', plan: '', created_at: HIS.now(), created_by: u.id, updated_at: HIS.now(), updated_by: u.id });
  audit('UPDATE', 'encounters', encId, '急診醫師接診', e.patient_id);
};
S.erDispose = (encId, kind, d) => {
  need('er'); const e = DB.get('encounters', encId);
  if (kind === '留觀') { DB.update('encounters', encId, { er_status: '留觀', obs_since: HIS.now() }); audit('UPDATE', 'encounters', encId, '轉留觀', e.patient_id); }
  else if (kind === '轉住院') { const a = S.requestAdmission(encId, d); DB.update('encounters', encId, { er_status: '轉住院' }); return a; }
  else if (kind === '離院') { S.completeEncounter(encId); DB.update('encounters', encId, { er_status: '離院' }); }
  else err('處置類型不正確');
};

/* ---------- 其他：病人用藥紀錄 / 工作清單 ---------- */
S.medRecord = pid => DB.where('prescriptions', r => r.patient_id === pid && ['已發藥', '已調劑'].includes(r.status));
S.unreadMsgs = () => DB.where('messages', m => m.to_user === me().id && !m.read);
S.worklist = () => {
  const u = me(), out = [], c = (t, f) => DB.where(t, f).length, T = HIS.today();
  if (HIS.can('opd')) {
    out.push(['今日門診候診（本科）', c('appointments', a => a.date === T && a.dept_id === u.dept_id && ['已掛號', '候診中'].includes(a.status)), 'opd']);
    out.push(['未閱檢驗/影像報告', c('lab_orders', o => o.ordered_by === u.id && o.report_status === '已發布' && !o.viewed_at) + c('radiology_orders', o => o.ordered_by === u.id && o.exam_status === '已發布' && !o.viewed_at), 'results']);
    out.push(['待簽署病歷', c('medical_records', r => r.created_by === u.id && r.status !== '已簽署'), 'opd']);
    out.push(['待回覆會診', c('consultations', x => x.to_dept === u.dept_id && x.status === '已送出'), 'consult']);
    out.push(['急診候診', c('encounters', e => e.type === 'ER' && e.status === '進行中' && e.er_status === '候診'), 'er']);
  }
  if (HIS.can('pharm')) { out.push(['待審核處方', c('prescriptions', r => r.status === '待審核'), 'pharm']); out.push(['待調劑', c('prescriptions', r => r.status === '待調劑'), 'pharm']); out.push(['待發藥', c('prescriptions', r => r.status === '已調劑'), 'pharm']); }
  if (HIS.can('lab')) { out.push(['待收件檢驗', c('lab_orders', o => o.status === ST.SENT), 'lab']); out.push(['檢驗中', c('lab_orders', o => o.status === ST.RUN), 'lab']); }
  if (HIS.can('rad_exec')) { out.push(['待排程影像', c('radiology_orders', o => o.exam_status === '待排程'), 'rad']); out.push(['已排程/檢查中', c('radiology_orders', o => ['已排程', '檢查中'].includes(o.exam_status)), 'rad']); }
  if (HIS.can('rad_report')) out.push(['待判讀', c('radiology_orders', o => o.exam_status === '待判讀'), 'rad']);
  if (HIS.can('nurse_exec')) out.push(['待執行處置', c('procedures', o => [ST.SENT, ST.RUN].includes(o.status)), 'nurse']);
  if (HIS.can('adt')) { out.push(['待分床入院申請', c('admissions', a => a.status === '入院申請'), 'adt']); out.push(['今日掛號數', c('appointments', a => a.date === T), 'reg']); }
  if (HIS.can('bed')) out.push(['清潔中床位', c('beds', b => b.status === '清潔中'), 'beds']);
  return out;
};

/* ---------- 資料一致性檢查 ---------- */
S.consistency = () => {
  const R = [], chk = (name, bad) => R.push({ name, ok: bad.length === 0, bad: bad.slice(0, 20), n: bad.length });
  const ids = t => new Set(DB.all(t).map(r => r.id)), pts = ids('patients'), encs = ids('encounters'), usr = ids('users');
  chk('encounters.patient_id 皆存在於 patients', DB.all('encounters').filter(e => !pts.has(e.patient_id)).map(e => e.id));
  chk('encounters.doctor_id 皆存在於 users（急診待接診除外）', DB.all('encounters').filter(e => e.doctor_id && !usr.has(e.doctor_id)).map(e => e.id));
  for (const t of ['diagnoses', 'medical_records', 'vital_signs', 'medication_orders', 'lab_orders', 'radiology_orders', 'procedures', 'consultations'])
    chk(`${t}.encounter_id 皆存在`, DB.all(t).filter(r => !encs.has(r.encounter_id)).map(r => r.id));
  chk('medical_records 病人與就診病人一致', DB.all('medical_records').filter(r => encs.has(r.encounter_id) && DB.get('encounters', r.encounter_id).patient_id !== r.patient_id).map(r => r.id));
  chk('已簽署病歷皆有對應版本紀錄', DB.all('medical_records').filter(r => r.status === '已簽署' && !DB.one('record_versions', v => v.record_id === r.id && v.version === r.version)).map(r => r.id));
  chk('已發藥處方皆有調劑與發藥紀錄', DB.all('prescriptions').filter(r => r.status === '已發藥' && (!DB.one('pharmacy_dispensing', d => d.prescription_id === r.id && d.type === '調劑') || !DB.one('pharmacy_dispensing', d => d.prescription_id === r.id && d.type === '發藥'))).map(r => r.id));
  chk('每筆已送出藥物醫囑皆有處方', DB.all('medication_orders').filter(o => [ST.SENT, ST.RUN, ST.DONE].includes(o.status) && !DB.one('prescriptions', r => r.order_id === o.id)).map(o => o.id));
  chk('庫存數量不得為負', DB.all('inventory').filter(i => i.qty < 0).map(i => i.id));
  chk('已發布檢驗報告皆有結果且有檢體', DB.all('lab_orders').filter(o => o.report_status === '已發布' && (!DB.one('lab_results', r => r.lab_order_id === o.id) || !o.specimen_id)).map(o => o.id));
  chk('lab_results.flag 與數值/參考區間相符', DB.all('lab_results').filter(r => { const a = DB.one('lab_items', x => x.code === r.analyte); return a && r.flag !== HIS.flagOf(a, r.value, r.ref_lo, r.ref_hi); }).map(r => r.id));
  chk('已發布影像報告皆有報告內容', DB.all('radiology_orders').filter(o => o.exam_status === '已發布' && !DB.one('radiology_reports', r => r.order_id === o.id && r.status === '已發布')).map(o => o.id));
  chk('使用中床位皆對應一筆住院中病人', DB.all('beds').filter(b => b.status === '使用中' && !HIS.bedAdm(b.id)).map(b => b.id));
  chk('住院中病人床位狀態必為使用中', DB.all('admissions').filter(a => ['住院中', '出院準備'].includes(a.status) && DB.get('beds', a.bed_id).status !== '使用中').map(a => a.id));
  chk('一床僅能有一位住院中病人', (() => { const m = {}; DB.all('admissions').filter(a => ['住院中', '出院準備'].includes(a.status)).forEach(a => { m[a.bed_id] = (m[a.bed_id] || 0) + 1; }); return Object.keys(m).filter(k => m[k] > 1); })());
  chk('同一就診不得有多個主要診斷', (() => { const m = {}; DB.all('diagnoses').filter(d => d.type === '主要' && d.status !== '已刪除' && !d.scope).forEach(d => { m[d.encounter_id] = (m[d.encounter_id] || 0) + 1; }); return Object.keys(m).filter(k => m[k] > 1); })());
  chk('已簽署醫囑皆有簽署者與時間', [...DB.all('medication_orders'), ...DB.all('lab_orders'), ...DB.all('radiology_orders'), ...DB.all('procedures')].filter(o => [ST.SENT, ST.RUN, ST.DONE].includes(o.status) && (!o.signed_by || !o.signed_at) && !o.legacy).map(o => o.id));
  chk('稽核紀錄不為空且涵蓋登入', DB.all('audit_logs').length ? [] : ['audit_logs 為空']);
  return R;
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
