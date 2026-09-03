const KTH_PROGRAM_BASE='https://www.kth.se/student/kurser/program/';

const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const codeNorm=v=>clean(v).toUpperCase().replace(/[^A-Z0-9ÅÄÖ]/g,'');
const round1=n=>Math.round(Number(n||0)*10)/10;

function isKth(university){return /(^|\s)kth(\s|$)|kungliga tekniska/.test(norm(university))}
function decodeHtml(s){return String(s??'').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&aring;/gi,'å').replace(/&Aring;/g,'Å').replace(/&auml;/gi,'ä').replace(/&Auml;/g,'Ä').replace(/&ouml;/gi,'ö').replace(/&Ouml;/g,'Ö').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)))}
function htmlText(s){return clean(decodeHtml(String(s??'').replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<br\s*\/?\s*>/gi,' ').replace(/<[^>]+>/g,' ')))}
async function getText(url,timeout=15000){const r=await fetch(url,{headers:{accept:'text/html,application/xhtml+xml'},signal:AbortSignal.timeout(timeout)});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.text()}
function currentCohorts(){const d=new Date(),y=d.getUTCFullYear(),m=d.getUTCMonth()+1,start=m>=7?y:y-1;return [`${start}2`,`${start}1`]}
function kthUrl(code,cohort,studyYear){return `${KTH_PROGRAM_BASE}${encodeURIComponent(codeNorm(code))}/${cohort}/arskurs${studyYear}?l=sv`}
function parseMeta(html){const plain=htmlText(html);const programMatch=plain.match(/(?:Civilingenjörsutbildning|Högskoleingenjörsutbildning|Kandidatprogram|Masterprogram|Magisterprogram|Arkitektutbildning|Ämneslärarutbildning)[^()]{0,180}\(([A-ZÅÄÖ0-9-]{3,12})\)/i)||plain.match(/\(([A-ZÅÄÖ0-9-]{3,12})\)/);return{code:clean(programMatch?.[1])}}

