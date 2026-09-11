#!/usr/bin/env node
import fs from 'node:fs/promises';
const FILE='data/susa/structures.json',META='data/susa/structure-meta.json';
const all=JSON.parse(await fs.readFile(FILE,'utf8'));
const find=code=>all.find(v=>String(v.programCode||'').toUpperCase()===code);
const course=(name,hp,type='required')=>({name,hp,type,isThesis:/examensarbete|kandidatuppsats/i.test(name)});
const r=(term,name,hp,type='required')=>({term,name,hp,type,isThesis:/examensarbete|kandidatuppsats/i.test(name)});

const apf=find('TGAPF');
if(apf){
 apf.rows=[];apf.coverage='manual-review';apf.reason='official-plan-verifies-complete-academic-year-course-structure-term-placement-unresolved';
 apf.academicYearCourses={
  1:[course('Byggnadsteknik',7.5),course('Matematik 1',7.5),course('Industriell ekonomi',7.5),course('Statistiska modeller och metoder',7.5),course('Byggnadsteknologi och affärsutveckling',7.5),course('Juridisk översiktskurs',15),course('Ritteknik med CAD och BIM',7.5)],
  2:[course('Projektteknik',7.5),course('Kvalitet och ledningssystem',7.5),course('Produktion grundkurs',7.5),course('Logistikens verktyg och metoder',7.5),course('Ledarskap, organisation och kommunikation',7.5),course('Innemiljö',7.5),course('Produktion fortsättningskurs',7.5),course('Projektering i byggprocessen',7.5)],
  3:[course('Fastighetsrätt',15),course('Styrning och samordning av byggprojekt',7.5),course('Fastighetsförvaltning',7.5),course('Livscykelanalys och miljöklassning',7.5),course('Fastighetsutveckling',7.5),course('Kandidatuppsats i byggteknik',15)]
 };
 apf.academicYearSums={1:60,2:60,3:60};apf.studyStructureGranularity='academic-year-only';apf.termPlacementVerified=false;apf.sourceEvidenceUrl='https://kursinfodoc.hb.se/PdfMaker.aspx?code=TGAPF&language=SV&revision=3%2C20&type=program';apf.verifiedProgrammeOverride=true;apf.checkedAt=new Date().toISOString();
}

const dtein=find('DTEIN');
if(dtein){
 dtein.rows=[];dtein.coverage='manual-review';dtein.reason='official-plan-verifies-complete-academic-year-course-structure-with-one-elective-slot-term-placement-unresolved';
 dtein.academicYearCourses={
  1:[course('Textil baskurs',5),course('Textilkemi I',4.5),course('Väveriteknik',5),course('Trikåteknik',5),course('Fiber- och garnteknologi',5),course('Färgning och beredning',5),course('Nonwoventeknik',5),course('Inledande matematik',3),course('Matematisk analys',7.5),course('Linjär algebra och differentialekvationer',7.5),course('Matematisk statistik',7.5)],
  2:[course('Textil mekanik- och hållfasthetslära',7.5),course('Textilkemi II',7.5),course('Fiber och garnteknologi påbyggnad',5),course('Konfektionsteknik',5),course('Sammanfogningstekniker',5),course('Kvalitetssäkring och textil provning med statistisk försöksplanering',7.5),course('Vävteknik påbyggnad',7.5),course('Polymerteknik',7.5),course('Hållbarhet inom textil och mode',7.5)],
  3:[course('Trikåteknik påbyggnad',5),course('Textilåtervinning',2.5),course('Fältstudie',15),course('Utvärdering av egenskaper och miljöpåverkan hos tekniska textilier',7.5),course('Vetenskaplig metod inom textilteknologi, kandidatnivå',7.5),course('Examensarbete Textilingenjör',15),{name:'Valbar kurs: Smarta textilier eller Biopolymerer',hp:7.5,type:'choice',choiceSlots:1,options:[{name:'Smarta textilier',hp:7.5},{name:'Biopolymerer',hp:7.5}],isThesis:false}]
 };
 dtein.academicYearSums={1:60,2:60,3:60};dtein.studyStructureGranularity='academic-year-only';dtein.termPlacementVerified=false;dtein.sourceEvidenceUrl='https://kursinfodoc.hb.se/PdfMaker.aspx?code=DTEIN&language=SV&revision=20%2C10&type=program';dtein.verifiedProgrammeOverride=true;dtein.checkedAt=new Date().toISOString();
}

