#!/usr/bin/env node
// Canonical offering refresh
// Add only dated, verified SUSA offerings to the authoritative StudieLots DB.
import fs from 'node:fs';
const API='https://api.skolverket.se/susa-navet/emil3/';
const dbPath='data/studielots-db/manifest.json',db=JSON.parse(fs.readFileSync(dbPath));
if(db.database!=='StudieLots DB'||db.tables?.courseOfferings?.storage!=='data/HT26/course-offerings.json')throw Error('Unexpected offerings storage');
const storage=db.tables.courseOfferings.storage,existing=JSON.parse(fs.readFileSync(storage));
if(!Array.isArray(existing)||!existing.length||db.tables.courseOfferings.rows!==existing.length)throw Error('Existing DB offerings count mismatch');
const clean=x=>String(x??'').trim();
const loc=x=>{const a=x?.strings||x?.urls||[];return clean((a.find(v=>v.lang==='swe')||a[0])?.value)};
const list=(d,keys)=>{if(Array.isArray(d))return d;for(const k of keys)if(Array.isArray(d?.[k]))return d[k];return[]};
const id=x=>clean(x?.id||x?.content?.identifier);
async function get(url){const r=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`${url} ${r.status}`);return r.json()}
async function pages(path,keys,max){const url=p=>{const u=new URL(path,API);u.searchParams.set('schoolType','HS');u.searchParams.set('page',p);u.searchParams.set('size','2000');return u};const first=await get(url(0));const n=Math.min(Number(first?.totalPages??first?.page?.totalPages)||1,max);const out=[...list(first,keys)];for(let p=1;p<n;p+=6){const batch=await Promise.all(Array.from({length:Math.min(6,n-p)},(_,i)=>get(url(p+i))));for(const d of batch)out.push(...list(d,keys))}return out}
const [events,providers]=await Promise.all([pages('educationEvents',['educationEvents','events','items','content','results','data'],80),pages('educationProviders',['educationProviders','providers','items','content','results','data'],20)]);
const providerMap=new Map(providers.map(p=>[id(p),p])),candidates=[];
for(const event of events){
  const c=event.content||{},start=clean(c.start||c.startDate),ts=Date.parse(start);
  if(!Number.isFinite(ts)||ts<Date.now()-86400000)continue;
  const educationId=clean(c.education||c.educationInfo||c.educationIdentifier),provider=providerMap.get(clean(c.providers?.[0]||c.provider));
  if(educationId&&provider)candidates.push({event,provider,educationId,start});
}
const byKey=new Map(existing.map(x=>[x.key,x])),cache=new Map();
const infoFor=key=>{if(!cache.has(key))cache.set(key,get(new URL('educationInfos/'+encodeURIComponent(key),API)).catch(()=>null));return cache.get(key)};
let added=0,missingInfo=0;
for(let i=0;i<candidates.length;i+=16){
  const batch=await Promise.all(candidates.slice(i,i+16).map(async candidate=>({candidate,info:await infoFor(candidate.educationId)})));
  for(const {candidate,info} of batch){
    if(!info){missingInfo++;continue}
    const c=info.content||{},e=candidate.event.content||{};
    if(!/^(kurs|course)$/i.test(clean(c.configuration?.code)))continue;
    const code=clean(c.code),name=loc(c.title),university=loc(candidate.provider.content?.name),hp=Number(c.credits?.credits),url=loc(e.application?.url)||loc(c.url);
    if(!code||!name||!university||!(hp>0)||!/^https?:\/\//.test(url))continue;
    const date=new Date(candidate.start),term=`${date.getUTCMonth()<6?'VT':'HT'}${String(date.getUTCFullYear()).slice(-2)}`;
    const slug=university.toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-');
    const key=[slug,code.toUpperCase(),term,id(candidate.event)].join('|');
    if(byKey.has(key))continue;
    byKey.set(key,{key,university,courseCode:code,courseName:name,courseHp:hp,offeringTerm:term,startDate:candidate.start,distance:Boolean(e.distance),standaloneSearchable:true,source:'skolverket-susa-navet',sourceUrl:url,checkedAt:new Date().toISOString()});
    added++;
  }
}
const offerings=[...byKey.values()];
if(added){fs.writeFileSync(storage,JSON.stringify(offerings,null,2)+'\n');db.tables.courseOfferings.rows=offerings.length;fs.writeFileSync(dbPath,JSON.stringify(db,null,2)+'\n')}
fs.mkdirSync('data/offerings',{recursive:true});
const report={updated:new Date().toISOString(),source:'skolverket-susa-navet',eventsScanned:events.length,datedCandidates:candidates.length,missingInfo,existing:existing.length,added,count:offerings.length,gu:offerings.filter(x=>x.university==='Göteborgs universitet').length};
fs.writeFileSync('data/offerings/meta.json',JSON.stringify(report,null,2)+'\n');
console.log(report);
