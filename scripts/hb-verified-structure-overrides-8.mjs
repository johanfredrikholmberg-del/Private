#!/usr/bin/env node
import fs from 'node:fs/promises';
const FILE='data/susa/structures.json',META='data/susa/structure-meta.json';
const all=JSON.parse(await fs.readFile(FILE,'utf8'));
const find=code=>all.find(v=>String(v.programCode||'').toUpperCase()===code);
const r=(term,name,hp,type='required')=>({term,name,hp,type,isThesis:/examensarbete|kandidatuppsats|masteruppsats/i.test(name)});

const lag=find('LAGF3');
if(lag){
 const rows=(lag.rows||[]).filter(x=>!(x.term===8&&/examensarbete,? del 2/i.test(String(x.name||''))));
 rows.push(r(8,'Kurs: Examensarbete, del 2',15));
 lag.rows=rows.sort((a,b)=>a.term-b.term);
 lag.termSums=Object.fromEntries([...new Set(lag.rows.map(x=>x.term))].map(t=>[t,lag.rows.filter(x=>x.term===t).reduce((s,x)=>s+Number(x.hp||0),0)]));
 if(Object.keys(lag.termSums).length===8&&Object.values(lag.termSums).every(x=>Math.abs(x-30)<.01)){lag.coverage='complete';lag.reason='official-current-plan-verified-eight-semester-structure-malformed-thesis-credit-restored';lag.verifiedProgrammeOverride=true;lag.studyStructureGranularity='term';lag.termPlacementVerified=true;lag.sourceEvidenceUrl='https://kursinfodoc.hb.se/PdfMaker.aspx?code=LAGF3&language=SV&revision=27%2C10&type=program';lag.checkedAt=new Date().toISOString()}
}

const tm=find('TMFMM');
if(tm){
 tm.rows=(tm.rows||[]).filter(x=>x.term!==4).concat([r(4,'Masteruppsats i textilt management',30)]).sort((a,b)=>a.term-b.term);
 tm.termSums=Object.fromEntries([...new Set(tm.rows.map(x=>x.term))].map(t=>[t,tm.rows.filter(x=>x.term===t).reduce((s,x)=>s+Number(x.hp||0),0)]));
 if(Object.keys(tm.termSums).length===4&&Object.values(tm.termSums).every(x=>Math.abs(x-30)<.01)){tm.coverage='complete';tm.reason='official-current-plan-verified-four-semester-structure-master-thesis-30hp';tm.verifiedProgrammeOverride=true;tm.studyStructureGranularity='term';tm.termPlacementVerified=true;tm.sourceEvidenceUrl='https://kursinfodoc.hb.se/PdfMaker.aspx?code=TMFMM&language=SV&revision=6%2C20&type=program';tm.checkedAt=new Date().toISOString()}
}

const dm=find('DMODE');
if(dm){dm.coverage='manual-review';dm.reason='official-current-plan-verifies-course-structure-but-cross-term-course-allocation-is-not-explicit';dm.verifiedProgrammeOverride=true;dm.studyStructureGranularity='term-with-cross-term-course';dm.termPlacementVerified=false;dm.sourceEvidenceUrl='https://kursinfodoc.hb.se/PdfMaker.aspx?code=DMODE&language=SV&revision=23%2C20&type=program';dm.checkedAt=new Date().toISOString()}

await fs.writeFile(FILE,JSON.stringify(all,null,2)+'\n');
const meta=JSON.parse(await fs.readFile(META,'utf8'));meta.generatedAt=new Date().toISOString();meta.counts=all.reduce((a,v)=>(a[v.coverage]=(a[v.coverage]||0)+1,a),{});meta.retryable=all.filter(v=>['metadata-only','manual-review'].includes(v.coverage)&&!v.verifiedProgrammeOverride).length;await fs.writeFile(META,JSON.stringify(meta,null,2)+'\n');
console.log('HB verified batch 8',all.filter(v=>['LAGF3','TMFMM','DMODE'].includes(String(v.programCode||'').toUpperCase())).map(v=>({code:v.programCode,coverage:v.coverage,reason:v.reason,termSums:v.termSums})));
await import('./hb-verified-structure-overrides-9.mjs');
