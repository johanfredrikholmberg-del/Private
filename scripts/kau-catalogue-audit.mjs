#!/usr/bin/env node
// StudieLots: Karlstads universitet catalogue reconciliation audit.
// Read-only: compares KAU's official programme pages with local SUSA programmes/structures.
// Workflow trigger: KAU baseline audit v1.
import fs from 'node:fs/promises';

const PAGES=[
  {level:'grund',url:'https://www.kau.se/utbildning/program-och-kurser/program/program-pa-grundniva-o'},
  {level:'avancerad',url:'https://www.kau.se/utbildning/program-och-kurser/program/program-pa-avancerad-niva-o'}
];
const clean=s=>String(s??'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&aring;/gi,'å').replace(/&auml;/gi,'ä').replace(/&ouml;/gi,'ö').replace(/&ndash;|&#8211;/gi,'–').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const norm=s=>clean(s).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const canonical=s=>norm(clean(s).replace(/^senare del av[:\s]*/i,'').replace(/\s*[-–|]\s*\d+(?:[,.]\d+)?\s*(?:hp|fup).*$/i,'').replace(/\s+\d+(?:[,.]\d+)?\s*(?:hp|fup)$/i,''));

const official=[];
for(const page of PAGES){
  const r=await fetch(page.url,{headers:{'user-agent':'StudieLots-KAU-audit/1.0'}});
  if(!r.ok)throw new Error(`KAU ${page.level}: HTTP ${r.status}`);
  const html=await r.text();
  const links=[...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  for(const m of links){
    const title=clean(m[2]);
    if(!title||!/\b(?:60|90|120|180|210|240|270|300|330)\s*hp\b/i.test(title))continue;
    const href=new URL(m[1],page.url).href;
    official.push({level:page.level,title,url:href,canonical:canonical(title)});
  }
}
const unique=[...new Map(official.map(x=>[`${x.level}|${x.canonical}`,x])).values()];
const programmes=JSON.parse(await fs.readFile('data/susa/programmes.json','utf8'));
const structures=JSON.parse(await fs.readFile('data/susa/structures.json','utf8'));
const isKau=x=>/karlstads universitet/i.test(String(x.university||''));
const kauProgrammes=programmes.filter(isKau),kauStructures=structures.filter(isKau);
const names=x=>[x.name,x.programName,x.programmeName,x.title].filter(Boolean).map(canonical);
const match=(o,x)=>names(x).includes(o.canonical);
const matched=[],missing=[];
for(const o of unique){
  const p=kauProgrammes.find(x=>match(o,x));
  const s=kauStructures.find(x=>match(o,x));
  (p||s?matched:missing).push({title:o.title,level:o.level,url:o.url,programme:!!p,structure:!!s,programmeCode:p?.code??p?.programCode??null,structureCode:s?.programCode??s?.code??null,coverage:s?.coverage??null});
}
const structureCounts=kauStructures.reduce((a,x)=>(a[x.coverage||'unknown']=(a[x.coverage||'unknown']||0)+1,a),{});
console.log(JSON.stringify({officialExtracted:unique.length,officialGround:unique.filter(x=>x.level==='grund').length,officialAdvanced:unique.filter(x=>x.level==='avancerad').length,susaKarlstadCount:kauProgrammes.length,structureKarlstadCount:kauStructures.length,structureCounts,matchedCount:matched.length,missingCount:missing.length,matched,missing},null,2));
if(unique.length<20)process.exitCode=2;
