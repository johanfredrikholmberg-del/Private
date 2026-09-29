#!/usr/bin/env node
// Materialize the official HT26 syllabus with its elective semester preserved as a slot.
import fs from 'node:fs';
const root='data/studielots-db/',read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const db=read(root+'manifest.json'),manifest=read(db.tables.programmeStructures.storageManifest);
if(db.database!=='StudieLots DB'||manifest.count!==db.tables.programmeStructures.rows)throw Error('Canonical structure count mismatch');
const code='S2IFÖ',url='https://www.gu.se/en/study-gothenburg/master-of-science-in-international-business-and-trade-s2ifo/syllabus/2df7659c-b4ba-11f0-bd83-743a3e5145ea';
const identity=[db.tables.programmes.storage,...(db.tables.programmes.additionalStorages||[])].flatMap(read).filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code&&Number(x.programHp)===120&&x.term==='HT26');
if(identity.length!==1)throw Error('GU HT26 programme identity missing or ambiguous');
const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
if(!response.ok||new URL(response.url).host!=='www.gu.se')throw Error('Official GU syllabus unavailable');
const html=await response.text();
const clean=x=>String(x||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;|\u00a0|\u202f/g,' ').replace(/\s+/g,' ').trim();
const plain=clean(html);
if(!plain.includes(code)||!/Valid from\s+Autumn semester 2026/.test(plain)||!/120 credits\s*\(ECTS\)/.test(plain))throw Error('Syllabus code, version or credits conflict');
const section=html.match(/<h2[^>]*id="content"[^>]*>[\s\S]*?<\/h2>([\s\S]*?)(?=<h2[^>]*id="objectives")/)?.[1];
if(!section)throw Error('Official GU term structure missing');
const rows=[];let term=0;
for(const paragraph of section.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)){
  const line=clean(paragraph[1]),mark=line.match(/^Semester ([1-4])$/i);
  if(mark){term=Number(mark[1]);continue}
  if(!term)continue;
  const course=line.match(/^Period\s*[1-4](?:\s*-\s*[1-4])?\s+(.+?),\s*7\.5 credits \(core\)$/i);
  if(course){rows.push({term,code:'',name:course[1],hp:7.5,category:'mandatory',isSlot:false});continue}
  if(term===3&&/^Elective courses, 30 credits \(core\)$/i.test(line))rows.push({term,code:'',name:'Elective courses according to programme syllabus',hp:30,category:'elective',isSlot:true,slotType:'elective-slot'});
  if(term===4&&/^Master Degree Project in International Business and Trade, 30 credits \(core\)$/i.test(line))rows.push({term,code:'',name:'Master Degree Project in International Business and Trade',hp:30,category:'mandatory',isSlot:false,isThesis:true});
}
if(rows.length!==10||[1,2,3,4].some(t=>Math.abs(rows.filter(r=>r.term===t).reduce((n,r)=>n+r.hp,0)-30)>.01)||rows.filter(r=>r.isSlot).length!==1)throw Error('Incomplete GU HT26 term sequence');
const primary=root+manifest.parts[0],data=read(primary);
if(!Array.isArray(data))throw Error('Unexpected canonical primary shard');
const index=data.findIndex(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
if(index<0||data.filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code).length!==1)throw Error('GU canonical placeholder ambiguous');
const old=data[index];
if(old.verified===true){if(old.validFrom!=='2026HT'||JSON.stringify(old.rows)!==JSON.stringify(rows))throw Error('Conflicting verified GU plan');console.log('GU international business already materialized');process.exit(0)}
if(old.rows?.length||Number(old.hp)!==120||old.key!=='goteborgs-universitet:S2IFÖ')throw Error('Refusing to replace populated or mismatched GU plan');
const item={...old,id:'gu:S2IFÖ:2026HT',key:old.key,programName:identity[0].programName,programHp:120,hp:120,validFrom:'2026HT',coverage:'choice-required',verified:true,courseCodesVerified:false,choiceRequired:true,source:'gu-official-programme-syllabus',sourceUrl:url,sourceEvidenceUrl:url,sourceUrls:[url],rows,status:'verified',reason:null};
if(process.argv.includes('--write')){data[index]=item;fs.writeFileSync(primary,JSON.stringify(data,null,2)+'\n')}
console.log(JSON.stringify({code,validFrom:'2026HT',rows:rows.length,termCredits:[30,30,30,30],electiveSlots:1,source:url}));
