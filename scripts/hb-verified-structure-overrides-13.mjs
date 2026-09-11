#!/usr/bin/env node
import fs from 'node:fs/promises';
const FILE='data/susa/structures.json',META='data/susa/structure-meta.json';
const all=JSON.parse(await fs.readFile(FILE,'utf8'));
const defs={
 AMSTV:['11%2C20','current-plan-identified-source-specific-master-structure-normalisation-required'],
 KMATM:['4%2C10','current-plan-identified-artistic-master-structure-normalisation-required'],
 'LGFÖR':['21%2C00','current-plan-identified-teacher-education-structure-normalisation-required'],
 SAMPD:['7%2C00','current-plan-identified-half-speed-master-structure-normalisation-required'],
 TAREB:['6%2C10','current-plan-identified-resource-recovery-structure-normalisation-required'],
 TAREE:['6%2C10','current-plan-identified-resource-recovery-structure-normalisation-required'],
 TAREP:['7%2C10','current-plan-identified-resource-recovery-structure-normalisation-required'],
 TAVEB:['3%2C10','current-plan-identified-resource-recovery-structure-normalisation-required'],
 TAVEE:['3%2C10','current-plan-identified-resource-recovery-structure-normalisation-required']
};
for(const [code,[rev,reason]] of Object.entries(defs))for(const p of all.filter(v=>String(v.programCode||'').toUpperCase()===code)){p.coverage='manual-review';p.reason=reason;p.verifiedProgrammeOverride=true;p.normalisationRequired=true;p.termPlacementVerified=false;p.sourceEvidenceUrl=`https://kursinfodoc.hb.se/PdfMaker.aspx?code=${encodeURIComponent(code)}&language=SV&revision=${rev}&type=program`;p.checkedAt=new Date().toISOString()}
await fs.writeFile(FILE,JSON.stringify(all,null,2)+'\n');
const meta=JSON.parse(await fs.readFile(META,'utf8'));meta.generatedAt=new Date().toISOString();meta.counts=all.reduce((a,v)=>(a[v.coverage]=(a[v.coverage]||0)+1,a),{});meta.retryable=all.filter(v=>['metadata-only','manual-review'].includes(v.coverage)&&!v.verifiedProgrammeOverride).length;await fs.writeFile(META,JSON.stringify(meta,null,2)+'\n');
console.log('HB verified batch 13',all.filter(v=>Object.hasOwn(defs,String(v.programCode||'').toUpperCase())).map(v=>({code:v.programCode,coverage:v.coverage,reason:v.reason})));
