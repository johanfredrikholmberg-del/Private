#!/usr/bin/env node
import fs from 'node:fs/promises';
const FILE='data/susa/structures.json',META='data/susa/structure-meta.json';
const all=JSON.parse(await fs.readFile(FILE,'utf8'));
const find=code=>all.find(v=>String(v.programCode||'').toUpperCase()===code);

const gitek=find('GITEK');
if(gitek){gitek.coverage='manual-review';gitek.reason='official-plan-verifies-complete-academic-year-course-structure-with-year-3-degree-track-choice-term-placement-unresolved';gitek.verifiedProgrammeOverride=true;gitek.studyStructureGranularity='academic-year-only';gitek.termPlacementVerified=false;gitek.academicYearSums={1:60,2:60,3:60};gitek.sourceEvidenceUrl='https://kursinfodoc.hb.se/PdfMaker.aspx?code=GITEK&language=SV&revision=1%2C000&type=program';gitek.checkedAt=new Date().toISOString()}

const bmbd=find('BMBD1');
if(bmbd){bmbd.coverage='manual-review';bmbd.reason='official-plan-verifies-complete-1-60-and-61-120-credit-blocks-with-alternative-and-elective-courses-no-term-placement';bmbd.verifiedProgrammeOverride=true;bmbd.studyStructureGranularity='credit-block-only';bmbd.termPlacementVerified=false;bmbd.creditBlockSums={'1-60':60,'61-120':60};bmbd.sourceEvidenceUrl='https://kursinfodoc.hb.se/PdfMaker.aspx?code=BMBD1&language=SV&revision=7%2C100&type=program';bmbd.checkedAt=new Date().toISOString()}

await fs.writeFile(FILE,JSON.stringify(all,null,2)+'\n');
const meta=JSON.parse(await fs.readFile(META,'utf8'));meta.generatedAt=new Date().toISOString();meta.counts=all.reduce((a,v)=>(a[v.coverage]=(a[v.coverage]||0)+1,a),{});meta.retryable=all.filter(v=>['metadata-only','manual-review'].includes(v.coverage)&&!v.verifiedProgrammeOverride).length;await fs.writeFile(META,JSON.stringify(meta,null,2)+'\n');
console.log('HB verified batch 9',all.filter(v=>['GITEK','BMBD1'].includes(String(v.programCode||'').toUpperCase())).map(v=>({code:v.programCode,coverage:v.coverage,reason:v.reason})));
