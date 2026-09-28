#!/usr/bin/env node
// Import KTH course catalogue from KTH's public course-directory pages.
// KOPPS itself was shut down in Sep 2026; the public catalogue remains the
// canonical read surface. Output is used to resolve historical 1-to-1 TG only.
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT='https://www.kth.se/student/kurser/org';
// KTH course pages expose course code, name, credits and education level.
const OUT=path.resolve('data/kth/courses.json');
const clean=s=>String(s||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
const fetchText=async url=>{const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 StudieLots/1.0','accept':'text/html,application/xhtml+xml'}});if(!r.ok)throw new Error(url+' '+r.status);return r.text()};

const root=await fetchText(ROOT);
// 2026 catalogue may expose course links directly even when organisation navigation is client-rendered.
const directCodes=[...root.matchAll(/\/student\/kurser\/kurs\/([A-Z][A-Z0-9]{4,5})/gi)].map(m=>m[1].toUpperCase()).filter((v,i,a)=>a.indexOf(v)===i);
// KTH now renders many catalogue links as relative hrefs. Accept absolute,
// root-relative and relative organisation links, but keep only safe org IDs.
const orgs=[...root.matchAll(/href=["']([^"']*\/student\/kurser\/org\/([A-Za-z0-9_-]+)[^"']*)["']/gi)]
 .map(m=>m[2])
 .filter(v=>/^[A-Za-z0-9_-]+$/.test(v))
 .filter((v,i,a)=>a.indexOf(v)===i);

// Fallback for the current catalogue markup where href may be relative to /student/kurser/.
if(!orgs.length){
 for(const m of root.matchAll(/href=["'](?:\.\/|\/)?org\/([A-Za-z0-9_-]+)(?:\?[^"']*)?["']/gi)){
  if(!orgs.includes(m[1]))orgs.push(m[1]);
 }
}
if(!orgs.length && !directCodes.length)throw new Error('No KTH organisations or direct course links parsed from '+ROOT);

const map=new Map();
// When KTH exposes course links directly on the catalogue root, resolve those pages too.
for(const id of directCodes){
 try{
  const html=await fetchText('https://www.kth.se/student/kurser/kurs/'+encodeURIComponent(id)+'?l=en');
  const title=clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');
  const text=clean(html);
  const hp=Number((text.match(/(?:credits|hp)\s*[:]?\s*(\d+(?:[.,]\d+)?)/i)||[])[1]?.replace(',','.'))||null;
  if(title)map.set(id,{code:id,name:title.replace(new RegExp('^'+id+'\\s*[-–:]?\\s*','i'),''),hp,level:null,org:null});
 }catch{}
}
for(const org of orgs){
 let html; try{html=await fetchText(ROOT+'/'+encodeURIComponent(org)+'?l=en')}catch{continue}
 // Current KTH directory tables expose: code, name, credits, level.
 for(const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)){
  const cells=[...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(x=>clean(x[1]));
  if(cells.length<3)continue;
  const rawCode=(cells[0].match(/[A-Z][A-Z0-9]{4,5}/i)||[])[0]?.toUpperCase()||'';
  const code=/^[A-Z][A-Z0-9]{4,5}$/.test(rawCode)?rawCode:null;
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
