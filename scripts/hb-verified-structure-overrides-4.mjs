#!/usr/bin/env node
import fs from 'node:fs/promises';
const FILE='data/susa/structures.json',META='data/susa/structure-meta.json';
const all=JSON.parse(await fs.readFile(FILE,'utf8'));
const r=(term,name,hp,type='required',extra={})=>({term,name,hp,type,isThesis:/examensarbete/i.test(name),...extra});
const choice=(term,name,hp,options)=>r(term,name,hp,'choice',{choiceSlots:1,options});
const dtdes=all.find(v=>String(v.programCode||'').toUpperCase()==='DTDES');
if(dtdes){
 dtdes.rows=[
  r(1,'Materiallära',5),r(1,'Textil baskurs',5),r(1,'Färgeri, tryck och beredning, bas',6),choice(1,'Valbara teknik- och designkurser: färgeri, tryck och beredning',9,[{name:'Fördjupning + designprojekt',hp:9,courses:[{name:'Färgeri, tryck och beredning, fördjupning',hp:4.5},{name:'Färgeri, tryck och beredning, designprojekt',hp:4.5}]},{name:'Designprojekt',hp:9,courses:[{name:'Färgeri, tryck och beredning, designprojekt',hp:9}]}]),r(1,'Färglära',5.5),
  r(2,'Väv, bas',6),choice(2,'Valbara teknik- och designkurser: väv',9,[{name:'Fördjupning + designprojekt',hp:9,courses:[{name:'Väv, fördjupning',hp:4.5},{name:'Väv, designprojekt',hp:4.5}]},{name:'Designprojekt',hp:9,courses:[{name:'Väv, designprojekt',hp:9}]}]),r(2,'Designestetik 1: historia och samtid',3),r(2,'Designmetodik 1: designutveckling',7.5),r(2,'Form och material',4),
  r(3,'Stickat och trikå, bas',6),choice(3,'Valbara teknik- och designkurser: stickat och trikå',9,[{name:'Fördjupning + designprojekt',hp:9,courses:[{name:'Stickat och trikå, fördjupning',hp:4.5},{name:'Stickat och trikå, designprojekt',hp:4.5}]},{name:'Designprojekt',hp:9,courses:[{name:'Stickat och trikå, designprojekt',hp:9}]}]),r(3,'Valbara kurser',7.5,'choice'),r(3,'Designmetodik 2: Experimentella metoder för textildesign',7.5),
  r(4,'Designprojekt: fördjupning',15),r(4,'Hållbarhet inom textil och mode',7.5),r(4,'Designestetik 2: kritik och bedömning',4.5),r(4,'Textil kommunikation',3),
  choice(5,'Designprojekt 4',18,[{name:'Designprojekt 4: designuppdrag',hp:18},{name:'Designprojekt 4: tillämpad design / designpraktik',hp:18}]),r(5,'Designmetodik 3: designforskning',7.5),r(6,'Visnings- och utställningsdesign',4.5),r(6,'Examensarbete',15)
 ];
 dtdes.coverage='choice-required';dtdes.reason='official-plan-verified-complete-structure-with-cross-semester-course';dtdes.termSums={1:30.5,2:29.5,3:30,4:30,5:25.5,6:19.5};dtdes.academicYearSums={1:60,2:60,3:60};dtdes.spanningCourses=[{name:'Designprojekt: koncept- och designutveckling',hp:15,startTerm:5,endTerm:6,type:'required'}];dtdes.sourceEvidenceUrl='https://kursinfodoc.hb.se/PdfMaker.aspx?code=DTDES&language=SV&revision=23%2C10&type=program';dtdes.verifiedProgrammeOverride=true;dtdes.studyStructureGranularity='term-with-spanning-course';dtdes.checkedAt=new Date().toISOString();
}
const lag46=all.find(v=>String(v.programCode||'').toUpperCase()==='LAG46');
if(lag46){
 lag46.rows=[
  r(1,'Utbildningsvetenskaplig kärna 1.1 för grundlärare med inriktning mot arbete i grundskolans årskurs 4-6',15),r(1,'Utbildningsvetenskaplig kärna 1.2 för förskollärare och grundlärare',15),
  r(2,'Svenska med didaktisk inriktning mot arbete i grundskolans årskurs 4-6, I',15),r(2,'Matematik med didaktisk inriktning mot arbete i grundskolans årskurs 4-6, I',15),
  choice(3,'Tillvalsämne',30,[{name:'Samhällsorienterade ämnen för grundlärare med inriktning mot arbete i grundskolans årskurs 4-6',hp:30},{name:'Naturvetenskap och teknik för grundlärare med inriktning mot arbete i grundskolans årskurs 4-6',hp:30}]),
  r(4,'Utbildningsvetenskaplig kärna 2.1; Hållbar utveckling och intersektionalitet',15),r(4,'Utbildningsvetenskaplig kärna 2.2; Specialpedagogiska perspektiv',7.5),r(4,'Utbildningsvetenskaplig kärna 2.3; Ledarskap, utvecklingsarbete och konflikthantering',7.5),
  r(5,'Engelska med didaktisk inriktning mot arbete i grundskolans årskurs 4-6, I',15),r(5,'Matematik med didaktisk inriktning mot arbete i grundskolans årskurs 4-6, II',15),
  r(6,'Svenska med didaktisk inriktning mot arbete i grundskolans årskurs 4-6, II',15),r(6,'Engelska med didaktisk inriktning mot arbete i grundskolans årskurs 4-6, II',15),
  r(7,'Utbildningsvetenskaplig kärna för grundlärare i grundskolans åk 4-6, III; Vetenskapliga perspektiv',15),r(7,'Examensarbete, del 1 - kunskapsöversikt',15),
  r(8,'Examensarbete, del 2',15),r(8,'Utvärdering och bedömning i svenska, engelska samt matematik för grundlärare med inriktning mot grundskolans åk 4-6',15)
 ];
 lag46.coverage='choice-required';lag46.reason='official-plan-verified-complete-eight-semester-structure';lag46.termSums={1:30,2:30,3:30,4:30,5:30,6:30,7:30,8:30};lag46.sourceEvidenceUrl='https://kursinfodoc.hb.se/PdfMaker.aspx?code=LAG46&language=SV&revision=20%2C000&type=program';lag46.verifiedProgrammeOverride=true;lag46.checkedAt=new Date().toISOString();
}
const tgiea=all.find(v=>String(v.programCode||'').toUpperCase()==='TGIEA');
if(tgiea){
 const tracks=['Byggteknik','Maskinteknik','Digitalisering'];
 const tr=(term,options)=>r(term,'Inriktningsspecifik termin',30,'choice',{choiceSlots:1,choiceGroup:'TGIEA-track',options});
 const opt=(track,courses)=>({track,hp:30,courses:courses.map(([name,hp])=>({name,hp}))});
 tgiea.rows=[
  r(1,'Matematisk analys 1',7.5),r(1,'Introduktion till ingenjörsmässigt arbete',7.5),r(1,'Matematisk analys 2',7.5),r(1,'Industriell Ekonomi',7.5),
  tr(2,[
   opt('Byggteknik',[['Linjär algebra',7.5],['Introduktion till byggteknik med ritteknik',7.5],['Vetenskapsteori och metod',2.5],['Grunder för uppföljning i kalkyleringsprogram',5],['Naturvetenskap',7.5]]),
   opt('Maskinteknik',[['Linjär algebra',7.5],['Grundläggande programmering i Python',7.5],['Vetenskapsteori och metod',2.5],['Grunder för uppföljning i kalkyleringsprogram',5],['Naturvetenskap',7.5]]),
   opt('Digitalisering',[['Linjär algebra',7.5],['Grundläggande programmering i Python',7.5],['Vetenskapsteori och metod',2.5],['Grunder för uppföljning i kalkyleringsprogram',5],['Naturvetenskap',7.5]])
  ]),
  tr(3,[
   opt('Byggteknik',[['Kvalitet och ledningssystem',7.5],['Grundläggande statistik med regressionsanalys',7.5],['Logistikens verktyg och metoder',7.5],['Produktion grundkurs',7.5]]),
   opt('Maskinteknik',[['Kvalitet och ledningssystem',7.5],['Grundläggande statistik med regressionsanalys',7.5],['Produktionsteknik',7.5],['Logistikens verktyg och metoder',7.5]]),
   opt('Digitalisering',[['Kvalitet och ledningssystem',7.5],['Grundläggande statistik med regressionsanalys',7.5],['Produktionsteknik',7.5],['Logistikens verktyg och metoder',7.5]])
  ]),
  tr(4,[
   opt('Byggteknik',[['Produktion II',7.5],['Inköp och investeringar',7.5],['Lean management',7.5],['Tillämpad byggnadsfysik och byggnadsmaterial',7.5]]),
   opt('Maskinteknik',[['Inköp och investeringar',7.5],['Tillverkningsteknologi',7.5],['Lean management',7.5],['Beräkningsmekanik 1',7.5]]),
   opt('Digitalisering',[['Distribution och e-handel',7.5],['Inköp och investeringar',7.5],['Lean management',7.5],['Cybersäkerhet för uppkopplade enheter',7.5]])
  ]),
  tr(5,[
   opt('Byggteknik',[['Styrning av försörjningskedjor',7.5],['Projektledning med rapportskrivning',7.5],['Fastighetsförvaltning',7.5],['Statistisk försöksplanering och kvalitetsstyrning',7.5]]),
   opt('Maskinteknik',[['Styrning av försörjningskedjor',7.5],['Projektledning med rapportskrivning',7.5],['Statistisk försöksplanering och kvalitetsstyrning',7.5],['Mekaniska konstruktioner 1',7.5]]),
   opt('Digitalisering',[['Styrning av försörjningskedjor',7.5],['Projektledning med rapportskrivning',7.5],['Statistisk försöksplanering och kvalitetsstyrning',7.5],['AI för affärsutveckling',7.5]])
  ]),
  tr(6,[
   opt('Byggteknik',[['Innemiljö',7.5],['Hållbar utveckling i ett ingenjörsperspektiv',7.5],['Examensarbete i industriell ekonomi',15]]),
   opt('Maskinteknik',[['Mekatronik',7.5],['Hållbar utveckling i ett ingenjörsperspektiv',7.5],['Examensarbete i industriell ekonomi',15]]),
   opt('Digitalisering',[['Databaser och dataanalys',7.5],['Hållbar utveckling i ett ingenjörsperspektiv',7.5],['Examensarbete i industriell ekonomi',15]])
  ])
 ];
 tgiea.coverage='choice-required';tgiea.reason='official-plan-verified-complete-six-semester-specialisation-structure';tgiea.termSums={1:30,2:30,3:30,4:30,5:30,6:30};tgiea.sourceEvidenceUrl='https://kursinfodoc.hb.se/PdfMaker.aspx?code=TGIEA&language=SV&revision=12%2C60&type=program';tgiea.verifiedProgrammeOverride=true;tgiea.trackContinuityRequired=true;tgiea.tracks=tracks;tgiea.checkedAt=new Date().toISOString();
}
await fs.writeFile(FILE,JSON.stringify(all,null,2)+'\n');
const meta=JSON.parse(await fs.readFile(META,'utf8'));meta.generatedAt=new Date().toISOString();meta.counts=all.reduce((a,v)=>(a[v.coverage]=(a[v.coverage]||0)+1,a),{});meta.retryable=all.filter(v=>['metadata-only','manual-review'].includes(v.coverage)).length;await fs.writeFile(META,JSON.stringify(meta,null,2)+'\n');
console.log('Verified structures 4:',[{code:'DTDES',coverage:dtdes?.coverage,reason:dtdes?.reason},{code:'LAG46',coverage:lag46?.coverage,reason:lag46?.reason},{code:'TGIEA',coverage:tgiea?.coverage,reason:tgiea?.reason,termSums:tgiea?.termSums}]);
