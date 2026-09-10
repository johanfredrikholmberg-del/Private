#!/usr/bin/env node

const args=process.argv.slice(2);
const value=(name,fallback='')=>{const i=args.indexOf(name);return i>=0&&args[i+1]?args[i+1]:fallback};
const has=name=>args.includes(name);
const base=(value('--base',process.env.STUDIELOTS_BASE_URL||'https://private-two-gamma.vercel.app')).replace(/\/$/,'');
const limit=Math.max(0,Number(value('--limit','0'))||0);
const concurrency=Math.max(1,Math.min(12,Number(value('--concurrency','6'))||6));
const timeout=Math.max(5000,Number(value('--timeout','25000'))||25000);
const jsonOnly=has('--json');
const auth=process.env.STUDIELOTS_AUTH||'';

const headers={accept:'application/json'};
if(auth)headers.authorization=auth;

async function getJson(url){
  let last;
  for(let attempt=0;attempt<2;attempt++){
    try{
      const r=await fetch(url,{headers,signal:AbortSignal.timeout(timeout)});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      return await r.json();
    }catch(error){
      last=error;
      if(attempt===0)await new Promise(r=>setTimeout(r,400));
    }
  }
  throw last;
}

const clean=v=>String(v??'').trim();
function sourceCoverage(p){return clean(p.susaStructureCoverage||p.structureCoverage||'metadata-only')||'metadata-only'}
function plannerCoverage(result){
  if(result?.structureAvailable===true)return'complete';
  if(result?.found===true||Array.isArray(result?.courses)&&result.courses.length>0||result?.requiresConcentration||result?.requiresMasterProgramme)return'partial';
  return'metadata-only';
}
function effectiveCoverage(source,planner){
  if(source==='complete'||planner==='complete')return'complete';
  if(source==='partial'||planner==='partial')return'partial';
  return'metadata-only';
}
function summary(rows,key){
  const out={complete:0,partial:0,metadataOnly:0,total:rows.length};
  for(const row of rows){const v=row[key];if(v==='complete')out.complete++;else if(v==='partial')out.partial++;else out.metadataOnly++}
  return out;
}

async function probe(program){
  const u=new URL(`${base}/api/program-structure-resolved`);
  for(const [k,v] of [['university',program.university],['code',program.programCode],['name',program.programName],['subject',program.subject]])if(clean(v))u.searchParams.set(k,clean(v));
  const source=sourceCoverage(program);
  try{
    const result=await getJson(u);
    const planner=plannerCoverage(result);
    return {...program,sourceCoverage:source,plannerStructureCoverage:planner,effectiveStructureCoverage:effectiveCoverage(source,planner),plannerSource:clean(result?.source),plannerCoverage:clean(result?.coverage),requiresConcentration:Boolean(result?.requiresConcentration),requiresMasterProgramme:Boolean(result?.requiresMasterProgramme),probeError:null};
  }catch(error){
    return {...program,sourceCoverage:source,plannerStructureCoverage:'metadata-only',effectiveStructureCoverage:source,plannerSource:'',plannerCoverage:'',requiresConcentration:false,requiresMasterProgramme:false,probeError:String(error?.message||error)};
  }
}

async function mapLimit(items,worker,count){
  const out=new Array(items.length);let next=0;
  async function run(){while(true){const i=next++;if(i>=items.length)return;out[i]=await worker(items[i]);if(!jsonOnly&&((i+1)%25===0||i===items.length-1))process.stderr.write(`\rAudited ${i+1}/${items.length}`)}}
  await Promise.all(Array.from({length:Math.min(count,items.length)},run));
  if(!jsonOnly&&items.length)process.stderr.write('\n');
  return out;
}

const index=await getJson(new URL(`${base}/api/program-index`));
let programs=Array.isArray(index?.programs)?index.programs:[];
if(limit)programs=programs.slice(0,limit);
if(!programs.length)throw new Error('Program-index returned no programs');

const rows=await mapLimit(programs,probe,concurrency);
const errors=rows.filter(r=>r.probeError);
const report={
  auditedAt:new Date().toISOString(),
  base,
  catalogueTotal:Number(index?.catalogue?.uniquePrograms||programs.length),
  auditedPrograms:rows.length,
  source:summary(rows,'sourceCoverage'),
  planner:summary(rows,'plannerStructureCoverage'),
  effective:summary(rows,'effectiveStructureCoverage'),
  probeErrors:errors.length,
  remaining:rows.filter(r=>r.effectiveStructureCoverage!=='complete').map(r=>({university:r.university,programName:r.programName,programCode:r.programCode||'',subject:r.subject||'',sourceCoverage:r.sourceCoverage,plannerCoverage:r.plannerStructureCoverage,error:r.probeError||null})),
  programs:rows
};

if(jsonOnly)console.log(JSON.stringify(report,null,2));
else{
  console.log(`Catalogue: ${report.catalogueTotal} | audited: ${report.auditedPrograms}`);
  console.log(`SUSA/source   complete ${report.source.complete}, partial ${report.source.partial}, metadata-only ${report.source.metadataOnly}`);
  console.log(`Planner       complete ${report.planner.complete}, partial ${report.planner.partial}, metadata-only ${report.planner.metadataOnly}`);
  console.log(`Effective     complete ${report.effective.complete}, partial ${report.effective.partial}, metadata-only ${report.effective.metadataOnly}`);
  console.log(`Probe errors: ${report.probeErrors}`);
  console.log(`Remaining non-complete: ${report.remaining.length}`);
}
