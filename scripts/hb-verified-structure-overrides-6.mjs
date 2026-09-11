#!/usr/bin/env node
import fs from 'node:fs/promises';
const FILE='data/susa/structures.json',META='data/susa/structure-meta.json';
const all=JSON.parse(await fs.readFile(FILE,'utf8'));
const x=all.find(v=>String(v.programCode||'').toUpperCase()==='TGKEH');
const r=(term,name,hp)=>({term,name,hp,type:'required',isThesis:/examensarbete/i.test(name)});
if(x){
 x.rows=[
  r(1,'Digitala verktyg',4.5),r(1,'Inledande matematik',3),r(1,'Grundläggande kemi och laboratorieteknik',7.5),r(1,'Allmän och oorganisk kemi 1',7.5),r(1,'Matematisk analys',7.5),
  r(2,'Termodynamik',7.5),r(2,'Linjär algebra och differentialekvationer',7.5),r(2,'Allmän och oorganisk kemi 2',7.5),r(2,'Energiteknik',7.5),
  r(3,'Fysikalisk kemi',7.5),r(3,'Tillämpad matematik och statistik',7.5),r(3,'Analytisk kemi',7.5),r(3,'Organisk kemi',7.5),
  r(4,'Grundläggande kemiteknik',7.5),r(4,'Bioteknik I',7.5),r(4,'Polymerteknik',7.5),r(4,'Kemitekniska processer',7.5),
  r(5,'Biopolymerer',7.5),r(5,'Bioteknik II',7.5),r(5,'Hållbar utveckling',7.5),r(5,'Bioprocessteknik',7.5),
  r(6,'Produkter, processer och det hållbara samhället',7.5),r(6,'Projektteknik',7.5),r(6,'Examensarbete',15)
 ];
 x.coverage='complete';
 x.reason='official-plan-verified-complete-six-semester-structure';
 x.termSums={1:30,2:30,3:30,4:30,5:30,6:30};
 x.sourceEvidenceUrl='https://kursinfodoc.hb.se/PdfMaker.aspx?code=TGKEH&language=SV&revision=2%2C20&type=program';
 x.verifiedProgrammeOverride=true;
 x.studyStructureGranularity='term';
 x.checkedAt=new Date().toISOString();
}
await fs.writeFile(FILE,JSON.stringify(all,null,2)+'\n');
const meta=JSON.parse(await fs.readFile(META,'utf8'));meta.generatedAt=new Date().toISOString();meta.counts=all.reduce((a,v)=>(a[v.coverage]=(a[v.coverage]||0)+1,a),{});meta.retryable=all.filter(v=>['metadata-only','manual-review'].includes(v.coverage)).length;await fs.writeFile(META,JSON.stringify(meta,null,2)+'\n');
console.log('TGKEH verified:',x&&{coverage:x.coverage,reason:x.reason,termSums:x.termSums});
