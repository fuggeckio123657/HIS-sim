const vm=require('vm'),fs=require('fs');global.localStorage=undefined;
for(const f of ['core','clinic-data','clinic-tpl','clinic-core','clinic-seed'])vm.runInThisContext(fs.readFileSync(`../src/${f}.js`,'utf8'),{filename:f});
HIS.setEdition('clinic');const t0=Date.now();HIS.CL.seed();console.log('seed ms',Date.now()-t0);
const {DB,svc:S}=HIS;
for(const t of ['patients','encounters','cl_charges','cl_items','cl_claims','cl_claim_lines','cl_closes','appointments'])console.log(t,DB.all(t).length);
console.log(HIS.CL.today(),DB.all('cl_claims').map(c=>[c.period,c.status,c.visit_count,c.points_claimed,c.points_cut]));
HIS.session={user:DB.get('users','U-C001')};
const R=S.clConsistency();R.forEach(r=>console.log(r.ok?'PASS':'FAIL',r.name,r.n,r.bad.slice(0,3)));
console.log(S.clPeriods());
