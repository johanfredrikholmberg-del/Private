import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const pureSource=await readFile(new URL('../studielots-engine-v1.js',import.meta.url),'utf8');
const ownerSource=await readFile(new URL('../studielots-engine-owner-v722.js',import.meta.url),'utf8');
const storage=new Map();
const context={
 console,
 CustomEvent:class CustomEvent{constructor(type,init){this.type=type;this.detail=init?.detail}},
 sessionStorage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)||null},
 window:{dispatchEvent:()=>{}}
};
context.window.canonicalPathResult=(courses,requirements)=>({remainingHp:60,totalHp:requirements.totalHp,subjectHp:requirements.subjectHp,thesisHp:requirements.thesisHp,subject:requirements.subject});
context.window.evaluateUniversityProgramV2=(courses,requirements)=>({remainingHp:60,totalHp:requirements.totalHp,subjectHp:requirements.subjectHp,thesisHp:requirements.thesisHp,subject:requirements.subject});
vm.createContext(context);
vm.runInContext(pureSource,context);
vm.runInContext(ownerSource,context);
const courses=[
 {name:'Psykologi A',hp:30,subject:'Psykologi',level:'G1N'},
 {name:'Psykologi B',hp:30,subject:'Psykologi',level:'G1F'},
 {name:'Psykologi Kandidatuppsats',hp:15,subject:'Psykologi',level:'G2E'},
 {name:'Valbar kurs',hp:45,subject:'Sociologi',level:'G1N'}
];
const requirements={totalHp:180,subjectHp:90,thesisHp:15,subject:'Psykologi'};
for(let i=0;i<5;i++){
 const legacy=context.window.canonicalPathResult(courses,requirements);
 if(legacy.remainingHp!==60)throw new Error('legacy result must be preserved');
}
const report=context.window.__studielotsEngine.getShadowReport();
if(report.version!=='733')throw new Error('shadow diagnostics v733 must load');
if(report.comparable<5)throw new Error('at least five shadow comparisons expected');
if(!Array.isArray(report.deltas)||!report.deltas.length)throw new Error('shadow details must be retained');
const parity=context.window.__studielotsEngine.getParityReport();
if(parity.uiTakeover!==false)throw new Error('parity gate must not take over UI');
if(parity.entries.canonicalPathResult.eligible!==true)throw new Error('five clean matches should make canonicalPathResult eligible');
if(context.window.__studielotsEngine.isPureEligible('canonicalPathResult')!==true)throw new Error('eligibility helper should expose established parity');
if(parity.allEligible!==false)throw new Error('allEligible must stay false until every owned entry establishes parity');
console.log(JSON.stringify({ok:true,version:report.version,parity},null,2));
