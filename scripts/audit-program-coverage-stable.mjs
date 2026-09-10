#!/usr/bin/env node

const args=process.argv.slice(2);
const value=(name,fallback='')=>{const i=args.indexOf(name);return i>=0&&args[i+1]?args[i+1]:fallback};
const base=(value('--base',process.env.STUDIELOTS_BASE_URL||'https://private-two-gamma.vercel.app')).replace(/\/$/,'');
const offset=Math.max(0,Number(value('--offset','0'))||0);
const limit=Math.max(1,Number(value('--limit','50'))||50);
const concurrency=Math.max(1,Math.min(6,Number(value('--concurrency','2'))||2));
const timeout=Math.max(5000,Number(value('--timeout','20000'))||20000);
const auth=process.env.STUDIELOTS_AUTH||'';
const headers={accept:'application/json'};
if(auth)headers.authorization=auth;
const clean=v=>String(v??'').trim();

async function getJson(url,{attempts=1,requestTimeout=timeout}={}){
  let last;
  for(let attempt=0;attempt<attempts;attempt++){
    try{
      const r=await fetch(url,{headers,signal:AbortSignal.timeout(requestTimeout)});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      return await r.json();
    }catch(error){
      last=error;
      if(attempt+1<attempts)await new Promise(r=>setTimeout(r,700*(attempt+1)));
    }
  }
  throw last;
}

function plannerCoverage(result){
  if(result?.structureAvailable===true)return result?.programmeSequence?.exact===false?'partial':'complete';
  if(result?.found===true||Array.isArray(result?.courses)&&result.courses.length>0||result?.requiresConcentration||result?.requiresMasterProgramme)return'partial';
  return'metadata-only';
}

function courseMetrics(result){
  const courses=Array.isArray(result?.courses)?result.courses:[];
  const terms=new Map();
  let hp=0;
  for(const c of courses){
    const n=Number(c?.hp)||0,term=Number(c?.term||c?.__slOriginalTerm)||0;
    if(n>0)hp+=n;
    if(term>0&&n>0)terms.set(term,(terms.get(term)||0)+n);
  }
  const completeTerms=[...terms].filter(([,n])=>n>=27&&n<=33).map(([t])=>t).sort((a,b)=>a-b);
  return{courseRows:courses.length,parsedHp:Math.round(hp*10)/10,sequencedTerms:terms.size,completeTerms};
}

async function probe(program){
  const u=new URL(`${base}/api/program-structure-resolved`);
  for(const [k,v] of [['university',program.university],['code',program.programCode],['name',program.programName],['subject',program.subject]])if(clean(v))u.searchParams.set(k,clean(v));
  try{
    const result=await getJson(u,{attempts:2,requestTimeout:timeout});
    return{...program,plannerCoverage:plannerCoverage(result),technicalError:null,...courseMetrics(result),source:result?.source||null,confidence:result?.confidence||null};
  }catch(error){
    return{...program,plannerCoverage:'technical-error',technicalError:String(error?.message||error),courseRows:0,parsedHp:0,sequencedTerms:0,completeTerms:[]};
  }
}

async function mapLimit(items,worker,count){
  const out=new Array(items.length);let next=0;
  async function run(){while(true){const i=next++;if(i>=items.length)return;out[i]=await worker(items[i]);}}
  await Promise.all(Array.from({length:Math.min(count,items.length)},run));
  return out;
}

let index;
try{
  index=await getJson(new URL(`${base}/api/program-index`),{attempts:2,requestTimeout:20000});
}catch(error){
  console.error(`AUDIT CATALOGUE ERROR: ${error?.message||error}`);
  process.exitCode=2;
  process.exit();
}

const all=Array.isArray(index?.programs)?index.programs:[];
const programs=all.slice(offset,offset+limit);
const rows=await mapLimit(programs,probe,concurrency);
const counts={complete:0,partial:0,metadataOnly:0,technicalError:0};
for(const r of rows){
  if(r.plannerCoverage==='complete')counts.complete++;
  else if(r.plannerCoverage==='partial')counts.partial++;
  else if(r.plannerCoverage==='technical-error')counts.technicalError++;
  else counts.metadataOnly++;
}
const incomplete=rows.filter(r=>r.plannerCoverage!=='complete');
const errors=rows.filter(r=>r.technicalError);
console.log(`Catalogue: ${all.length} | audited: ${rows.length} | offset: ${offset}`);
console.log(`Planner complete ${counts.complete}, partial ${counts.partial}, metadata-only ${counts.metadataOnly}, technical-error ${counts.technicalError}`);
console.log(`Incomplete: ${incomplete.length} | Probe errors: ${errors.length}`);
for(const r of rows)console.log(`${r.plannerCoverage.toUpperCase()} | ${r.university} | ${r.programCode||'-'} | ${r.programName} | rows=${r.courseRows} hp=${r.parsedHp} terms=${r.sequencedTerms} completeTerms=${r.completeTerms.join(',')||'-'}${r.technicalError?` | ${r.technicalError}`:''}`);
