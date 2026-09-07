import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const pureSource=await readFile(new URL('../studielots-engine-v1.js',import.meta.url),'utf8');
const ownerSource=await readFile(new URL('../studielots-engine-owner-v737.js',import.meta.url),'utf8');
const storage=new Map();
const context={console,CustomEvent:class CustomEvent{constructor(type,init){this.type=type;this.detail=init?.detail}},sessionStorage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)||null},window:{dispatchEvent:()=>{}}};
const legacy=(requirements,marker)=>({remainingHp:60,totalHp:requirements.totalHp,subjectHp:requirements.subjectHp,thesisHp:requirements.thesisHp,subject:requirements.subject,gaps:{totalGap:60,subjectGap:15,thesisGap:0,remainingHp:60},legacyMarker:marker});
context.window.canonicalPathResult=(courses,requirements)=>legacy(requirements,'canonical');context.window.evaluateUniversityProgramV2=(courses,requirements)=>legacy(requirements,'university');
vm.createContext(context);vm.runInContext(pureSource,context);vm.runInContext(ownerSource,context);
const courses=[{name:'Psykologi A',hp:30,subject:'Psykologi',level:'G1N'},{name:'Psykologi B',hp:30,subject:'Psykologi',level:'G1F'},{name:'Psykologi Kandidatuppsats',hp:15,subject:'Psykologi',level:'G2E'},{name:'Valbar kurs',hp:45,subject:'Sociologi',level:'G1N'}];const requirements={totalHp:180,subjectHp:90,thesisHp:15,subject:'Psykologi'};
for(let i=0;i<5;i++){
 const a=context.window.canonicalPathResult(courses,requirements),b=context.window.evaluateUniversityProgramV2(courses,requirements);
 for(const r of [a,b]){if(r.remainingHp!==60)throw new Error('remaining hp changed');if(r.gaps.totalGap!==60||r.gaps.subjectGap!==15||r.gaps.thesisGap!==0)throw new Error('gap value changed unexpectedly')}
 if(a.legacyMarker!=='canonical'||b.legacyMarker!=='university')throw new Error('legacy shape changed')
}
const report=context.window.__studielotsEngine.getShadowReport();if(report.version!=='737')throw new Error('v737 must load');if(report.takeoversByEntry?.canonicalPathResult<1||report.takeoversByEntry?.evaluateUniversityProgramV2<1)throw new Error('remainingHp takeover expected');
for(const entry of ['canonicalPathResult','evaluateUniversityProgramV2']){const c=report.componentParity?.[entry];if(!c)throw new Error('component parity missing');for(const field of ['totalGap','subjectGap','thesisGap'])if(c[field]?.comparable<5||c[field]?.mismatches!==0||c[field]?.eligible!==true)throw new Error(field+' parity not established');const t=report.componentTakeoversByEntry?.[entry];for(const field of ['totalGap','subjectGap','thesisGap'])if((t?.[field]||0)<1)throw new Error(field+' takeover expected')}
const parity=context.window.__studielotsEngine.getParityReport();if(!parity.allEligible)throw new Error('both entries should establish parity');if(parity.componentTakeover!==true)throw new Error('gap components should be takeover-enabled');if(!parity.takeoverFields.includes('gaps.totalGap')||!parity.takeoverFields.includes('gaps.subjectGap')||!parity.takeoverFields.includes('gaps.thesisGap'))throw new Error('gap takeover fields missing');console.log(JSON.stringify({ok:true,version:report.version,parity,componentParity:report.componentParity,componentTakeoversByEntry:report.componentTakeoversByEntry},null,2));
