#!/usr/bin/env node

const args=process.argv.slice(2);
const value=(name,fallback='')=>{const i=args.indexOf(name);return i>=0&&args[i+1]?args[i+1]:fallback};
const base=(value('--base',process.env.STUDIELOTS_BASE_URL||'https://studielots-git-studi-5f5a74-johanfredrikholmberg-6513s-projects.vercel.app')).replace(/\/$/,'');
const limit=Math.max(1,Number(value('--limit','100'))||100);
const universityFilter=String(value('--university','')).trim().toLocaleLowerCase('sv-SE');
const timeout=Math.max(5000,Number(value('--timeout','20000'))||20000);
const clean=v=>String(v??'').trim();
const norm=v=>clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');

async function getJson(url){const r=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(timeout)});if(!r.ok)throw new Error(`HTTP ${r.status} ${url}`);return r.json()}
function key(p){return `${norm(p.university)}|${norm(p.programCode||p.programName)}|${Number(p.programHp||0)||0}`}
function canonicalEndpoint(p){const u=norm(p.university);if(/(^|\s)(kth|kungliga tekniska högskolan)(\s|$)/.test(u))return'/api/kth-program-structure';if(/göteborgs universitet|goteborgs universitet|(^|\s)gu(\s|$)|lunds universitet|(^|\s)lu(\s|$)/.test(u))return'/api/program-structure-resolved';return'/api/program-structure'}
function structureUrl(endpoint,p){const u=new URL(base+endpoint);for(const [k,v] of [['university',p.university],['code',p.programCode],['name',p.programName],['subject',p.subject]])if(clean(v))u.searchParams.set(k,clean(v));return u}
function fingerprint(x){if(!x?.structureAvailable||!Array.isArray(x.courses))return'';return x.courses.map(c=>[Number(c.term||c.__slOriginalTerm)||0,clean(c.code).toUpperCase(),norm(c.name),Number(c.hp)||0,clean(c.category),clean(c.slotType)].join('|')).sort().join('\n')}

const index=await getJson(new URL(base+'/api/program-index'));
let programs=Array.isArray(index?.programs)?index.programs:[];
if(universityFilter)programs=programs.filter(p=>norm(p.university).includes(universityFilter));
const duplicateMap=new Map();for(const p of programs){const k=key(p);if(!duplicateMap.has(k))duplicateMap.set(k,[]);duplicateMap.get(k).push(p)}
const duplicateKeys=[...duplicateMap.entries()].filter(([,rows])=>rows.length>1);

let conflicts=0,checked=0,errors=0;
for(const p of programs.slice(0,limit)){
  checked++;
  const canonical=canonicalEndpoint(p);
  const alternatives=[canonical,'/api/program-structure-resolved','/api/program-structure','/api/kth-program-structure'].filter((x,i,a)=>a.indexOf(x)===i);
  const results=[];
  for(const endpoint of alternatives){
    try{const r=await getJson(structureUrl(endpoint,p));if(r?.structureAvailable&&Array.isArray(r.courses)&&r.courses.length>=2)results.push({endpoint,source:r.source||'',coverage:r.coverage||'',fp:fingerprint(r),rows:r.courses.length,totalHp:Number(r.totalHp)||0})}catch(_){/* alternative may not apply */}
  }
  const canonicalResult=results.find(r=>r.endpoint===canonical);
  const differing=canonicalResult?results.filter(r=>r.endpoint!==canonicalResult.endpoint&&r.fp&&r.fp!==canonicalResult.fp):[];
  if(differing.length){
    conflicts++;
    console.log(`CONFLICT | ${p.university} | ${p.programCode||'-'} | ${p.programName}`);
    console.log(`  canonical ${canonicalResult.endpoint} source=${canonicalResult.source} rows=${canonicalResult.rows} hp=${canonicalResult.totalHp}`);
    for(const r of differing)console.log(`  differs   ${r.endpoint} source=${r.source} rows=${r.rows} hp=${r.totalHp}`);
  }else if(!canonicalResult){
    console.log(`MISSING | ${p.university} | ${p.programCode||'-'} | ${p.programName} | canonical=${canonical}`);
  }
}

if(duplicateKeys.length){
  console.log(`\nCATALOGUE DUPLICATES: ${duplicateKeys.length}`);
  for(const [k,rows] of duplicateKeys.slice(0,25))console.log(`DUPLICATE | ${k} | ${rows.map(r=>r.programName).join(' / ')}`);
}
console.log(`\nChecked ${checked} programs | structure conflicts ${conflicts} | catalogue duplicate keys ${duplicateKeys.length} | request errors ${errors}`);
if(conflicts||duplicateKeys.length)process.exitCode=1;
