#!/usr/bin/env node
import fs from 'node:fs/promises';
const FILE='data/susa/structures.json',META='data/susa/structure-meta.json';
const all=JSON.parse(await fs.readFile(FILE,'utf8'));
const official='https://kursinfodoc.hb.se/PdfMaker.aspx?code=SGKMM&language=SV&revision=1%2C00&type=program';
const years={
  1:[['Mode och den kreativa processen',7.5],['Textil baskurs',5],['Fiber och garnteknologi',5],['Grundläggande marknadsföring',7.5],['Väveriteknik',5],['Redovisningens grunder och tekniker',7.5],['Trikåteknik',5],['Nonwoventeknik',5],['Organisering och ledning',7.5],['Konfektionsteknik',5]],
  2:[['Kvantitativ marknadsundersökningsmetodik',7.5],['Kvalitetssäkring och textil provning',5],['Färgning och beredning',5],['Logistik och styrning av försörjningskedjor',7.5],['Teorier om textil detaljhandel',7.5],['Modevetenskaplig teori och metod',7.5],['Affärssystem och organisering av kundrelationer',7.5],['Hållbarhet inom textil och mode',7.5],['Digital marknadsföring och modehandel',5]],
  3:[['Marknadskommunikation',7.5],['Konsumentbeteende',7.5],['Fältstudie inom detaljhandel',15],['Textilt management i ett detaljhandelsperspektiv',7.5],['Forskningsmetoder på kandidatnivå',7.5],['Självständigt arbete för kandidatexamen inom textilt management',15]]
};
for(const code of ['SGKMM','SGKTM']){
  const x=all.find(v=>String(v.programCode||'').toUpperCase()===code);if(!x)continue;
  x.coverage='manual-review';x.reason='official-plan-verifies-academic-years-but-explicitly-not-chronological-within-years';x.rows=[];
  x.academicYearCourses=Object.fromEntries(Object.entries(years).map(([y,cs])=>[y,cs.map(([name,hp])=>({name,hp,type:'required',isThesis:/självständigt arbete/i.test(name)}))]));
  x.academicYearSums={1:60,2:60,3:60};x.studyStructureGranularity='academic-year-only';x.termPlacementVerified=false;x.sourceEvidenceUrl=official;x.verifiedProgrammeOverride=true;
  if(code==='SGKTM')x.successorProgrammeCode='SGKMM';x.checkedAt=new Date().toISOString();
}
await fs.writeFile(FILE,JSON.stringify(all,null,2)+'\n');
const meta=JSON.parse(await fs.readFile(META,'utf8'));meta.generatedAt=new Date().toISOString();meta.counts=all.reduce((a,v)=>(a[v.coverage]=(a[v.coverage]||0)+1,a),{});meta.retryable=all.filter(v=>['metadata-only','manual-review'].includes(v.coverage)).length;await fs.writeFile(META,JSON.stringify(meta,null,2)+'\n');
console.log('Verified Borås academic-year grouping:',all.filter(v=>['SGKMM','SGKTM'].includes(String(v.programCode||'').toUpperCase())).map(v=>({code:v.programCode,coverage:v.coverage,reason:v.reason,academicYearSums:v.academicYearSums})));
await import('./hb-verified-structure-overrides-6.mjs');
