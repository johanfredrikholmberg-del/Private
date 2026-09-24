#!/usr/bin/env node
// Build an official KTH course catalogue used only to resolve historical
// 1-to-1 credit-transfer evidence. Ambiguous name matches remain unresolved.
import fs from 'node:fs/promises';
import path from 'node:path';

const OUT=path.resolve('data/kth/courses.json');
const endpoints=[
 'https://api.kth.se/api/kopps/v2/courses'
];

let raw=null,used=null,lastError=null;
for(const url of endpoints){
 try{
  const res=await fetch(url,{headers:{accept:'application/json'}});
  if(!res.ok)throw new Error(String(res.status));
  raw=await res.json(); used=url; break;
 }catch(e){lastError=e}
}
if(!raw)throw new Error('Could not fetch KTH KOPPS courses: '+lastError);
const list=Array.isArray(raw)?raw:(raw.courses||raw.course||[]);
if(!Array.isArray(list)||!list.length)throw new Error('KTH KOPPS returned no courses');

const val=(o,keys)=>{for(const k of keys)if(o&&o[k]!=null&&o[k]!=='')return o[k];return null};
const txt=v=>typeof v==='string'?v:(v&&typeof v==='object'?(v.sv||v.en||v.text||v.title||null):null);
const rows=[];
for(const c of list){
 const code=String(val(c,['code','courseCode','course_code'])||'').trim().toUpperCase();
 if(!code)continue;
 rows.push({
  code,
  nameSv:txt(val(c,['title','name','courseName','course_name','titleSv','nameSv'])),
  nameEn:txt(val(c,['titleEn','nameEn','englishTitle','englishName'])),
  hp:Number(val(c,['credits','credit','hp','ects']))||null
 });
}
const unique=[...new Map(rows.map(x=>[x.code,x])).values()].sort((a,b)=>a.code.localeCompare(b.code,'sv'));
await fs.mkdir(path.dirname(OUT),{recursive:true});
await fs.writeFile(OUT,JSON.stringify({source:'KTH KOPPS',sourceUrl:used,fetchedAt:new Date().toISOString(),count:unique.length,courses:unique},null,2)+'\n');
console.log('KTH catalogue:',unique.length);
