#!/usr/bin/env node
// Import KTH course catalogue from KTH's public course-directory pages.
// KOPPS itself was shut down in Sep 2026; the public catalogue remains the
// canonical read surface. Output is used to resolve historical 1-to-1 TG only.
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT='https://www.kth.se/student/kurser/org';
const OUT=path.resolve('data/kth/courses.json');
const clean=s=>String(s||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
const fetchText=async url=>{const r=await fetch(url,{headers:{'user-agent':'StudieLots/1.0'}});if(!r.ok)throw new Error(url+' '+r.status);return r.text()};

const root=await fetchText(ROOT);
const orgs=[...root.matchAll(/href="([^"]*\/student\/kurser\/org\/([A-Za-z0-9_-]+)[^"]*)"/g)]
 .map(m=>m[2]).filter((v,i,a)=>a.indexOf(v)===i);

const map=new Map();
for(const org of orgs){
 let html; try{html=await fetchText(ROOT+'/'+encodeURIComponent(org)+'?l=en')}catch{continue}
 // Current KTH directory tables expose: code, name, credits, level.
 for(const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)){
  const cells=[...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(x=>clean(x[1]));
  if(cells.length<3)continue;
  const code=(cells[0].match(/\b[A-Z]{1,4}\d{3,4}[A-Z]?\b/)||[])[0];
  if(!code)continue;
  const hp=Number((cells[2].match(/\d+(?:[.,]\d+)?/)||[])[0]?.replace(',','.'))||null;
  if(!map.has(code))map.set(code,{code,name:cells[1]||null,hp,level:cells[3]||null,org});
 }
}
const courses=[...map.values()].sort((a,b)=>a.code.localeCompare(b.code,'sv'));
if(!courses.length)throw new Error('No KTH courses parsed');
await fs.mkdir(path.dirname(OUT),{recursive:true});
await fs.writeFile(OUT,JSON.stringify({source:'KTH public course directory',sourceUrl:ROOT,fetchedAt:new Date().toISOString(),count:courses.length,courses},null,2)+'\n');
console.log('KTH catalogue:',courses.length,'courses');
