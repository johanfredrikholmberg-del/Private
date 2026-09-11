#!/usr/bin/env node
/** StudieLots offline SUSA bulk importer. Materialises Swedish higher-ed programmes,
 * courses, providers and a queue for official university structure enrichment. */
import fs from 'node:fs/promises';
import path from 'node:path';

const SCHEMA_URL='https://api.skolverket.se/susa-navet/susa-navet-emil3.yaml';
const FALLBACK_BASE='https://api.skolverket.se/susa-navet/emil3/';
const OUT=process.env.SUSA_OUT||'data/susa';
const UPDATED_SINCE=process.env.SUSA_UPDATED_SINCE||'';
const SCHOOL_TYPE='HS';
const SIZE=Number(process.env.SUSA_PAGE_SIZE||2000);
const MAX_PAGES=Number(process.env.SUSA_MAX_PAGES||120);
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const arr=v=>Array.isArray(v)?v:(v==null?[]:[v]);
const first=(...xs)=>xs.map(clean).find(Boolean)||'';
const slug=v=>norm(v).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const localized=value=>{const rows=value?.strings||value?.urls||[];const swe=rows.find(x=>String(x?.lang||'').toLowerCase()==='swe');return clean((swe||rows[0])?.value)||clean(value)};
const list=(d,keys)=>{if(Array.isArray(d))return d;for(const k of keys)if(Array.isArray(d?.[k]))return d[k];return[]};
const infoList=d=>list(d,['educationInfos','educationInfo','items','content','results','data']);
const eventList=d=>list(d,['educationEvents','events','items','content','results','data']);
const providerList=d=>list(d,['educationProviders','providers','items','content','results','data']);
const idOf=x=>first(x?.id,x?.content?.identifier,x?.identifier);
const isActive=x=>{if(!x||String(x.status||'ACTIVE').toUpperCase()!=='ACTIVE')return false;const expires=x?.content?.expires;return !expires||!Number.isFinite(Date.parse(expires))||Date.parse(expires)>=Date.now()-86400000};
const configCode=x=>norm(x?.content?.configuration?.code);
const kindOf=x=>{const c=configCode(x);if(['program','programme','programmeutbildning'].includes(c)||/program/.test(c))return'programme';if(['course','kurs','kursutbildning'].includes(c)||/course|kurs/.test(c))return'course';return'other'};
const providerId=x=>first(x?.content?.provider,x?.content?.providers?.[0],x?.content?.organizer,x?.content?.educationProvider);
const hpOf=x=>{const c=Number(x?.content?.credits?.credits);if(Number.isFinite(c)&&c>0)return c;const e=x?.content?.extent||{},n=Number(e.length),u=norm(e?.unit?.code);if(!Number.isFinite(n)||n<=0)return null;if(/hp|credit|ects|poang|point/.test(u))return n;if(/semester/.test(u))return n*30;return null};
const urlsOf=x=>{const out=[];const walk=v=>{if(v==null)return;if(typeof v==='string'&&/^https?:\/\//i.test(v))out.push(v);else if(Array.isArray(v))v.forEach(walk);else if(typeof v==='object')Object.entries(v).forEach(([k,z])=>{if(/url|uri|link|web/i.test(k))walk(z)})};walk(x?.content);return[...new Set(out)]};
const subjectOf=x=>{const s=arr(x?.content?.subjects),uh=s.find(v=>v?.type==='UH_Subject');return localized(uh?.name)||clean(uh?.name)||localized(x?.content?.subject)||''};

async function getJson(url,timeout=20000){const r=await fetch(url,{headers:{accept:'application/json','user-agent':'StudieLots-SUSA-import/2.0'},signal:AbortSignal.timeout(timeout)});if(!r.ok)throw new Error(`SUSA ${r.status} ${r.statusText}: ${url}`);return r.json()}
async function schemaBase(){try{const r=await fetch(SCHEMA_URL,{headers:{accept:'text/yaml,text/plain'},signal:AbortSignal.timeout(5000)});if(!r.ok)return FALLBACK_BASE;const y=await r.text(),server=y.match(/^\s*-\s*url:\s*["']?([^\s"']+)/m)?.[1];if(!server)return FALLBACK_BASE;const u=new URL(server,SCHEMA_URL);if(!u.pathname.endsWith('/'))u.pathname+='/';return u.href}catch{return FALLBACK_BASE}}
const totalPages=d=>{const n=Number(d?.totalPages??d?.page?.totalPages??d?.pagination?.totalPages);return Number.isFinite(n)&&n>0?Math.ceil(n):1};
async function collection(base,resource,listFn,{updatedSince='',maxPages=MAX_PAGES}={}){const make=p=>{const u=new URL(resource,base);u.searchParams.set('schoolType',SCHOOL_TYPE);u.searchParams.set('page',String(p));u.searchParams.set('size',String(SIZE));if(updatedSince)u.searchParams.set('updatedSince',updatedSince);return u};const firstPage=await getJson(make(0));const pages=Math.min(totalPages(firstPage),maxPages);const out=[...listFn(firstPage)];for(let p=1;p<pages;p+=6){const n=Math.min(6,pages-p);const batch=await Promise.all(Array.from({length:n},(_,i)=>getJson(make(p+i))));for(const d of batch)out.push(...listFn(d))}return out}

function normalizeProvider(p){return{id:idOf(p),name:localized(p?.content?.name),code:first(p?.content?.code),urls:urlsOf(p)}}
function normalizeEvent(e){const c=e?.content||{};return{id:idOf(e),educationId:first(c.education,c.educationInfo,c.educationIdentifier),providerId:first(c.providers?.[0],c.provider),start:first(c.start,c.startDate,c.startSemester),end:first(c.end,c.endDate),distance:Boolean(c.distance??c.isDistance),location:first(c.location?.name,c.location,c.place?.name),urls:urlsOf(e),lastEdited:first(e?.lastEdited,c.lastEdited)}}
function normalizeInfo(i,provider,eventRows){const c=i?.content||{};return{susaId:idOf(i),kind:kindOf(i),name:localized(c.title),code:first(c.code),hp:hpOf(i),level:first(c.educationLevel?.code,c.level?.code,c.educationLevel,c.level),subject:subjectOf(i),university:provider?.name||'',providerId:provider?.id||'',urls:[...new Set([...urlsOf(i),...eventRows.flatMap(e=>e.urls||[])])],events:eventRows,lastEdited:first(i?.lastEdited,c.lastEdited),expires:first(c.expires),source:'skolverket-susa-navet'}}
function identity(x){return`${norm(x.university)}|${norm(x.code||x.name)}|${x.hp||0}|${x.kind}`}
function newer(a,b){const ad=Date.parse(a.lastEdited||'')||0,bd=Date.parse(b.lastEdited||'')||0;return bd>=ad?b:a}
function dedupe(xs){const m=new Map();for(const x of xs){const k=identity(x),old=m.get(k);m.set(k,old?newer(old,x):x)}return[...m.values()]}

async function main(){
  await fs.mkdir(OUT,{recursive:true});
  const base=await schemaBase();
  const infoRaw=await collection(base,'educationInfos',infoList,{updatedSince:UPDATED_SINCE});
  const activeInfos=infoRaw.filter(isActive).filter(x=>kindOf(x)!=='other');
  const infoIds=new Set(activeInfos.map(idOf).filter(Boolean));
  const eventRaw=await collection(base,'educationEvents',eventList,{updatedSince:UPDATED_SINCE});
  const events=eventRaw.filter(isActive).map(normalizeEvent).filter(e=>e.id&&infoIds.has(e.educationId));
  const eventsByInfo=new Map();for(const e of events){const a=eventsByInfo.get(e.educationId)||[];a.push(e);eventsByInfo.set(e.educationId,a)}
  const providerRaw=await collection(base,'educationProviders',providerList,{maxPages:40});
  const providers=providerRaw.filter(isActive).map(normalizeProvider).filter(p=>p.id);
  const pmap=new Map(providers.map(p=>[p.id,p]));
  const records=[];
  for(const i of activeInfos){const id=idOf(i),ev=eventsByInfo.get(id)||[],pid=providerId(i)||ev.find(e=>e.providerId)?.providerId||'',p=pmap.get(pid);const row=normalizeInfo(i,p,ev);if(row.name&&row.university)records.push(row)}
  const catalogue=dedupe(records);
  const programmes=catalogue.filter(x=>x.kind==='programme');
  const courses=catalogue.filter(x=>x.kind==='course');
  const structureQueue=programmes.map(p=>({key:`${slug(p.university)}:${p.code||p.susaId}`,susaId:p.susaId,university:p.university,programCode:p.code,programName:p.name,hp:p.hp,subject:p.subject,officialUrls:p.urls,status:'pending-official-structure',attempts:0}));
  const meta={generatedAt:new Date().toISOString(),apiBase:base,schoolType:SCHOOL_TYPE,updatedSince:UPDATED_SINCE||null,counts:{educationInfos:activeInfos.length,events:events.length,providers:providers.length,programmes:programmes.length,courses:courses.length,structureQueue:structureQueue.length}};
  const write=(name,data)=>fs.writeFile(path.join(OUT,name),JSON.stringify(data,null,2)+'\n');
  await Promise.all([write('meta.json',meta),write('providers.json',providers),write('programmes.json',programmes),write('courses.json',courses),write('structure-queue.json',structureQueue)]);
  console.log(JSON.stringify(meta,null,2));
  if(!programmes.length||!courses.length)throw new Error(`Empty catalogue: ${programmes.length} programmes, ${courses.length} courses`);
}
main().catch(e=>{console.error(e);process.exitCode=1});
