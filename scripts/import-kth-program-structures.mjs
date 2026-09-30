#!/usr/bin/env node
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const term=process.env.STUDIELOTS_TERM||'HT26';
const programsPath='data/HT26/programs.json';
const structuresPath='data/HT26/program-structures.json';
const reportPath='data/import-reviews/kth-program-structures-ht26-latest.json';
const mod=await import(pathToFileURL(process.cwd()+'/api/kth-program-structure.js'));
const handler=mod.default;

const programs=JSON.parse(await fs.readFile(programsPath,'utf8'));
const structures=JSON.parse(await fs.readFile(structuresPath,'utf8'));
let previous=null;
try{previous=JSON.parse(await fs.readFile(reportPath,'utf8'))}catch(e){if(e?.code!=='ENOENT')throw e}
const retryAfter=previous?.retryAfter||new Date(Date.parse(previous?.generatedAt||new Date().toISOString())+7*86400000).toISOString();
const deferred=new Set(process.env.KTH_FORCE_RETRY==='1'?[]:(Date.now()<Date.parse(retryAfter)?(previous?.deferredCodes||previous?.failed?.map(x=>x.code)||[]):[]));
const rows=Array.isArray(programs)?programs:(programs.programs||[]);
const existing=Array.isArray(structures)?structures:(structures.programs||[]);
const isKth=x=>x.providerId==='p.uoh.kth'||/\bkth\b|kungl\.? tekniska|kungliga tekniska/i.test(String(x.university||x.provider||x.universityName||x.providerName||''));
const candidates=rows.filter(isKth).sort((a,b)=>{
  const ak=knownSortKey(a),bk=knownSortKey(b);
  return ak-bk||(Number(a.programHp)||999)-(Number(b.programHp)||999)||key(a).localeCompare(key(b),'sv');
});
const limit=Number(process.env.KTH_STRUCTURE_LIMIT||500);
const out=[...existing];
const report={generatedAt:new Date().toISOString(),term,catalogueProgrammes:candidates.length,attempted:0,imported:0,failed:[],retryAfter:deferred.size?retryAfter:new Date(Date.now()+7*86400000).toISOString(),deferredCodes:[],verifiedProgrammeCodes:[]};

const call=async p=>new Promise(resolve=>{
 const req={query:{code:p.programCode||p.code||'',name:p.programName||p.name||'',university:p.university||p.provider||p.universityName||p.providerName||'KTH'}};
 const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this},json(v){resolve(v);return this}};
 Promise.resolve(handler(req,res)).catch(e=>resolve({found:false,error:String(e)}));
});

const key=x=>String(x.programCode||x.code||'').trim().toUpperCase();
const knownCodes=new Set(out.filter(isKth).map(key).filter(Boolean));
const knownSortKey=x=>knownCodes.has(key(x))?1:0;
const known=knownCodes;
for(const p of candidates){
 const code=key(p); if(!code||known.has(code)||deferred.has(code))continue;
 if(report.attempted>=limit)break;
 report.attempted++;
 const r=await call(p);
 if(!r?.structureAvailable||!Array.isArray(r.courses)||!r.courses.length){report.failed.push({code,reason:r?.coverage||r?.error||'not-verified',quality:r?.quality||null});continue}
 out.push({university:'KTH',programCode:code,programName:p.programName||p.name||r.program?.name||code,term,courses:r.courses,source:r.source,sourceUrls:r.sourceUrls,confidence:r.confidence,coverage:r.coverage,quality:r.quality,verifiedAt:new Date().toISOString()});
 known.add(code);report.imported++;report.verifiedProgrammeCodes.push(code);
}
report.deferredCodes=[...new Set([...deferred,...report.failed.map(x=>x.code)])];
await fs.writeFile(structuresPath,JSON.stringify(out,null,2)+'\n');
await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
