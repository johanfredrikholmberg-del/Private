#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { discover as discoverGuStructure } from '../api/gu-program-structure.js';

const execFileAsync=promisify(execFile);
const SRC='data/susa';
const DEST='data/HT26';
const CONCURRENCY=Number(process.env.GU_CONCURRENCY||6);
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const isGU=x=>/goteborgs universitet/.test(norm(x.university));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const slugify=v=>norm(v).replace(/[^a-z0-9åäö]+/g,'-').replace(/^-+|-+$/g,'').replace(/å/g,'a').replace(/ä/g,'a').replace(/ö/g,'o');
const codeNorm=v=>clean(v).toUpperCase().replace(/[^A-Z0-9ÅÄÖ]/g,'');

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

function decodeHtml(s){return String(s??'').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")}
function abs(href,base){try{return new URL(decodeHtml(href),base).href}catch{return''}}
function htmlText(s){return clean(String(s??'').replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' '))}
async function getText(url){const r=await fetch(url,{headers:{accept:'text/html,application/xhtml+xml'},redirect:'follow',signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);return{html:await r.text(),url:r.url||url}}
async function findEducationPlanPdf(item){
  const main=`https://www.gu.se/studera/hitta-utbildning/${slugify(item.programName)}-${String(item.programCode||'').toLowerCase()}`;
  const page=await getText(main);
  for(const m of page.html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    const href=abs(m[1],page.url),label=htmlText(m[2]);
    if(/utbildningsplan/i.test(`${label} ${href}`)&&/\.pdf(?:$|\?)/i.test(href)) return href;
  }
  return'';
}
async function extractPdfText(url){
  const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`PDF HTTP ${r.status}`);
  const tmp=path.join(os.tmpdir(),`gu-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  await fs.writeFile(tmp,Buffer.from(await r.arrayBuffer()));
  try{const {stdout}=await execFileAsync('pdftotext',['-layout',tmp,'-'],{maxBuffer:8*1024*1024});return stdout}finally{await fs.rm(tmp,{force:true})}
}
function parsePdfRows(text){
  const rows=[];let term=0,year=0,yearHp=0;
  const lines=String(text||'').split(/\r?\n/).map(clean).filter(Boolean);
  const assignTerm=hp=>{
    if(year){const offset=Math.min(1,Math.floor((yearHp+0.001)/30));const t=(year-1)*2+1+offset;yearHp+=hp;return t}
    return term;
  };
  for(const line of lines){
    const tm=line.match(/^Termin\s+(\d{1,2})\b/i);if(tm){term=Number(tm[1]);year=0;yearHp=0;continue}
    const ym=line.match(/^År\s+(\d{1,2})\b/i);if(ym){year=Number(ym[1]);term=(year-1)*2+1;yearHp=0;continue}
    const explicit=[...line.matchAll(/\b([A-ZÅÄÖ]{2,8}\d{1,4}[A-Z]?)\b\s+(.{2,160}?)\s*[,;:\-–(]*\s*(\d+(?:[.,]\d+)?)\s*hp\b/gi)];
    for(const m of explicit){const hp=Number(m[3].replace(',','.'));if((term||year)&&hp>0&&hp<=30){const assigned=assignTerm(hp);rows.push({term:assigned,code:codeNorm(m[1]),name:clean(m[2].replace(/[,(;:\-–\s]+$/g,'')),hp,category:/valbar|fritt vald/i.test(line)?'elective':'unknown'})}}
    const simple=line.match(/^(.{3,160}?)\s*[,;:\-–(]*\s*(\d+(?:[.,]\d+)?)\s*hp\b/i);
    if((term||year)&&simple&&!explicit.length){const hp=Number(simple[2].replace(',','.'));if(hp>0&&hp<=30){const assigned=assignTerm(hp);rows.push({term:assigned,code:'',name:clean(simple[1].replace(/[,(;:\-–\s]+$/g,'')),hp,category:/valbar|fritt vald/i.test(line)?'elective':'unknown'})}}
  }
  const map=new Map();for(const r of rows){const k=`${r.term}|${r.code||norm(r.name)}`;if(!map.has(k))map.set(k,r)}return[...map.values()]
}
function buildPdfResult(item,rows,pdfUrl){
  const expected=Math.max(1,Math.round((Number(item.hp)||0)/30));const completeTerms=[],termHp={};
  for(let t=1;t<=expected;t++){const listed=Math.round(rows.filter(r=>r.term===t).reduce((s,r)=>s+r.hp,0)*10)/10;const covered=listed>=29.8&&listed<=30.2;termHp[t]={listedHp:listed,covered};if(covered)completeTerms.push(t)}
  const complete=completeTerms.length===expected;const courses=rows.filter(r=>completeTerms.includes(r.term)).map((r,i)=>({...r,originalTerm:r.term,__slOriginalTerm:r.term,__slOriginalIndex:i,status:'remaining',credited:false,isCredited:false,programmeSource:'gu-official-education-plan-pdf',programmeCategory:r.category}));
  return{found:rows.length>0,structureAvailable:complete,courses,sourceUrls:[pdfUrl],source:'gu-official-education-plan-pdf',confidence:complete?'official-pdf-sequenced':'official-pdf-partial',coverage:complete?'complete-term-sequence':'partial-or-choice-dependent',quality:{complete,expectedTerms:expected,completeTerms,termHp,slotCount:rows.filter(r=>r.category==='elective').length,parsedRows:rows.length,totalHp:Number(item.hp)||0,sourcePages:1}}
}
async function pdfFallback(item){try{const pdfUrl=await findEducationPlanPdf(item);if(!pdfUrl)return null;const text=await extractPdfText(pdfUrl);const rows=parsePdfRows(text);return buildPdfResult(item,rows,pdfUrl)}catch(e){console.log(`PDF fallback skipped ${item.programCode||''}: ${e.message}`);return null}}

async function enrich(item){
  try{
    let data=await discoverGuStructure({code:item.programCode||'',name:item.programName||'',university:'Göteborgs universitet'});
    let c=classify(data);
    if(['metadata-only','manual-review'].includes(c.coverage)){
      const pdf=await pdfFallback(item);if(pdf){const pc=classify(pdf);if(({complete:5,'choice-required':4,'partial-structure':3,'manual-review':2,'metadata-only':1}[pc.coverage]||0)>({complete:5,'choice-required':4,'partial-structure':3,'manual-review':2,'metadata-only':1}[c.coverage]||0)){data=pdf;c=pc}}
    }
    return {...item,term:'HT26',status:c.coverage==='metadata-only'?'manual-review':'processed',...c,source:data?.source||'gu-official-programplan',sourceUrl:(data?.sourceUrls||[])[0]||'',sourceUrls:data?.sourceUrls||[],apiCoverage:data?.coverage||'',apiConfidence:data?.confidence||'',officialProgramCode:codeNorm(data?.program?.code),officialAliases:(data?.programAliases||[]).map(codeNorm).filter(Boolean),quality:data?.quality||{},checkedAt:new Date().toISOString()};
  }catch(e){return {...item,term:'HT26',status:'manual-review',coverage:'metadata-only',reason:`gu-import:${e.message}`,checkedAt:new Date().toISOString()}}
}

async function pool(items){
  const out=new Array(items.length);let i=0;
  async function worker(){for(;;){const n=i++;if(n>=items.length)return;out[n]=await enrich(items[n]);console.log(`${n+1}/${items.length} ${out[n].coverage} ${items[n].programCode||''} ${items[n].programName||''}`);await sleep(120)}}
  await Promise.all(Array.from({length:Math.min(CONCURRENCY,items.length)},worker));return out;
}

const rank={complete:5,'choice-required':4,'partial-structure':3,'manual-review':2,'metadata-only':1};

function applyOfficialAliases(fresh){
  const byCode=new Map(fresh.map(x=>[codeNorm(x.programCode),x]));
  for(const current of fresh){
    if((rank[current.coverage]||0)<3)continue;
    for(const alias of current.officialAliases||[]){
      const old=byCode.get(codeNorm(alias));
      if(!old)continue;
      if(Number(old.hp||0)!==Number(current.hp||0))continue;
      if((rank[old.coverage]||0)>=3)continue;
      const inherited={...current,key:old.key,programCode:old.programCode,programName:old.programName,hp:old.hp,coverage:current.coverage,reason:'official-gu-superseded-code-alias',status:'processed',aliasOf:current.programCode,officialProgramCode:current.officialProgramCode||current.programCode,checkedAt:new Date().toISOString()};
      Object.assign(old,inherited);
      console.log(`alias ${old.programCode} -> ${current.programCode} ${old.coverage}`);
    }
  }
}

async function main(){
  const queue=JSON.parse(await fs.readFile(path.join(SRC,'structure-queue.json'),'utf8'));
  let structures=[];try{structures=JSON.parse(await fs.readFile(path.join(DEST,'program-structures.json'),'utf8'))}catch{}
  const map=new Map(structures.map(x=>[x.key,x]));
  const gu=queue.filter(isGU);
  const fresh=await pool(gu);
  applyOfficialAliases(fresh);
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

// trigger: gu-official-alias-resolution
