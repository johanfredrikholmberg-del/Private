#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const UNIVERSITY='Göteborgs universitet';
const DB='data/HT26';
const OUT=path.join(DB,'course-offerings.json');
const META='data/gu/course-offerings-meta.json';
const MANIFEST=path.join(DB,'manifest.json');
const CONCURRENCY=Math.max(1,Number(process.env.GU_OFFERING_CONCURRENCY||6));
const LIMIT=Math.max(1,Number(process.env.GU_OFFERING_LIMIT||800));
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const isGU=x=>norm(x?.university)==='goteborgs universitet';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const monthMap={jan:'01',januari:'01',feb:'02',februari:'02',mar:'03',mars:'03',apr:'04',april:'04',maj:'05',jun:'06',juni:'06',jul:'07',juli:'07',aug:'08',augusti:'08',sep:'09',sept:'09',september:'09',okt:'10',oktober:'10',nov:'11',november:'11',dec:'12',december:'12'};

async function readJson(file,fallback=[]){try{return JSON.parse(await fs.readFile(file,'utf8'))}catch{return fallback}}
async function writeJson(file,value){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(value,null,2)+'\n')}
function decodeHtml(s=''){return s.replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&aring;/gi,'å').replace(/&auml;/gi,'ä').replace(/&ouml;/gi,'ö').replace(/&Aring;/g,'Å').replace(/&Auml;/g,'Ä').replace(/&Ouml;/g,'Ö').replace(/&ndash;|&#8211;/gi,'-').replace(/&mdash;|&#8212;/gi,'-').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'\n').replace(/\r/g,'').replace(/\n[ \t]+/g,'\n').replace(/[ \t]+\n/g,'\n').replace(/\n{2,}/g,'\n').trim()}
function slugify(v=''){return norm(v).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}
function isoDate(text=''){
  const m=clean(text).toLowerCase().match(/(\d{1,2})\s+([a-zåäö]+)\s+(\d{4})/i);
  if(!m)return '';
  const mm=monthMap[m[2]]||monthMap[m[2].slice(0,3)]; if(!mm)return '';
  return `${m[3]}-${mm}-${String(m[1]).padStart(2,'0')}`;
}
function valueAfter(text,label){
  const lines=text.split('\n').map(clean).filter(Boolean);
  const wanted=norm(label);
  for(let i=0;i<lines.length;i++) if(norm(lines[i])===wanted) return clean(lines[i+1]||'');
  return '';
}
function offeringTermFromHeading(v=''){
  const s=norm(v);
  const m=s.match(/^(host|autumn|var|spring)\s+(20\d{2})$/);
  if(!m)return '';
  const season=(m[1]==='host'||m[1]==='autumn')?'HT':'VT';
  return `${season}${m[2].slice(2)}`;
}
function splitOfferingSections(html=''){
  const re=/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi; const heads=[]; let m;
  while((m=re.exec(html))){const title=clean(decodeHtml(m[1]));const term=offeringTermFromHeading(title);if(term) heads.push({title,term,start:re.lastIndex,headStart:m.index});}
  return heads.map((h,i)=>({...h,html:html.slice(h.start,i+1<heads.length?heads[i+1].headStart:html.length)}));
}
function parseSection(section,course,url){
  const text=decodeHtml(section.html);
  const startEnd=valueAfter(text,'Start/slut')||valueAfter(text,'Start/end');
  const dm=startEnd.match(/(\d{1,2}\s+[A-Za-zÅÄÖåäö]+\s+20\d{2})\s*-\s*(\d{1,2}\s+[A-Za-zÅÄÖåäö]+\s+20\d{2})/);
  const appPeriod=valueAfter(text,'Ansökningsperiod')||valueAfter(text,'Application period');
  const am=appPeriod.match(/(\d{1,2}\s+[A-Za-zÅÄÖåäö]+\s+20\d{2})\s*-\s*(\d{1,2}\s+[A-Za-zÅÄÖåäö]+\s+20\d{2})/);
  const pace=valueAfter(text,'Studietakt')||valueAfter(text,'Pace of study');
  const form=valueAfter(text,'Undervisningsform')||valueAfter(text,'Form of teaching');
  const status=(/Ansökan stängd|Application closed/i.test(text)?'closed':/Ansökan öppnar|Application opens/i.test(text)?'opens-later':/Ansök|Apply/i.test(text)?'open':'unknown');
  const applicationCode=valueAfter(text,'Anmälningskod')||valueAfter(text,'Application code');
  return {
    key:`goteborgs-universitet|${clean(course.courseCode||course.code).toUpperCase()}|${section.term}|${applicationCode||isoDate(dm?.[1]||'')||'unknown'}`,
    university:UNIVERSITY,
    courseCode:clean(course.courseCode||course.code).toUpperCase(),courseName:clean(course.courseName||course.name),courseHp:Number(course.courseHp||course.hp)||0,
    offeringTerm:section.term,termHeading:section.title,
    startDate:isoDate(dm?.[1]||''),endDate:isoDate(dm?.[2]||''),
    studyPace:pace,studyPacePercent:Number((pace.match(/\d+/)||[])[0])||null,
    teachingTime:valueAfter(text,'Undervisningstid')||valueAfter(text,'Teaching time'),
    studyLocation:valueAfter(text,'Studieort')||valueAfter(text,'Location'),
    teachingForm:form,distance:/distans|distance/i.test(form),
    teachingLanguage:valueAfter(text,'Undervisningsspråk')||valueAfter(text,'Language of instruction'),
    partOfTerm:valueAfter(text,'Del av termin')||valueAfter(text,'Part of term'),
    applicationStart:isoDate(am?.[1]||''),applicationEnd:isoDate(am?.[2]||''),applicationCode,applicationStatus:status,
    source:'gu-official-course-page',sourceUrl:url,checkedAt:new Date().toISOString()
  };
}
async function fetchPage(url){
  const r=await fetch(url,{headers:{accept:'text/html','user-agent':'StudieLots-GU-offerings/1.0'},redirect:'follow',signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);
  return {html:await r.text(),url:r.url};
}
function candidateUrls(course){
  const code=clean(course.courseCode||course.code).toLowerCase();
  const urls=[];
  for(const u of course.urls||[]) if(/https?:\/\/(www\.)?gu\.se\//i.test(u)) urls.push(u);
  if(code){urls.push(`https://www.gu.se/studera/hitta-utbildning/${slugify(course.courseName||course.name)}-${code}`);urls.push(`https://www.gu.se/exchange_education/${code.toUpperCase()}`)}
  return [...new Set(urls.filter(Boolean))];
}
async function resolveCourse(course){
  let last='';
  for(const candidate of candidateUrls(course)){
    try{
      const {html,url}=await fetchPage(candidate);
      const code=clean(course.courseCode||course.code).toUpperCase();
      if(code&&!new RegExp(`\\b${code}\\b`,'i').test(decodeHtml(html).slice(0,12000))) {last='course-code-not-confirmed';continue;}
      const sections=splitOfferingSections(html);
      const rows=sections.map(s=>parseSection(s,course,url)).filter(x=>x.offeringTerm);
      if(rows.length)return {status:'resolved',courseCode:code,url,rows};
      last='no-offering-sections';
    }catch(error){last=String(error?.message||error)}
  }
  const susaRows=(course.events||[]).filter(e=>clean(e.start)||clean(e.end)).map(e=>({
    key:`goteborgs-universitet|${clean(course.courseCode||course.code).toUpperCase()}|SUSA|${clean(e.id)||clean(e.start)||'unknown'}`,
    university:UNIVERSITY,courseCode:clean(course.courseCode||course.code).toUpperCase(),courseName:clean(course.courseName||course.name),courseHp:Number(course.courseHp||course.hp)||0,
    offeringTerm:'',termHeading:'',startDate:clean(e.start).slice(0,10),endDate:clean(e.end).slice(0,10),studyPace:'',studyPacePercent:null,teachingTime:'',studyLocation:clean(e.location),teachingForm:e.distance?'Distans':'',distance:Boolean(e.distance),teachingLanguage:'',partOfTerm:'',applicationStart:'',applicationEnd:'',applicationCode:'',applicationStatus:'unknown',source:'skolverket-susa-navet',sourceUrl:'',checkedAt:new Date().toISOString()
  }));
  return {status:susaRows.length?'fallback-susa':'manual-review',courseCode:clean(course.courseCode||course.code).toUpperCase(),reason:last||'no-offering-data',rows:susaRows};
}
async function pool(items){
  const out=new Array(items.length);let next=0;
  async function worker(){for(;;){const i=next++;if(i>=items.length)return;out[i]=await resolveCourse(items[i]);console.log(`${i+1}/${items.length} ${out[i].status} ${out[i].courseCode} ${out[i].rows.length}`);await sleep(120)}}
  await Promise.all(Array.from({length:Math.min(CONCURRENCY,items.length)},worker));
  return out;
}
async function main(){
  const [courses,existing,manifest]=await Promise.all([readJson(path.join(DB,'courses.json')),readJson(OUT,[]),readJson(MANIFEST,{})]);
  const guCourses=courses.filter(isGU).filter(c=>clean(c.courseCode||c.code));
  const already=new Set(existing.filter(isGU).map(x=>clean(x.courseCode).toUpperCase()));
  const pending=guCourses.filter(c=>!already.has(clean(c.courseCode||c.code).toUpperCase())).slice(0,LIMIT);
  const results=await pool(pending);
  const map=new Map(existing.map(x=>[x.key,x]));
  for(const result of results) for(const row of result.rows) map.set(row.key,row);
  const all=[...map.values()].sort((a,b)=>String(a.university).localeCompare(String(b.university),'sv')||String(a.courseCode).localeCompare(String(b.courseCode),'sv')||String(a.startDate).localeCompare(String(b.startDate)));
  await writeJson(OUT,all);
  const guRows=all.filter(isGU); const coursesWithOfferings=new Set(guRows.map(x=>x.courseCode));
  const unresolvedResults=results.filter(x=>x.status==='manual-review');
  const remaining=Math.max(0,guCourses.length-new Set([...already,...results.map(x=>x.courseCode)]).size);
  const dated=guRows.filter(x=>x.startDate&&x.endDate).length;
  const meta={database:'StudieLots HT26',generatedAt:new Date().toISOString(),university:UNIVERSITY,totalCourses:guCourses.length,coursesWithOfferings:coursesWithOfferings.size,offeringRows:guRows.length,datedOfferingRows:dated,processedThisRun:results.length,manualReviewThisRun:unresolvedResults.length,remaining,unresolvedCourseCodes:unresolvedResults.map(x=>x.courseCode).slice(0,250)};
  await writeJson(META,meta);
  const nextManifest={...manifest,generatedAt:new Date().toISOString(),tables:{...(manifest.tables||{}),courseOfferings:{file:'course-offerings.json',rows:all.length}},guCourseOfferingImport:meta};
  await writeJson(MANIFEST,nextManifest);
  console.log(JSON.stringify(meta,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
