import fs from 'node:fs/promises';
import path from 'node:path';

const clean=v=>String(v??'').trim();
const norm=v=>clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const codeNorm=v=>clean(v).toUpperCase().replace(/[^A-Z0-9ÅÄÖ]/g,'');
const requested=value=>[...new Set((Array.isArray(value)?value:[value]).flatMap(v=>clean(v).split(/[;,]/)).map(codeNorm).filter(Boolean))].slice(0,20);
const providerMatches=(a,b)=>{if(!b)return true;a=norm(a);b=norm(b);return a===b||a.includes(b)||b.includes(a)};

let cache=null;
async function localRows(){
  if(cache)return cache;
  try{cache=JSON.parse(await fs.readFile(path.join(process.cwd(),'data/HT26/course-offerings.json'),'utf8'));}
  catch(_){cache=[];}
  return cache;
}
function mapLocal(r){
  const startDate=clean(r.startDate),endDate=clean(r.endDate),url=clean(r.sourceUrl||r.url);
  return {
    source:r.source||'studielots-verified-local',
    sourceId:r.key||'',
    offeringId:r.key||'',
    offeringKey:r.key||['studielots',codeNorm(r.courseCode),startDate].join('|'),
    type:'course',name:clean(r.courseName),code:clean(r.courseCode),university:clean(r.university),hp:Number(r.courseHp)||null,
    distance:r.distance===true,pace:Number(r.studyPacePercent)||null,startDate,endDate,
    applicationOpensAt:clean(r.applicationStart),applicationClosesAt:clean(r.applicationEnd),url,
    currentOffering:true,verified:true,standaloneSearchable:r.standaloneSearchable===true,
    applicationEvidence:r.applicationCode?'official-application-code':'none',applicationCode:clean(r.applicationCode),applicationStatus:clean(r.applicationStatus),
    localVerified:true
  };
}
async function susaFallback(req){
  try{
    const proto=clean(req.headers['x-forwarded-proto'])||'https',host=clean(req.headers['x-forwarded-host']||req.headers.host);
    if(!host)return [];
    const u=new URL(`${proto}://${host}/api/susa-offerings`);
    for(const [k,v] of Object.entries(req.query||{}))if(v!=null)u.searchParams.set(k,Array.isArray(v)?v.join(','):String(v));
    const r=await fetch(u,{headers:{accept:'application/json'},signal:AbortSignal.timeout(7000)});if(!r.ok)return [];
    return (await r.json())?.offerings||[];
  }catch(_){return []}
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=86400');
  const codes=requested([req.query?.code,req.query?.codes]),wanted=new Set(codes),university=clean(req.query?.university),standaloneOnly=String(req.query?.standaloneOnly||'').toLowerCase()==='true'||String(req.query?.standaloneOnly)==='1';
  if(!codes.length)return res.status(400).json({error:'code or codes is required'});
  const rows=(await localRows()).filter(r=>wanted.has(codeNorm(r.courseCode))&&providerMatches(r.university,university)).map(mapLocal).filter(o=>o.startDate&&o.endDate&&o.url&&o.verified===true&&(!standaloneOnly||o.standaloneSearchable===true)&&o.applicationStatus!=='cancelled');
  const fallback=await susaFallback(req),seen=new Set(),offerings=[];
  for(const o of [...rows,...fallback]){const k=clean(o.offeringKey||o.offeringId)||`${codeNorm(o.code)}|${clean(o.startDate)}|${norm(o.university)}`;if(seen.has(k))continue;seen.add(k);offerings.push(o)}
  offerings.sort((a,b)=>codeNorm(a.code).localeCompare(codeNorm(b.code))||String(a.startDate).localeCompare(String(b.startDate)));
  return res.status(200).json({offerings,queryCodes:codes,standaloneOnly,source:'studielots-local+skolverket-susa-navet',localCount:rows.length,updated:new Date().toISOString()});
}
