import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../studielots-engine-v1.js',import.meta.url),'utf8');
const context={window:{},CustomEvent:class CustomEvent{constructor(type,init){this.type=type;this.detail=init?.detail}},console};
context.window.dispatchEvent=()=>{};
vm.createContext(context);
vm.runInContext(source,context);
const e=context.window.__studielotsPureEngine;
function assert(ok,msg){if(!ok){console.error('FAIL:',msg);process.exitCode=1}else console.log('OK:',msg)}
assert(e?.version==='724','pure engine v724 loads');
assert(typeof e?.evaluateRequirements==='function','requirement evaluator is exposed');
const courses=[
 {name:'Psykologi: Grundkurs',hp:30,subject:'Psykologi',level:'G1N'},
 {name:'Psykologi: Fortsättningskurs',hp:30,subject:'Psykologi',level:'G1F'},
 {name:'Psykologi: Kandidatuppsats',hp:15,subject:'Psykologi',level:'G2E'},
 {name:'Valbar kurs',hp:45,subject:'Sociologi',level:'G1N'},
 {name:'Avancerad kurs',hp:15,subject:'Psykologi',level:'A1N'}
];
const candidate=e.evaluateRequirements(courses,{subject:'Psykologi',totalHp:180,subjectHp:90,thesisHp:15,excludeAdvancedFromTotal:true});
assert(candidate.completed.totalHp===120,'advanced credits can be excluded from candidate total');
assert(candidate.completed.subjectHp===75,'subject hp is calculated from eligible subject courses');
assert(candidate.completed.thesisHp===15,'thesis hp is calculated independently');
assert(candidate.gaps.totalGap===60&&candidate.gaps.subjectGap===15&&candidate.gaps.thesisGap===0,'requirement gaps are deterministic');
assert(candidate.remainingHp===60,'remaining hp preserves legacy overlapping-gap max semantics');
const all=e.evaluateRequirements(courses,{subject:'Psykologi',totalHp:180,subjectHp:90,thesisHp:15});
assert(all.completed.totalHp===135,'advanced credits remain included when not explicitly excluded');
if(process.exitCode)process.exit(process.exitCode);
