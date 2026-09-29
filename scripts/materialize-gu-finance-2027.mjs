#!/usr/bin/env node
// Scope this official syllabus to its stated HT27 start; no HT26 inference.
import fs from 'node:fs';
const root='data/studielots-db/',read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const db=read(root+'manifest.json'),manifest=read(db.tables.programmeStructures.storageManifest);
if(db.database!=='StudieLots DB'||manifest.count!==db.tables.programmeStructures.rows)throw Error('Canonical structure count mismatch');
const matches=[db.tables.programmes.storage,...(db.tables.programmes.additionalStorages||[])].flatMap(read).filter(x=>x.university==='Göteborgs universitet'&&x.programCode==='S2FIC'&&Number(x.programHp)===60&&x.term==='HT27');
if(matches.length!==1)throw Error('GU finance 2027 programme identity missing or ambiguous');
const url='https://www.gu.se/en/syllabus/9be73d86-709f-11f1-b645-10cec8c14f9f';
const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
if(!response.ok||new URL(response.url).host!=='www.gu.se')throw Error('Official syllabus unavailable');
const html=await response.text();
const clean=x=>String(x||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;|\u00a0|\u202f/g,' ').replace(/\s+/g,' ').trim();
const plain=clean(html);
if(!/\bS2FIC\b/.test(plain)||!/Valid from\s+Autumn semester 2027/.test(plain)||!/60 credits\s*\(ECTS\)/.test(plain))throw Error('Syllabus identity, credits or valid-from conflict');
const section=html.match(/<h2[^>]*id="content"[^>]*>[\s\S]*?<\/h2>([\s\S]*?)(?=<h2[^>]*id="objectives")/)?.[1];
if(!section)throw Error('Programme structure section missing');
const rows=[];let term=0;
for(const paragraph of section.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)){
  const line=clean(paragraph[1]),mark=line.match(/^Semester ([12])$/i);
  if(mark){term=Number(mark[1]);continue}
  const course=line.match(/^Period\s*[1-4](?:-[1-4])?:\s*(.+?),\s*(7\.5|15) credits \(core\)$/i);
  if(course){if(!term)throw Error('Course without semester');rows.push({term,code:'',name:course[1],hp:Number(course[2]),category:'mandatory',isSlot:false})}
}
if(rows.length!==7||[1,2].some(t=>Math.abs(rows.filter(r=>r.term===t).reduce((n,r)=>n+r.hp,0)-30)>.01))throw Error('GU finance term or credits incomplete');
const existing=manifest.parts.flatMap(p=>{const x=read(root+p);return Array.isArray(x)?x:x.programs}).filter(x=>x.university==='Göteborgs universitet'&&x.programCode==='S2FIC');
if(existing.length){if(existing.length!==1||existing[0].validFrom!=='2027HT'||JSON.stringify(existing[0].rows)!==JSON.stringify(rows))throw Error('Conflicting canonical GU finance plan');console.log('GU finance 2027 already materialized');process.exit(0)}
const item={id:'gu:S2FIC:2027HT',key:matches[0].key,university:'Göteborgs universitet',programCode:'S2FIC',programName:matches[0].programName,programHp:60,hp:60,validFrom:'2027HT',coverage:'complete',verified:true,courseCodesVerified:false,source:'gu-official-programme-syllabus',sourceEvidenceUrl:url,sourceUrls:[url],rows};
if(process.argv.includes('--write')){
  const part='programme-structures-gu-finance-2027.json';
  fs.writeFileSync(root+part,JSON.stringify({schemaVersion:1,programs:[item]},null,2)+'\n');
  manifest.parts.push(part);manifest.count++;
  manifest.universities.find(x=>x.university==='Göteborgs universitet').count++;
  db.tables.programmeStructures.rows=manifest.count;
  fs.writeFileSync(root+'programme-structures-manifest.json',JSON.stringify(manifest,null,2)+'\n');
  fs.writeFileSync(root+'manifest.json',JSON.stringify(db,null,2)+'\n');
}
console.log(JSON.stringify({code:'S2FIC',validFrom:'2027HT',rows:rows.length,termCredits:[30,30],source:url}));
