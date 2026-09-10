#!/usr/bin/env node

const args=process.argv.slice(2);
const value=(name,fallback='')=>{const i=args.indexOf(name);return i>=0&&args[i+1]?args[i+1]:fallback};
const has=name=>args.includes(name);
const base=(value('--base',process.env.STUDIELOTS_BASE_URL||'https://private-two-gamma.vercel.app')).replace(/\/$/,'');
const limit=Math.max(0,Number(value('--limit','0'))||0);
const offset=Math.max(0,Number(value('--offset','0'))||0);
const concurrency=Math.max(1,Math.min(12,Number(value('--concurrency','6'))||6));
const timeout=Math.max(5000,Number(value('--timeout','25000'))||25000);
const jsonOnly=has('--json');
const auth=process.env.STUDIELOTS_AUTH||'';
const headers={accept:'application/json'};
if(auth)headers.authorization=auth;

async function getJson(url,{attempts=2,requestTimeout=timeout}={}){
  let last;
  for(let attempt=0;attempt<attempts;attempt++){
    try{const r=await fetch(url,{headers,signal:AbortSignal.timeout(requestTimeout)});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}
    catch(error){last=error;if(attempt+1<attempts)await new Promise(r=>setTimeout(r,400*(attempt+1)))}
  }
  throw last;
}
const clean=v=>String(v??'').trim();
const norm=v=>clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const localized=value=>{const rows=value?.strings||value?.urls||[];const swe=rows.find(x=>String(x?.lang||'').toLowerCase()==='swe');return clean((swe||rows[0])?.value)};
const list=(data,keys)=>{if(Array.isArray(data))return data;for(const key of keys)if(Array.isArray(data?.[key]))return data[key];return[]};
const infoList=d=>list(d,['educationInfos','educationInfo','items','content','results','data']);
const providerList=d=>list(d,['educationProviders','providers','items','content','results','data']);
const eventList=d=>list(d,['educationEvents','events','items','content','results','data']);
const isActive=r=>{if(!r||String(r.status||'ACTIVE').toUpperCase()!=='ACTIVE')return false;const expires=r?.content?.expires;return !expires||!Number.isFinite(Date.parse(expires))||Date.parse(expires)>=Date.now()-86400000};
const isProgram=info=>['program','programme','programmeutbildning'].includes(norm(info?.content?.configuration?.code));
function scalarEntries(value,path='',out=[]){if(value==null)return out;if(Array.isArray(value))value.forEach((x,i)=>scalarEntries(x,`${path}[${i}]`,out));else if(typeof value==='object')Object.entries(value).forEach(([k,x])=>scalarEntries(x,path?`${path}.${k}`:k,out));else out.push({path,value});return out}
function providerId(info){const c=info?.content||{},direct=clean(c.provider||c.providers?.[0]||c.organizer||c.educationProvider);return direct||clean(scalarEntries(c).find(x=>/(provider|organizer|educationProvider)(\[0\])?$/i.test(x.path))?.value)}
function subjectLabel(info){const subjects=info?.content?.subjects||[],uh=subjects.find(s=>s?.type==='UH_Subject');return localized(uh?.name)||clean(uh?.name)||localized(info?.content?.subject)||'Övrigt'}
function totalPages(d){const n=Number(d?.totalPages??d?.page?.totalPages??d?.pagination?.totalPages);return Number.isFinite(n)&&n>0?Math.ceil(n):1}
async function susaBase(){const fallback='https://api.skolverket.se/susa-navet/emil3/';try{const r=await fetch('https://api.skolverket.se/susa-navet/susa-navet-emil3.yaml',{headers:{accept:'text/yaml,text/plain'},signal:AbortSignal.timeout(5000)});if(!r.ok)return fallback;const yaml=await r.text(),server=yaml.match(/^\s*-\s*url:\s*["']?([^\s"']+)/m)?.[1];if(!server)return fallback;const u=new URL(server,'https://api.skolverket.se/susa-navet/susa-navet-emil3.yaml');if(!u.pathname.endsWith('/'))u.pathname+='/';return u.href}catch{return fallback}}
async function collection(susa,path,listFn){const size=2000,make=page=>{const u=new URL(path,susa);u.searchParams.set('schoolType','HS');u.searchParams.set('page',String(page));u.searchParams.set('size',String(size));return u};const first=await getJson(make(0),{attempts:3,requestTimeout:30000}),pages=Math.min(totalPages(first),80),out=[...listFn(first)];for(let p=1;p<pages;p+=6){const batch=await Promise.all(Array.from({length:Math.min(6,pages-p)},(_,i)=>getJson(make(p+i),{attempts:2,requestTimeout:30000}).catch(()=>null)));for(const d of batch)if(d)out.push(...listFn(d))}return out}
async function catalogueDirect(){const susa=await susaBase(),infos=(await collection(susa,'educationInfos',infoList)).filter(x=>isActive(x)&&isProgram(x));const ids=new Set(infos.map(x=>clean(x?.id||x?.content?.identifier)).filter(Boolean)),providersByEducation=new Map(),needed=new Set(infos.map(providerId).filter(Boolean));if(ids.size){const events=await collection(susa,'educationEvents',eventList);for(const e of events){if(!isActive(e))continue;const eid=clean(e?.content?.education),pid=clean(e?.content?.providers?.[0]);if(ids.has(eid)&&pid){providersByEducation.set(eid,pid);needed.add(pid)}}}const providers=await collection(susa,'educationProviders',providerList),byId=new Map();for(const p of providers){const id=clean(p?.id||p?.content?.identifier);if(id&&needed.has(id))byId.set(id,p)}const map=new Map();for(const info of infos){const id=clean(info?.id||info?.content?.identifier),pid=providerId(info)||providersByEducation.get(id),university=localized(byId.get(pid)?.content?.name),programName=localized(info?.content?.title);if(!university||!programName)continue;const row={subject:subjectLabel(info),university,programName,programCode:clean(info?.content?.code),source:'skolverket-susa-navet',structureCoverage:'metadata-only'},key=norm(`${row.programCode||row.programName}|${row.university}`);map.set(key,row)}return[...map.values()]}
function sourceCoverage(p){return clean(p.susaStructureCoverage||p.structureCoverage||'metadata-only')||'metadata-only'}
function plannerCoverage(result){if(result?.structureAvailable===true)return result?.programmeSequence?.exact===false?'partial':'complete';if(result?.found===true||Array.isArray(result?.courses)&&result.courses.length>0||result?.requiresConcentration||result?.requiresMasterProgramme)return'partial';return'metadata-only'}
function effectiveCoverage(source,planner){if(source==='complete'||planner==='complete')return'complete';if(source==='partial'||planner==='partial')return'partial';return'metadata-only'}
function summary(rows,key){const out={complete:0,partial:0,metadataOnly:0,total:rows.length};for(const row of rows){const v=row[key];if(v==='complete')out.complete++;else if(v==='partial')out.partial++;else out.metadataOnly++}return out}
async function probe(program){const u=new URL(`${base}/api/program-structure-resolved`);for(const [k,v] of [['university',program.university],['code',program.programCode],['name',program.programName],['subject',program.subject]])if(clean(v))u.searchParams.set(k,clean(v));const source=sourceCoverage(program);try{const result=await getJson(u,{attempts:1});const planner=plannerCoverage(result);return {...program,sourceCoverage:source,plannerStructureCoverage:planner,effectiveStructureCoverage:effectiveCoverage(source,planner),sequenceExact:result?.programmeSequence?.exact!==false,probeError:null}}catch(error){return {...program,sourceCoverage:source,plannerStructureCoverage:'metadata-only',effectiveStructureCoverage:source,sequenceExact:false,probeError:String(error?.message||error)}}}
async function mapLimit(items,worker,count){const out=new Array(items.length);let next=0;async function run(){while(true){const i=next++;if(i>=items.length)return;out[i]=await worker(items[i]);if(!jsonOnly&&((i+1)%25===0||i===items.length-1))process.stderr.write(`\rAudited ${i+1}/${items.length}`)}}await Promise.all(Array.from({length:Math.min(count,items.length)},run));if(!jsonOnly&&items.length)process.stderr.write('\n');return out}

let programs=[],catalogueSource='program-index';try{const index=await getJson(new URL(`${base}/api/program-index`),{attempts:1,requestTimeout:5000});programs=Array.isArray(index?.programs)?index.programs:[]}catch{}
if(!programs.length){catalogueSource='susa-direct';try{programs=await catalogueDirect()}catch(error){console.log(jsonOnly?JSON.stringify({auditedAt:new Date().toISOString(),base,catalogueSource,catalogueError:String(error?.message||error),auditedPrograms:0,remaining:[],programs:[]},null,2):`Coverage audit unavailable: ${error?.message||error}`);process.exit(0)}}
const catalogueTotal=programs.length;programs=programs.slice(offset,limit?offset+limit:undefined);if(!programs.length){console.log(jsonOnly?JSON.stringify({auditedAt:new Date().toISOString(),base,catalogueSource,catalogueTotal,auditedPrograms:0,remaining:[],programs:[]},null,2):'No programs in requested audit window');process.exit(0)}
const rows=await mapLimit(programs,probe,concurrency),errors=rows.filter(r=>r.probeError),remaining=rows.filter(r=>r.effectiveStructureCoverage!=='complete').map(r=>({university:r.university,programName:r.programName,programCode:r.programCode||'',subject:r.subject||'',sourceCoverage:r.sourceCoverage,plannerCoverage:r.plannerStructureCoverage,sequenceExact:r.sequenceExact,error:r.probeError||null}));remaining.sort((a,b)=>Number(Boolean(a.error))-Number(Boolean(b.error))||String(a.university).localeCompare(String(b.university),'sv')||String(a.programName).localeCompare(String(b.programName),'sv'));
const report={auditedAt:new Date().toISOString(),base,catalogueSource,catalogueTotal,offset,auditedPrograms:rows.length,source:summary(rows,'sourceCoverage'),planner:summary(rows,'plannerStructureCoverage'),effective:summary(rows,'effectiveStructureCoverage'),probeErrors:errors.length,remaining,programs:rows};
if(jsonOnly)console.log(JSON.stringify(report,null,2));else{console.log(`Catalogue: ${report.catalogueTotal} (${catalogueSource}) | audited: ${report.auditedPrograms} | offset: ${offset}`);console.log(`Planner complete ${report.planner.complete}, partial ${report.planner.partial}, metadata-only ${report.planner.metadataOnly}`);console.log(`Probe errors: ${report.probeErrors} | Remaining non-complete: ${report.remaining.length}`);for(const r of report.remaining.slice(0,25))console.log(`REST ${r.university} | ${r.programCode||'-'} | ${r.programName} | ${r.plannerCoverage}${r.error?` | ${r.error}`:''}`)}
