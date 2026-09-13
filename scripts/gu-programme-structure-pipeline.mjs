#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const SRC='data/susa';
const DEST='data/HT26';
const API=(process.env.GU_API_BASE||'https://private-two-gamma.vercel.app').replace(/\/$/,'');
const CONCURRENCY=Number(process.env.GU_CONCURRENCY||6);
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const isGU=x=>/goteborgs universitet/.test(norm(x.university));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function getJson(url){
  const r=await fetch(url,{headers:{accept:'application/json','user-agent':'StudieLots-GU-import/HT26'},redirect:'follow',signal:AbortSignal.timeout(25000)});
  if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

function classify(data){
  const rows=(Array.isArray(data?.courses)?data.courses:[]).map(r=>({
    term:Number(r.term??r.__slOriginalTerm)||null,
    code:clean(r.code),name:clean(r.name),hp:Number(r.hp)||0,
    category:clean(r.category||r.programmeCategory||r.type||r.slotType),
    isSlot:Boolean(r.isSlot),isThesis:Boolean(r.isThesis)
  })).filter(r=>r.term&&r.name&&r.hp>0);
  if(!data?.found||!rows.length) return {coverage:'metadata-only',reason:'official-gu-structure-not-resolved',rows:[]};
  const q=data.quality||{};
  if(data.structureAvailable===true&&q.complete===true) return {coverage:Number(q.slotCount||0)>0?'choice-required':'complete',reason:'official-gu-complete-term-sequence',rows};
  const fullTerms=Array.isArray(q.completeTerms)?q.completeTerms.length:0;
  if(fullTerms>=2) return {coverage:'partial-structure',reason:'official-gu-partial-term-sequence',rows};
  return {coverage:'manual-review',reason:'official-gu-insufficient-consistency',rows};
}

async function enrich(item){
  const u=new URL('/api/gu-program-structure',API);
  u.searchParams.set('code',item.programCode||'');
  u.searchParams.set('name',item.programName||'');
  u.searchParams.set('university','Göteborgs universitet');
  try{
    const data=await getJson(u);
    const c=classify(data);
    return {...item,term:'HT26',status:c.coverage==='metadata-only'?'manual-review':'processed',...c,source:data?.source||'gu-official-programplan',sourceUrl:(data?.sourceUrls||[])[0]||'',sourceUrls:data?.sourceUrls||[],apiCoverage:data?.coverage||'',apiConfidence:data?.confidence||'',quality:data?.quality||{},checkedAt:new Date().toISOString()};
  }catch(e){return {...item,term:'HT26',status:'manual-review',coverage:'metadata-only',reason:`gu-import:${e.message}`,checkedAt:new Date().toISOString()}}
}

async function pool(items){
  const out=new Array(items.length);let i=0;
  async function worker(){for(;;){const n=i++;if(n>=items.length)return;out[n]=await enrich(items[n]);console.log(`${n+1}/${items.length} ${out[n].coverage} ${items[n].programCode||''} ${items[n].programName||''}`);await sleep(120)}}
  await Promise.all(Array.from({length:Math.min(CONCURRENCY,items.length)},worker));return out;
}

const rank={complete:5,'choice-required':4,'partial-structure':3,'manual-review':2,'metadata-only':1};

async function main(){
  const queue=JSON.parse(await fs.readFile(path.join(SRC,'structure-queue.json'),'utf8'));
  let structures=[];try{structures=JSON.parse(await fs.readFile(path.join(DEST,'program-structures.json'),'utf8'))}catch{}
  const map=new Map(structures.map(x=>[x.key,x]));
  const gu=queue.filter(isGU);
  const fresh=await pool(gu);
  for(const x of fresh){const old=map.get(x.key);if(!old||(rank[x.coverage]||0)>=(rank[old.coverage]||0))map.set(x.key,x)}
  const all=[...map.values()];
  const guRows=gu.map(x=>map.get(x.key)).filter(Boolean);
  const counts=guRows.reduce((a,x)=>(a[x.coverage]=(a[x.coverage]||0)+1,a),{});
  const unresolved=guRows.filter(x=>['metadata-only','manual-review'].includes(x.coverage)).map(x=>({key:x.key,code:x.programCode,name:x.programName,hp:x.hp,coverage:x.coverage,reason:x.reason||''}));
  await fs.mkdir(DEST,{recursive:true});
  await fs.writeFile(path.join(DEST,'program-structures.json'),JSON.stringify(all,null,2)+'\n');
  await fs.mkdir('data/gu',{recursive:true});
  await fs.writeFile('data/gu/meta.json',JSON.stringify({database:'StudieLots HT26',generatedAt:new Date().toISOString(),programmes:gu.length,counts,unresolved:unresolved.length},null,2)+'\n');
  await fs.writeFile('data/gu/unresolved.json',JSON.stringify(unresolved,null,2)+'\n');
  console.log(JSON.stringify({database:'StudieLots HT26',programmes:gu.length,counts,unresolved:unresolved.length},null,2));
}

main().catch(e=>{console.error(e);process.exitCode=1});
