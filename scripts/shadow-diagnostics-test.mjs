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
context.window.evaluateUniversityProgramV2=(courses,requirements)=>({remainingHp:45,totalHp:requirements.totalHp,subjectHp:requirements.subjectHp,thesisHp:requirements.thesisHp,subject:requirements.subject});
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
const legacy=context.window.canonicalPathResult(courses,requirements);
if(legacy.remainingHp!==60)throw new Error('legacy result must be preserved');
const report=context.window.__studielotsEngine.getShadowReport();
if(report.version!=='727')throw new Error('shadow diagnostics v727 must load');
if(report.comparable<1)throw new Error('at least one shadow comparison expected');
if(!report.byReason?.total)throw new Error('mismatch classification must group by dominant requirement');
if(!Array.isArray(report.deltas)||!report.deltas.length)throw new Error('shadow details must be retained');
console.log(JSON.stringify({ok:true,version:report.version,comparable:report.comparable,byReason:report.byReason,last:report.last?.classification},null,2));
