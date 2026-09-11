#!/usr/bin/env node
import fs from 'node:fs/promises';
const FILE='data/susa/structures.json',META='data/susa/structure-meta.json';
const all=JSON.parse(await fs.readFile(FILE,'utf8'));
const x=all.find(v=>String(v.programCode||'').toUpperCase()==='DTDES');
const r=(term,name,hp,type='required',extra={})=>({term,name,hp,type,isThesis:/examensarbete/i.test(name),...extra});
const choice=(term,name,hp,options)=>r(term,name,hp,'choice',{choiceSlots:1,options});
if(x){
 x.rows=[
  r(1,'Materiallära',5),r(1,'Textil baskurs',5),r(1,'Färgeri, tryck och beredning, bas',6),
  choice(1,'Valbara teknik- och designkurser: färgeri, tryck och beredning',9,[{name:'Fördjupning + designprojekt',hp:9,courses:[{name:'Färgeri, tryck och beredning, fördjupning',hp:4.5},{name:'Färgeri, tryck och beredning, designprojekt',hp:4.5}]},{name:'Designprojekt',hp:9,courses:[{name:'Färgeri, tryck och beredning, designprojekt',hp:9}]}]),
  r(1,'Färglära',5.5),
  r(2,'Väv, bas',6),choice(2,'Valbara teknik- och designkurser: väv',9,[{name:'Fördjupning + designprojekt',hp:9,courses:[{name:'Väv, fördjupning',hp:4.5},{name:'Väv, designprojekt',hp:4.5}]},{name:'Designprojekt',hp:9,courses:[{name:'Väv, designprojekt',hp:9}]}]),r(2,'Designestetik 1: historia och samtid',3),r(2,'Designmetodik 1: designutveckling',7.5),r(2,'Form och material',4),
  r(3,'Stickat och trikå, bas',6),choice(3,'Valbara teknik- och designkurser: stickat och trikå',9,[{name:'Fördjupning + designprojekt',hp:9,courses:[{name:'Stickat och trikå, fördjupning',hp:4.5},{name:'Stickat och trikå, designprojekt',hp:4.5}]},{name:'Designprojekt',hp:9,courses:[{name:'Stickat och trikå, designprojekt',hp:9}]}]),r(3,'Valbara kurser',7.5,'choice'),r(3,'Designmetodik 2: Experimentella metoder för textildesign',7.5),
  r(4,'Designprojekt: fördjupning',15),r(4,'Hållbarhet inom textil och mode',7.5),r(4,'Designestetik 2: kritik och bedömning',4.5),r(4,'Textil kommunikation',3),
  choice(5,'Designprojekt 4',18,[{name:'Designprojekt 4: designuppdrag',hp:18},{name:'Designprojekt 4: tillämpad design / designpraktik',hp:18}]),r(5,'Designmetodik 3: designforskning',7.5),
  r(6,'Visnings- och utställningsdesign',4.5),r(6,'Examensarbete',15)
 ];
 x.coverage='choice-required';x.reason='official-plan-verified-complete-structure-with-cross-semester-course';
 x.termSums={1:30.5,2:29.5,3:30,4:30,5:25.5,6:19.5};x.academicYearSums={1:60,2:60,3:60};
 x.spanningCourses=[{name:'Designprojekt: koncept- och designutveckling',hp:15,startTerm:5,endTerm:6,type:'required'}];
 x.sourceEvidenceUrl='https://kursinfodoc.hb.se/PdfMaker.aspx?code=DTDES&language=SV&revision=23%2C10&type=program';
 x.verifiedProgrammeOverride=true;x.studyStructureGranularity='term-with-spanning-course';x.checkedAt=new Date().toISOString();
}
await fs.writeFile(FILE,JSON.stringify(all,null,2)+'\n');
const meta=JSON.parse(await fs.readFile(META,'utf8'));meta.generatedAt=new Date().toISOString();meta.counts=all.reduce((a,v)=>(a[v.coverage]=(a[v.coverage]||0)+1,a),{});meta.retryable=all.filter(v=>['metadata-only','manual-review'].includes(v.coverage)).length;await fs.writeFile(META,JSON.stringify(meta,null,2)+'\n');
console.log('DTDES verified:',x&&{coverage:x.coverage,reason:x.reason,termSums:x.termSums,academicYearSums:x.academicYearSums});
