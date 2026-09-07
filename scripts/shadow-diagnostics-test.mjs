import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const pureSource=await readFile(new URL('../studielots-engine-v1.js',import.meta.url),'utf8');
const ownerSource=await readFile(new URL('../studielots-engine-owner-v722.js',import.meta.url),'utf8');
const storage=new Map();
const context={console,CustomEvent:class CustomEvent{constructor(type,init){this.type=type;this.detail=init?.detail}},sessionStorage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)||null},window:{dispatchEvent:()=>{}}};
context.window.canonicalPathResult=(courses,requirements)=>({remainingHp:60,totalHp:requirements.totalHp,subjectHp:requirements.subjectHp,thesisHp:requirements.thesisHp,subject:requirements.subject,legacyMarker:'canonical'});
context.window.evaluateUniversityProgramV2=(courses,requirements)=>({remainingHp:60,totalHp:requirements.totalHp,subjectHp:requirements.subjectHp,thesisHp:requirements.thesisHp,subject:requirements.subject,legacyMarker:'university'});
vm.createContext(context);
vm.runInContext(pureSource,context);
vm.runInContext(ownerSource,context);
const courses=[{name:'Psykologi A',hp:30,subject:'Psykologi',level:'G1N'},{name:'Psykologi B',hp:30,subject:'Psykologi',level:'G1F'},{name:'Psykologi Kandidatuppsats',hp:15,subject:'Psykologi',level:'G2E'},{name:'Valbar kurs',hp:45,subject:'Sociologi',level:'G1N'}];
const requirements={totalHp:180,subjectHp:90,thesisHp:15,subject:'Psykologi'};
for(let i=0;i<5;i++){
 const canonical=context.window.canonicalPathResult(courses,requirements);
 const university=context.window.evaluateUniversityProgramV2(courses,requirements);
 if(canonical.remainingHp!==60||university.remainingHp!==60)throw new Error('remaining hp must stay numerically identical during migration');
 if(canonical.legacyMarker!=='canonical'||university.legacyMarker!=='university')throw new Error('partial takeover must preserve legacy result shape for both entries');
}
const report=context.window.__studielotsEngine.getShadowReport();
if(report.version!=='735')throw new Error('shadow diagnostics v735 must load');
if(report.takeoversByEntry?.canonicalPathResult<1)throw new Error('canonical remainingHp should transfer after parity');
if(report.takeoversByEntry?.evaluateUniversityProgramV2<1)throw new Error('university remainingHp should transfer after parity');
const parity=context.window.__studielotsEngine.getParityReport();
if(parity.uiTakeover!==false||parity.partialTakeover!==true)throw new Error('migration must remain partial and non-UI');
if(!Array.isArray(parity.takeoverFields)||parity.takeoverFields.join(',')!=='remainingHp')throw new Error('only remainingHp may transfer');
if(!parity.entries.canonicalPathResult.eligible||!parity.entries.evaluateUniversityProgramV2.eligible||!parity.allEligible)throw new Error('both entries should establish parity independently');
console.log(JSON.stringify({ok:true,version:report.version,parity,takeoversByEntry:report.takeoversByEntry},null,2));
