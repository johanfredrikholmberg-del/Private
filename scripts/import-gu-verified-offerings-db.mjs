#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
const UNIVERSITY='Göteborgs universitet',DB='data/studielots-db',OUT='',META='data/import-reviews/gu-offerings-db-latest.json',MANIFEST=path.join(DB,'manifest.json');
const CONCURRENCY=Math.max(1,Number(process.env.GU_OFFERING_CONCURRENCY||6)),LIMIT=Math.max(1,Number(process.env.GU_OFFERING_LIMIT||800));
const clean=v=>String(v??'').replace(/\s+/g,' ').trim(),norm=v=>clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,''),isGU=x=>x?.providerId==='p.uoh.gu'||norm(x?.university)==='goteborgs universitet',codeOf=x=>clean(x?.courseCode||x?.code).toUpperCase();
const monthMap={jan:'01',januari:'01',feb:'02',februari:'02',mar:'03',mars:'03',apr:'04',april:'04',maj:'05',jun:'06',juni:'06',jul:'07',juli:'07',aug:'08',augusti:'08',sep:'09',sept:'09',september:'09',okt:'10',oktober:'10',nov:'11',november:'11',dec:'12',december:'12'};
async function readJson(f,d=[]){try{return JSON.parse(await fs.readFile(f,'utf8'))}catch{return d}} async function writeJson(f,v){await fs.mkdir(path.dirname(f),{recursive:true});await fs.writeFile(f,JSON.stringify(v,null,2)+'\n')}
function decode(s=''){return s.replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&aring;/gi,'å').replace(/&auml;/gi,'ä').replace(/&ouml;/gi,'ö').replace(/&Aring;/g,'Å').replace(/&Auml;/g,'Ä').replace(/&Ouml;/g,'Ö').replace(/&ndash;|&#8211;|&mdash;|&#8212;/gi,'-').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'\n').replace(/\r/g,'').replace(/\n[ \t]+|[ \t]+\n/g,'\n').replace(/\n{2,}/g,'\n').trim()}
function isoDate(t=''){const x=clean(t);let m=x.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);if(m)return `${m[1]}-${m[2]}-${m[3]}`;m=x.toLowerCase().match(/(\d{1,2})\s+([a-zåäö]+)\.?\s+(\d{4})/i);if(!m)return '';const mm=monthMap[m[2]]||monthMap[m[2].slice(0,3)];return mm?`${m[3]}-${mm}-${String(m[1]).padStart(2,'0')}`:''}
function term(v=''){const m=norm(v).match(/^(host|autumn|var|spring)\s+(20\d{2})$/);return m?`${m[1]==='host'||m[1]==='autumn'?'HT':'VT'}${m[2].slice(2)}`:''}
function labeledRange(text,labels){const lines=text.split('\n').map(clean).filter(Boolean),dateRe=/(\d{1,2}\s+[A-Za-zÅÄÖåäö]+\.?\s+20\d{2}|20\d{2}-\d{2}-\d{2})/g;for(const label of labels){const w=norm(label);for(let i=0;i<lines.length;i++){const n=norm(lines[i]);if(n!==w&&!n.startsWith(w+':'))continue;const tail=n.startsWith(w+':')?lines[i].slice(lines[i].indexOf(':')+1):'',sample=[tail,...lines.slice(i+1,i+9)].join(' '),dates=[...sample.matchAll(dateRe)].map(x=>x[1]);if(dates.length>=2)return dates.slice(0,2)}}return []}
function labeledValue(text,labels){const lines=text.split('\n').map(clean).filter(Boolean);for(const label of labels){const w=norm(label);for(let i=0;i<lines.length;i++){const n=norm(lines[i]);if(n===w&&lines[i+1])return lines[i+1];if(n.startsWith(w+':'))return clean(lines[i].slice(lines[i].indexOf(':')+1))}}return ''}
function termSections(html=''){const text=decode(html),lines=text.split('\n').map(clean).filter(Boolean),heads=[];for(let i=0;i<lines.length;i++){const t=term(lines[i]);if(t)heads.push({i,title:lines[i],offeringTerm:t})}return heads.map((h,j)=>({...h,text:lines.slice(h.i+1,j+1<heads.length?heads[j+1].i:lines.length).join('\n')}))}
function offeringBlocks(section){const lines=section.text.split('\n').map(clean).filter(Boolean),starts=[];for(let i=0;i<lines.length;i++)if(norm(lines[i])==='studietakt'||norm(lines[i])==='pace of study')starts.push(i);if(!starts.length)return [section.text];return starts.map((s,i)=>lines.slice(s,i+1<starts.length?starts[i+1]:lines.length).join('\n'))}
function parseBlock(text,s,c,url,idx){const dm=labeledRange(text,['Start/slut','Start/end']),am=labeledRange(text,['Ansökningsperiod','Application period']),pace=labeledValue(text,['Studietakt','Pace of study']),form=labeledValue(text,['Undervisningsform','Form of teaching']),applicationCode=labeledValue(text,['Anmälningskod','Application code']),startDate=isoDate(dm[0]||''),endDate=isoDate(dm[1]||'');return {key:`goteborgs-universitet|${codeOf(c)}|${s.offeringTerm}|${applicationCode||startDate||idx}`,university:UNIVERSITY,courseCode:codeOf(c),courseName:clean(c.courseName||c.name),courseHp:Number(c.courseHp||c.hp)||0,offeringTerm:s.offeringTerm,termHeading:s.title,startDate,endDate,studyPace:pace,studyPacePercent:Number((pace.match(/\d+/)||[])[0])||null,teachingTime:labeledValue(text,['Undervisningstid','Teaching time']),studyLocation:labeledValue(text,['Studieort','Location']),teachingForm:form,distance:/distans|distance/i.test(form),teachingLanguage:labeledValue(text,['Undervisningsspråk','Language of instruction']),partOfTerm:labeledValue(text,['Del av termin','Part of term']),applicationStart:isoDate(am[0]||''),applicationEnd:isoDate(am[1]||''),applicationCode,applicationStatus:/Tillfället är inställt|cancelled/i.test(text)?'cancelled':/Ansökan stängd|Application closed/i.test(text)?'closed':/Ansökan öppnar|Application opens/i.test(text)?'opens-later':/sen anmälan|Ansök|Apply/i.test(text)?'open':'unknown',standaloneSearchable:Boolean(applicationCode)&&!/Tillfället är inställt|cancelled/i.test(text),source:'gu-official-course-page',sourceUrl:url,checkedAt:new Date().toISOString()}}
async function fetchPage(url){const r=await fetch(url,{headers:{accept:'text/html','user-agent':'StudieLots-GU-offerings/2.4'},redirect:'follow',signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return {html:await r.text(),url:r.url}}
function candidateUrls(c){const urls=[];for(const raw of c.urls||[]){const u=typeof raw==='string'?raw:(raw?.url||raw?.href||raw?.link||raw?.value||'');if(/^https?:\/\/(www\.)?gu\.se\//i.test(u))urls.push(u)}const code=codeOf(c).toLowerCase(),slug=norm(c.courseName||c.name).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');if(code){urls.push(`https://www.gu.se/studera/hitta-utbildning/${slug}-${code}`);urls.push(`https://www.gu.se/exchange_education/${code.toUpperCase()}`)}return [...new Set(urls.filter(Boolean))]}
async function resolveCourse(c){let last='';for(const candidate of candidateUrls(c))try{const {html,url}=await fetchPage(candidate),code=codeOf(c),text=decode(html);if(code&&!new RegExp(`\\b${code}\\b`,'i').test(text.slice(0,30000))){last='course-code-not-confirmed';continue}const rows=termSections(html).flatMap(s=>offeringBlocks(s).map((b,i)=>parseBlock(b,s,c,url,i))).filter(r=>r.applicationCode||r.startDate||r.endDate);if(rows.length)return {status:'resolved',courseCode:code,rows};last='no-offering-sections'}catch(e){last=String(e?.message||e)}const rows=(c.events||[]).filter(e=>clean(e.start)||clean(e.end)).map(e=>({key:`goteborgs-universitet|${codeOf(c)}|SUSA|${clean(e.id)||clean(e.start)||'unknown'}`,university:UNIVERSITY,courseCode:codeOf(c),courseName:clean(c.courseName||c.name),courseHp:Number(c.courseHp||c.hp)||0,offeringTerm:'',termHeading:'',startDate:clean(e.start).slice(0,10),endDate:clean(e.end).slice(0,10),studyPace:'',studyPacePercent:null,teachingTime:'',studyLocation:clean(e.location),teachingForm:e.distance?'Distans':'',distance:Boolean(e.distance),teachingLanguage:'',partOfTerm:'',applicationStart:'',applicationEnd:'',applicationCode:'',applicationStatus:'unknown',standaloneSearchable:false,source:'skolverket-susa-navet',sourceUrl:'',checkedAt:new Date().toISOString()}));return {status:rows.length?'fallback-susa':'manual-review',courseCode:codeOf(c),reason:last||'no-offering-data',rows}}
function usable(r){return Boolean(r.startDate&&r.endDate&&r.sourceUrl&&r.standaloneSearchable===true&&r.applicationStatus!=='cancelled')}
async function pool(items){const out=new Array(items.length);let next=0;async function worker(){for(;;){const i=next++;if(i>=items.length)return;out[i]=await resolveCourse(items[i]);console.log(`${i+1}/${items.length} ${out[i].status} ${out[i].courseCode} ${out[i].rows.length}`)}}await Promise.all(Array.from({length:Math.min(CONCURRENCY,items.length)},worker));return out}
async function main(){
 const db=await readJson(MANIFEST,{});
 if(db.database!=='StudieLots DB'||db.singleSourceOfTruth!==true)throw new Error('Not the authoritative StudieLots DB');
 const readTable=async spec=>(await Promise.all([spec.storage,...(spec.additionalStorages||[])].map(f=>readJson(path.join(process.cwd(),f),[])))).flatMap(x=>Array.isArray(x)?x:[]);
 const [courseTables,offerTables]=await Promise.all([readTable(db.tables.courses),readTable(db.tables.courseOfferings)]);
 if(courseTables.length!==db.tables.courses.rows||offerTables.length!==db.tables.courseOfferings.rows)throw new Error('Canonical manifest count mismatch');
 const byCourse=new Map();
 for(const c of courseTables){const code=codeOf(c);if(isGU(c)&&code&&!byCourse.has(code))byCourse.set(code,{...c,courseCode:code,courseName:clean(c.courseName||c.name),courseHp:Number(c.courseHp||c.hp)||0,university:UNIVERSITY})}
 const guCourses=[...byCourse.values()];
 const officialUrl=u=>/^https:\/\/(?:[a-z0-9-]+\.)*gu\.se\//i.test(String(u||''));
 const validIso=x=>/^20\d{2}-\d{2}-\d{2}$/.test(String(x||''))&&Number.isFinite(Date.parse(x))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
 const usable=r=>Boolean(r.startDate&&r.endDate&&Date.parse(r.endDate)>=Date.parse(r.startDate)&&validIso(r.startDate)&&validIso(r.endDate)&&officialUrl(r.sourceUrl)&&r.source!=='skolverket-susa-navet'&&r.applicationStatus!=='cancelled');
 const complete=new Set(offerTables.filter(r=>isGU(r)&&usable(r)).map(r=>codeOf(r)));
 const pending=guCourses.filter(c=>!complete.has(codeOf(c))).slice(0,LIMIT);
 const checkedAt=new Date().toISOString();\n const results=await pool(pending),byKey=new Map(offerTables.map(r=>[r.key,r])),newRows=[];
 for(const result of results)for(const row of result.rows||[]){
  if(!usable(row)||!officialUrl(row.sourceUrl)||!row.offeringTerm||!codeOf(row))continue;
  const code=codeOf(row),identity='p.uoh.gu|'+code;
  if(!courseTables.some(c=>(c.providerId==='p.uoh.gu'||isGU(c))&&codeOf(c)===code))throw new Error(code+': no canonical course identity');
  const exact={...row,checkedAt,datePrecision:'exact',dateDerivation:'explicit-dates-on-official-gu-course-page',verificationStatus:'verified',verified:true};
  if(byKey.has(exact.key))continue;
  byKey.set(exact.key,exact);newRows.push(exact);
 }
 const shard='data/studielots-db/course-offerings-gu-verified-current.json';
 const priorShard=await readJson(path.join(process.cwd(),shard),[]);
 const shardByKey=new Map(priorShard.map(r=>[r.key,r]));
 for(const r of newRows)shardByKey.set(r.key,r);
 const shardRows=[...shardByKey.values()].sort((a,b)=>codeOf(a).localeCompare(codeOf(b))||String(a.startDate).localeCompare(String(b.startDate)));
 const all=[...byKey.values()];
 db.tables.courseOfferings.additionalStorages=db.tables.courseOfferings.additionalStorages||[];
 if(!db.tables.courseOfferings.additionalStorages.includes(shard))db.tables.courseOfferings.additionalStorages.push(shard);
 db.tables.courseOfferings.rows=all.length;
 db.tables.courseOfferings.terms=[...new Set(all.map(r=>r.offeringTerm).filter(Boolean))].sort();
 db.generatedAt=new Date().toISOString();
 const newlyCovered=new Set(newRows.map(r=>codeOf(r)));
 const manual=results.filter(r=>!(r.rows||[]).some(usable)).map(r=>({courseCode:r.courseCode,reason:r.reason||r.status}));
 const report={checkedAt,source:'gu-official-course-page',canonicalCourseIdentities:guCourses.length,alreadyCoveredBefore:complete.size,candidates:pending.length,processed:results.length,added:newRows.length,newlyCoveredCourseCodes:newlyCovered.size,exactDatedRows:newRows.filter(r=>r.datePrecision==='exact').length,manualReview:manual.length,remainingAfterRun:Math.max(0,guCourses.length-new Set([...complete,...newlyCovered]).size),manualReviewRows:manual.slice(0,500)};
 await writeJson(path.join(process.cwd(),shard),shardRows);
 await writeJson(MANIFEST,db);
 await writeJson(META,report);
 console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
// batch continuation 2026-09-15: process the next unresolved GU courses after verified rows are skipped
// large-batch continuation 2026-09-15: sweep all remaining GU course offering gaps in one run
