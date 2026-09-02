const SUSA_SCHEMA_URL='https://api.skolverket.se/susa-navet/susa-navet-emil3.yaml';
const SUSA_FALLBACK_BASE='https://api.skolverket.se/susa-navet/emil3/';
const DISTANCE_RE=/(distans|distance|remote|online|webb)/i;

function localized(value){
  const strings=value?.strings||value?.urls||[];
  const swe=strings.find(x=>String(x?.lang||'').toLowerCase()==='swe');
  return String((swe||strings[0])?.value||'').trim();
}
function list(data,keys){
  if(Array.isArray(data))return data;
  for(const key of keys)if(Array.isArray(data?.[key]))return data[key];
  return [];
}
function clean(v){return String(v??'').trim()}
function norm(v){return clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function codeNorm(v){return clean(v).toUpperCase().replace(/[^A-Z0-9ÅÄÖ]/g,'')}
function isActive(resource){
  if(!resource||String(resource.status||'ACTIVE').toUpperCase()!=='ACTIVE')return false;
  const expires=resource?.content?.expires;
  return !expires||!Number.isFinite(Date.parse(expires))||Date.parse(expires)>=Date.now()-86400000;
}
async function schemaBase(){
  try{
    const r=await fetch(SUSA_SCHEMA_URL,{headers:{accept:'text/yaml,text/plain'},signal:AbortSignal.timeout(5000)});
    if(!r.ok)return SUSA_FALLBACK_BASE;
    const yaml=await r.text();
    const server=yaml.match(/^\s*-\s*url:\s*["']?([^\s"']+)/m)?.[1];
    if(!server)return SUSA_FALLBACK_BASE;
    const base=new URL(server,SUSA_SCHEMA_URL);
    if(!base.pathname.endsWith('/'))base.pathname+='/';
    return base.href;
  }catch(_){return SUSA_FALLBACK_BASE}
}
async function getJson(url,timeout=10000){
  const r=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(timeout)});
  if(!r.ok)throw new Error(`Susa-navet ${r.status}`);
  return r.json();
}
function totalPages(data){
  const n=Number(data?.totalPages??data?.page?.totalPages??data?.pagination?.totalPages);
  return Number.isFinite(n)&&n>0?Math.ceil(n):1;
}
async function mapLimit(items,limit,worker){
  const results=new Array(items.length);let next=0;
  async function run(){while(true){const i=next++;if(i>=items.length)return;try{results[i]=await worker(items[i],i)}catch(_){results[i]=null}}}
  await Promise.all(Array.from({length:Math.min(limit,items.length)},run));
  return results;
}
function hpFromInfo(info){
  const credits=Number(info?.content?.credits?.credits);
  const system=String(info?.content?.credits?.system?.code||'').toLocaleLowerCase('sv-SE');
  if(Number.isFinite(credits)&&credits>0&&(!system||/(hp|ects|credit|poäng|point)/i.test(system)))return credits;
  return null;
}
function offeringType(info){
  const code=norm(info?.content?.configuration?.code);
  if(code==='kurs'||code==='course')return 'course';
  if(code==='program'||code==='programme'||code==='programmeutbildning')return 'program';
  return 'other';
}
function providerMap(rows){
  const out=new Map();
  for(const p of rows){
    const id=clean(p?.id||p?.content?.identifier);
    if(id)out.set(id,p);
  }
  return out;
}
function codeAppearsInEducationRef(ref,code){
  const wanted=codeNorm(code);
  if(!wanted)return false;
  const compact=codeNorm(ref);
  return compact.includes(wanted);
}
function providerMatches(provider,university){
  if(!university)return true;
  const name=localized(provider?.content?.name);
  const a=norm(name),b=norm(university);
  return a===b||a.includes(b)||b.includes(a);
}
function distanceState(event){
  const distance=event?.content?.distance;
  if(!distance)return false;
  const text=localized(distance?.description);
  return Boolean(distance)||DISTANCE_RE.test(text);
}
function offeringFrom(event,info,provider){
  const ec=event?.content||{},ic=info?.content||{};
  const type=offeringType(info);
  const educationId=clean(ec.education);
  const providerId=clean(ec.providers?.[0]);
  const offeringId=clean(event?.id||ec.identifier);
  const code=clean(ic.code);
  const university=localized(provider?.content?.name);
  const name=localized(ic.title);
  const startDate=clean(ec.startDate||ec.start||ec.from);
  const applicationUrl=localized(ec?.application?.url)||localized(ic.url);
  return {
    source:'skolverket-susa-navet',
    sourceId:educationId,
    offeringId,
    definitionKey:[norm(university),codeNorm(code),type].join('|'),
    offeringKey:['susa',offeringId||educationId,startDate].join('|'),
    type,
    name,
    code,
    university,
    hp:hpFromInfo(info),
    distance:distanceState(event),
    pace:Number(ec?.paceOfStudy?.percentage)||null,
    startDate,
    applicationOpensAt:clean(ec?.application?.startDate||ec?.application?.opens),
    applicationClosesAt:clean(ec?.application?.endDate||ec?.application?.lastApplicationDate),
    url:applicationUrl,
    currentOffering:true,
    verified:true,
    providerId,
    educationId
  };
}

async function fetchAllEventPages(base){
  const size=2000;
  const firstUrl=new URL('educationEvents',base);
  firstUrl.searchParams.set('schoolType','HS');
  firstUrl.searchParams.set('page','0');
  firstUrl.searchParams.set('size',String(size));
  const first=await getJson(firstUrl,12000);
  const pages=Math.min(totalPages(first),80);
  if(pages<=1)return list(first,['educationEvents','events','items','content','results','data']);
  const rest=await mapLimit(Array.from({length:pages-1},(_,i)=>i+1),5,async page=>{
    const u=new URL('educationEvents',base);u.searchParams.set('schoolType','HS');u.searchParams.set('page',String(page));u.searchParams.set('size',String(size));
    return getJson(u,12000);
  });
  return [first,...rest.filter(Boolean)].flatMap(x=>list(x,['educationEvents','events','items','content','results','data']));
}
async function fetchProviders(base){
  const u=new URL('educationProviders',base);u.searchParams.set('schoolType','HS');u.searchParams.set('page','0');u.searchParams.set('size','2000');
  const data=await getJson(u,10000);
  return providerMap(list(data,['educationProviders','providers','items','content','results','data']));
}
async function fetchOfferings({code,university,type}){
  const base=await schemaBase();
  const [events,providers]=await Promise.all([fetchAllEventPages(base),fetchProviders(base)]);
  const candidates=[];
  const seen=new Set();
  for(const event of events){
    if(!isActive(event))continue;
    const educationId=clean(event?.content?.education),providerId=clean(event?.content?.providers?.[0]);
    if(!educationId||!providerId||!codeAppearsInEducationRef(educationId,code))continue;
    const provider=providers.get(providerId);
    if(!provider||!providerMatches(provider,university))continue;
    const id=clean(event?.id||event?.content?.identifier)||[educationId,clean(event?.content?.start)].join('|');
    if(seen.has(id))continue;seen.add(id);
    candidates.push({event,provider,educationId});
  }
  const infos=new Map();
  const joined=await mapLimit(candidates,12,async row=>{
    if(!infos.has(row.educationId))infos.set(row.educationId,getJson(new URL(`educationInfos/${encodeURIComponent(row.educationId)}`,base),9000).catch(()=>null));
    const info=await infos.get(row.educationId);if(!info||!isActive(info))return null;
    const item=offeringFrom(row.event,info,row.provider);
    if(type&&item.type!==type)return null;
    if(codeNorm(item.code)!==codeNorm(code))return null;
    return item;
  });
  const out=[],seenOffering=new Set();
  for(const item of joined.filter(Boolean)){
    if(seenOffering.has(item.offeringKey))continue;seenOffering.add(item.offeringKey);out.push(item);
  }
  return out.sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate)));
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=86400');
  const code=clean(req.query?.code),university=clean(req.query?.university),type=norm(req.query?.type);
  if(!code)return res.status(400).json({error:'code is required'});
  if(type&&!['course','program'].includes(type))return res.status(400).json({error:'type must be course or program'});
  try{
    const offerings=await fetchOfferings({code,university,type});
    return res.status(200).json({
      offerings,
      identityPolicy:{definition:'university + code + type',offering:'Susa event id + start date',merge:'enrich-only; never replace local degree/program rules'},
      source:'skolverket-susa-navet',
      updated:new Date().toISOString()
    });
  }catch(error){
    console.error('susa-offerings',error);
    return res.status(200).json({offerings:[],source:'skolverket-susa-navet',temporarilyUnavailable:true,updated:new Date().toISOString()});
  }
}
