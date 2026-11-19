const vm=require('vm'),fs=require('fs');
global.localStorage=undefined;
for(const f of ['core','seed'])vm.runInThisContext(fs.readFileSync(`../src/${f}.js`,'utf8'),{filename:f});
const t0=Date.now();HIS.seed();console.log('seed ms',Date.now()-t0);
const c=t=>HIS.DB.all(t).length;
for(const t of HIS.DB.tables)console.log(t.padEnd(22),c(t));
console.log('OPD enc',HIS.DB.where('encounters',{type:'OPD'}).length,'IPD',HIS.DB.where('admissions',()=>true).length,'cur',HIS.DB.where('admissions',a=>a.status!=='已出院').length,'rad reports',c('radiology_reports'));
const r=HIS.svc.consistency();r.forEach(x=>console.log(x.ok?'OK  ':'FAIL',x.name,x.ok?'':x.bad.slice(0,5)));
