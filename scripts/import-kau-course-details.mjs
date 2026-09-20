#!/usr/bin/env node
/** Import official Karlstad course-page details without altering canonical course identities. */
import fs from 'node:fs/promises';
import path from 'node:path';
const ROOT='data/HT26';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const clean=s=>String(s??'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
const code=s=>String(s??'').trim().toUpperCase();
const norm=s=>clean(s).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const kau=s=>norm(s)==='karlstads universitet';
const match=(html,label)=>{const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return clean(html.match(new RegExp(escaped+'\\s*:?\\s*(?:<[^>]+>\\s*){0,3}([^<]{2,350})','i'))?.[1]||'')};
const extract=(html,field)=>match(html,field);
const timeout=Number(process.env.KAU_TIMEOUT_MS||12000),limit=Math.max(1,Math.min(100,Number(process.env.KAU_COURSE_LIMIT||25)));
const canonical=await read(`${ROOT}/courses.json`),staged=await read('data/kau/courses.json');
if(!Array.isArray(canonical)||!Array.isArray(staged))throw Error('Course tables must be arrays');
const existing=await read(`${ROOT}/course-details.json`).catch(e=>{if(e.code==='ENOENT')return[];throw e});
if(!Array.isArray(existing))throw Error('Invalid course-details table');
const byCode=new Map();for(const row of canonical){if(!kau(row.university)||!code(row.code))continue;const k=code(row.code);byCode.set(k,[...(byCode.get(k)||[]),row]);}
const seen=new Set(existing.filter(x=>kau(x.university)).map(x=>code(x.code)));
const candidates=[...new Map(staged.filter(x=>kau(x.university)&&code(x.code)).map(x=>[code(x.code),x])).values()].filter(x=>(byCode.get(code(x.code))||[]).length===1&&!seen.has(code(x.code))).slice(0,limit);
const imported=[],errors=[];
for(const candidate of candidates){const id=code(candidate.code),url=`https://www.kau.se/utbildning/program-och-kurser/kurser/${encodeURIComponent(id)}`;
 try{const response=await fetch(url,{signal:AbortSignal.timeout(timeout),headers:{'user-agent':'StudieLots course-detail importer (official sources)'}});if(!response.ok)throw Error(`HTTP ${response.status}`);const html=await response.text();
 const published=code(extract(html,'Kurskod'));if(published!==id)throw Error(`Course code mismatch: ${published||'missing'}`);
 const level=extract(html,'Utbildningsnivå'),depth=extract(html,'Fördjupningsnivå'),requirements=extract(html,'Behörighetskrav');
 const title=clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');
 if(!title||(!level&&!depth&&!requirements))throw Error('Insufficient official detail');
 imported.push({university:'Karlstads universitet',code:id,canonicalKey:byCode.get(id)[0].key||null,name:title,educationLevel:level||null,progression:depth||null,entryRequirements:requirements||null,sourceUrl:url,sourceType:'official-university-course-page',verifiedFields:['code','name',...level?['educationLevel']:[],...depth?['progression']:[],...requirements?['entryRequirements']:[]]});
 }catch(error){errors.push({code:id,reason:String(error.message||error)})}
}
const merged=[...existing,...imported];if(imported.length){await fs.writeFile(path.join(ROOT,'course-details.json'),JSON.stringify(merged,null,2)+'\n');}
const report={attempted:candidates.length,imported:imported.length,previous:existing.length,total:merged.length,errors};await fs.mkdir('data/import-reviews',{recursive:true});await fs.writeFile('data/import-reviews/kau-course-details-latest.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
if(candidates.length&&!imported.length)process.exitCode=1;
