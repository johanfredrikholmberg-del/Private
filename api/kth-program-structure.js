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
function parseMeta(html){const plain=htmlText(html);const heading=htmlText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');const context=clean(plain.match(/Utbildningsplan\s+kull\s+(?:HT|VT)?\s*20\d{2}[^\n]*/i)?.[0]||'');const programMatch=plain.match(/(?:Civilingenjörsutbildning|Högskoleingenjörsutbildning|Kandidatprogram|Masterprogram|Magisterprogram|Arkitektutbildning|Ämneslärarutbildning)[^()]{0,160}\(([A-ZÅÄÖ0-9-]{3,12})\)/i)||plain.match(/\(([A-ZÅÄÖ0-9-]{3,12})\)/);return{heading,context,code:clean(programMatch?.[1])}}
function parseYear(html,studyYear){
  const tokens=String(html??'').match(/<h[2-5]\b[^>]*>[\s\S]*?<\/h[2-5]>|<tr\b[^>]*>[\s\S]*?<\/tr>/gi)||[];
  let category='';const rows=[];
  for(const token of tokens){
    if(/^<h[2-5]\b/i.test(token)){const t=norm(htmlText(token));if(/^obligatoriska kurser/.test(t))category='mandatory';else if(/^villkorligt valfria kurser/.test(t))category='conditional';else if(/^valfria kurser/.test(t)||/^rekommenderade kurser/.test(t))category='elective';continue}
    if(!category)continue;
    const cells=[...token.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>htmlText(m[1]));
    if(cells.length<3)continue;
    const first=cells[0],m=first.match(/^([A-ZÅÄÖ]{2,5}\d{3}[A-Z]?)\s+(.+)$/i);if(!m)continue;
    const hpIndex=cells.findIndex((c,i)=>i>0&&/(\d+(?:[.,]\d+)?)\s*hp/i.test(c));if(hpIndex<0)continue;
    const hp=Number(cells[hpIndex].match(/(\d+(?:[.,]\d+)?)/)?.[1]?.replace(',','.'));if(!(hp>0&&hp<=60))continue;
    const periodCells=cells.slice(hpIndex+1,hpIndex+5);while(periodCells.length<4)periodCells.push('');
    const periodHp=periodCells.map(c=>{const n=Number(String(c).replace(',','.').match(/\d+(?:\.\d+)?/)?.[0]);return Number.isFinite(n)?n:0});
    const allocated=round1(periodHp.reduce((a,b)=>a+b,0));
    const fall=round1(periodHp[0]+periodHp[1]),spring=round1(periodHp[2]+periodHp[3]);
    const startTerm=(studyYear-1)*2+1,endTerm=startTerm+1;
    let term=fall>0?startTerm:spring>0?endTerm:startTerm;
    if(spring>fall)term=endTerm;
    rows.push({name:clean(m[2]),code:codeNorm(m[1]),hp:round1(hp),term,studyYear,category,periodHp:periodHp.map(round1),termParts:{[startTerm]:fall,[endTerm]:spring},crossSemester:fall>0&&spring>0,allocationComplete:allocated>0&&Math.abs(allocated-hp)<=0.2});
  }
  return rows;
}
function quality(rows,years){
  const mandatory=rows.filter(r=>r.category==='mandatory');const termHp={};let incompleteAllocations=0,crossSemesterCourses=0;
  for(const r of mandatory){if(!r.allocationComplete)incompleteAllocations++;if(r.crossSemester)crossSemesterCourses++;for(const [term,hp] of Object.entries(r.termParts||{}))termHp[term]=round1((termHp[term]||0)+hp)}
  const expectedTerms=years.length*2,completeTerms=[];for(let t=1;t<=expectedTerms;t++){const hp=round1(termHp[t]||0);if(hp>=27&&hp<=33)completeTerms.push(t)}
  const complete=years.length>=1&&completeTerms.length===expectedTerms&&incompleteAllocations===0;
  return{complete,expectedTerms,completeTerms,termHp,incompleteAllocations,crossSemesterCourses,mandatoryHp:round1(mandatory.reduce((s,r)=>s+r.hp,0))};
}
async function discover({code,name,university}){
  if(!isKth(university))return null;const wanted=codeNorm(code);if(!wanted)return{found:false,structureAvailable:false,courses:[],source:'kth-programplan'};
  let cohort='',firstHtml='',firstUrl='';
  for(const c of currentCohorts()){const url=kthUrl(wanted,c,1);try{const html=await getText(url);const meta=parseMeta(html);if(meta.code&&codeNorm(meta.code)!==wanted)continue;cohort=c;firstHtml=html;firstUrl=url;break}catch(_){}}
  if(!cohort)return{found:false,structureAvailable:false,courses:[],source:'kth-programplan'};
  const pages=[{year:1,html:firstHtml,url:firstUrl}];
  for(let year=2;year<=5;year++){const url=kthUrl(wanted,cohort,year);try{const html=await getText(url);const plain=htmlText(html);if(!new RegExp(`Årskurs\\s+${year}\\b`,'i').test(plain))break;pages.push({year,html,url})}catch(_){break}}
  const all=pages.flatMap(p=>parseYear(p.html,p.year));const q=quality(all,pages.map(p=>p.year));
  const mandatory=all.filter(r=>r.category==='mandatory').sort((a,b)=>a.term-b.term||a.code.localeCompare(b.code,'sv'));
  const courses=mandatory.map((r,i)=>({...r,originalTerm:r.term,__slOriginalTerm:r.term,__slOriginalIndex:i,status:'remaining',credited:false,isCredited:false,programmeSource:'kth-programplan',programmeCategory:'mandatory'}));
  const meta=parseMeta(firstHtml);
  return{found:true,structureAvailable:q.complete,courses,program:{name:name||meta.context||wanted,code:wanted,university:'KTH'},sourceUrls:pages.map(p=>p.url),source:'kth-programplan',confidence:q.complete?'official-machine-readable-sequenced':'official-partial',coverage:q.complete?'complete-period-sequence':'partial-or-period-incomplete',quality:{...q,cohort,pagesFound:pages.map(p=>p.year)},policy:'KTH structure is activated only when official programme-year pages provide complete P1-P4 credit allocation for every mandatory course and every expected semester has a near-full 30-credit load. Cross-semester courses retain termParts so their period allocation is not lost.'};
}

export default async function handler(req,res){res.setHeader('Cache-Control','s-maxage=21600, stale-while-revalidate=86400');const code=clean(req.query?.code),name=clean(req.query?.name),university=clean(req.query?.university);if(!code&&!name)return res.status(400).json({error:'code or name is required'});try{const result=await discover({code,name,university});if(!result)return res.status(200).json({found:false,structureAvailable:false,courses:[],source:'kth-programplan',checkedAt:new Date().toISOString()});return res.status(200).json({...result,checkedAt:new Date().toISOString()})}catch(error){console.error('kth-program-structure',error);return res.status(200).json({found:false,structureAvailable:false,courses:[],temporarilyUnavailable:true,source:'kth-programplan',checkedAt:new Date().toISOString()})}}
