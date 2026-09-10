import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const window={StudieLotsV2:{paths:{structure:async()=>null}}};
const context=vm.createContext({window,console});
vm.runInContext(fs.readFileSync(new URL('../v2-credit-allocation-v8.js',import.meta.url),'utf8'),context,{filename:'v2-credit-allocation-v8.js'});
const allocate=window.StudieLotsV2.paths.allocateProgrammeMatches;
const merits=[
 {code:'FEG101',name:'Organisation och ledarskap',hp:15,subject:'Företagsekonomi'},
 {code:'FEG102',name:'Marknadsföring',hp:15,subject:'Företagsekonomi'},
 {code:'STAT01',name:'Statistik',hp:15,subject:'Statistik'}
];
const rows=[
 {code:'X1',name:'Ledarskap och organisation',hp:6,subject:'Företagsekonomi',term:1},
 {code:'X2',name:'Organisation och förändring',hp:6,subject:'Företagsekonomi',term:1},
 {code:'X3',name:'Marketing',hp:6,subject:'Företagsekonomi',term:2},
 {code:'X4',name:'Statistik 1a',hp:8,subject:'Statistik',term:2}
];
const out=allocate(rows,merits,'Företagsekonomi');
assert.equal(out.filter(x=>x.credited).length,0,'semantic matches must not become verified credits');
assert.ok(out[0].matchedHp>0,'organisation course should produce a possible match');
assert.ok(out[1].matchedHp>0,'remaining hp from a 15 hp merit may support another possible row');
assert.ok(out[2].matchedHp>0,'Swedish/English marketing synonym should match as possible');
assert.ok(out[3].matchedHp>0,'statistics concept should match as possible');
const usedOrganisation=out.slice(0,2).reduce((s,x)=>s+(x.matchedCourse.includes('Organisation och ledarskap')?x.matchedHp:0),0);
assert.ok(usedOrganisation<=15.001,'one merit course must never be double-counted beyond its hp');
const possibleHp=out.reduce((s,x)=>s+(x.credited?0:x.matchedHp||0),0);
assert.ok(possibleHp<=45.001,'total allocated hp must never exceed available merit hp');
console.log('v2 credit-allocation regression: OK');