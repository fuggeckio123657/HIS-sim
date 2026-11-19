const vm=require('vm'),fs=require('fs'),{spawn}=require('child_process'),path=require('path');
const PORT=18765,base=`http://127.0.0.1:${PORT}`;
const dataDir=path.join(__dirname,'../data');fs.rmSync(dataDir,{recursive:true,force:true});
const srv=spawn('node',['../server.js',String(PORT)],{cwd:__dirname,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let n=0,bad=0;const ok=(c,m)=>{n++;if(!c){bad++;process.exitCode=1}console.log((c?'PASS ':'FAIL ')+m)};
const client=()=>{const sb={console,Math,JSON,Date,setTimeout,clearTimeout,Promise,location:{protocol:'http:'},fetch:(u,o)=>fetch(u.startsWith('http')?u:base+u,o),localStorage:undefined};sb.globalThis=sb;vm.createContext(sb);
 for(const f of ['core','clinic-data','clinic-tpl','clinic-core','clinic-seed','remote'])vm.runInContext(fs.readFileSync(`../src/${f}.js`,'utf8'),sb,{filename:f});return sb.HIS};
(async()=>{await sleep(700);
const A=client(),B=client();
ok(await A.remote.probe(),'伺服器偵測成功');
await A.remote.attach('clinic');await B.remote.attach('clinic');
ok(A.DB.all('patients').length>=80&&B.DB.all('patients').length===A.DB.all('patients').length,'第二台載入第一台上傳的同一份資料');
ok(A.remote.tag!==B.remote.tag,'兩台使用不同 ID 標籤');
const login=(H,emp)=>{H.session={user:H.DB.one('users',u=>u.emp_no===emp)}};login(A,'C004');login(B,'C001');
A.DB.where('appointments',a=>['櫃台等候','候診中'].includes(a.status)).forEach(a=>A.svc.clCancelAppt(a.id,'x'));
const ap=A.svc.clArrive(1,{caseKey:'URI'})[0];A.DB.update('appointments',ap.id,{card_state:'正常'});
await sleep(3200);
ok(B.DB.get('appointments',ap.id)&&B.DB.get('appointments',ap.id).status==='櫃台等候','A 的來客同步到 B');
A.svc.clRegister(ap.id,{doctor_id:'U-C001',mode:'讀卡'});await sleep(3200);
ok(B.DB.get('appointments',ap.id).status==='候診中','A 掛號 → B 診間看到候診');
// B 完診 → A 批價
login(B,'C001');B.svc.clMeasure(ap.id);const a2=B.DB.get('appointments',ap.id);const t=B.DB.one('templates',x=>x.key==='URI');
const rec=Object.fromEntries(B.CL.REC_FIELDS.map(k=>[k,B.CL.autofill(t.f[k]||'x',Math.random)+'測試內容測試內容']));
const r=B.svc.clCompleteVisit(ap.id,{record:rec,dx:[{icd:'J06.9',type:'主要'}],drugs:[],services:[],ignoreBlank:true});
await sleep(3200);
const ch=A.DB.one('cl_charges',{encounter_id:r.encounter.id});ok(!!ch&&A.DB.get('appointments',ap.id).status==='已看診','B 完診 → A 櫃台看到待批價');
A.svc.clPay(r.encounter.id,{received:ch.cash_due});await sleep(3200);
ok(B.DB.one('cl_charges',{encounter_id:r.encounter.id}).status==='已批價','A 批價 → B 同步');
// 同時新增 ID 不衝突
const ids=new Set();A.svc.clArrive(3);B.svc.clArrive(3);await sleep(3200);
const all=A.DB.all('appointments').map(a=>a.id);ok(all.length===new Set(all).size&&A.DB.all('appointments').length===B.DB.all('appointments').length,'兩端同時產生資料，ID 不衝突且最終一致');
// 重新連線的第三台取得完整資料
const C=client();await C.remote.attach('clinic');ok(C.DB.all('encounters').length===A.DB.all('encounters').length&&!!C.DB.get('encounters',r.encounter.id),'新加入裝置取得最新完整資料');
// 伺服器重啟後資料仍在
await sleep(800);srv.kill();await sleep(300);const s2=spawn('node',['../server.js',String(PORT)],{cwd:__dirname,stdio:'ignore'});await sleep(700);
const j=await (await fetch(base+'/api/state?ed=clinic')).json();ok(j.ready&&j.snap.encounters.some(e=>e.id===r.encounter.id),'伺服器重啟後資料已持久化');
await (await fetch(base+'/')).text().catch(()=>0);
[A,B,C].forEach(H=>H.remote.detach());s2.kill();fs.rmSync(dataDir,{recursive:true,force:true});console.log(`${n-bad}/${n}`);process.exit(process.exitCode||0)})().catch(e=>{console.log('例外',e.stack);srv.kill();process.exit(1)});
