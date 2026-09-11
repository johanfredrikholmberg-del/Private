#!/usr/bin/env node
import fs from 'node:fs/promises';
const FILE='data/susa/structures.json';
const META='data/susa/structure-meta.json';
const all=JSON.parse(await fs.readFile(FILE,'utf8'));
const byCode=new Map(all.filter(x=>x.programCode).map(x=>[String(x.programCode).toUpperCase(),x]));
const r=(term,name,hp,type='required',extra={})=>({term,name,hp,type,isThesis:/examensarbete|thesis/i.test(name),...extra});
const sums=rows=>Object.fromEntries([...new Set(rows.map(x=>x.term))].sort((a,b)=>a-b).map(t=>[t,rows.filter(x=>x.term===t).reduce((s,x)=>s+x.hp,0)]));
function finish(x,coverage,reason,url){x.rows=x.rows.sort((a,b)=>a.term-b.term);x.coverage=coverage;x.reason=reason;x.termSums=sums(x.rows);x.sourceEvidenceUrl=url;x.verifiedProgrammeOverride=true;x.checkedAt=new Date().toISOString();delete x.unassignedCourses;}

// TGTPI — current official plan, revision 3.20. Semester 5 has three elective 7.5-credit courses.
{
 const x=byCode.get('TGTPI'); if(x){
  x.rows=[
   r(1,'Introduktionskurs textil produktion och innovation',2.5),r(1,'Textil baskurs',5),r(1,'Textilteknisk vetenskap I',7.5),r(1,'Fiber- och garnteknologi',5),r(1,'Väveriteknik',5),r(1,'Trikåteknik',5),
   r(2,'Textilteknisk vetenskap II',7.5),r(2,'Produktutveckling av tekniska textilier',7.5),r(2,'Nonwoven-teknik',5),r(2,'Färgning och beredning',5),r(2,'Digitala verktyg för kommunikation',5),
   r(3,'Textila strukturer',7.5),r(3,'Textil innovation',7.5),r(3,'Konfektionsteknik',5),r(3,'Kvalitetssäkring och textil provning',5),r(3,'Sammanfogningstekniker för textila produkter',5),
   r(4,'Designprocesser och prototypframtagning',7.5),r(4,'Digital transformation inom textil',7.5),r(4,'Projektmanagement och global kommunikation',7.5),r(4,'Hållbarhet inom textil och mode',7.5),
   r(5,'Textila regelverk för produktframtagning',7.5),
   r(5,'Valbar specialiseringskurs I',7.5,'choice',{choiceGroup:'TGTPI-specialisation'}),r(5,'Valbar specialiseringskurs II',7.5,'choice',{choiceGroup:'TGTPI-specialisation'}),r(5,'Valbar specialiseringskurs III',7.5,'choice',{choiceGroup:'TGTPI-specialisation',options:[
    {track:'Material Innovation',courses:['Smarta textilier','Textil återvinning och nya hållbara fibrer','Textil funktionalisering']},
    {track:'Product Innovation',courses:['Konstruktionstekniker för textila produkter','Produktionsteknik för textila produkter','Textil prototypframtagning för produktion']}
   ]}),
   r(6,'Textilteknisk fördjupning med vetenskaplig metod',15),r(6,'Examensarbete',15)
  ];
  finish(x,'choice-required','official-plan-verified-complete-six-semester-structure','https://kursinfodoc.hb.se/PdfMaker.aspx?code=TGTPI&language=EN&revision=3%2C20&type=program');
 }
}

