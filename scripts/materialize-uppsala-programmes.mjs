#!/usr/bin/env node
// Import only the published 2026 Uppsala study plans whose semester allocations
// can be checked exactly. Ambiguous plans are recorded for review.
import fs from 'node:fs/promises';

const base='data/studielots-db/';
const sources=[
  {query:'cfc4076e-a0fb-4cce-a241-49d1e9c5fea4',variant:'Programvaruteknik'},
  {query:'10056',variant:''},
  {query:'041d6f54-ed13-453a-a3e8-39c2ab99c0b2',variant:'Speldesign'}
];
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const manifest=await read(base+'programme-structures-manifest.json');
const existing=(await Promise.all(manifest.parts.map(p=>read(base+p)))).flatMap(x=>Array.isArray(x)?x:x.programs||[]);
const candidates=await read('data/import-reviews/uppsala-programme-candidates.json');
const report={generatedAt:new Date().toISOString(),university:'Uppsala universitet',catalogueCandidates:candidates.length,attempted:0,added:0,review:[],duplicates:[],canonicalBefore:existing.length};
const added=[];
for(const {query,variant} of sources){
  report.attempted++;
  const url=`https://www.uu.se/utbildning/studieplan?query=${query}`;
  try{
    const response=await fetch(url,{signal:AbortSignal.timeout(25000)});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const html=await response.text();
    const match=html.match(/AppRegistry\.registerInitialState\([^,]+,({"outline":.*?})\);/s);
    if(!match)throw new Error('No official outline state');
    const outline=JSON.parse(match[1]).outline;
    const total=Number(String(outline.credits).match(/\d+/)?.[0]);
    const code=outline.code;
    if(!code||!total||!Array.isArray(outline.semesters))throw new Error('Missing programme metadata');
    const rows=[];
    for(const semester of outline.semesters){
      const term=Number(semester.number);
      for(const course of semester.courses||[]){
        const education=course.education||{};
        rows.push({term,code:education.code||'',name:education.nameSv||'',hp:Number(education.creditsNumber),category:'mandatory'});
      }
      // A textual elective allocation is a block, not the optional example course.
      const descriptions=(semester.texts||[]).map(x=>String(x.descriptionSv||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ')).join(' ');
      const elective=descriptions.match(/valbara kurser\s+(\d+(?:[,.]\d+)?)\s*hp/i);
      if(elective){
        const hp=Number(elective[1].replace(',','.'));
        const mandatory=rows.filter(x=>x.term===term).reduce((s,x)=>s+x.hp,0);
        if(mandatory===0||mandatory+hp===30||mandatory===hp){
          // Guaranteed example courses in the plan are alternatives to this block.
          if(mandatory===hp)rows.splice(rows.findIndex(x=>x.term===term),rows.filter(x=>x.term===term).length);
          rows.push({term,code:'',name:'Valbara kurser',hp,category:'elective',slotType:'elective-slot',isSlot:true});
        }
      }
    }
    const sums=Array.from({length:total/30},(_,i)=>rows.filter(x=>x.term===i+1).reduce((s,x)=>s+x.hp,0));
    if(!Number.isInteger(total/30)||outline.semesters.length!==total/30||sums.some(x=>Math.abs(x-30)>0.01)||rows.some(x=>!x.name||!(x.hp>0))){
      throw new Error(`Incomplete or ambiguous semester allocation: ${JSON.stringify(sums)}`);
    }
    const id=`uu:${code}:2026HT:${variant.toLowerCase()||'general'}`;
    if(existing.some(x=>x.id===id||x.university==='Uppsala universitet'&&x.programCode===code&&x.validFrom==='2026HT'&&String(x.subject||'')===variant)){
      report.duplicates.push(id);continue;
    }
    added.push({id,university:'Uppsala universitet',programCode:code,programName:outline.name+(variant?` – ${variant}`:''),programHp:total,validFrom:'2026HT',subject:variant,coverage:rows.some(x=>x.isSlot)?'choice-required':'complete',verified:true,source:'uppsala-official-studieplan',sourceUrls:[url],rows});
  }catch(e){report.review.push({url,reason:String(e.message||e)});}
}
if(added.length){
  const part='programme-structures-uppsala-2026.json';
  const old=manifest.parts.includes(part)?await read(base+part):[];
  const merged=[...old,...added];
  await fs.writeFile(base+part,JSON.stringify(merged,null,2)+'\n');
  if(!manifest.parts.includes(part))manifest.parts.push(part);
  manifest.count=existing.length+added.length;
  manifest.generatedAt=new Date().toISOString();
  const university=manifest.universities.find(x=>x.university==='Uppsala universitet');
  if(university)university.count+=added.length;
  else manifest.universities.push({university:'Uppsala universitet',count:added.length});
  await fs.writeFile(base+'programme-structures-manifest.json',JSON.stringify(manifest,null,2)+'\n');
  const db=await read(base+'manifest.json');db.tables.programmeStructures.rows=manifest.count;db.generatedAt=manifest.generatedAt;
  await fs.writeFile(base+'manifest.json',JSON.stringify(db,null,2)+'\n');
}
report.added=added.length;report.canonicalAfter=existing.length+added.length;report.remaining=candidates.length-report.attempted;
await fs.writeFile('data/import-reviews/uppsala-materialization-latest.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.review.length)process.exitCode=0;
