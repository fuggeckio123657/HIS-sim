const {JSDOM}=require('jsdom'),fs=require('fs');
const html=fs.readFileSync('/home/claude/his/his.html','utf8');
const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',pretendToBeVisual:true,beforeParse(w){w.localStorage.setItem('his.edition','hospital');w.addEventListener('error',e=>errs.push('window.error: '+e.message));const ce=w.console.error;w.console.error=(...a)=>{errs.push('console.error: '+a.map(x=>x&&x.stack||x).join(' '));};}});
const w=dom.window,d=w.document,H=w.HIS,UI=H.UI;let n=0,fail=0;
const ok=(c,m)=>{n++;if(!c)fail++;console.log((c?'PASS ':'FAIL ')+m)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const win=k=>UI.wins[k];
const click=(el)=>{if(!el)throw new Error('找不到元素');el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}))};
const act=(wn,a,id)=>{const x=typeof wn==='string'?win(wn):wn;const el=x.body.querySelector(`[data-act="${a}"]${id?`[data-id="${id}"]`:''}`);if(!el)throw new Error(`視窗 ${x.key} 找不到動作 ${a} ${id||''}`);click(el)};
const setv=(wn,name,v)=>{const x=typeof wn==='string'?win(wn):wn;const el=x.body.querySelector(`[name="${name}"]`);if(!el)throw new Error('找不到欄位 '+name);el.value=v};
const fire=(el,t)=>el.dispatchEvent(new w.Event(t,{bubbles:true}));
const login=async(emp,ws)=>{if(H.session)UI.logout();d.getElementById('lg-emp').value=emp;d.getElementById('lg-pw').value='1234';d.getElementById('lg-ws').value=ws;click(d.getElementById('lg-btn'));await sleep(60);};
const dlgOK=(i=0)=>{const b=d.querySelectorAll('.modal .df button');click(b[i])};
const dlgErr=()=>{const m=d.querySelector('.modal');return m?m.textContent:''};
(async()=>{
 await sleep(100);
 ok(!d.getElementById('login').hidden,'登入畫面顯示；測試帳號表 '+d.querySelectorAll('#lg-demo tbody tr').length+' 列');
 // 錯誤密碼
 d.getElementById('lg-emp').value='D001';d.getElementById('lg-pw').value='x';click(d.getElementById('lg-btn'));ok(d.getElementById('lg-err').textContent.includes('錯誤'),'錯誤密碼顯示錯誤訊息');
 // ===== 逐角色開啟全部視窗，檢查沒有畫面錯誤 =====
 const roles=[['D001','OPD-101'],['D002','OPD-101'],['N001','WARD-5A-01'],['PH001','PHAR-01'],['LAB001','LAB-01'],['RAD001','RAD-01'],['D012','RAD-01'],['REG001','REG-01'],['MR001','MR-01'],['ADM001','IT-01'],['D011','ER-01']];
 for(const [emp,ws] of roles){await login(emp,ws);
  const info=d.getElementById('tb-info').textContent;
  const menus=[...d.querySelectorAll('#menubar .mi')];let opened=0;
  for(const m of menus){const items=[...m.querySelectorAll('.mdd a')];for(const a of items){const t=a.textContent;if(/登出|關於/.test(t))continue;click(a);opened++;await sleep(5);const dl=d.querySelector('.modal');if(dl)dl.remove();}}
  const bad=Object.values(UI.wins).filter(x=>x.body.textContent.includes('畫面載入錯誤'));
  ok(bad.length===0&&info.includes(emp),`${emp} ${info.match(/角色：(\S+)/)[1]}：選單 ${menus.length} 個、開啟 ${opened} 個視窗、${Object.keys(UI.wins).length} 個視窗無錯誤`+(bad.length?' ✗'+bad.map(b=>b.title+':'+b.body.textContent.slice(0,80)):''));
 }
 // ===== 醫師 UI 流程 =====
 await login('D001','OPD-101');UI.closeAll();
 UI.openAppt();await sleep(10);const aw=win('appt');
 const startBtn=[...aw.body.querySelectorAll('[data-act=start]')][0];const apptId=startBtn.dataset.id;const appt=H.DB.get('appointments',apptId);const pt=H.pt(appt.patient_id);
 ok(true,'候診清單顯示 '+aw.body.querySelectorAll('[data-act=start]').length+' 位可看診病人；選擇 '+pt.name);
 UI.openSearch();await sleep(10);setv('search','chart',pt.chart_no);act('search','go');await sleep(10);ok(win('search').body.textContent.includes(pt.name),'病人查詢（病歷號）找到 '+pt.name);
 act('search','open',pt.id);await sleep(10);ok(win('pt:'+pt.id).body.textContent.includes('過敏史')&&win('pt:'+pt.id).body.textContent.includes('就診紀錄'),'病人資料視窗（基本資料/過敏/病史/就診紀錄）');
 click(startBtn);await sleep(20);const encId=Object.keys(UI.wins).find(k=>k.startsWith('ws:')).slice(3);const ws=win('ws:'+encId);ok(!!ws,'開始看診 → 工作區 '+encId);
 act(ws,'tab','hist');ok(ws.body.textContent.includes('過去診斷')&&ws.body.textContent.includes('過去處方'),'歷史就診頁：過去病歷/診斷/處方/檢驗');
 act(ws,'tab','vs');setv(ws,'bp_sys','128');setv(ws,'bp_dia','82');setv(ws,'hr','76');setv(ws,'temp','36.8');setv(ws,'spo2','98');act(ws,'addvs');ok(H.DB.where('vital_signs',v=>v.encounter_id===encId).length===1,'輸入生命徵象');
 act(ws,'tab','soap');
 const sel=ws.body.querySelector('[data-chg=tpl]');sel.innerHTML+='<option>x</option>';sel.value='高血壓追蹤';fire(sel,'change');
 setv(ws,'cc','頭暈兩週');setv(ws,'assessment','Essential hypertension，控制尚可');act(ws,'savesoap');ok(H.encRecord(encId).cc==='頭暈兩週'&&H.encRecord(encId).pe.includes('心音'),'SOAP 範本套用並儲存');
 act(ws,'tab','dx');const q=ws.body.querySelector('[data-inp=icdq]');q.value='高血壓';fire(q,'input');ok(ws.body.querySelector('[name=icdlist]').options.length>=1,'ICD-10 搜尋（高血壓）');
 const ls=ws.body.querySelector('[name=icdlist]');ls.value='I10';fire(ls,'change');act(ws,'adddx');ok(H.DB.where('diagnoses',x=>x.encounter_id===encId&&x.icd_code==='I10').length===1,'建立主要診斷 I10');
 act(ws,'tab','ord');
 const mq=ws.body.querySelector('[data-inp=medq]');mq.value='amlodipine';fire(mq,'input');const ml=ws.body.querySelector('[name=medlist]');ml.value=ml.options[0].value;fire(ml,'change');
 ok(ws.body.querySelector('#medname').textContent.includes('Amlodipine'),'藥品搜尋/選取');
 setv(ws,'dose','1');setv(ws,'freq','QD');setv(ws,'days','28');fire(ws.body.querySelector('[name=days]'),'input');ok(ws.body.querySelector('#medtotal').textContent.startsWith('28'),'預估總量自動計算 '+ws.body.querySelector('#medtotal').textContent);act(ws,'addmed');
 act(ws,'sub','lab');act(ws,'qlab','CBC');act(ws,'sub','rad');setv(ws,'exam_code','CXR');setv(ws,'reason','頭暈評估，排除心肺異常');act(ws,'addrad');act(ws,'sub','proc');setv(ws,'proc_type','心電圖');setv(ws,'detail','12導程心電圖');act(ws,'addproc');
 ok(H.encOrders(encId).length===4,'開立藥物/檢驗(CBC)/影像(CXR)/處置(心電圖) 共 '+H.encOrders(encId).length+' 筆草稿');
 // 過敏攔截（UI）
 const p2=H.pt(pt.id);H.session.user&&H.svc.addAllergy(pt.id,{allergen:'盤尼西林',allergen_class:'penicillin',reaction:'皮疹',severity:'中度'});
 act(ws,'sub','med');const ml2=ws.body.querySelector('[name=medlist]');const mq2=ws.body.querySelector('[data-inp=medq]');mq2.value='Amoxicillin';fire(mq2,'input');ml2.value=ml2.options[0].value;fire(ml2,'change');ok(ws.body.querySelector('#medwarn').textContent.includes('禁忌'),'選取過敏藥品時即時顯示過敏禁忌警示');
 act(ws,'signAll');await sleep(20);ok(H.encOrders(encId).every(x=>x.o.status==='已送出'),'簽署並送出醫囑：全部 已送出');
 act(ws,'tab','soap');act(ws,'signRec');ok(H.encRecord(encId).status==='已簽署','簽署病歷');
 // 修訂
 act(ws,'amend');dlgErr();d.querySelector('.modal textarea').value='補充追蹤';dlgOK(0);await sleep(10);setv(ws,'plan','調整計畫：加做心電圖追蹤');act(ws,'savesoap');ok(H.encRecord(encId).status==='修訂中'&&H.encRecord(encId).version===2,'簽署後修訂 → 版本 v2（修訂中）');act(ws,'signRec');ok(H.DB.where('record_versions',v=>v.record_id===H.encRecord(encId).id).length===2,'重新簽署，保留 v1 與 v2');
 // ===== 藥局 =====
 await login('PH001','PHAR-01');UI.closeAll();UI.openPharmacy();await sleep(10);const ph=win('pharm');const rx=H.DB.where('prescriptions',r=>r.encounter_id===encId)[0];
 ok(ph.body.querySelector(`[data-act=review][data-id="${rx.id}"]`)!==null,'藥局收到處方 '+rx.id);
 act(ph,'review',rx.id);await sleep(60);act(ph,'disp',rx.id);await sleep(60);act(ph,'hand',rx.id);await sleep(60);ok(H.DB.get('prescriptions',rx.id).status==='已發藥','藥師 審核→調劑→發藥');
 // ===== 檢驗 =====
 await login('LAB001','LAB-01');UI.closeAll();UI.openLab();await sleep(10);const lb=win('lab');const lo=H.DB.where('lab_orders',o=>o.encounter_id===encId)[0];
 ok(lb.body.querySelector(`[data-act=work][data-id="${lo.id}"]`)!==null,'檢驗科收到 CBC 申請');
 UI.openLabWork(lo.id);await sleep(10);const lw=win('lw:'+lo.id);act(lw,'recv');await sleep(10);ok(H.DB.get('lab_orders',lo.id).status==='執行中','接收檢體（採檢/收件時間記錄）');
 const vals={WBC:'11.8',RBC:'4.2',HB:'10.2',HCT:'31',MCV:'74',MCH:'24',PLT:'310'};for(const k in vals){const el=lw.body.querySelector(`[name=v_${k}]`);el.value=vals[k];fire(el,'input');}
 ok(lw.body.querySelector('#fl_HB').textContent.includes('L')&&lw.body.querySelector('#fl_WBC').textContent.includes('H'),'結果輸入即時異常標示（WBC H、Hb L）');
 act(lw,'complete');await sleep(10);act(lw,'publish');await sleep(10);ok(H.DB.get('lab_orders',lo.id).report_status==='已發布','完成並發布報告');
 // ===== 醫師查看 =====
 await login('D001','OPD-101');UI.closeAll();UI.openWorklist();await sleep(10);ok(win('worklist').body.textContent.includes('未閱檢驗/影像報告'),'醫師工作清單顯示未閱報告');
 UI.openResults();await sleep(10);const rs=win('results');ok(rs.body.querySelector(`[data-act=lab][data-id="${lo.id}"]`)!==null,'結果追蹤出現新報告');act(rs,'lab',lo.id);await sleep(10);const lr=win('lr:'+lo.id);ok(lr.body.textContent.includes('Hb')&&lr.body.querySelectorAll('.fl').length>=2,'檢閱報告（含 H/L 異常標示 '+lr.body.querySelectorAll('.fl').length+' 項）');
 {const two=H.DB.all('lab_orders').filter(o=>o.report_status==='已發布'&&o.panel_code==='CBC').reduce((m,o)=>{(m[o.patient_id]=m[o.patient_id]||[]).push(o);return m},{});const k=Object.keys(two).find(x=>two[x].length>=2);const o2=two[k].sort((a,b)=>b.published_at.localeCompare(a.published_at))[0];UI.openLabReport(o2.id);await sleep(10);ok(win('lr:'+o2.id).body.textContent.includes('歷次對照'),'有歷史 CBC 的病人：報告顯示歷次對照表');}ok(!!H.DB.get('lab_orders',lo.id).viewed_at,'醫師已閱紀錄');
 UI.openWorkspace(encId);await sleep(10);const ws2=win('ws:'+encId);act(ws2,'finish');dlgOK(0);await sleep(20);ok(H.DB.get('encounters',encId).status==='完成','完成就診');
 // ===== 稽核 =====
 await login('ADM001','IT-01');UI.closeAll();UI.openAudit();await sleep(10);const at=win('audit');ok(at.body.textContent.includes('DISPENSE')&&at.body.textContent.includes('PUBLISH')&&at.body.textContent.includes('SIGN'),'管理者操作紀錄可查到全流程');
 UI.openConsistency();await sleep(10);ok(win('consist').body.textContent.includes('全部通過'),'一致性檢查全部通過');
 // ===== 掛號/住院/急診 UI =====
 await login('REG001','REG-01');UI.closeAll();UI.openRegister();await sleep(10);const rg=win('register');setv(rg,'q',pt.chart_no);act(rg,'find');await sleep(10);act(rg,'sel',pt.id);await sleep(10);setv(rg,'date',H.addDays(H.today(),1));act(rg,'reg');ok(H.DB.where('appointments',a=>a.patient_id===pt.id&&a.date===H.addDays(H.today(),1)).length===1,'掛號作業建立隔日掛號');dlgOK(0);
 await login('N002','ER-01');UI.closeAll();UI.openER();await sleep(10);const er=win('er');const cand=H.DB.all('patients').find(p=>!H.DB.one('encounters',e=>e.patient_id===p.id&&e.status!=='完成'));
 const qi=er.body.querySelector('[data-inp=q]');qi.value=cand.chart_no;fire(qi,'input');setv(er,'cc','胸痛 30 分鐘');setv(er,'tri','2');setv(er,'bp_sys','150');setv(er,'bp_dia','90');setv(er,'hr','100');act(er,'reg');await sleep(20);ok(H.DB.where('encounters',e=>e.patient_id===cand.id&&e.type==='ER'&&e.status==='進行中').length===1,'急診掛號/檢傷（第2級）');
 await login('D011','ER-01');UI.closeAll();UI.openER();await sleep(10);const er2=win('er');const ee=H.DB.where('encounters',e=>e.patient_id===cand.id&&e.type==='ER'&&e.status==='進行中')[0];act(er2,'take',ee.id);await sleep(20);ok(H.DB.get('encounters',ee.id).er_status==='診治中'&&!!win('ws:'+ee.id),'急診醫師接診並開啟工作區（自動建立急診病歷）');
 console.log('\n共 '+n+' 項，失敗 '+fail+'；JS 錯誤 '+errs.length);errs.slice(0,10).forEach(e=>console.log('ERR '+e.slice(0,300)));process.exit(fail||errs.length?1:0);
})().catch(e=>{console.log('腳本例外',e.stack);errs.slice(0,10).forEach(x=>console.log('ERR '+x.slice(0,300)));process.exit(2)});
