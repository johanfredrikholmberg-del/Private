#!/usr/bin/env node
import fs from 'node:fs/promises';

const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const codeNorm=v=>clean(v).toUpperCase().replace(/[^A-Z0-9ÅÄÖ]/g,'');
const rank={complete:5,'choice-required':4,'partial-structure':3,'manual-review':2,'metadata-only':1};

const verified=JSON.parse(await fs.readFile('data/gu/official-structures.json','utf8'));
const structures=JSON.parse(await fs.readFile('data/HT26/program-structures.json','utf8'));
const queue=JSON.parse(await fs.readFile('data/susa/structure-queue.json','utf8'));
const map=new Map(structures.map(x=>[x.key,x]));
const gu=queue.filter(x=>/goteborgs universitet/.test(norm(x.university)));
const byCode=new Map(gu.map(x=>[codeNorm(x.programCode),x]));

for(const v of verified){
  const base=byCode.get(codeNorm(v.programCode));
  if(!base) throw new Error(`Verified GU programme missing from SUSA queue: ${v.programCode}`);
  const expected=Math.round(Number(v.hp||base.hp||0)/30);
  const termHp={};
  for(let t=1;t<=expected;t++){
    const listed=Math.round(v.rows.filter(r=>Number(r.term)===t).reduce((s,r)=>s+Number(r.hp||0),0)*10)/10;
    termHp[t]={listedHp:listed,covered:listed>=29.8&&listed<=30.2};
    if(!termHp[t].covered) throw new Error(`${v.programCode} term ${t} has ${listed} hp`);
  }
  const rows=v.rows.map((r,i)=>({
    term:Number(r.term),code:clean(r.code),name:clean(r.name),hp:Number(r.hp),
    category:clean(r.category||'required'),isSlot:r.category==='elective',isThesis:Boolean(r.isThesis),
    originalTerm:Number(r.term),__slOriginalTerm:Number(r.term),__slOriginalIndex:i,
    status:'remaining',credited:false,isCredited:false,
    programmeSource:v.source||'gu-official-direct-verification',programmeCategory:clean(r.category||'required')
  }));
  const row={...base,term:'HT26',status:'processed',coverage:v.coverage,reason:v.reason||'official-gu-direct-verification',rows,
    source:v.source||'gu-official-direct-verification',sourceUrl:v.sourceUrl||'',sourceUrls:v.sourceUrl?[v.sourceUrl]:[],
    apiCoverage:'complete-term-sequence',apiConfidence:'official-direct-verification',officialProgramCode:codeNorm(v.programCode),officialAliases:[],
    quality:{complete:true,expectedTerms:expected,completeTerms:Array.from({length:expected},(_,i)=>i+1),termHp,slotCount:rows.filter(r=>r.category==='elective').length,parsedRows:rows.length,totalHp:Number(v.hp||base.hp||0),sourcePages:1},
    checkedAt:new Date().toISOString()};
  const old=map.get(base.key);
  if(!old||(rank[row.coverage]||0)>=(rank[old.coverage]||0)) map.set(base.key,row);
}

const all=[...map.values()];
const guRows=gu.map(x=>map.get(x.key)).filter(Boolean);
const counts=guRows.reduce((a,x)=>(a[x.coverage]=(a[x.coverage]||0)+1,a),{});
const unresolved=guRows.filter(x=>['metadata-only','manual-review'].includes(x.coverage)).map(x=>({key:x.key,code:x.programCode,name:x.programName,hp:x.hp,coverage:x.coverage,reason:x.reason||''}));
await fs.writeFile('data/HT26/program-structures.json',JSON.stringify(all,null,2)+'\n');
await fs.writeFile('data/gu/meta.json',JSON.stringify({database:'StudieLots HT26',generatedAt:new Date().toISOString(),programmes:gu.length,counts,unresolved:unresolved.length},null,2)+'\n');
await fs.writeFile('data/gu/unresolved.json',JSON.stringify(unresolved,null,2)+'\n');
console.log(JSON.stringify({verified:verified.length,counts,unresolved:unresolved.length},null,2));
