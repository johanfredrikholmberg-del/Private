#!/usr/bin/env node
// Build KTH course catalogue from the canonical SUSA import already stored in StudieLots.
import fs from 'node:fs/promises';
import path from 'node:path';
const SOURCE=path.resolve('data/susa/courses.json');
const OUT=path.resolve('data/kth/courses.json');
const rows=JSON.parse(await fs.readFile(SOURCE,'utf8'));
const kth=rows.filter(x=>/^(KTH|Kungliga tekniska högskolan)$/i.test(String(x.university||'').trim()));
const byCode=new Map();
for(const x of kth){
 const code=String(x.code||'').trim().toUpperCase();
 if(!code)continue;
 const prev=byCode.get(code);
 if(!prev || String(x.lastEdited||'')>String(prev.lastEdited||'')) byCode.set(code,x);
}
const courses=[...byCode.values()].map(x=>({code:String(x.code).toUpperCase(),name:x.name||null,hp:Number(x.hp)||null,level:x.level||null,subject:x.subject||null,providerId:x.providerId||null,sourceId:x.susaId||null,lastEdited:x.lastEdited||null,source:'skolverket-susa-navet'})).sort((a,b)=>a.code.localeCompare(b.code,'sv'));
if(!courses.length)throw new Error('No KTH courses found in canonical SUSA catalogue');
await fs.mkdir(path.dirname(OUT),{recursive:true});
await fs.writeFile(OUT,JSON.stringify({source:'StudieLots canonical SUSA import',sourceFile:'data/susa/courses.json',fetchedAt:new Date().toISOString(),count:courses.length,courses},null,2)+'\n');
console.log('KTH catalogue:',courses.length,'unique courses from canonical SUSA data');
