#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const GU='data/gu';
const TARGET='data/HT26/program-structures.json';
const QUEUE='data/susa/structure-queue.json';
const clean=v=>String(v??'').trim();
const norm=v=>clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const codeNorm=v=>clean(v).toUpperCase().replace(/[^A-Z0-9ÅÄÖ]/g,'');

const names=(await fs.readdir(GU)).filter(n=>/^verified-.*\.json$/i.test(n));
const overrides=[];
for(const name of names){
  const raw=JSON.parse(await fs.readFile(path.join(GU,name),'utf8'));
  overrides.push(raw);
}

const structures=JSON.parse(await fs.readFile(TARGET,'utf8'));
const queue=JSON.parse(await fs.readFile(QUEUE,'utf8'));
const guQueue=queue.filter(x=>/goteborgs universitet/.test(norm(x.university)));
const guKeys=new Set(guQueue.map(x=>x.key));
const byCode=new Map(structures.map((x,i)=>[codeNorm(x.programCode),i]));
let applied=0;
for(const o of overrides){
  const i=byCode.get(codeNorm(o.programCode));
  if(i==null) continue;
  const old=structures[i];
  const rows=(o.rows||[]).map((r,j)=>({
    ...r,
    originalTerm:r.term,
    __slOriginalTerm:r.term,
    __slOriginalIndex:j,
    status:'remaining',
    credited:false,
    isCredited:false,
    programmeSource:'gu-official-direct-verification',
    programmeCategory:r.category||'unknown'
  }));
  structures[i]={...old,term:'HT26',status:'processed',coverage:o.coverage||'choice-required',reason:o.reason||'official-gu-direct-verification',rows,courses:rows,source:o.source||'gu-official-direct-verification',sourceUrl:o.sourceUrl||old.sourceUrl||'',sourceUrls:o.sourceUrl?[o.sourceUrl]:(old.sourceUrls||[]),quality:{complete:true,expectedTerms:Math.round(Number(o.hp||old.hp||0)/30),parsedRows:rows.length,totalHp:Number(o.hp||old.hp||0)},checkedAt:new Date().toISOString()};
  applied++;
}
await fs.writeFile(TARGET,JSON.stringify(structures,null,2)+'\n');

const byKey=new Map(structures.map(x=>[x.key,x]));
const guRows=guQueue.map(x=>byKey.get(x.key)).filter(Boolean);
const counts=guRows.reduce((a,x)=>(a[x.coverage]=(a[x.coverage]||0)+1,a),{});
const unresolved=guRows.filter(x=>['metadata-only','manual-review'].includes(x.coverage)).map(x=>({key:x.key,code:x.programCode,name:x.programName,hp:x.hp,coverage:x.coverage,reason:x.reason||''}));
await fs.writeFile(path.join(GU,'meta.json'),JSON.stringify({database:'StudieLots HT26',generatedAt:new Date().toISOString(),programmes:guRows.length,counts,unresolved:unresolved.length,verifiedOverrides:applied},null,2)+'\n');
await fs.writeFile(path.join(GU,'unresolved.json'),JSON.stringify(unresolved,null,2)+'\n');
console.log(JSON.stringify({applied,programmes:guRows.length,counts,unresolved:unresolved.length},null,2));
