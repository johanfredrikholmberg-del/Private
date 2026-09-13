import fs from 'node:fs/promises';

const RAW='https://raw.githubusercontent.com/johanfredrikholmberg-del/Private/studielots-v2/data/susa';
const UMU='https://www.umu.se/utbildning/kurs-och-utbildningsplan';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const isUmea=o=>/umea universitet/.test(norm(JSON.stringify(o)));
const num=v=>{const n=Number(String(v??'').replace(',','.').match(/\d+(?:\.\d+)?/)?.[0]);return Number.isFinite(n)?n:0};
const get=(o,keys)=>{for(const k of keys){if(o&&o[k]!=null&&o[k]!=='')return o[k]}return''};
const pickCode=o=>clean(get(o,['code','programCode','programmeCode','educationCode','identifier','applicationCode'])).toUpperCase();
const pickName=o=>clean(get(o,['name','title','programmeName','programName','educationName','label']));
const pickHp=o=>num(get(o,['hp','credits','credit','creditsValue','scope']));

async function j(url){const r=await fetch(url,{headers:{accept:'application/json'}});if(!r.ok)throw new Error(`${url} ${r.status}`);return r.json()}
async function html(url){for(let i=0;i<5;i++){const r=await fetch(url,{headers:{accept:'text/html,application/xhtml+xml','user-agent':'StudieLots/1.0 data-quality import'},signal:AbortSignal.timeout(20000)});if(r.ok)return r.text();if(![429,500,502,503,504].includes(r.status))throw new Error(`${url} ${r.status}`);await sleep(1200*(i+1))}throw new Error(`${url} temporarily unavailable`)}
function strip(s){return clean(String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<br\s*\/?>/gi,'\n').replace(/<\/(?:p|li|h[1-6]|div|tr|section|article|dt|dd)>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;|&#xA0;/gi,' ').replace(/&amp;/gi,'&').replace(/&aring;|&#229;/gi,'å').replace(/&auml;|&#228;/gi,'ä').replace(/&ouml;|&#246;/gi,'ö').replace(/&Aring;|&#197;/g,'Å').replace(/&Auml;|&#196;/g,'Ä').replace(/&Ouml;|&#214;/g,'Ö').replace(/[ \t]+/g,' ').replace(/\n\s*\n+/g,'\n'))}
function flatten(value,out=[]){if(Array.isArray(value)){for(const v of value)flatten(v,out)}else if(value&&typeof value==='object'){out.push(value);for(const v of Object.values(value))if(v&&typeof v==='object')flatten(v,out)}return out}
function catalogue(raw,type){const seen=new Map;for(const o of flatten(raw)){if(!isUmea(o))continue;const code=pickCode(o),name=pickName(o),hp=pickHp(o);if(!code||code.length>20||!name||name.length<3)continue;const key=code;const old=seen.get(key);const rec={code,name,hp:hp||old?.hp||0,university:'Umeå universitet',type,source:'susa-static'};if(!old||(!old.hp&&rec.hp)||rec.name.length>old.name.length)seen.set(key,rec)}return [...seen.values()].sort((a,b)=>a.code.localeCompare(b.code,'sv'))}
function parseMeta(text,code){const name=clean(text.match(/(?:^|\n)\s*([^\n]{3,220}?),\s*(\d{2,3})\s*hp\b/i)?.[1]);const hp=num(text.match(/\bHögskolepoäng\s*:\s*(\d{2,3})\b/i)?.[1]||text.match(/,\s*(\d{2,3})\s*hp\b/i)?.[1]);const pageCode=clean(text.match(/\bProgramkod\s*:\s*([A-ZÅÄÖ0-9-]+)/i)?.[1]).toUpperCase();return{name, hp, code:pageCode||code}}
function row(term,name,hp,category,extra={}){return{term,name:clean(name),code:'',hp,category,...extra}}
function parseStructure(text,total){const marker=Math.max(text.lastIndexOf('\nProgrammets upplägg\n'),text.lastIndexOf('\nStudieplan\n'));if(marker<0)return{rows:[],coverage:'metadata-only',reason:'no-published-term-structure'};const body=text.slice(marker),terms=[...body.matchAll(/(?:^|\n)\s*Termin\s+(\d{1,2})\b[^\n]*/gi)],rows=[];for(let i=0;i<terms.length;i++){const term=Number(terms[i][1]),start=terms[i].index+terms[i][0].length,end=i+1<terms.length?terms[i+1].index:body.length,chunk=body.slice(start,end),lines=chunk.split('\n').map(clean).filter(Boolean),tr=[];for(let j=0;j<lines.length;j++){const m=lines[j].match(/^(.{2,220}?),\s*(\d+(?:[,.]\d+)?)\s*hp\b/i);if(!m)continue;const name=clean(m[1]),hp=Number(m[2].replace(',','.'));if(!(hp>0&&hp<=60))continue;const context=[lines[j-1],lines[j+1],name].filter(Boolean).join(' ');let category=/valbara|valfria|valbar kurs|valfri kurs|fria kurser/i.test(context)?'elective':'mandatory';tr.push(row(term,name,hp,category))}let sum=tr.reduce((s,r)=>s+r.hp,0);if(sum<29.5){const hasOpen=/valbara(?:\/fria)? kurser|valfria kurser|fria kurser/i.test(chunk);if(hasOpen){const explicit=chunk.match(/(?:valbara(?:\/fria)?|valfria|fria)\s+kurser[^\d]{0,40}(\d+(?:[,.]\d+)?)\s*hp/i);const hp=explicit?Number(explicit[1].replace(',','.')):30-sum;if(hp>0&&hp<=30){tr.push(row(term,'Valbara/fria kurser',hp,'elective-slot',{isSlot:true,slotType:'elective-slot'}));sum+=hp}}}rows.push(...tr)}const expected=total?Math.round(total/30):(terms.length?Math.max(...terms.map(x=>Number(x[1]))):0);const sums={};for(const r of rows)sums[r.term]=(sums[r.term]||0)+r.hp;const completeTerms=Object.keys(sums).map(Number).filter(t=>sums[t]>=29.5&&sums[t]<=30.5);const hasChoice=rows.some(r=>r.category!=='mandatory');let coverage='partial-structure',reason='published-terms-not-fully-reconciled';if(expected>0&&completeTerms.length===expected){coverage=hasChoice?'choice-required':'complete';reason='all-published-terms-reconciled'}else if(!rows.length){coverage='metadata-only';reason='no-verified-term-structure'}return{rows,coverage,reason,expectedTerms:expected,completeTerms,termSums:sums}}

const programmeRaw=await j(`${RAW}/programmes.json`);
const courseRaw=await j(`${RAW}/courses.json`);
let programmes=catalogue(programmeRaw,'programme');
let courses=catalogue(courseRaw,'course');
console.log(`SUSA candidates: programmes=${programmes.length} courses=${courses.length}`);

const structures=[];let temporaryErrors=0,officialFound=0;
for(let i=0;i<programmes.length;i++){
  const p=programmes[i], code=p.code.toLowerCase().replace(/[^a-z0-9åäö]/g,'');
  if(!code)continue;
  const url=`${UMU}/${encodeURIComponent(code)}/`;
  try{
    const text=strip(await html(url)),meta=parseMeta(text,p.code);if(meta.code&&meta.code!==p.code)continue;officialFound++;
    p.name=meta.name||p.name;p.hp=meta.hp||p.hp;p.sourceUrl=url;p.source='umea-official-education-plan';
    const s=parseStructure(text,p.hp);
    structures.push({...p,...s,sourceUrl:url,checkedAt:new Date().toISOString()});
  }catch(e){temporaryErrors++;structures.push({...p,coverage:'temporarily-unavailable',reason:String(e.message||e),rows:[],sourceUrl:url,checkedAt:new Date().toISOString()})}
  if((i+1)%10===0)console.log(`${i+1}/${programmes.length}`);
  await sleep(350);
}
const counts={};for(const s of structures)counts[s.coverage]=(counts[s.coverage]||0)+1;
await fs.mkdir('data/umu',{recursive:true});
await fs.writeFile('data/umu/programmes.json',JSON.stringify(programmes,null,2));
await fs.writeFile('data/umu/courses.json',JSON.stringify(courses,null,2));
await fs.writeFile('data/umu/structures.json',JSON.stringify(structures,null,2));
await fs.writeFile('data/umu/meta.json',JSON.stringify({generatedAt:new Date().toISOString(),university:'Umeå universitet',programmes:programmes.length,courses:courses.length,officialFound,temporaryErrors,counts,policy:'SUSA supplies catalogue coverage. Programme structure is upgraded only from Umeå University official education-plan pages; unreconciled or unpublished terms remain explicit rather than guessed.'},null,2));
console.log(JSON.stringify({programmes:programmes.length,courses:courses.length,officialFound,temporaryErrors,counts},null,2));