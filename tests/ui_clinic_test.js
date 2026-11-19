const {JSDOM}=require('jsdom'),fs=require('fs');
const html=fs.readFileSync('/home/claude/his/his.html','utf8');const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',pretendToBeVisual:true,beforeParse(w){w.addEventListener('error',e=>errs.push('window.error: '+e.message));w.console.error=(...a)=>{errs.push('console.error: '+a.map(x=>x&&x.stack||x).join(' '))};}});
const w=dom.window,d=w.document,H=w.HIS,UI=H.UI;let n=0,fail=0;
const ok=(c,m)=>{n++;if(!c){fail++;process.exitCode=1}console.log((c?'PASS ':'FAIL ')+m)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const win=k=>UI.wins[k];
const click=el=>{if(!el)throw new Error('找不到元素');el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}))};
const act=(wn,a,id)=>{const x=typeof wn==='string'?win(wn):wn;if(!x)throw new Error('無視窗 '+wn);const el=x.body.querySelector(`[data-act="${a}"]${id?`[data-id="${id}"]`:''}`);if(!el)throw new Error(`視窗 ${x.key} 找不到動作 ${a} ${id||''}`);click(el)};
const fire=(el,t)=>el.dispatchEvent(new w.Event(t,{bubbles:true}));
const dlg=()=>{const m=d.querySelectorAll('.modal');return m[m.length-1]};
const dbtn=t=>{const b=[...dlg().querySelectorAll('.df button')].find(x=>x.textContent.includes(t));if(!b)throw new Error('對話框無按鈕 '+t);click(b)};
const setIn=(root,sel,v,ev='change')=>{const e=root.querySelector(sel);if(!e)throw new Error('找不到 '+sel);e.value=v;fire(e,ev)};
const dlgErr=()=>{const m=dlg();return m?(m.querySelector('.dlgerr')||{}).textContent:''};
(async()=>{
await sleep(300);const S=H.svc,DB=H.DB,CL=H.CL;
ok(H.edition==='clinic'&&DB.all('patients').length>=80,'預設載入診所版，已有種子資料');
d.getElementById('lg-emp').value='C001';d.getElementById('lg-pw').value='1234';d.getElementById('lg-ws').value='診間1';click(d.getElementById('lg-btn'));
ok(!d.getElementById('app').hidden&&win('cl-home'),'院長登入進入診所首頁');
ok(d.querySelectorAll('#menubar .mi').length>=5,'診所選單顯示');
// 清掉種子留下的來客
DB.where('appointments',a=>['櫃台等候','候診中'].includes(a.status)).forEach(a=>S.clCancelAppt(a.id,'測試清場'));
S.clArrive(1,{caseKey:'URI'});
UI.openClReg();await sleep(60);
const ap=DB.where('appointments',a=>a.status==='櫃台等候')[0];DB.update('appointments',ap.id,{card_state:'正常'});UI.refresh(win('cl-reg'));
act('cl-reg','reg',ap.id);setIn(dlg(),'[name=doctor_id]','U-C001','change');dbtn('確定');
ok(DB.get('appointments',ap.id).status==='候診中'&&DB.get('appointments',ap.id).ic_seq,'櫃台掛號讀卡完成進入候診');
UI.openClTriage();await sleep(60);act('cl-triage','auto',ap.id);
ok(DB.get('appointments',ap.id).vitals_done,'護理量測完成');
UI.openClDoctor();await sleep(60);act('cl-doctor','see',ap.id);await sleep(60);
const v=win('cl-visit:'+ap.id);ok(!!v,'開啟看診工作台');
ok(v.body.textContent.includes(DB.get('appointments',ap.id).speech),'顯示病人主訴語句');
const hpiEmpty=v.body.querySelector('textarea[data-k=hpi]').value==='';ok(hpiEmpty,'S 欄位預設空白（需醫師自行輸入）');
act(v,'ask');act(v,'pe');
ok(v.state.d.log.length===1&&Object.keys(v.state.d.pe_seen).length===1,'問診與理學檢查有回應');
// 沒填完診 → 應報錯，且不產生任何就診
act(v,'finish');await sleep(20);dbtn('確認完診');ok(/主訴/.test(dlgErr()),'未填主訴不可完診：'+dlgErr());dbtn('返回修改');
ok(DB.where('encounters',e=>e.appt_id===ap.id).length===0,'失敗完診不留半完成資料');
// 範本
setIn(v.body,'[name=tpl]',DB.one('templates',t=>t.key==='URI').id);act(v,'tpl');await sleep(10);
click([...dlg().querySelectorAll('.df button')].find(b=>b.textContent==='確定'));await sleep(30);
ok(v.state.d.drugs.length>0&&v.state.d.dx.length>0,'套用範本帶入診斷與處方');
act(v,'finish');await sleep(20);dbtn('確認完診');ok(/未填的標記/.test(dlgErr()),'範本標記未改不可完診');dbtn('返回修改');
// 醫師自行輸入 S 與其他欄位
const R=v.state.d.record;const typ=(k,t)=>{const e=v.body.querySelector(`textarea[data-k=${k}]`);e.value=t;fire(e,'input')};
CL.REC_FIELDS.forEach(k=>{if(CL.unfilled(R[k])||!R[k])typ(k,{cc:'流鼻水喉嚨痛三天',hpi:'三天前開始流鼻水、喉嚨痛，乾咳，無發燒，同事有類似症狀。',ros:'無喘、無胸痛、無腹瀉。',pmh:'無慢性病、無藥物過敏、無長期用藥。',fh:'無特殊。',sh:'不抽菸不喝酒不嚼檳榔，上班族。',pe:'咽喉輕度充血，雙肺呼吸音清晰。',exam:'無',assessment:'急性上呼吸道感染',plan:'症狀治療，多休息多喝水。',edu:'多喝水休息，惡化回診。',followup:'三日後'}[k])});
act(v,'finish');await sleep(20);dbtn('確認完診');await sleep(80);
const enc=DB.one('encounters',e=>e.appt_id===ap.id);ok(enc&&enc.status==='完診','完診一次寫入就診');
ok(!win('cl-visit:'+ap.id),'完診後看診視窗關閉');ok(!!dlg(),'顯示診後回顧');dbtn('關閉');
UI.openClBill();await sleep(60);const ch=DB.one('cl_charges',{encounter_id:enc.id});
setIn(win('cl-bill').body,'[name=received]',ch.cash_due,'input');act('cl-bill','pay',enc.id);ok(DB.one('cl_charges',{encounter_id:enc.id}).status==='已批價','批價收款');dbtn('確定');
if(DB.get('encounters',enc.id).disp_status==='待領藥'){UI.openClPharm();await sleep(60);act('cl-pharm','disp',enc.id);dbtn('核對');ok(DB.get('encounters',enc.id).disp_status==='已領藥','藥局領藥');}
UI.openClClose();await sleep(60);act('cl-close','close');dbtn('確定');await sleep(30);ok(DB.all('cl_closes').slice(-1)[0].date===HIS_D(),'日結完成');dbtn('確定');
function HIS_D(){return DB.all('cl_closes').slice(-1)[0].date}
UI.openClClaim();await sleep(60);const per=S.clPeriods()[0];ok(!!per,'有可申報年月');act('cl-claim','mk',per.period);await sleep(60);
const cl=DB.all('cl_claims').slice(-1)[0];ok(cl&&cl.status==='草稿','建立申報草稿');
UI.openClTpl();await sleep(60);ok(win('cl-tpl').body.querySelectorAll('tbody tr').length>=30,'範本管理列出內建範本');
UI.openClSettings();await sleep(60);ok(!win('cl-set').body.innerHTML.includes('異常'),'一致性檢查全部通過');
UI.openClLab();UI.openClPatients();await sleep(60);
// 版本切換回大醫院
UI.logout();await UI.loadEdition('hospital');ok(H.edition==='hospital'&&DB.all('patients').length>0,'可切換回大醫院版');
d.getElementById('lg-emp').value='D001';d.getElementById('lg-pw').value='1234';click(d.getElementById('lg-btn'));ok(!!win('worklist'),'大醫院版仍可登入');
ok(d.querySelectorAll('#menubar .mi').length>=6&&![...d.querySelectorAll('#menubar .mi span')].some(s=>s.textContent.includes('前台')),'大醫院版選單不含診所項目');
console.log(`\n${n-fail}/${n} 通過`);if(errs.length){console.log('頁面錯誤：');errs.slice(0,8).forEach(e=>console.log(' ',e.slice(0,300)));process.exitCode=1}
process.exit(process.exitCode||0)})().catch(e=>{console.log('測試例外',e.stack);process.exit(1)});
