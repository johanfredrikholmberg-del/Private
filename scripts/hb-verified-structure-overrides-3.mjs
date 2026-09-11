#!/usr/bin/env node
// Verified Civilekonom branch model; edit also acts as the Borås fast-path trigger.
import fs from 'node:fs/promises';
const FILE='data/susa/structures.json',META='data/susa/structure-meta.json';
const all=JSON.parse(await fs.readFile(FILE,'utf8'));
const x=all.find(v=>String(v.programCode||'').toUpperCase()==='ACEKO');
const r=(term,name,hp,type='required',extra={})=>({term,name,hp,type,isThesis:/examensarbete/i.test(name),...extra});
const track=(term,options)=>r(term,'Inriktningsspecifik termin',30,'choice',{choiceSlots:1,choiceGroup:'ACEKO-track',options});
if(x){
 const m5={track:'Management',hp:30,courses:[['Performativ managementrevision',15],['Chefskap, ledarskap och medarbetarskap',7.5],['Valbar kurs',7.5]]};
 const k5={track:'Marknadsföring',hp:30,courses:[['Marknadsundersökning och marknadsanalys',7.5],['Konsumentbeteende',7.5],['Marknadskommunikation',7.5],['Valbar kurs',7.5]]};
 const r5={track:'Redovisning',hp:30,courses:[['Redovisningsteori och koncernredovisning',7.5],['Ekonomistyrning II',7.5],['Valbart block',15]]};
 const m6={track:'Management',hp:30,courses:[['Tjänstelogik i teori och praktik',7.5],['Management och revision i professionella organisationer',7.5],['Fallstudie i företagspraktik',15]]};
 const k6={track:'Marknadsföring',hp:30,courses:[['Affärsdesign och investeringsbeslut',7.5],['Tjänstelogik i teori och praktik',7.5],['Fallstudie i företagspraktik',15]]};
 const r6={track:'Redovisning',hp:30,courses:[['Fallstudie i företagspraktik',15],['Valbart block',15]]};
 const m7={track:'Management',hp:30,courses:[['Pragmatiskt förändringsledarskap',15],['Ledarskap och reflekterande etik',7.5],['Forskningsmetoder i företagsekonomi',7.5]]};
 const k7={track:'Marknadsföring',hp:30,courses:[['Digital marknadskommunikation',7.5],['Management av affärsrelationer',7.5],['Ledarskap och reflekterande etik',7.5],['Forskningsmetoder i företagsekonomi',7.5]]};
 const r7={track:'Redovisning',hp:30,courses:[['Internationell redovisning',7.5],['Räkenskapsanalys och värdering',7.5],['Forskningsmetoder i företagsekonomi',7.5],['Ledarskap och reflekterande etik',7.5]]};
 x.rows=[
  r(1,'Makroekonomi',7.5),r(1,'Grundläggande marknadsföring',7.5),r(1,'Mikroekonomi',7.5),r(1,'Organisering och ledning',7.5),
  r(2,'Statistik I',7.5),r(2,'Redovisningens grunder och tekniker',7.5),r(2,'Internationell ekonomi',7.5),r(2,'Ekonomistyrning I',7.5),
  r(3,'Affärsjuridik I',15),r(3,'Externredovisning',7.5),r(3,'Finansiell ekonomi',7.5),
  r(4,'Strategisk marknadsföring',7.5),r(4,'Organisationsdesign och managementrecept',7.5),r(4,'Statistik II',7.5),r(4,'Finansiell planering',7.5),
  track(5,[m5,k5,r5]),track(6,[m6,k6,r6]),track(7,[m7,k7,r7]),track(8,[
   {track:'Management',hp:30,courses:[['Självständigt arbete för civilekonomexamen, management',30]]},
   {track:'Marknadsföring',hp:30,courses:[['Självständigt arbete för civilekonomexamen, marknadsföring',30]]},
   {track:'Redovisning',hp:30,courses:[['Självständigt arbete för civilekonomexamen, redovisning',30]]}
  ])
 ];
 x.coverage='choice-required';x.reason='official-plan-verified-complete-four-year-track-structure';x.termSums={1:30,2:30,3:30,4:30,5:30,6:30,7:30,8:30};
 x.sourceEvidenceUrl='https://kursinfodoc.hb.se/PdfMaker.aspx?code=ACEKO&language=SV&revision=18%2C20&type=program';x.verifiedProgrammeOverride=true;x.trackContinuityRequired=true;x.tracks=['Management','Marknadsföring','Redovisning'];x.checkedAt=new Date().toISOString();
}
await fs.writeFile(FILE,JSON.stringify(all,null,2)+'\n');
const meta=JSON.parse(await fs.readFile(META,'utf8'));meta.generatedAt=new Date().toISOString();meta.counts=all.reduce((a,v)=>(a[v.coverage]=(a[v.coverage]||0)+1,a),{});meta.retryable=all.filter(v=>['metadata-only','manual-review'].includes(v.coverage)).length;await fs.writeFile(META,JSON.stringify(meta,null,2)+'\n');
console.log('ACEKO verified:',x&&{coverage:x.coverage,reason:x.reason,termSums:x.termSums});
await import('./hb-verified-structure-overrides-4.mjs');
