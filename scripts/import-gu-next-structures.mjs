#!/usr/bin/env node
import fs from 'node:fs';
import { discover } from '../api/gu-program-structure.js';

const BASE='data/studielots-db/';
const LIMIT=Number(process.env.GU_STRUCTURE_LIMIT||20);
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const arr=x=>Array.isArray(x)?x:Array.isArray(x?.programs)?x.programs:[];
const norm=v=>String(v??'').trim();
const db=read(BASE+'manifest.json');
const index=read(BASE+'programme-structures-manifest.json');
const identities=[read(db.tables.programmes.storage),...(db.tables.programmes.additionalStorages||[]).map(read)].flat().filter(Boolean);
const all=index.parts.flatMap(p=>arr(read(BASE+p))).filter(Boolean);
const existing=new Set(all.filter(x=>x.university==='Göteborgs universitet').map(x=>norm(x.programCode)).filter(Boolean));
const gu=identities.filter(x=>x.university==='Göteborgs universitet'&&norm(x.programCode)&&!existing.has(norm(x.programCode)));
const unique=[...new Map(gu.map(x=>[norm(x.programCode),x])).values()];
const accepted=[],review=[];
for(const identity of unique.slice(0,LIMIT)){
  try{
    const result=await discover({code:identity.programCode,name:identity.programName,university:identity.university});
    if(!result?.found||!result?.structureAvailable||!Array.isArray(result.courses)||!result.courses.length){
      review.push({code:identity.programCode,name:identity.programName,reason:'official-structure-incomplete',quality:result?.quality||null});
      continue;
    }
    const rows=result.courses.map(({__slOriginalTerm,__slOriginalIndex,originalTerm,status,credited,isCredited,programmeSource,programmeCategory,...r})=>({
      term:Number(r.term),code:norm(r.code),name:norm(r.name),hp:Number(r.hp)||0,
      category:r.category==='elective-slot'?'elective':(r.category||'unknown'),
      ...(r.category==='elective-slot'?{isSlot:true,slotType:'elective-slot'}:{}),
      ...(Array.isArray(r.options)&&r.options.length?{options:r.options}:{})
    })).filter(r=>r.term>0&&r.name&&r.hp>0);
    const expected=Math.round((Number(identity.programHp)||Number(result?.quality?.totalHp)||0)/30);
    if(expected<2||Array.from({length:expected},(_,i)=>i+1).some(t=>Math.abs(rows.filter(r=>r.term===t).reduce((s,r)=>s+r.hp,0)-30)>.2)){
      review.push({code:identity.programCode,name:identity.programName,reason:'term-credit-validation'});
      continue;
    }
    accepted.push({
      id:`gu:${identity.programCode}:official`,key:identity.key,university:'Göteborgs universitet',
      programCode:identity.programCode,programName:identity.programName,programHp:Number(identity.programHp)||expected*30,hp:Number(identity.programHp)||expected*30,
      validFrom:'2026HT',coverage:result.coverage||'complete-term-sequence',verified:true,courseCodesVerified:rows.filter(r=>!r.isSlot).every(r=>Boolean(r.code)),
      choiceRequired:rows.some(r=>r.isSlot),source:'gu-official-programplan',sourceEvidenceUrl:result.sourceUrls?.[0]||'',sourceUrls:result.sourceUrls||[],rows
    });
  }catch(error){review.push({code:identity.programCode,name:identity.programName,reason:'fetch-error',error:String(error?.message||error)})}
}
const target=BASE+'programme-structures-gu-batch.json';
if(process.argv.includes('--write')&&accepted.length){
  const current=fs.existsSync(target)?read(target):{schemaVersion:1,programs:[]};
  const merged=new Map(arr(current).map(x=>[x.programCode,x])); for(const x of accepted)merged.set(x.programCode,x);
  fs.writeFileSync(target,JSON.stringify({schemaVersion:1,programs:[...merged.values()]},null,2)+'\n');
  if(!index.parts.includes('programme-structures-gu-batch.json'))index.parts.push('programme-structures-gu-batch.json');
  const previousCount=index.count;
  index.count=previousCount+accepted.filter(x=>!existing.has(x.programCode)).length;
  const uni=index.universities.find(x=>x.university==='Göteborgs universitet');
  if(uni)uni.count=(Number(uni.count)||0)+accepted.filter(x=>!existing.has(x.programCode)).length;
  db.tables.programmeStructures.rows=index.count;
  fs.writeFileSync(BASE+'programme-structures-manifest.json',JSON.stringify(index,null,2)+'\n');
  fs.writeFileSync(BASE+'manifest.json',JSON.stringify(db,null,2)+'\n');
}
fs.mkdirSync('data/import-reviews',{recursive:true});
fs.writeFileSync('data/import-reviews/gu-structure-batch-latest.json',JSON.stringify({generatedAt:new Date().toISOString(),limit:LIMIT,candidates:unique.length,attempted:Math.min(LIMIT,unique.length),imported:accepted.length,reviewCount:review.length,importedCodes:accepted.map(x=>x.programCode),review},null,2)+'\n');
console.log(JSON.stringify({candidates:unique.length,attempted:Math.min(LIMIT,unique.length),imported:accepted.length,review:review.length,codes:accepted.map(x=>x.programCode)},null,2));
