#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const TERM='HT26';
const UNIVERSITY='Göteborgs universitet';
const DB=`data/${TERM}`;
const API=(process.env.GU_API_BASE||'https://private-two-gamma.vercel.app').replace(/\/$/,'');
const CONCURRENCY=Math.max(1,Number(process.env.GU_SYLLABUS_CONCURRENCY||5));
const LIMIT=Math.max(1,Number(process.env.GU_SYLLABUS_LIMIT||250));
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const isGU=x=>norm(x?.university)==='goteborgs universitet';
const keyFor=code=>`${norm(UNIVERSITY)}|${clean(code).toUpperCase()}|${TERM}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function readJson(file,fallback=[]){try{return JSON.parse(await fs.readFile(file,'utf8'))}catch{return fallback}}
async function writeJson(file,value){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(value,null,2)+'\n')}
async function getJson(url){
  const r=await fetch(url,{headers:{accept:'application/json','user-agent':'StudieLots-GU-syllabus/HT26'},redirect:'follow',signal:AbortSignal.timeout(30000)});
  const text=await r.text();
  let data={};try{data=JSON.parse(text)}catch{}
  if(!r.ok&&r.status!==206) throw new Error(`${r.status} ${data?.message||data?.error||r.statusText}`);
  return {status:r.status,data};
}

async function resolveCourse(course){
  const code=clean(course.courseCode||course.code).toUpperCase();
  const name=clean(course.courseName||course.name||course.title);
  const hp=Number(course.courseHp||course.hp||course.credits)||0;
  const u=new URL('/api/syllabus',API);
  u.searchParams.set('code',code);u.searchParams.set('name',name);u.searchParams.set('university',UNIVERSITY);u.searchParams.set('term',TERM);
  try{
    const {status,data}=await getJson(u);
    const url=clean(data?.url);
    const hasUsefulContent=Boolean(clean(data?.level)||clean(data?.progression)||(Array.isArray(data?.learningGoals)&&data.learningGoals.length)||clean(data?.content));
    const versionText=clean(data?.validFromTerm||data?.validFrom||data?.version||data?.term);
    const versionVerified=/hösttermin(?:en)?\s*2026|ht\s*26|ht26/i.test(versionText);
    return {key:keyFor(code),university:UNIVERSITY,term:TERM,courseCode:code,courseName:name,courseHp:hp,requestedVersion:TERM,version:versionText||TERM,status:hasUsefulContent?'resolved':'manual-review',httpStatus:status,versionVerified,versionEvidence:versionVerified?`Official GU syllabus reports ${versionText} as applicable version.`:'Official GU syllabus resolved, but the resolver did not expose an explicit HT26 applicable-version value.',level:clean(data?.level),progression:clean(data?.progression),content:clean(data?.content),learningGoals:Array.isArray(data?.learningGoals)?data.learningGoals:[],sourceUrl:url,source:'gu-official-syllabus',checkedAt:new Date().toISOString(),unresolved:Boolean(data?.unresolved)||!hasUsefulContent};
  }catch(error){return {key:keyFor(code),university:UNIVERSITY,term:TERM,courseCode:code,courseName:name,courseHp:hp,requestedVersion:TERM,version:TERM,status:'manual-review',versionVerified:false,source:'gu-official-syllabus',checkedAt:new Date().toISOString(),unresolved:true,reason:String(error?.message||error)}}
}
async function pool(items){const out=new Array(items.length);let next=0;async function worker(){for(;;){const i=next++;if(i>=items.length)return;out[i]=await resolveCourse(items[i]);console.log(`${i+1}/${items.length} ${out[i].status} verified=${out[i].versionVerified} ${out[i].courseCode}`);await sleep(150)}}await Promise.all(Array.from({length:Math.min(CONCURRENCY,items.length)},worker));return out}

async function main(){
 const [courses,existing,manifest]=await Promise.all([readJson(path.join(DB,'courses.json')),readJson(path.join(DB,'syllabus-versions.json')),readJson(path.join(DB,'manifest.json'),{})]);
 const guCourses=courses.filter(isGU).filter(c=>clean(c.courseCode||c.code));
 const map=new Map(existing.map(x=>[x.key||keyFor(x.courseCode),x]));
 // Crucial: retry existing GU rows until their exact HT26 syllabus version is verified.
 const pending=guCourses.filter(c=>map.get(keyFor(c.courseCode||c.code))?.versionVerified!==true).slice(0,LIMIT);
 const fresh=await pool(pending);for(const row of fresh)map.set(row.key,row);
 const all=[...map.values()].sort((a,b)=>String(a.university).localeCompare(String(b.university),'sv')||String(a.courseCode).localeCompare(String(b.courseCode),'sv'));
 await writeJson(path.join(DB,'syllabus-versions.json'),all);
 const guRows=all.filter(isGU),resolved=guRows.filter(x=>x.status==='resolved').length,unresolved=guRows.length-resolved,exactVersionVerified=guRows.filter(x=>x.versionVerified===true).length;
 const nextManifest={...manifest,generatedAt:new Date().toISOString(),tables:{...(manifest.tables||{}),syllabusVersions:{file:'syllabus-versions.json',rows:all.length}},guSyllabusImport:{term:TERM,totalCourses:guCourses.length,processed:guRows.length,resolved,unresolved,remainingVerification:Math.max(0,guCourses.length-exactVersionVerified),exactVersionVerified}};
 await writeJson(path.join(DB,'manifest.json'),nextManifest);await fs.mkdir('data/gu',{recursive:true});await writeJson('data/gu/syllabus-meta.json',{database:'StudieLots HT26',generatedAt:new Date().toISOString(),term:TERM,totalCourses:guCourses.length,processed:guRows.length,resolved,unresolved,remainingVerification:Math.max(0,guCourses.length-exactVersionVerified),exactVersionVerified});console.log(JSON.stringify(nextManifest.guSyllabusImport,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