function parseEncodedYearBlock(html,studyYear){
  const source=String(html??'');
  const marker=`%7B%22yearNumber%22%3A${studyYear}%2C%22courses%22%3A%5B`;
  const start=source.indexOf(marker);
  if(start<0)return null;
  const after=start+marker.length;
  const endMarker='%5D%2C%22freeTexts%22';
  const end=source.indexOf(endMarker,after);
  if(end<0)return null;
  try{
    const prefix=`%7B%22yearNumber%22%3A${studyYear}%2C%22courses%22%3A%5B`;
    const json=decodeURIComponent(prefix+source.slice(after,end)+'%5D%7D');
    const parsed=JSON.parse(json);
    return Array.isArray(parsed?.courses)?parsed.courses:null;
  }catch(_){return null}
}
function semesterFromDates(periods,startTerm,endTerm){
  let fall=false,spring=false;
  for(const p of Array.isArray(periods)?periods:[]){
    const a=String(p?.ForstaUndervisningsdatum||''),b=String(p?.SistaUndervisningsdatum||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(a)||!/^\d{4}-\d{2}-\d{2}$/.test(b))continue;
    const sm=Number(a.slice(5,7)),em=Number(b.slice(5,7));
    if(sm>=7&&(em>=7||em===1))fall=true;
    else if(sm<=6&&em<=6)spring=true;
    else {fall=true;spring=true}
  }
  if(fall&&!spring)return startTerm;
  if(spring&&!fall)return endTerm;
  return 0;
}
function parseYear(html,studyYear){
  const objects=parseEncodedYearBlock(html,studyYear)||[];
  const rows=[];const startTerm=(studyYear-1)*2+1,endTerm=startTerm+1;
  for(const o of objects){
    const hp=Number(o?.omfattning?.number);if(!(hp>0&&hp<=60)||!o?.kod)continue;
    const category=o?.Valvillkor==='O'?'mandatory':o?.Valvillkor==='V'?'elective':o?.Valvillkor==='B'?'conditional':'unknown';
    const periodHp=[0,0,0,0];
    for(const tp of Array.isArray(o?.Tillfallesperioder)?o.Tillfallesperioder:[]){for(const p of Array.isArray(tp?.Lasperiodsfordelning)?tp.Lasperiodsfordelning:[]){const m=String(p?.Lasperiodskod||'').match(/^P([1-4])$/i);if(!m)continue;periodHp[Number(m[1])-1]=round1(periodHp[Number(m[1])-1]+Number(p?.Omfattningsvarde||0))}}
    const allocated=round1(periodHp.reduce((a,b)=>a+b,0)),fall=round1(periodHp[0]+periodHp[1]),spring=round1(periodHp[2]+periodHp[3]);
    let term=0,termParts={[startTerm]:fall,[endTerm]:spring},allocationComplete=false,allocationMethod='periods';
    if(allocated>0){term=spring>fall?endTerm:startTerm;allocationComplete=Math.abs(allocated-hp)<=0.2}
    else{
      term=semesterFromDates(o?.Tillfallesperioder,startTerm,endTerm);
      allocationMethod='teaching-dates';
      if(term){termParts={[startTerm]:term===startTerm?round1(hp):0,[endTerm]:term===endTerm?round1(hp):0};allocationComplete=true}
    }
    if(!term)term=startTerm;
    rows.push({name:clean(o?.benamning)||codeNorm(o?.kod),code:codeNorm(o?.kod),hp:round1(hp),term,studyYear,category,periodHp:periodHp.map(round1),termParts,crossSemester:Number(termParts[startTerm]||0)>0&&Number(termParts[endTerm]||0)>0,allocationComplete,allocationMethod,sourceType:clean(o?.type)});
  }
  const seen=new Set();return rows.filter(r=>{const k=[r.code,r.hp,r.category].join('|');if(seen.has(k))return false;seen.add(k);return true});
}
function duplicateYearPairs(rows,years){
  const sets=new Map();for(const y of years)sets.set(y,new Set(rows.filter(r=>r.studyYear===y&&r.category==='mandatory').map(r=>r.code)));
  const bad=[];for(let i=0;i<years.length;i++)for(let j=i+1;j<years.length;j++){const a=sets.get(years[i]),b=sets.get(years[j]);if(!a.size||!b.size)continue;const common=[...a].filter(x=>b.has(x)).length;const similarity=common/Math.min(a.size,b.size);if(similarity>=0.8)bad.push({years:[years[i],years[j]],similarity:round1(similarity*100)})}return bad;
}
function quality(rows,years){
  const mandatory=rows.filter(r=>r.category==='mandatory');const termHp={};let incompleteAllocations=0,crossSemesterCourses=0;
  for(const r of mandatory){if(!r.allocationComplete)incompleteAllocations++;if(r.crossSemester)crossSemesterCourses++;for(const [term,hp] of Object.entries(r.termParts||{}))termHp[term]=round1((termHp[term]||0)+hp)}
  const expectedTerms=years.length*2,completeTerms=[];for(let t=1;t<=expectedTerms;t++){const hp=round1(termHp[t]||0);if(hp>=27&&hp<=33)completeTerms.push(t)}
  const duplicateYears=duplicateYearPairs(rows,years);
  const complete=years.length>=1&&completeTerms.length===expectedTerms&&incompleteAllocations===0&&duplicateYears.length===0;
  return{complete,expectedTerms,completeTerms,termHp,incompleteAllocations,crossSemesterCourses,mandatoryHp:round1(mandatory.reduce((s,r)=>s+r.hp,0)),duplicateYears};
}
async function discover({code,name,university}){
  if(!isKth(university))return null;const wanted=codeNorm(code);if(!wanted)return{found:false,structureAvailable:false,courses:[],source:'kth-programplan'};
  let cohort='',firstHtml='',firstUrl='';
  for(const c of currentCohorts()){const url=kthUrl(wanted,c,1);try{const html=await getText(url);const meta=parseMeta(html);if(meta.code&&codeNorm(meta.code)!==wanted)continue;if(!parseEncodedYearBlock(html,1)?.length)continue;cohort=c;firstHtml=html;firstUrl=url;break}catch(_){}}
  if(!cohort)return{found:false,structureAvailable:false,courses:[],source:'kth-programplan'};
  const pages=[{year:1,html:firstHtml,url:firstUrl}];
  for(let year=2;year<=5;year++){const url=kthUrl(wanted,cohort,year);try{const html=await getText(url);if(!parseEncodedYearBlock(html,year)?.length)break;pages.push({year,html,url})}catch(_){break}}
  const years=pages.map(p=>p.year),all=pages.flatMap(p=>parseYear(p.html,p.year)),q=quality(all,years);
  const mandatory=all.filter(r=>r.category==='mandatory').sort((a,b)=>a.term-b.term||a.code.localeCompare(b.code,'sv'));
  const courses=mandatory.map((r,i)=>({...r,originalTerm:r.term,__slOriginalTerm:r.term,__slOriginalIndex:i,status:'remaining',credited:false,isCredited:false,programmeSource:'kth-programplan',programmeCategory:'mandatory'}));
  return{found:true,structureAvailable:q.complete,courses,program:{name:name||wanted,code:wanted,university:'KTH'},sourceUrls:pages.map(p=>p.url),source:'kth-programplan',confidence:q.complete?'official-machine-readable-sequenced':'official-partial',coverage:q.complete?'complete-semester-sequence':'partial-or-semester-incomplete',quality:{...q,cohort,pagesFound:years},policy:'KTH data is scoped to the official yearNumber block. P1-P4 allocation is used when published; otherwise a course is assigned to a semester only when official teaching dates keep the whole course inside that semester. Repeated year-course sets, ambiguous cross-semester dates, incomplete allocations or semesters outside 27-33 credits prevent verification.'};
}

export default async function handler(req,res){res.setHeader('Cache-Control','s-maxage=21600, stale-while-revalidate=86400');const code=clean(req.query?.code),name=clean(req.query?.name),university=clean(req.query?.university);if(!code&&!name)return res.status(400).json({error:'code or name is required'});try{const result=await discover({code,name,university});if(!result)return res.status(200).json({found:false,structureAvailable:false,courses:[],source:'kth-programplan',checkedAt:new Date().toISOString()});return res.status(200).json({...result,checkedAt:new Date().toISOString()})}catch(error){console.error('kth-program-structure',error);return res.status(200).json({found:false,structureAvailable:false,courses:[],temporarilyUnavailable:true,source:'kth-programplan',checkedAt:new Date().toISOString()})}}
