#!/usr/bin/env node
/** Enrich existing Lund course identities from official syllabus PDFs; never infer term availability. */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile),root='data/HT26',review='data/import-reviews';
const read=p=>fs.readFile(p,'utf8').then(JSON.parse);
const norm=s=>String(s??'').trim().toLocaleLowerCase('sv-SE');
const code=s=>String(s??'').trim().toUpperCase();
const canonical=await read(`${root}/courses.json`);
const existing=await read(`${root}/course-details.json`).catch(e=>{if(e.code==='ENOENT')return [];throw e});
const failures=await read(`${review}/lund-course-details-unavailable.json`).catch(e=>{if(e.code==='ENOENT')return [];throw e});
if(!Array.isArray(canonical)||!Array.isArray(existing)||!Array.isArray(failures))throw Error('Expected array tables');
const byCode=new Map();
for(const row of canonical){if(norm(row.university)!=='lunds universitet'||!code(row.code))continue;const k=code(row.code);byCode.set(k,[...(byCode.get(k)||[]),row]);}
const already=new Set(existing.filter(x=>norm(x.university)==='lunds universitet').map(x=>code(x.code)));
const unavailable=new Map(failures.filter(x=>x&&code(x.code)&&x.reason==='HTTP 404').map(x=>[code(x.code),x]));
const eligible=[...byCode.entries()].filter(([id,rows])=>/^[A-Z0-9]{5,12}$/.test(id)&&rows.length===1&&!already.has(id));
const pending=eligible.filter(([id])=>!unavailable.has(id)).sort(([a],[b])=>a.localeCompare(b,'sv'));
const limit=Math.max(1,Math.min(100,Number(process.env.LUND_COURSE_LIMIT||40)));
const candidates=pending.slice(0,limit);
const report={attempted:0,imported:0,errors:[],candidateLimit:limit,remainingBeforeBatch:pending.length,unavailableBeforeBatch:unavailable.size},added=[];
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'studielots-lund-'));
try{
for(const [id,matches] of candidates){
 report.attempted++;
 const url=`https://kursplaner.lu.se/pdf/kurs/sv/${encodeURIComponent(id)}`;
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'user-agent':'StudieLots official syllabus importer'}});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length<100||bytes.subarray(0,5).toString()!=='%PDF-')throw Error('Not a syllabus PDF');
  const pdf=path.join(dir,`${id}.pdf`);
  await fs.writeFile(pdf,bytes);
  const {stdout}=await exec('pdftotext',['-layout','-enc','UTF-8',pdf,'-'],{maxBuffer:2_000_000,timeout:15000});
  const text=stdout.replace(/\r/g,'');
  if(!new RegExp(`\\b${id}\\b`,'i').test(text))throw Error('Course code absent from official syllabus');
  if(!/kursplan/i.test(text))throw Error('Document does not identify as course syllabus');
  const sections=text.split(/\n(?=(?:Förkunskapskrav|Behörighet|Kursens innehåll|Innehåll|Lärandemål|Kursens mål|Undervisning|Examination|Fastställande)\s*\n)/i);
  const section=label=>{const part=sections.find(s=>new RegExp(`^${label}\\s*\\n`,'i').test(s.trimStart()));return part?part.trim().replace(new RegExp(`^${label}\\s*`,'i'),'').replace(/\s+/g,' ').trim().slice(0,5000):null;};
  const requirements=section('Förkunskapskrav')||section('Behörighet');
  const content=section('Kursens innehåll')||section('Innehåll');
  const goals=section('Lärandemål')||section('Kursens mål');
  if(!requirements&&!content&&!goals)throw Error('No reliably delimited detail fields');
  added.push({university:'Lunds universitet',code:id,canonicalKey:matches[0].key||null,sourceUrl:url,sourceType:'official-university-syllabus-pdf',verifiedFields:['code',...(requirements?['entryRequirements']:[]),...(content?['content']:[]),...(goals?['learningOutcomes']:[])],entryRequirements:requirements,content,learningOutcomes:goals});
  already.add(id);report.imported++;
 }catch(e){const reason=String(e.message||e);report.errors.push({code:id,reason});if(reason==='HTTP 404')unavailable.set(id,{code:id,reason,sourceUrl:url});}
}
}finally{await fs.rm(dir,{recursive:true,force:true});}
const merged=[...existing,...added];
if(added.length)await fs.writeFile(`${root}/course-details.json`,JSON.stringify(merged,null,2)+'\n');
await fs.mkdir(review,{recursive:true});
await fs.writeFile(`${review}/lund-course-details-unavailable.json`,JSON.stringify([...unavailable.values()].sort((a,b)=>a.code.localeCompare(b.code)),null,2)+'\n');
report.previous=existing.length;report.total=merged.length;
report.remainingAfterBatch=eligible.filter(([id])=>!already.has(id)&&!unavailable.has(id)).length;
report.unavailableAfterBatch=unavailable.size;
await fs.writeFile(`${review}/lund-course-details-latest.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
if(report.attempted&&!report.imported&&report.remainingAfterBatch>0)process.exitCode=1;