const ngbid=find('NGBID');
if(ngbid){
 ngbid.rows=[r(1,'Introduktion till biblioteks- och informationsvetenskap',15),r(2,'Kunskapsorganisation och sökteknik – grund',15),r(3,'Bibliotek i samhället',15),r(4,'Bibliotek och användare',15),r(5,'Vetenskapsteori och forskningsmetoder 1',7.5),r(5,'Kunskapsorganisation och sökteknik med fokus explorativ sökteknik',7.5),r(6,'Vetenskapsteori och forskningsmetoder 2',7.5),r(6,'Professionell informationssökning',7.5),r(7,'Bibliotekens redskap och arbetsmetoder',15),r(8,'Kandidatuppsats',15)];
 ngbid.coverage='complete';ngbid.reason='official-current-plan-and-course-plans-verified-eight-semester-half-time-structure';ngbid.termSums={1:15,2:15,3:15,4:15,5:15,6:15,7:15,8:15};ngbid.expectedHpPerTerm=15;ngbid.studyPacePercent=50;ngbid.studyStructureGranularity='term';ngbid.termPlacementVerified=true;ngbid.sourceEvidenceUrl='https://kursinfodoc.hb.se/PdfMaker.aspx?code=NGBID&language=SV&revision=17%2C20&type=program';ngbid.verifiedProgrammeOverride=true;ngbid.checkedAt=new Date().toISOString();
}

const polis=find('POLIS');
if(polis){polis.rows=[];polis.coverage='manual-review';polis.reason='official-national-police-plan-special-case';polis.officialHp=120;polis.studyStructureGranularity='national-plan-special';polis.termPlacementVerified=false;polis.sourceEvidenceUrl='https://www.hb.se/utbildning/omraden/polis/polisprogrammet/';polis.verifiedProgrammeOverride=true;polis.checkedAt=new Date().toISOString()}
const kbast=find('KBAST');
if(kbast){kbast.rows=[];kbast.coverage='manual-review';kbast.reason='official-foundation-year-40-weeks-preparatory-non-higher-education-credit-system';kbast.officialHp=null;kbast.officialDurationWeeks=40;kbast.studyStructureGranularity='preparatory-year';kbast.termPlacementVerified=false;kbast.sourceEvidenceUrl='https://kursinfodoc.hb.se/PdfMaker.aspx?code=KBAST&language=SV&revision=11%2C000&type=program';kbast.verifiedProgrammeOverride=true;kbast.checkedAt=new Date().toISOString()}

await fs.writeFile(FILE,JSON.stringify(all,null,2)+'\n');
const meta=JSON.parse(await fs.readFile(META,'utf8'));meta.generatedAt=new Date().toISOString();meta.counts=all.reduce((a,v)=>(a[v.coverage]=(a[v.coverage]||0)+1,a),{});meta.retryable=all.filter(v=>['metadata-only','manual-review'].includes(v.coverage)&&!v.verifiedProgrammeOverride).length;await fs.writeFile(META,JSON.stringify(meta,null,2)+'\n');
console.log('HB verified batch 7',all.filter(v=>['TGAPF','DTEIN','NGBID','POLIS','KBAST'].includes(String(v.programCode||'').toUpperCase())).map(v=>({code:v.programCode,coverage:v.coverage,reason:v.reason,termSums:v.termSums,academicYearSums:v.academicYearSums})));
await import('./hb-verified-structure-overrides-8.mjs');
