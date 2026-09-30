#!/usr/bin/env node
import fs from 'node:fs';
import { discover } from '../api/gu-program-structure.js';

const BASE='data/studielots-db/';
const LIMIT=Number(process.env.GU_STRUCTURE_LIMIT||20);
const OFFSET=Math.max(0,Number(process.env.GU_STRUCTURE_OFFSET||114));
const FORCE_RETRY=process.env.GU_STRUCTURE_FORCE_RETRY==='1';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const arr=x=>Array.isArray(x)?x:Array.isArray(x?.programs)?x.programs:[];
const norm=v=>String(v??'').trim();
const db=read(BASE+'manifest.json');
const index=read(BASE+'programme-structures-manifest.json');
const identities=[read(db.tables.programmes.storage),...(db.tables.programmes.additionalStorages||[]).map(read)].flat().filter(Boolean);
const parts=new Map(index.parts.map(p=>[p,read(BASE+p)]));
const all=[...parts.values()].flatMap(arr).filter(Boolean);
const byCode=new Map(all.filter(x=>x.university==='Göteborgs universitet').map(x=>[norm(x.programCode),x]));
const candidates=new Map();
for(const row of all.filter(x=>x.university==='Göteborgs universitet'&&!x.rows?.length)){
  const code=norm(row.programCode),matches=identities.filter(x=>x.university==='Göteborgs universitet'&&norm(x.programCode)===code&&Number(x.programHp)===Number(row.hp));
  if(matches.length===1)candidates.set(code,matches[0]);
}
for(const row of identities.filter(x=>x.university==='Göteborgs universitet'&&norm(x.programCode)&&!byCode.has(norm(x.programCode)))){
  const code=norm(row.programCode);
  if(identities.filter(x=>x.university==='Göteborgs universitet'&&norm(x.programCode)===code&&Number(x.programHp)===Number(row.programHp)).length===1)candidates.set(code,row);
}
let previous=null;try{previous=read('data/import-reviews/gu-structure-batch-latest.json')}catch{}
const retryMs=7*86400000,now=Date.now(),deferredUntil={...previous?.deferredUntil};
if(!previous?.deferredUntil&&Date.parse(previous?.generatedAt||'')>now-retryMs)for(const row of previous.review||[])deferredUntil[row.code]=Date.parse(previous.generatedAt)+retryMs;
for(const [code,until] of Object.entries(deferredUntil))if(Number(until)<=now||!candidates.has(code))delete deferredUntil[code];
const unique=[...candidates.values()].filter(x=>FORCE_RETRY||!deferredUntil[norm(x.programCode)]).sort((a,b)=>Number(a.programHp)-Number(b.programHp)||norm(a.programCode).localeCompare(norm(b.programCode)));
const accepted=[],review=[];
for(const identity of unique.slice(OFFSET,OFFSET+LIMIT)){
  try{
    const result=await discover({code:identity.programCode,name:identity.programName,university:identity.university});
    if(!result?.found||!result?.structureAvailable||!Array.isArray(result.courses)||!result.courses.length){
      review.push({code:identity.programCode,name:identity.programName,reason:'official-structure-incomplete',quality:result?.quality||null});
      continue;
    }
    if(!result.sourceUrls?.[0]?.toLowerCase().match(new RegExp(`-${norm(identity.programCode).toLowerCase()}(?:[/?#]|$)`))||Number(result.quality?.totalHp)!==Number(identity.programHp)){
      review.push({code:identity.programCode,name:identity.programName,reason:'official-identity-or-credit-conflict'});
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
      id:`gu:${identity.programCode}:official`,key:byCode.get(norm(identity.programCode))?.key||identity.key,university:'Göteborgs universitet',
      programCode:identity.programCode,programName:identity.programName,programHp:Number(identity.programHp)||expected*30,hp:Number(identity.programHp)||expected*30,
      validFrom:'2026HT',coverage:result.coverage||'complete-term-sequence',verified:true,courseCodesVerified:rows.filter(r=>!r.isSlot).every(r=>Boolean(r.code)),
      choiceRequired:rows.some(r=>r.isSlot),source:'gu-official-programplan',sourceEvidenceUrl:result.sourceUrls?.[0]||'',sourceUrls:result.sourceUrls||[],rows
    });
  }catch(error){review.push({code:identity.programCode,name:identity.programName,reason:'fetch-error',error:String(error?.message||error)})}
}
const target=BASE+'programme-structures-gu-batch.json';
if(process.argv.includes('--write')&&accepted.length){
  const replacements=new Map(accepted.filter(x=>byCode.has(x.programCode)).map(x=>[x.programCode,x]));
  for(const [part,data] of parts){
    const rows=arr(data),next=rows.map(row=>{
      const replacement=row.university==='Göteborgs universitet'&&replacements.get(norm(row.programCode));
      if(!replacement)return row;
      if(row.rows?.length||row.verified===true)throw Error('Refusing to overwrite populated GU plan '+row.programCode);
      replacements.delete(norm(row.programCode));
      return {...row,...replacement,key:row.key,sourceUrl:replacement.sourceEvidenceUrl,status:'verified',reason:null};
    });
    if(next.some((row,i)=>row!==rows[i]))fs.writeFileSync(BASE+part,JSON.stringify(Array.isArray(data)?next:{...data,programs:next},null,2)+'\n');
  }
  if(replacements.size)throw Error('GU metadata replacement missing: '+[...replacements.keys()]);
  const additions=accepted.filter(x=>!byCode.has(x.programCode));
  if(additions.length){
    const current=fs.existsSync(target)?read(target):{schemaVersion:1,programs:[]};
    fs.writeFileSync(target,JSON.stringify({schemaVersion:1,programs:[...arr(current),...additions]},null,2)+'\n');
    if(!index.parts.includes('programme-structures-gu-batch.json'))index.parts.push('programme-structures-gu-batch.json');
  }
  index.count+=additions.length;
  const uni=index.universities.find(x=>x.university==='Göteborgs universitet');
  if(uni)uni.count=(Number(uni.count)||0)+additions.length;
  db.tables.programmeStructures.rows=index.count;
  fs.writeFileSync(BASE+'programme-structures-manifest.json',JSON.stringify(index,null,2)+'\n');
  fs.writeFileSync(BASE+'manifest.json',JSON.stringify(db,null,2)+'\n');
}
fs.mkdirSync('data/import-reviews',{recursive:true});
for(const row of review)deferredUntil[row.code]=now+retryMs;
fs.writeFileSync('data/import-reviews/gu-structure-batch-latest.json',JSON.stringify({generatedAt:new Date().toISOString(),limit:LIMIT,candidates:unique.length,offset:OFFSET,attempted:Math.min(LIMIT,Math.max(0,unique.length-OFFSET)),imported:accepted.length,reviewCount:review.length,importedCodes:accepted.map(x=>x.programCode),review,deferredUntil},null,2)+'\n');
console.log(JSON.stringify({candidates:unique.length,offset:OFFSET,attempted:Math.min(LIMIT,Math.max(0,unique.length-OFFSET)),imported:accepted.length,review:review.length,codes:accepted.map(x=>x.programCode)},null,2));
