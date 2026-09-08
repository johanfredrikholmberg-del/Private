import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const code=fs.readFileSync(new URL('../v2-degree-rules.js',import.meta.url),'utf8');
const engine={
 subjectMatch:(c,s)=>String(c.subject||'').toLowerCase()===String(s||'').toLowerCase(),
 isAdvanced:c=>/^A/.test(String(c.progression||c.levelCode||'')),
 isThesis:c=>Boolean(c.thesis)||/uppsats|examensarbete/i.test(String(c.name||'')),
 evaluate:(courses,r)=>{
  const usable=(courses||[]).filter(c=>!(r.excludeAdvancedFromTotal&&/^A/.test(String(c.progression||c.levelCode||''))));
  const total=usable.reduce((s,c)=>s+Number(c.hp||0),0);
  const subj=usable.filter(c=>String(c.subject||'').toLowerCase()===String(r.subject||'').toLowerCase());
  const subjectHp=subj.reduce((s,c)=>s+Number(c.hp||0),0);
  const thesisHp=subj.filter(c=>Boolean(c.thesis)||/uppsats|examensarbete/i.test(String(c.name||''))).reduce((s,c)=>s+Number(c.hp||0),0);
  return {remainingHp:Math.max(0,r.totalHp-total,r.subjectHp-subjectHp,r.thesisHp-thesisHp)};
 }
};
const window={StudieLotsV2:{engine}};
vm.runInNewContext(code,{window,console});
const rules=window.StudieLotsV2.degreeRules;

assert.equal(rules.get('GU','Psykologi').id,'gu-general-candidate');
assert.equal(rules.get('Lunds universitet','Företagsekonomi').id,'lu-business-candidate');
assert.equal(rules.get('LU','Nationalekonomi').id,'lu-economics-candidate');
assert.equal(rules.get('ORU','Psykologi').id,'oru-general-candidate');
assert.equal(rules.get('KTH','Teknik').id,'kth-technology-candidate');

const base=[
 {code:'P1',name:'Psykologi I',subject:'Psykologi',hp:30,progression:'G1N'},
 {code:'P2',name:'Psykologi II',subject:'Psykologi',hp:30,progression:'G1F'},
 {code:'P3',name:'Psykologi III',subject:'Psykologi',hp:15,progression:'G2F'},
 {code:'PX',name:'Kandidatuppsats',subject:'Psykologi',hp:15,progression:'G2E',thesis:true},
 {code:'V1',name:'Valbar 1',subject:'Sociologi',hp:30,progression:'G1N'},
 {code:'V2',name:'Valbar 2',subject:'Pedagogik',hp:30,progression:'G1N'},
 {code:'V3',name:'Valbar 3',subject:'Historia',hp:30,progression:'G1N'}
];
const oru=rules.evaluate(base,{university:'Örebro universitet',subject:'Psykologi'});
assert.equal(oru.result.remainingHp,0);
assert.equal(oru.failedLocalRequirements.length,0);
assert.equal(oru.unknownLocalRequirements.length,0);
assert.equal(oru.eligible,true);

const badOru=rules.evaluate(base.map(c=>c.code==='PX'?{...c,progression:'G1E'}:c),{university:'ORU',subject:'Psykologi'});
assert.equal(badOru.eligible,false);
assert.ok(badOru.failedLocalRequirements.some(x=>x.id==='thesisLevel'));

const noLevels=rules.evaluate(base.map(({progression,...c})=>c),{university:'ORU',subject:'Psykologi'});
assert.equal(noLevels.eligible,false);
assert.ok(noLevels.unknownLocalRequirements.some(x=>x.id==='progression'));
assert.ok(noLevels.unknownLocalRequirements.some(x=>x.id==='thesisLevel'));

const lu=rules.evaluate(base,{university:'LU',subject:'Psykologi'});
assert.ok(lu.extraChecks.some(x=>x.id==='outsideSubjectHp'&&x.status==='pass'));

const suCourses=[...base,{code:'A1',name:'Avancerad kurs',subject:'Annat',hp:37.5,progression:'A1N'}];
const su=rules.evaluate(suCourses,{university:'SU',subject:'Psykologi'});
assert.ok(su.failedLocalRequirements.some(x=>x.id==='maxAdvancedHp'));
assert.equal(su.eligible,false);

const econ=[
 {code:'NEK1',name:'Nationalekonomi grundkurs',subject:'Nationalekonomi',hp:30,progression:'G1N'},
 {code:'NEK2',name:'Nationalekonomi fortsättning',subject:'Nationalekonomi',hp:30,progression:'G1F'},
 {code:'NEKG21',name:'Fördjupning',subject:'Nationalekonomi',hp:15,progression:'G2F'},
 {code:'NEKX',name:'Kandidatuppsats',subject:'Nationalekonomi',hp:15,progression:'G2E',thesis:true},
 {code:'V1',name:'Valbar 1',subject:'Sociologi',hp:30},
 {code:'V2',name:'Valbar 2',subject:'Historia',hp:30},
 {code:'V3',name:'Valbar 3',subject:'Pedagogik',hp:30}
];
const econResult=rules.evaluate(econ,{university:'Lunds universitet',subject:'Nationalekonomi'});
assert.ok(econResult.missingRequiredCodes.includes('NEKG31'));
assert.equal(econResult.eligible,false);

console.log('v2 degree-rules regression: PASS');
