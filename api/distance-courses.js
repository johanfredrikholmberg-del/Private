const DEFAULT_SUSA_URL='https://api.skolverket.se/susa-navet/educationEvents';
const DISTANCE_RE=/(^|[\s_/-])(distans|distance|remote|online|webb)([\s_/-]|$)/i;
const CAMPUS_RE=/(^|[\s_/-])(campus|on[- ]?site|på plats|ortsoberoende med träff)([\s_/-]|$)/i;

function scalarEntries(value,path='',out=[]){
  if(value==null)return out;
  if(Array.isArray(value))value.forEach((item,index)=>scalarEntries(item,`${path}[${index}]`,out));
  else if(typeof value==='object')Object.entries(value).forEach(([key,item])=>scalarEntries(item,path?`${path}.${key}`:key,out));
  else if(['string','number','boolean'].includes(typeof value))out.push({path,value});
  return out;
}
function firstValue(entries,keyRe,valueRe=null){
  return entries.find(x=>keyRe.test(x.path)&&(!valueRe||valueRe.test(String(x.value))))?.value;
}
function textValue(entries,keyRe){const value=firstValue(entries,keyRe);return value==null?'':String(value).trim()}
function numberValue(entries,keyRe){
  const match=String(firstValue(entries,keyRe)??'').replace(',','.').match(/\d+(?:\.\d+)?/);
  return match?Number(match[0]):0;
}
function explicitDistance(entries){
  const delivery=entries.filter(x=>/(attendance|delivery|study.?form|teaching.?form|location.?type|distance|remote|online)/i.test(x.path));
  if(!delivery.some(x=>x.value===true&&/(distance|remote|online)/i.test(x.path)||DISTANCE_RE.test(String(x.value))))return false;
  return !delivery.some(x=>CAMPUS_RE.test(String(x.value))&&!DISTANCE_RE.test(String(x.value)));
}
function eventList(data){
  if(Array.isArray(data))return data;
  for(const key of ['educationEvents','events','items','content','results','data'])if(Array.isArray(data?.[key]))return data[key];
  return [];
}
function normalizeEvent(raw,subject){
  if(!raw||typeof raw!=='object')return null;
  const entries=scalarEntries(raw);
  if(!explicitDistance(entries))return null;
  const haystack=entries.map(x=>String(x.value)).join(' ');
  if(subject&&!haystack.toLocaleLowerCase('sv').includes(subject.toLocaleLowerCase('sv')))return null;
  const name=textValue(entries,/(^|\.)(educationName|courseName|title)(\.|$)/i)||textValue(entries,/^(name)$/i);
  const university=textValue(entries,/(provider|organizer|university|institution).*(name|title)$/i);
  const hp=numberValue(entries,/(credits?|creditPoints?|higherEducationCredits?|extent)(\.|$)/i);
  if(!name||!university||!(hp>0))return null;
  const expires=textValue(entries,/(^|\.)(expires|endDate|lastApplicationDate)(\.|$)/i);
  if(expires){const end=Date.parse(expires);if(Number.isFinite(end)&&end<Date.now()-86400000)return null}
  const applicationOpensAt=textValue(entries,/(application|admission).*(open|start).*date$/i);
  const applicationClosesAt=textValue(entries,/(application|admission).*(close|end|last).*date$/i);
  const startDate=textValue(entries,/(^|\.)(startDate|startsAt)(\.|$)/i);
  const applicationOpen=Boolean(applicationOpensAt&&applicationClosesAt&&Date.now()>=Date.parse(applicationOpensAt)&&Date.now()<=Date.parse(applicationClosesAt));
  const physicalMeetings=entries.some(x=>/(meeting|gathering|träff)/i.test(x.path)&&x.value===true);
  return {
    name,code:textValue(entries,/(^|\.)(courseCode|applicationCode|code)(\.|$)/i),university,subject,hp,
    pace:numberValue(entries,/(studyPace|pace|percentage)(\.|$)/i)||null,
    term:textValue(entries,/(^|\.)(semester|term)(\.|$)/i),period:numberValue(entries,/(^|\.)(period)(\.|$)/i)||null,
    startDate,applicationDeadline:applicationClosesAt,applicationOpensAt,applicationClosesAt,applicationOpen,
    distance:true,currentOffering:true,verified:true,noPhysicalMeetings:physicalMeetings?false:null,
    url:textValue(entries,/(^|\.)(url|webpage|informationUrl|applicationUrl)(\.|$)/i)
  };
}
function normalizeResponse(data,subject){
  const seen=new Set();
  return eventList(data).map(x=>normalizeEvent(x,subject)).filter(course=>{
    if(!course)return false;
    const key=[course.code,course.name,course.university,course.startDate].join('|').toLocaleLowerCase('sv');
    if(seen.has(key))return false;seen.add(key);return true;
  }).slice(0,60);
}
export {eventList,explicitDistance,normalizeEvent,normalizeResponse};

export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=86400');
  const subject=String(req.query?.subject||'').trim();
  const kind=String(req.query?.kind||'candidate').trim();
  const base=process.env.DISTANCE_COURSE_FEED_URL||DEFAULT_SUSA_URL;
  try{
    const u=new URL(base);
    if(process.env.DISTANCE_COURSE_FEED_URL){if(subject)u.searchParams.set('subject',subject);if(kind)u.searchParams.set('kind',kind)}
    else{u.searchParams.set('page','0');u.searchParams.set('size','500')}
    const upstream=await fetch(u,{headers:{accept:'application/json'},signal:AbortSignal.timeout(12000)});
    if(!upstream.ok)throw new Error(`Susa-navet svarade ${upstream.status}`);
    const courses=normalizeResponse(await upstream.json(),subject);
    return res.status(200).json({courses,updated:new Date().toISOString(),source:process.env.DISTANCE_COURSE_FEED_URL?'configured-feed':'skolverket-susa-navet'});
  }catch(error){
    console.error('distance-courses',error);
    return res.status(200).json({courses:[],updated:new Date().toISOString(),source:'skolverket-susa-navet',temporarilyUnavailable:true});
  }
}
