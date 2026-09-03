const SUSA_SCHEMA_URL='https://api.skolverket.se/susa-navet/susa-navet-emil3.yaml';
const SUSA_FALLBACK_BASE='https://api.skolverket.se/susa-navet/emil3/';
const CHALMERS_PROGRAM_BASE='https://www.chalmers.se/utbildning/dina-studier/hitta-kurs-och-programplaner/programplaner/';

const clean=v=>String(v??'').trim();
const norm=v=>clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const codeNorm=v=>clean(v).toUpperCase().replace(/[^A-Z0-9ÅÄÖ]/g,'');
const localized=value=>{const rows=value?.strings||value?.urls||[];const swe=rows.find(x=>String(x?.lang||'').toLowerCase()==='swe');return clean((swe||rows[0])?.value)};
const list=(data,keys)=>{if(Array.isArray(data))return data;for(const key of keys)if(Array.isArray(data?.[key]))return data[key];return[]};
const infoList=data=>list(data,['educationInfos','educationInfo','items','content','results','data']);
const providerList=data=>list(data,['educationProviders','providers','items','content','results','data']);
const isActive=r=>{if(!r||String(r.status||'ACTIVE').toUpperCase()!=='ACTIVE')return false;const expires=r?.content?.expires;return !expires||!Number.isFinite(Date.parse(expires))||Date.parse(expires)>=Date.now()-86400000};

async function getText(url,timeout=15000){
  const r=await fetch(url,{headers:{accept:'text/html,application/xhtml+xml'},signal:AbortSignal.timeout(timeout)});
  if(!r.ok)throw new Error(`HTTP ${r.status}`);
  return r.text();
}

