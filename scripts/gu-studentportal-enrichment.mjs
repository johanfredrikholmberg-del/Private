#!/usr/bin/env node
import fs from 'node:fs/promises';

const GU='data/gu';
const TARGET='data/HT26/program-structures.json';
const QUEUE='data/susa/structure-queue.json';
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const codeNorm=v=>clean(v).toUpperCase().replace(/[^A-Z0-9ÅÄÖ]/g,'');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rank={complete:5,'choice-required':4,'partial-structure':3,'manual-review':2,'metadata-only':1};

function decodeHtml(s){return String(s??'').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&nbsp;/gi,' ')}
function abs(href,base){try{return new URL(decodeHtml(href),base).href}catch{return''}}
function textLines(html){
  return decodeHtml(String(html??''))
    .replace(/<script\b[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi,' ')
    .replace(/<(?:br|\/p|\/li|\/div|\/h[1-6]|\/tr|\/section)>/gi,'\n')
    .replace(/<[^>]+>/g,' ')
    .split(/\r?\n/).map(clean).filter(Boolean);
}
function links(html,base){const out=[];for(const m of String(html||'').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){const href=abs(m[1],base);if(href)out.push(href)}return [...new Set(out)]}
function xmlLocs(xml){return [...String(xml||'').matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map(m=>decodeHtml(m[1]).trim()).filter(Boolean)}
async function get(url,accept='text/html,application/xhtml+xml,application/xml,text/xml'){const r=await fetch(url,{headers:{accept,'user-agent':'StudieLots/1.0'},redirect:'follow',signal:AbortSignal.timeout(25000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);return{html:await r.text(),url:r.url||url,contentType:r.headers.get('content-type')||''}}

let portalIndexPromise=null;
async function buildPortalIndex(){
  if(portalIndexPromise)return portalIndexPromise;
  portalIndexPromise=(async()=>{
    const sitemapSeeds=[
      'https://studentportal.gu.se/sitemap.xml',
      'https://studentportal.gu.se/sitemap_index.xml',
      'https://studentportal.gu.se/sitemap/sitemap.xml'
    ];
    const seenMaps=new Set();const urls=new Set();const queue=[...sitemapSeeds];
    while(queue.length&&seenMaps.size<30){
      const u=queue.shift();if(seenMaps.has(u))continue;seenMaps.add(u);
      try{
        const r=await get(u);
        const locs=xmlLocs(r.html);
        for(const loc of locs){
          if(/\.xml(?:$|\?)/i.test(loc)||/sitemap/i.test(loc)&&!(/\/program\//i.test(loc))) {if(!seenMaps.has(loc))queue.push(loc);continue}
          if(/studentportal\.gu\.se\/(?:en\/programme|program)\//i.test(loc))urls.add(loc);
        }
      }catch{}
    }
    console.log(`studentportal sitemap programme urls: ${urls.size}`);
    const byCode=new Map();const arr=[...urls];let cursor=0;
    async function worker(){
      for(;;){const n=cursor++;if(n>=arr.length)return;const u=arr[n];try{
        const p=await get(u);const all=textLines(p.html).join(' ');
        const codes=[...all.matchAll(/(?:Program|Programme)\s+([A-ZÅÄÖ0-9]{4,12})\b/g)].map(m=>codeNorm(m[1]));
        for(const c of codes){if(c&&!byCode.has(c))byCode.set(c,p)}
      }catch{}
      await sleep(25);
      }
    }
    await Promise.all(Array.from({length:Math.min(10,Math.max(1,arr.length))},worker));
    console.log(`studentportal indexed programme codes: ${byCode.size}`);
    return byCode;
  })();
  return portalIndexPromise;
}

async function resolvePage(code){
  const index=await buildPortalIndex();
  if(index.has(code))return index.get(code);
  try{
    const search=await get(`https://studentportal.gu.se/sok?q=${encodeURIComponent(code)}`);
    const candidates=links(search.html,search.url).filter(u=>/studentportal\.gu\.se\/(?:en\/programme|program)\//i.test(u)).slice(0,12);
    for(const u of candidates){
      try{const p=await get(u);const t=textLines(p.html).join(' ');if(new RegExp(`\\b${code.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(t))return p}catch{}
    }
  }catch{}
  return null;
}

function parsePage(page,item){
  const code=codeNorm(item.programCode);
  const lines=textLines(page.html);
  const all=lines.join(' ');
  if(!new RegExp(`\\b${code.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(all))return null;
  const rows=[];let term=0;
  for(const line of lines){
    const tm=line.match(/^(?:###\s*)?(?:Termin|Term|Year\s+\d+,\s*(?:autumn|spring)\s+term)\s*(\d{1,2})?\b/i);
    if(tm&&/^\s*(?:Termin|Term)\s+\d+/i.test(line)){term=Number(line.match(/\d{1,2}/)?.[0]||0);continue}
    const yearTerm=line.match(/^Year\s+(\d+)\s*,\s*(autumn|spring)\s+term/i);
    if(yearTerm){term=(Number(yearTerm[1])-1)*2+(yearTerm[2].toLowerCase()==='spring'?2:1);continue}
    if(!term)continue;
    const patterns=[
      /\b([A-ZÅÄÖ]{2,8}\d{1,4}[A-Z]?)\b\s*[-–:]?\s*(.{2,180}?)\s*[,;:]?\s*(\d+(?:[.,]\d+)?)\s*(?:hp|högskolepoäng|credits?|ECTS)\b/i,
      /\b([A-ZÅÄÖ]{2,8}\d{1,4}[A-Z]?)\b\s+(.{2,180}?)\s+(\d+(?:[.,]\d+)?)\s*(?:hp|högskolepoäng|credits?|ECTS)\b/i
    ];
    let m=null;for(const p of patterns){m=line.match(p);if(m)break}
    if(m){
      const hp=Number(m[3].replace(',','.'));if(!(hp>0&&hp<=30))continue;
      const name=clean(m[2].replace(/[,:;\-–\s]+$/g,''));if(!name)continue;
      rows.push({term,code:codeNorm(m[1]),name,hp,category:/valbar|valfri|elective|choose|depending on|alternativ|inriktning/i.test(line)?'elective':'required',isThesis:/examensarbete|självständigt arbete|degree project|thesis/i.test(name)});
      continue;
    }
    const slot=line.match(/(?:Valbar(?:a)? kurser?|Valfri(?:a)? kurser?|Elective courses?)\s*[,;:]?\s*(\d+(?:[.,]\d+)?)\s*(?:hp|högskolepoäng|credits?|ECTS)/i);
    if(slot){const hp=Number(slot[1].replace(',','.'));if(hp>0&&hp<=30)rows.push({term,code:'',name:'Elective courses',hp,category:'elective',isThesis:false})}
  }
  const dedup=new Map();for(const r of rows){const k=`${r.term}|${r.code||norm(r.name)}|${r.hp}`;if(!dedup.has(k))dedup.set(k,r)}
  const unique=[...dedup.values()];if(!unique.length)return null;
  const maxTerm=Math.max(...unique.map(r=>r.term));if(maxTerm<1)return null;
  const totalHp=Number(item.hp)||0;const target=Math.round((totalHp/maxTerm)*10)/10;
  if(!(target>0&&target<=30))return null;
  const termHp={};for(let t=1;t<=maxTerm;t++)termHp[t]=Math.round(unique.filter(r=>r.term===t).reduce((s,r)=>s+r.hp,0)*10)/10;
  const complete=Object.values(termHp).every(v=>Math.abs(v-target)<=0.2);
  if(!complete)return null;
  const hasChoice=unique.some(r=>r.category==='elective')||/valbar|valfri|elective|choose|depending on|utbytesstudier|exchange|praktik/i.test(all);
  return{rows:unique,maxTerm,target,coverage:hasChoice?'choice-required':'complete',termHp};
}

const queue=JSON.parse(await fs.readFile(QUEUE,'utf8'));
const guQueue=queue.filter(x=>/goteborgs universitet/.test(norm(x.university)));
const structures=JSON.parse(await fs.readFile(TARGET,'utf8'));
const byKey=new Map(structures.map((x,i)=>[x.key,i]));
let checked=0,applied=0;
for(const item of guQueue){
  const i=byKey.get(item.key);if(i==null)continue;
  const old=structures[i];if((rank[old.coverage]||0)>=3)continue;
  checked++;
  try{
    const page=await resolvePage(codeNorm(item.programCode));
    if(!page){continue}
    const parsed=parsePage(page,item);if(!parsed){continue}
    const courses=parsed.rows.map((r,j)=>({...r,originalTerm:r.term,__slOriginalTerm:r.term,__slOriginalIndex:j,status:'remaining',credited:false,isCredited:false,programmeSource:'gu-official-studentportal',programmeCategory:r.category}));
    structures[i]={...old,term:'HT26',status:'processed',coverage:parsed.coverage,reason:'official-gu-studentportal-exact-term-sums',rows:courses,courses,source:'gu-official-studentportal',sourceUrl:page.url,sourceUrls:[page.url],quality:{complete:true,expectedTerms:parsed.maxTerm,completeTerms:Array.from({length:parsed.maxTerm},(_,n)=>n+1),termHp:parsed.termHp,parsedRows:courses.length,totalHp:Number(item.hp)||0,targetPerTerm:parsed.target},checkedAt:new Date().toISOString()};
    applied++;console.log(`studentportal ${parsed.coverage} ${item.programCode} ${item.programName}`);
  }catch(e){console.log(`studentportal skipped ${item.programCode}: ${e.message}`)}
}
await fs.writeFile(TARGET,JSON.stringify(structures,null,2)+'\n');
const guRows=guQueue.map(x=>structures[byKey.get(x.key)]).filter(Boolean);
const counts=guRows.reduce((a,x)=>(a[x.coverage]=(a[x.coverage]||0)+1,a),{});
const unresolved=guRows.filter(x=>['metadata-only','manual-review'].includes(x.coverage)).map(x=>({key:x.key,code:x.programCode,name:x.programName,hp:x.hp,coverage:x.coverage,reason:x.reason||''}));
let oldMeta={};try{oldMeta=JSON.parse(await fs.readFile(`${GU}/meta.json`,'utf8'))}catch{}
await fs.writeFile(`${GU}/meta.json`,JSON.stringify({...oldMeta,database:'StudieLots HT26',generatedAt:new Date().toISOString(),programmes:guRows.length,counts,unresolved:unresolved.length,studentPortalChecked:checked,studentPortalApplied:applied},null,2)+'\n');
await fs.writeFile(`${GU}/unresolved.json`,JSON.stringify(unresolved,null,2)+'\n');
console.log(JSON.stringify({checked,applied,counts,unresolved:unresolved.length},null,2));
