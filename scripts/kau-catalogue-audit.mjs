#!/usr/bin/env node
// StudieLots: Karlstads universitet catalogue reconciliation audit.
// Read-only: compares KAU's official programme catalogue with local SUSA programmes/structures.
import fs from 'node:fs/promises';

const PAGES=[
  {level:'grund',url:'https://www.kau.se/utbildning/program-och-kurser/program/program-pa-grundniva-o'},
  {level:'avancerad',url:'https://www.kau.se/utbildning/program-och-kurser/program/program-pa-avancerad-niva-o'}
];
const clean=s=>String(s??'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&aring;/gi,'å').replace(/&auml;/gi,'ä').replace(/&ouml;/gi,'ö').replace(/&ndash;|&#8211;/gi,'–').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const norm=s=>clean(s).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const canonical=s=>norm(clean(s).replace(/^senare del av[:\s]*/i,'').replace(/\s*[-–|]\s*\d+(?:[,.]\d+)?\s*(?:hp|fup).*$/i,'').replace(/\s+\d+(?:[,.]\d+)?\s*(?:hp|fup)$/i,''));
const programmePath=/\/utbildning\/program-och-kurser\/program\/([^?#"']+)/i;

const official=[];
for(const page of PAGES){
  const r=await fetch(page.url,{headers:{'user-agent':'StudieLots-KAU-audit/2.0'}});
  if(!r.ok)throw new Error(`KAU ${page.level}: HTTP ${r.status}`);
  const html=await r.text();
  const links=[...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  for(const m of links){
    const href=new URL(m[1],page.url);
    const pathMatch=href.pathname.match(programmePath);
    if(!pathMatch)continue;
    const slug=pathMatch[1].replace(/\/$/,'');
    if(!slug||/^program-pa-(?:grund|avancerad)-niva-o$/i.test(slug))continue;
    const title=clean(m[2]);
    if(!title||title.length<3)continue;
    // KAU's catalogue cards do not consistently put the hp value inside the anchor.
    // The programme URL itself is therefore the stable catalogue identifier.
    official.push({level:page.level,title,url:href.href,slug,canonical:canonical(title)});
  }
}
const unique=[...new Map(official.map(x=>[`${x.level}|${x.slug.toLowerCase()}`,x])).values()];
const programmes=JSON.parse(await fs.readFile('data/susa/programmes.json','utf8'));
const structures=JSON.parse(await fs.readFile('data/susa/structures.json','utf8'));
const isKau=x=>/karlstads universitet/i.test(String(x.university||x.providerName||x.provider||''));
const kauProgrammes=programmes.filter(isKau),kauStructures=structures.filter(isKau);
const names=x=>[x.name,x.programName,x.programmeName,x.title].filter(Boolean).map(canonical);
const codes=x=>[x.code,x.programCode,x.programmeCode].filter(Boolean).map(v=>String(v).toLowerCase());
const match=(o,x)=>names(x).includes(o.canonical)||codes(x).includes(o.slug.toLowerCase());
const matched=[],missing=[];
for(const o of unique){
  const p=kauProgrammes.find(x=>match(o,x));
  const s=kauStructures.find(x=>match(o,x));
  const row={title:o.title,level:o.level,url:o.url,slug:o.slug,programme:!!p,structure:!!s,programmeCode:p?.code??p?.programCode??p?.programmeCode??null,structureCode:s?.programCode??s?.programmeCode??s?.code??null,coverage:s?.coverage??null};
  (p||s?matched:missing).push(row);
}
const structureCounts=kauStructures.reduce((a,x)=>(a[x.coverage||'unknown']=(a[x.coverage||'unknown']||0)+1,a),{});
console.log(JSON.stringify({officialExtracted:unique.length,officialGround:unique.filter(x=>x.level==='grund').length,officialAdvanced:unique.filter(x=>x.level==='avancerad').length,susaKarlstadCount:kauProgrammes.length,structureKarlstadCount:kauStructures.length,structureCounts,matchedCount:matched.length,missingCount:missing.length,matched,missing},null,2));
if(unique.length<40)process.exitCode=2;