function academicYear(){
  const d=new Date(),y=d.getUTCFullYear(),m=d.getUTCMonth()+1;
  const start=m>=7?y:y-1;
  return `${start}/${start+1}`;
}
function decodeHtml(s){
  return String(s??'')
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&aring;/gi,'å').replace(/&Aring;/g,'Å')
    .replace(/&auml;/gi,'ä').replace(/&Auml;/g,'Ä')
    .replace(/&ouml;/gi,'ö').replace(/&Ouml;/g,'Ö')
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));
}
function htmlText(s){
  return clean(decodeHtml(String(s??'')
    .replace(/<script\b[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi,' ')
    .replace(/<br\s*\/?\s*>/gi,' ')
    .replace(/<[^>]+>/g,' ')));
}
function headingText(fragment){return htmlText(fragment)}
function isChalmersUniversity(university){return /chalmers/.test(norm(university))}
function chalmersUrl(code,year,studyYear){
  const u=new URL(`${CHALMERS_PROGRAM_BASE}${encodeURIComponent(codeNorm(code))}/`);
  u.searchParams.set('acYear',year);
  u.searchParams.set('year',String(studyYear));
  return u.href;
}
function parseChalmersMeta(html){
  const plain=htmlText(html);
  const title=headingText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');
  const code=clean(plain.match(/Programkod\s+([A-ZÅÄÖ0-9-]{3,12})/i)?.[1]);
  const totalHp=Number(String(plain.match(/Omfattning\s+(\d+(?:[.,]\d+)?)\s+Högskolepoäng/i)?.[1]||'').replace(',','.'))||0;
  const acYear=clean(plain.match(/Läsår\s+(20\d{2}\s*\/\s*20\d{2})/i)?.[1]).replace(/\s+/g,'');
  const selectedYear=Number([...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m=>headingText(m[1])).map(t=>t.match(/^Årskurs\s+(\d+)$/i)?.[1]).find(Boolean))||0;
  return{title,code,totalHp,acYear,selectedYear};
}
function parseChalmersCourses(html,studyYear){
  const tokens=String(html??'').match(/<h[2-4]\b[^>]*>[\s\S]*?<\/h[2-4]>|<tr\b[^>]*>[\s\S]*?<\/tr>/gi)||[];
  let season='',category='',period='';
  const map=new Map();
  for(const token of tokens){
    if(/^<h[2-4]\b/i.test(token)){
      const t=headingText(token);
      if(/^HÖSTTERMIN$/i.test(t))season='fall';
      else if(/^VÅRTERMIN$/i.test(t))season='spring';
      else if(/^SOMMARTERMIN$/i.test(t))season='summer';
      else if(/^Läsperiod\s+\d+/i.test(t)||/^Sommar$/i.test(t))period=t;
      else if(/^(Obligatoriska|Valbara|Frivilliga)\s+kurser$/i.test(t))category=norm(t).split(' ')[0];
      continue;
    }
    if(!season||season==='summer'||!category)continue;
    const cells=[...token.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>htmlText(m[1]));
    if(cells.length<2)continue;
    const first=clean(cells[0]);
    const match=first.match(/^([A-ZÅÄÖ]{2,5}\d{3}[A-Z]?)\s+(.+)$/i);
    if(!match)continue;
    const hpMatch=cells[1].match(/(\d+(?:[.,]\d+)?)\s*hp/i);
    if(!hpMatch)continue;
    const hp=Number(hpMatch[1].replace(',','.'));
    if(!(hp>0&&hp<=30))continue;
    const code=codeNorm(match[1]),name=clean(match[2]);
    const term=(studyYear-1)*2+(season==='fall'?1:2);
    const key=[term,code,category].join('|');
    const row=map.get(key)||{name,code,hp:0,term,category,periods:new Set()};
    row.hp+=hp;
    if(period)row.periods.add(period);
    map.set(key,row);
  }
  return[...map.values()].map(r=>({...r,hp:Math.round(r.hp*10)/10,periods:[...r.periods]}));
}
function chalmersCompleteness(rows,totalHp){
  const expectedTerms=totalHp>0?Math.round(totalHp/30):0;
  const mandatory=rows.filter(r=>r.category==='obligatoriska');
  const sums=new Map();
  mandatory.forEach(r=>sums.set(r.term,(sums.get(r.term)||0)+r.hp));
  const completeTerms=[];
  for(let term=1;term<=expectedTerms;term++){
    const hp=Math.round((sums.get(term)||0)*10)/10;
    if(hp>=27&&hp<=33)completeTerms.push(term);
  }
  const mandatoryHp=Math.round(mandatory.reduce((s,r)=>s+r.hp,0)*10)/10;
  const complete=expectedTerms>=2&&completeTerms.length===expectedTerms&&mandatoryHp>=totalHp*0.9&&mandatoryHp<=totalHp*1.1;
  return{complete,expectedTerms,completeTerms,mandatoryHp,termHp:Object.fromEntries([...sums.entries()].map(([k,v])=>[k,Math.round(v*10)/10]))};
}
async function discoverChalmers({code,name,university}){
  if(!isChalmersUniversity(university))return null;
  const normalizedCode=codeNorm(code);
  if(!normalizedCode)return{found:false,structureAvailable:false,courses:[],source:'chalmers-programplan'};
  const acYear=academicYear();
  const firstUrl=chalmersUrl(normalizedCode,acYear,1);
  const firstHtml=await getText(firstUrl,15000);
  const firstMeta=parseChalmersMeta(firstHtml);
  if(firstMeta.code&&codeNorm(firstMeta.code)!==normalizedCode)return{found:false,structureAvailable:false,courses:[],source:'chalmers-programplan'};
  const totalHp=firstMeta.totalHp;
  const expectedYears=totalHp>0?Math.max(1,Math.min(5,Math.ceil(totalHp/60))):3;
  const pages=[{year:1,html:firstHtml,url:firstUrl,meta:firstMeta}];
  for(let year=2;year<=expectedYears;year++){
    const url=chalmersUrl(normalizedCode,acYear,year);
    try{
      const html=await getText(url,15000),meta=parseChalmersMeta(html);
      if(meta.selectedYear&&meta.selectedYear!==year)continue;
      if(meta.code&&codeNorm(meta.code)!==normalizedCode)continue;
      pages.push({year,html,url,meta});
    }catch(_){/* partial coverage is handled below */}
  }
  const allRows=pages.flatMap(p=>parseChalmersCourses(p.html,p.year));
  const quality=chalmersCompleteness(allRows,totalHp);
  const mandatory=allRows.filter(r=>r.category==='obligatoriska').sort((a,b)=>a.term-b.term||a.code.localeCompare(b.code,'sv'));
  const courses=mandatory.map((r,i)=>({
    name:r.name,code:r.code,hp:r.hp,term:r.term,
    originalTerm:r.term,__slOriginalTerm:r.term,__slOriginalIndex:i,
    status:'remaining',credited:false,isCredited:false,
    programmeSource:'chalmers-programplan',programmeCategory:'mandatory',periods:r.periods
  }));
  return{
    found:true,
    structureAvailable:quality.complete,
    courses,
    program:{name:firstMeta.title||name,code:firstMeta.code||normalizedCode,university:'Chalmers tekniska högskola'},
    sourceUrls:pages.map(p=>p.url),
    source:'chalmers-programplan',
    confidence:quality.complete?'official-machine-readable-sequenced':'official-partial',
    coverage:quality.complete?'complete-mandatory-sequence':'partial-or-elective-dependent',
    quality:{...quality,totalHp,pagesFound:pages.map(p=>p.year),academicYear:acYear},
    policy:'Chalmers structure is activated only when official program-plan pages cover every expected semester with a near-full mandatory course load. Module rows are aggregated by course and semester; elective and voluntary alternatives never inflate required credits.'
  };
}

async function schemaBase(){try{const r=await fetch(SUSA_SCHEMA_URL,{headers:{accept:'text/yaml,text/plain'},signal:AbortSignal.timeout(5000)});if(!r.ok)return SUSA_FALLBACK_BASE;const yaml=await r.text();const server=yaml.match(/^\s*-\s*url:\s*["']?([^\s"']+)/m)?.[1];if(!server)return SUSA_FALLBACK_BASE;const base=new URL(server,SUSA_SCHEMA_URL);if(!base.pathname.endsWith('/'))base.pathname+='/';return base.href}catch(_){return SUSA_FALLBACK_BASE}}
async function getJson(url,timeout=15000){const r=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(timeout)});if(!r.ok)throw new Error(`Susa-navet ${r.status}`);return r.json()}
function totalPages(data){const n=Number(data?.totalPages??data?.page?.totalPages??data?.pagination?.totalPages);return Number.isFinite(n)&&n>0?Math.ceil(n):1}
async function mapLimit(items,limit,worker){const results=new Array(items.length);let next=0;async function run(){while(true){const i=next++;if(i>=items.length)return;try{results[i]=await worker(items[i],i)}catch(_){results[i]=null}}}await Promise.all(Array.from({length:Math.min(limit,items.length)},run));return results}
async function fetchCollection(base,path,listFn){const size=2000;const firstUrl=new URL(path,base);firstUrl.searchParams.set('schoolType','HS');firstUrl.searchParams.set('page','0');firstUrl.searchParams.set('size',String(size));const first=await getJson(firstUrl);const pages=Math.min(totalPages(first),80);if(pages<=1)return listFn(first);const rest=await mapLimit(Array.from({length:pages-1},(_,i)=>i+1),8,async page=>{const u=new URL(path,base);u.searchParams.set('schoolType','HS');u.searchParams.set('page',String(page));u.searchParams.set('size',String(size));return getJson(u)});return[first,...rest.filter(Boolean)].flatMap(listFn)}
function providerMap(rows){const m=new Map();for(const p of rows){const id=clean(p?.id||p?.content?.identifier);if(id)m.set(id,p)}return m}
function scalarEntries(value,path='',out=[]){if(value==null)return out;if(Array.isArray(value))value.forEach((x,i)=>scalarEntries(x,`${path}[${i}]`,out));else if(typeof value==='object')Object.entries(value).forEach(([k,x])=>scalarEntries(x,path?`${path}.${k}`:k,out));else if(['string','number','boolean'].includes(typeof value))out.push({path,value});return out}
function providerIdFromInfo(info){const c=info?.content||{};const direct=clean(c.provider||c.providers?.[0]||c.organizer||c.educationProvider);if(direct)return direct;return clean(scalarEntries(c).find(x=>/(provider|organizer|educationProvider)(\[0\])?$/i.test(x.path))?.value)}
function isProgram(info){const code=norm(info?.content?.configuration?.code);return ['program','programme','programmeutbildning'].includes(code)}
function hpFromObject(o){const values=[o?.hp,o?.credits,o?.credit,o?.ects,o?.points,o?.creditPoints,o?.extent?.length,o?.credits?.credits];for(const v of values){const n=Number(String(v??'').replace(',','.'));if(Number.isFinite(n)&&n>0&&n<=60)return n}return 0}
function nameFromObject(o){return clean(o?.name||o?.courseName||o?.title?.strings?.[0]?.value||o?.title||o?.label||o?.educationName)}
function codeFromObject(o){return clean(o?.code||o?.courseCode||o?.applicationCode||o?.identifier)}
function termFromObject(o){const values=[o?.term,o?.semester,o?.termNo,o?.semesterNo,o?.studyPeriod,o?.period];for(const v of values){const n=Number(v);if(Number.isFinite(n)&&n>=1&&n<=20)return n}const year=Number(o?.year||o?.studyYear);if(Number.isFinite(year)&&year>=1&&year<=10)return (year-1)*2+1;return 0}
function collectObjects(value,path='',out=[]){if(value==null)return out;if(Array.isArray(value))value.forEach((x,i)=>collectObjects(x,`${path}[${i}]`,out));else if(typeof value==='object'){out.push({path,value});Object.entries(value).forEach(([k,x])=>collectObjects(x,path?`${path}.${k}`:k,out))}return out}
function extractCourseStructure(info){const candidates=[];for(const entry of collectObjects(info?.content||{})){const p=entry.path.toLocaleLowerCase('sv-SE'),o=entry.value;if(!/(course|kurs|module|modul|study.?plan|curriculum|programme.?structure|program.?structure)/i.test(p))continue;const hp=hpFromObject(o),name=nameFromObject(o),code=codeFromObject(o),term=termFromObject(o);if(!(hp>0)||(!name&&!code))continue;candidates.push({name:name||code,code,hp,term,sourcePath:entry.path})}
 const seen=new Set(),rows=[];for(const c of candidates){const k=[codeNorm(c.code),norm(c.name),c.term].join('|');if(seen.has(k))continue;seen.add(k);rows.push(c)}
 const withSequence=rows.filter(r=>r.term>0);const selected=withSequence.length>=2?rows.filter(r=>r.term>0):[];const total=selected.reduce((s,r)=>s+r.hp,0);if(selected.length<2||total<15)return[];return selected.sort((a,b)=>a.term-b.term||a.name.localeCompare(b.name,'sv')).map((r,i)=>({...r,__slOriginalTerm:r.term,__slOriginalIndex:i,status:'remaining',credited:false,isCredited:false,programmeSource:'susa-auto'}))}
function sourceUrls(info){const urls=scalarEntries(info?.content||{}).filter(x=>/(url|web|syllabus|curriculum|study.?plan|program.?plan|utbildningsplan)/i.test(x.path)&&/^https?:\/\//i.test(String(x.value))).map(x=>clean(x.value));return[...new Set(urls)].slice(0,8)}
function scoreInfo(info,{code,name}){if(!isProgram(info)||!isActive(info))return-Infinity;const ic=info?.content||{},c=codeNorm(ic.code),wanted=codeNorm(code),title=norm(localized(ic.title)),wantedName=norm(name);let score=0;if(wanted&&c===wanted)score+=200;else if(wanted&&c.includes(wanted))score+=80;if(wantedName&&title===wantedName)score+=100;else if(wantedName&&title.includes(wantedName))score+=60;return score}
async function discover({code,name,university}){const base=await schemaBase();const [infos,providersRows]=await Promise.all([fetchCollection(base,'educationInfos',infoList),fetchCollection(base,'educationProviders',providerList)]);const providers=providerMap(providersRows);const matches=infos.map(info=>({info,score:scoreInfo(info,{code,name})})).filter(x=>x.score>0).map(x=>{const pid=providerIdFromInfo(x.info),provider=providers.get(pid),providerName=localized(provider?.content?.name);let score=x.score;if(university){const a=norm(providerName),b=norm(university);if(a===b)score+=100;else if(a.includes(b)||b.includes(a))score+=50;else score-=80}return{...x,providerName,score}}).sort((a,b)=>b.score-a.score);const best=matches[0];if(!best)return{found:false,structureAvailable:false,courses:[]};const courses=extractCourseStructure(best.info),ic=best.info?.content||{};return{found:true,structureAvailable:courses.length>=2,courses,program:{name:localized(ic.title)||name,code:clean(ic.code)||code,university:best.providerName||university,sourceId:clean(best.info?.id||ic.identifier)},sourceUrls:sourceUrls(best.info),source:'skolverket-susa-navet',confidence:courses.length>=2?'machine-readable-sequenced':'metadata-only'}}

export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=21600, stale-while-revalidate=86400');
  const code=clean(req.query?.code),name=clean(req.query?.name),university=clean(req.query?.university);
  if(!code&&!name)return res.status(400).json({error:'code or name is required'});
  try{
    const chalmers=await discoverChalmers({code,name,university});
    if(chalmers)return res.status(200).json({...chalmers,checkedAt:new Date().toISOString()});
    const result=await discover({code,name,university});
    return res.status(200).json({...result,checkedAt:new Date().toISOString(),policy:'Automatic discovery only. A study plan is activated only when Susa exposes at least two sequenced course records; otherwise StudieLots keeps the program marked as unpublished.'});
  }catch(error){
    console.error('program-structure',error);
    return res.status(200).json({found:false,structureAvailable:false,courses:[],temporarilyUnavailable:true,source:isChalmersUniversity(university)?'chalmers-programplan':'skolverket-susa-navet',checkedAt:new Date().toISOString()});
  }
}
