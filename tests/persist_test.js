const {JSDOM}=require('jsdom'),fs=require('fs');const html=fs.readFileSync('/home/claude/his/his.html','utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const a=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',beforeParse(w){w.localStorage.setItem('his.edition','hospital')}});await sleep(150);const H=a.window.HIS;
 H.svc.login('D001','1234','OPD-101');const appt=H.DB.where('appointments',x=>x.status==='已掛號'&&x.dept_id==='DEP-IM')[0];const e=H.svc.startVisit(appt.id);H.svc.addDx(e.id,{icd_code:'I10',type:'主要'});
 const snap={};for(let i=0;i<a.window.localStorage.length;i++){const k=a.window.localStorage.key(i);snap[k]=a.window.localStorage.getItem(k)}
 const b=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',beforeParse(w){for(const k in snap)w.localStorage.setItem(k,snap[k])}});await sleep(100);const H2=b.window.HIS;
 const same=H2.DB.get('encounters',e.id)&&H2.DB.where('diagnoses',d=>d.encounter_id===e.id).length===1&&H2.DB.get('appointments',appt.id).status==='看診中';
 console.log(same?'PASS 重新載入頁面後資料仍在（新就診、診斷、掛號狀態皆保留）':'FAIL 持久化失敗');
 console.log('localStorage 資料表數：',Object.keys(snap).length,'，總大小約',Math.round(Object.values(snap).join('').length/1024),'KB');
 const nextId=H2.DB.nextId('encounters');console.log(nextId!==e.id?'PASS 流水號延續（下一筆 '+nextId+'）':'FAIL id 衝突');
 process.exit(same?0:1);
})();
