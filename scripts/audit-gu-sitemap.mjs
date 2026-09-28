#!/usr/bin/env node
// Public GU sitemap is an index of official page URLs, not a course catalogue.
// Only follow direct education URLs, then verify individual identities/credits.
import fs from 'node:fs';
const root='https://www.gu.se/sitemap.xml';
const get=async url=>{const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`${response.status} ${url}`);return response.text()};
const locs=xml=>[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].replace(/&amp;/g,'&'));
const index=locs(await get(root)).filter(x=>/^https:\/\/www\.gu\.se\/sitemap\.xml\?page=\d+$/.test(x));
if(!index.length||index.length>100)throw Error('Unexpected sitemap index');
const all=[];let next=0;
async function worker(){while(next<index.length){const url=index[next++],xml=await get(url);all.push(...locs(xml));}}
await Promise.all(Array.from({length:4},worker));
const byCode=new Map();
for(const url of all){
  if(!/^https:\/\/www\.gu\.se\/(studera\/hitta-utbildning|en\/study-gothenburg)\//.test(url))continue;
  const match=new URL(url).pathname.match(/-([a-z]{1,4}\d{2,5}|[a-z]\d[a-z0-9åäö]{2,5})$/i);
  if(!match)continue;
  const code=match[1].toUpperCase(),rows=byCode.get(code)||[];
  rows.push(url);byCode.set(code,rows);
}
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const canonical=read('data/studielots-db/programmes.json').filter(x=>x.university==='Göteborgs universitet');
const courses=read('data/HT26/courses.json').filter(x=>x.university==='Göteborgs universitet');
const missingCodes=(from,existing)=>[...new Set(from.filter(x=>x.university==='Göteborgs universitet').map(x=>x.code))].filter(code=>!existing.some(x=>x.code===code||x.programCode===code));
const missingPrograms=missingCodes(read('data/susa/programmes.json'),canonical);
const missingCourses=missingCodes(read('data/susa/courses.json'),courses);
const report={pages:index.length,urls:all.length,educationCodes:byCode.size,missingPrograms:missingPrograms.map(code=>({code,urls:byCode.get(code)||[]})),missingCourses:missingCourses.map(code=>({code,urls:byCode.get(code)||[]}))};
console.log(JSON.stringify(report,null,2));
