const vm=require('vm'),fs=require('fs');global.localStorage=undefined;vm.runInThisContext(fs.readFileSync('../src/core.js','utf8'));
const {DB}=HIS;const sent=[];DB.sink=o=>sent.push(o);DB.use('clinic');
DB.insert('patients',{name:'A'});const base=DB.all('patients').length;sent.length=0;
let threw=false;try{DB.tx(()=>{DB.insert('patients',{name:'B'});DB.update('patients',DB.all('patients')[0].id,{name:'Z'});throw new Error('boom')})}catch(e){threw=true}
console.log(threw&&DB.all('patients').length===base&&DB.all('patients')[0].name==='A'&&sent.length===0?'PASS 交易失敗：整批還原，無變更送出':'FAIL rollback');
DB.tx(()=>{DB.insert('patients',{name:'C'});DB.update('patients',DB.all('patients')[0].id,{name:'Y'})});
console.log(DB.all('patients').length===base+1&&DB.all('patients')[0].name==='Y'&&sent.length===2?'PASS 交易成功：寫入並送出 '+sent.length+' 筆變更':'FAIL commit '+sent.length);
// 套用遠端變更不回送
sent.length=0;DB.applyRemote([{o:'i',t:'patients',row:{id:'PTremote',name:'R'}},{o:'u',t:'patients',id:'PTremote',patch:{name:'R2'}}]);
console.log(DB.get('patients','PTremote').name==='R2'&&sent.length===0?'PASS 遠端變更套用且不回送':'FAIL remote');
DB.use('hospital');console.log(DB.all('patients').length===0?'PASS 切換版本後資料互相獨立':'FAIL ns');