// TGENA — current official plan revision 8.20. Courses without an explicit value are 7.5 credits.
{
 const x=byCode.get('TGENA'); if(x){
  x.rows=[
   r(1,'Digitala verktyg',4.5),r(1,'Inledande matematik',3),r(1,'Elteknik',7.5),r(1,'Hållbar utveckling',7.5),r(1,'Matematisk analys',7.5),
   r(2,'Linjär algebra och differentialekvationer',7.5),r(2,'Termodynamik',7.5),r(2,'Energiteknik I',7.5),r(2,'Elkretsanalys',7.5),
   r(3,'Energiteknik II',7.5),r(3,'Tillämpad matematik och statistik',7.5),r(3,'Fjärrvärme och fjärrkyla',7.5),r(3,'Elkraftteknik',7.5),
   r(4,'Elanläggnings- och reläskyddsteknik',7.5),r(4,'Installationsteknik',7.5),r(4,'Ritteknik med installationsteknisk CAD',7.5),r(4,'Projektteknik',7.5),
   r(5,'Elkrafttekniska beräkningar och elkvalitet',7.5),r(5,'Byggnaders inomhusmiljö och energiprestanda',7.5),r(5,'Styr- och reglerteknik - smarta hus',7.5),r(5,'Förnyelsebar energi, batterier och energilagring',7.5),
   r(6,'Val av termin 6-spår',30,'choice',{choiceSlots:1,options:[
    {name:'Praktikspår',hp:30,courses:[{name:'Arbetsplatsförlagd utbildning för energiingenjörer',hp:15},{name:'Examensarbete',hp:15}]},
    {name:'Kursspår',hp:30,courses:[{name:'Valbar kurs I',hp:7.5},{name:'Valbar kurs II',hp:7.5},{name:'Examensarbete',hp:15}]}
   ]})
  ];
  finish(x,'choice-required','official-plan-verified-complete-six-semester-structure-with-term-6-tracks','https://kursinfodoc.hb.se/PdfMaker.aspx?code=TGENA&language=SV&revision=8%2C20&type=program');
 }
}

// VGLOV — official full-time schedule. Semester loads are intentionally uneven; each academic year still totals 60 credits.
{
 const x=byCode.get('VGLOV'); if(x){
  x.rows=[
   r(1,'Introduktion till Vård- och omsorgsadministration',5),r(1,'Offentlig förvaltning',7.5),r(1,'Ekonomi, redovisning och budgetering',7.5),r(1,'Etik och prioriteringar',7.5),
   r(2,'Organisering och styrning 1',5),r(2,'Ledarskap 1',5),r(2,'Förbättringskunskap',7.5),r(2,'Vårdande begrepp och perspektiv',7.5),r(2,'Ledarskap 2 - Gruppdynamik och konflikthantering',7.5),
   r(3,'Socialrätt',7.5),r(3,'Vetenskaplig teori och metod 1',15),r(3,'Organisering och styrning inom vård och omsorg 2',7.5),r(3,'Ledarskap 3 - Förändringsledarskap',7.5),
   r(4,'Äldre inom vård och omsorg',7.5),r(4,'Arbetsrätt',7.5),r(4,'Ledarskap 4 - Ledarskap och samverkan i vardag, kris och katastrof',7.5),
   r(5,'Arbetsmiljö',7.5),r(5,'Förbättringskunskap 2',7.5),r(5,'Vetenskaplig teori och metod 2',15),
   r(6,'Valbar kurs',15,'choice'),r(6,'Självständigt arbete för kandidatexamen i Vård- och omsorgsadministration',15)
  ];
  finish(x,'choice-required','official-plan-verified-full-time-schedule-with-uneven-semester-loads','https://kursinfodoc.hb.se/PdfMaker.aspx?code=VGLOV&language=SV&revision=1%2C000&type=program');
  x.studyPaceVariant='helfart';x.academicYearSums={1:60,2:60,3:60};
 }
}

await fs.writeFile(FILE,JSON.stringify(all,null,2)+'\n');
const meta=JSON.parse(await fs.readFile(META,'utf8'));meta.generatedAt=new Date().toISOString();meta.counts=all.reduce((a,x)=>(a[x.coverage]=(a[x.coverage]||0)+1,a),{});meta.retryable=all.filter(x=>['metadata-only','manual-review'].includes(x.coverage)).length;await fs.writeFile(META,JSON.stringify(meta,null,2)+'\n');
console.log('Verified full structures 2:', ['TGTPI','TGENA','VGLOV'].map(code=>({code,coverage:byCode.get(code)?.coverage,termSums:byCode.get(code)?.termSums})));
