#!/usr/bin/env node
import fs from 'node:fs/promises';

const rank={"metadata-only":1,"manual-review":2,"partial-structure":3,"choice-required":4,"complete":5};
const currentPath='data/kau/structures.json';
const baselinePath='data/kau/structures-baseline.json';
const current=JSON.parse(await fs.readFile(currentPath,'utf8'));
let baseline=[];
try{baseline=JSON.parse(await fs.readFile(baselinePath,'utf8'))}catch{baseline=current}
const oldBy=new Map(baseline.map(x=>[String(x.programCode||'').toUpperCase(),x]));
let preserved=0;
const merged=current.map(row=>{
  const old=oldBy.get(String(row.programCode||'').toUpperCase());
  if(!old)return row;
  const temporary=row.reason==='official-page-temporarily-unavailable';
  if(temporary&&(rank[old.coverage]||0)>(rank[row.coverage]||0)){
    preserved++;
    return {...old,lastRefreshAttemptAt:row.checkedAt||new Date().toISOString(),lastRefreshError:row.error||row.reason,preservedVerifiedBaseline:true};
  }
  return row;
});
await fs.writeFile(currentPath,JSON.stringify(merged,null,2)+'\n');
await fs.writeFile(baselinePath,JSON.stringify(merged,null,2)+'\n');
let global=[];
try{global=JSON.parse(await fs.readFile('data/susa/structures.json','utf8'))}catch{}
const by=new Map(merged.map(x=>[String(x.programCode||'').toUpperCase(),x]));
global=global.map(x=>/karlstads universitet/i.test(String(x.university||''))&&by.has(String(x.programCode||'').toUpperCase())?by.get(String(x.programCode||'').toUpperCase()):x);
await fs.writeFile('data/susa/structures.json',JSON.stringify(global,null,2)+'\n');
const counts=merged.reduce((a,x)=>(a[x.coverage||'metadata-only']=(a[x.coverage||'metadata-only']||0)+1,a),{});
let meta={};try{meta=JSON.parse(await fs.readFile('data/kau/structure-meta.json','utf8'))}catch{}
meta.generatedAt=new Date().toISOString();meta.counts=counts;meta.preservedVerifiedBaseline=preserved;meta.temporaryErrors=merged.filter(x=>x.reason==='official-page-temporarily-unavailable').length;
await fs.writeFile('data/kau/structure-meta.json',JSON.stringify(meta,null,2)+'\n');
console.log(JSON.stringify({programmes:merged.length,preserved,counts,temporaryErrors:meta.temporaryErrors},null,2));
