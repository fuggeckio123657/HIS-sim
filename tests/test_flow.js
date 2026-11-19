const vm=require('vm'),fs=require('fs');global.localStorage=undefined;
for(const f of ['core','seed'])vm.runInThisContext(fs.readFileSync(`../src/${f}.js`,'utf8'),{filename:f});
HIS.seed();const {DB,svc:S}=HIS;let n=0;const ok=(c,m)=>{n++;console.log((c?'PASS ':'FAIL ')+String(n).padStart(2)+' '+m);if(!c)process.exitCode=1};
const throws=(f,m)=>{try{f();return false}catch(e){console.log('     ↳ 預期錯誤：'+e.message);return true}};
// 1 醫師登入
S.login('D001','1234','OPD-101');ok(HIS.session.user.name==='陳志明','1 醫師登入 '+HIS.session.user.name);
throws(()=>S.login('D001','bad','OPD-101'),'');S.login('D001','1234','OPD-101');
// 2 查詢病人（今日掛號者）
const appt=DB.where('appointments',a=>a.date===HIS.today()&&a.dept_id==='DEP-IM'&&['已掛號','候診中'].includes(a.status))[0];
const pt=HIS.pt(appt.patient_id);const rs=S.searchPatients({chart:pt.chart_no});ok(rs.length===1&&rs[0].id===pt.id,'2 以病歷號查詢病人 '+pt.name+' '+pt.chart_no);
// 3 歷史病歷
const hist=DB.where('medical_records',r=>r.patient_id===pt.id&&r.status==='已簽署');ok(hist.length>0,'3 歷史病歷 '+hist.length+' 份，歷史處方 '+DB.where('medication_orders',o=>o.patient_id===pt.id).length+' 筆，歷史檢驗 '+DB.where('lab_orders',o=>o.patient_id===pt.id).length+' 筆');
// 4 開始看診
const enc=S.startVisit(appt.id);ok(enc.status==='進行中'&&DB.get('appointments',appt.id).status==='看診中','4 建立門診紀錄 '+enc.id);
// 完成就診前置檢查
ok(throws(()=>S.completeEncounter(enc.id),''),'  未簽署/無診斷不可完成就診');
// 5 SOAP
const rec=HIS.encRecord(enc.id);S.saveRecord(rec.id,{cc:'頭暈、倦怠兩週',hpi:'兩週來頭暈、容易疲倦，無胸痛。',pmh:'高血壓',fh:'父親高血壓',sh:'不吸菸',ros:'無發燒，無噁心',pe:'結膜略蒼白，心肺聽診正常',assessment:'疑貧血，待查',plan:'抽血檢查，補充鐵劑，兩週後回診'});ok(DB.get('medical_records',rec.id).cc.includes('頭暈'),'5 輸入 SOAP');
S.addVitals(enc.id,{bp_sys:132,bp_dia:84,hr:88,rr:18,temp:36.7,spo2:98});
ok(throws(()=>S.addVitals(enc.id,{bp_sys:80,bp_dia:120}),''),'  生命徵象驗證（收縮壓<舒張壓被拒）');
// 6 診斷
S.addDx(enc.id,{icd_code:'D64.9',type:'主要',status:'疑似'});S.addDx(enc.id,{icd_code:'I10',type:'次要',status:'慢性'});ok(DB.where('diagnoses',d=>d.encounter_id===enc.id).length===2,'6 建立診斷（主要 D64.9／次要 I10）');
ok(throws(()=>S.addDx(enc.id,{icd_code:'E03.9',type:'主要'}),''),'  重複主要診斷被拒');
// 7 藥物處方（含過敏檢查）
const ferrous=DB.one('medications',m=>m.ingredient==='Ferrous fumarate');
const mo=S.addMedOrder(enc.id,{med_code:ferrous.code,dose:1,route:'PO',freq:'BID',days:14});ok(mo.total_qty===28&&mo.status==='草稿','7 開立藥物處方 '+mo.med_name+' 總量 '+mo.total_qty);
ok(throws(()=>S.addMedOrder(enc.id,{med_code:ferrous.code,dose:1,route:'PO',freq:'BID',days:14}),''),'  重複藥品被拒');
// 過敏攔截：替病人加入盤尼西林過敏後開立 Amoxicillin
S.addAllergy(pt.id,{allergen:'盤尼西林',allergen_class:'penicillin',reaction:'皮疹',severity:'中度'});
const amox=DB.one('medications',m=>m.ingredient==='Amoxicillin');ok(throws(()=>S.addMedOrder(enc.id,{med_code:amox.code,dose:1,route:'PO',freq:'TID',days:5}),''),'  過敏攔截（盤尼西林 vs Amoxicillin）');
// 8 CBC
const lo=S.addLabOrder(enc.id,{panel_code:'CBC',priority:'一般'});ok(lo.panel_name==='全血球計數','8 開立 CBC '+lo.id);
// 送出
const sent=S.signSendOrders(enc.id);ok(sent===2&&DB.get('medication_orders',mo.id).status==='已送出'&&DB.get('lab_orders',lo.id).status==='已送出','  簽署並送出醫囑 '+sent+' 筆');
// 9 藥局
S.logout();S.login('PH001','1234','PHAR-01');const rx=DB.one('prescriptions',r=>r.order_id===mo.id);ok(rx&&rx.status==='待審核','9 藥局收到處方 '+rx.id);
// 10 藥師調劑
const stock0=HIS.stockOf(rx.med_code);ok(throws(()=>S.rxDispense(rx.id),''),'  未審核不可調劑');
S.rxReview(rx.id);S.rxDispense(rx.id);S.rxHandOut(rx.id);ok(DB.get('prescriptions',rx.id).status==='已發藥'&&HIS.stockOf(rx.med_code)===stock0-28&&DB.get('medication_orders',mo.id).status==='已完成','10 藥師審核→調劑→發藥，庫存 '+stock0+'→'+HIS.stockOf(rx.med_code)+'，醫囑已完成');
S.rxReturn(rx.id,3,'病人拒絕服用');ok(HIS.stockOf(rx.med_code)===stock0-25,'  退藥 3，庫存回補');
// 11-12 檢驗
S.logout();S.login('LAB001','1234','LAB-01');ok(DB.get('lab_orders',lo.id).status==='已送出','11 檢驗科收到 CBC 申請');
S.receiveSpecimen(lo.id,{collected_at:HIS.now()});
ok(throws(()=>S.completeLabReport(lo.id),''),'  未輸入結果不可完成報告');
S.saveLabResults(lo.id,{WBC:{value:'6.8'},RBC:{value:'3.9'},HB:{value:'8.9'},HCT:{value:'28'},MCV:{value:'68'},MCH:{value:'22'},PLT:{value:'2'+'80'}});
const rr=DB.where('lab_results',r=>r.lab_order_id===lo.id);const hb=rr.find(r=>r.analyte==='HB');ok(rr.length===7&&hb.flag==='L'||hb.flag==='LL','12 檢驗師輸入結果，Hb 8.9 標示 '+hb.flag+'（女/男參考區間 '+hb.ref_lo+'–'+hb.ref_hi+'）');
S.completeLabReport(lo.id);ok(DB.get('lab_orders',lo.id).report_status==='已完成報告','  完成報告');
ok(DB.get('lab_orders',lo.id).status==='執行中','  發布前醫師端尚未可見（狀態仍為執行中）');
S.publishLabReport(lo.id);ok(DB.get('lab_orders',lo.id).status==='已完成','  發布報告');
// 13 醫師看結果
S.logout();S.login('D001','1234','OPD-101');const unread=S.unreadMsgs();ok(unread.some(m=>m.text.includes('檢驗報告已發布')),'13 醫師收到報告通知：'+unread.filter(m=>m.text.includes('檢驗')).map(m=>m.text)[0]);
S.markViewed('lab',lo.id);ok(DB.get('lab_orders',lo.id).viewed_by==='U-D001','  醫師已閱紀錄');
// 14 簽署與完成
ok(throws(()=>S.completeEncounter(enc.id),''),'  病歷未簽署不可完成就診');
S.signRecord(rec.id);ok(DB.get('medical_records',rec.id).status==='已簽署'&&DB.where('record_versions',v=>v.record_id===rec.id).length===1,'14 簽署病歷（v1 版本快照）');
ok(throws(()=>S.saveRecord(rec.id,{plan:'改'},''),''),'  簽署後修改須填修訂原因');
S.saveRecord(rec.id,{plan:'抽血檢查，補充鐵劑，兩週後回診；追蹤 Hb'},'補充追蹤項目');S.signRecord(rec.id);
const vs=DB.where('record_versions',v=>v.record_id===rec.id);ok(vs.length===2&&vs[0].plan!==vs[1].plan,'  修訂後保留 v1 原文與 v2 ('+vs.map(v=>'v'+v.version+':'+v.reason).join('；')+')');
S.completeEncounter(enc.id);ok(DB.get('encounters',enc.id).status==='完成'&&DB.get('appointments',appt.id).status==='已看診','  完成就診');
// 15 稽核
const logs=DB.where('audit_logs',l=>l.patient_id===pt.id);const acts=[...new Set(logs.map(l=>l.action))];ok(logs.length>=15&&['CREATE','SIGN','SEND','DISPENSE','HANDOUT','RECEIVE','PUBLISH','AMEND'].every(a=>acts.includes(a)),'15 稽核紀錄 '+logs.length+' 筆，涵蓋：'+acts.join(',')+'；全院共 '+DB.all('audit_logs').length+' 筆');
const cons=S.consistency();ok(cons.every(c=>c.ok),'  跨模組一致性檢查全數通過（'+cons.length+' 項）');cons.filter(c=>!c.ok).forEach(c=>console.log('     ✗',c.name,c.bad));
// 權限
S.logout();S.login('REG001','1234','REG-01');ok(throws(()=>S.addMedOrder(enc.id,{}),''),'  掛號人員不可開醫囑（權限）');
// 住院流程
S.logout();S.login('D001','1234','OPD-101');
const pt2=DB.all('patients').find(p=>!DB.one('admissions',a=>a.patient_id===p.id&&a.status!=='已出院')&&HIS.ageN(p.birth)>20);
const e2=DB.insert('encounters',{patient_id:pt2.id,type:'ER',dept_id:'DEP-ER',doctor_id:'U-D011',start_time:HIS.now(),status:'進行中',er_status:'診治中'});
const adm=S.requestAdmission(e2.id,{dept_id:'DEP-IM',dx:'肺炎',reason:'喘、發燒'});S.logout();S.login('REG001','1234','REG-01');
const bed=DB.all('beds').find(b=>b.status==='空床'&&b.ward_id==='W-5A');const ie=S.assignBed(adm.id,bed.id);ok(DB.get('beds',bed.id).status==='使用中'&&DB.get('admissions',adm.id).status==='住院中','  住院：申請→分床→入住 '+bed.id);
S.logout();S.login('D001','1234','OPD-101');ok(throws(()=>S.discharge(adm.id,{dx:'肺炎'}),''),'  無出院病歷不可出院');
const ds=S.createRecord(ie.id,'出院病歷');S.saveRecord(ds.id,{cc:'肺炎',assessment:'痊癒',plan:'門診追蹤'});S.signRecord(ds.id);S.discharge(adm.id,{dx:'肺炎',disposition:'出院返家'});ok(DB.get('beds',bed.id).status==='清潔中','  出院後床位轉「清潔中」');
const c2=S.consistency();ok(c2.every(c=>c.ok),'  住院流程後一致性檢查通過');
console.log('\n共',n,'項檢查');
