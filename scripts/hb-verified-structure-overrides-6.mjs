#!/usr/bin/env node
import fs from 'node:fs/promises';
const FILE='data/susa/structures.json',META='data/susa/structure-meta.json';
const all=JSON.parse(await fs.readFile(FILE,'utf8'));
const r=(term,name,hp,type='required')=>({term,name,hp,type,isThesis:/examensarbete|kandidatuppsats/i.test(name)});
const tg=all.find(v=>String(v.programCode||'').toUpperCase()==='TGKEH');
if(tg){
 tg.rows=[
  r(1,'Digitala verktyg',4.5),r(1,'Inledande matematik',3),r(1,'Grundläggande kemi och laboratorieteknik',7.5),r(1,'Allmän och oorganisk kemi 1',7.5),r(1,'Matematisk analys',7.5),
  r(2,'Termodynamik',7.5),r(2,'Linjär algebra och differentialekvationer',7.5),r(2,'Allmän och oorganisk kemi 2',7.5),r(2,'Energiteknik',7.5),
  r(3,'Fysikalisk kemi',7.5),r(3,'Tillämpad matematik och statistik',7.5),r(3,'Analytisk kemi',7.5),r(3,'Organisk kemi',7.5),
  r(4,'Grundläggande kemiteknik',7.5),r(4,'Bioteknik I',7.5),r(4,'Polymerteknik',7.5),r(4,'Kemitekniska processer',7.5),
  r(5,'Biopolymerer',7.5),r(5,'Bioteknik II',7.5),r(5,'Hållbar utveckling',7.5),r(5,'Bioprocessteknik',7.5),
  r(6,'Produkter, processer och det hållbara samhället',7.5),r(6,'Projektteknik',7.5),r(6,'Examensarbete',15)
 ];
 tg.coverage='complete';tg.reason='official-plan-verified-complete-six-semester-structure';tg.termSums={1:30,2:30,3:30,4:30,5:30,6:30};tg.sourceEvidenceUrl='https://kursinfodoc.hb.se/PdfMaker.aspx?code=TGKEH&language=SV&revision=2%2C20&type=program';tg.verifiedProgrammeOverride=true;tg.studyStructureGranularity='term';tg.checkedAt=new Date().toISOString();
}
const bib=all.find(v=>String(v.programCode||'').toUpperCase()==='NGBIB');
if(bib){
 bib.rows=[
  r(1,'Introduktion till biblioteks- och informationsvetenskap',15),r(1,'Bibliotek i samhället',15),
  r(2,'Kunskapsorganisation och sökteknik – grund',15),r(2,'Bibliotek och användare',15),
  r(3,'Bibliotekens redskap och arbetsmetoder',15),r(3,'Vetenskapsteori och forskningsmetoder 1',7.5),r(3,'Kunskapsorganisation och sökteknik med fokus explorativ sökteknik',7.5),
  r(4,'Biblioteks- och informationsvetenskapliga fältstudier',15),r(4,'Informationskompetens och lärande',7.5),r(4,'Professionell informationssökning',7.5),
  r(5,'Valbara kurser inom biblioteks- och informationsvetenskap',30,'choice'),
  r(6,'Vetenskapsteori och forskningsmetoder 2',7.5),r(6,'Biblioteksorganisationers kompetensförsörjning',7.5),r(6,'Kandidatuppsats',15)
 ];
 bib.coverage='choice-required';bib.reason='official-current-plan-verified-complete-six-semester-structure-with-elective-term-5';bib.termSums={1:30,2:30,3:30,4:30,5:30,6:30};bib.sourceEvidenceUrl='https://kursinfodoc.hb.se/PdfMaker.aspx?code=NGBIB&language=SV&revision=17%2C00&type=program';bib.verifiedProgrammeOverride=true;bib.studyStructureGranularity='term';bib.checkedAt=new Date().toISOString();
}
await fs.writeFile(FILE,JSON.stringify(all,null,2)+'\n');
const meta=JSON.parse(await fs.readFile(META,'utf8'));meta.generatedAt=new Date().toISOString();meta.counts=all.reduce((a,v)=>(a[v.coverage]=(a[v.coverage]||0)+1,a),{});meta.retryable=all.filter(v=>['metadata-only','manual-review'].includes(v.coverage)).length;await fs.writeFile(META,JSON.stringify(meta,null,2)+'\n');
console.log('Verified Borås structures 6:',all.filter(v=>['TGKEH','NGBIB'].includes(String(v.programCode||'').toUpperCase())).map(v=>({code:v.programCode,coverage:v.coverage,termSums:v.termSums})));
