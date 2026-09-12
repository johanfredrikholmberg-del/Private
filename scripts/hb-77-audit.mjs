#!/usr/bin/env node
// StudieLots: Borås catalogue reconciliation audit.
// Reads the official HB programme catalogue and local SUSA data without modifying generated data.
import fs from 'node:fs/promises';
const CATALOGUE_URL='https://www.hb.se/utbildning/program-och-kurser/?lang=sv&types=Programme&userInput=true';
const decode=s=>String(s??'').replace(/&shy;|&#173;/gi,'').replace(/&amp;/gi,'&').replace(/&ndash;|&#8211;/gi,'–').replace(/&mdash;|&#8212;/gi,'—').replace(/&aring;/gi,'å').replace(/&auml;/gi,'ä').replace(/&ouml;/gi,'ö').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
const clean=s=>decode(s).replace(/\s+/g,' ').trim();
const norm=s=>clean(s).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const canonicalName=s=>norm(clean(s).replace(/^senare del av program\s*,?\s*/i,'').replace(/\s*\|\s*[\d,.]+\s*hp\s*\|\s*[A-ZÅÄÖ0-9]+\s*$/i,''));
const html=await (await fetch(CATALOGUE_URL,{headers:{'user-agent':'StudieLots-HB-audit/1.2'}})).text();
const rows=[...html.matchAll(/href=["']([^"']*\/utbildning\/program-och-kurser\/program\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m=>({url:new globalThis.URL(m[1],CATALOGUE_URL).href,title:clean(m[2].replace(/<[^>]+>/g,' '))})).filter(x=>x.title);
const official=[...new Map(rows.map(x=>[`${norm(x.title)}|${x.url}`,x])).values()];
const programmes=JSON.parse(await fs.readFile('data/susa/programmes.json','utf8'));
const structures=JSON.parse(await fs.readFile('data/susa/structures.json','utf8'));
const isHb=x=>/högskolan i borås|hogskolan i boras/i.test(JSON.stringify(x));
const hbProgrammes=programmes.filter(isHb), hbStructures=structures.filter(isHb);
const names=x=>[x.programName,x.name,x.title,x.programmeName].filter(Boolean).flatMap(v=>[norm(v),canonicalName(v)]);
const urls=x=>[x.url,x.programUrl,x.sourceUrl,...(Array.isArray(x.sourceUrls)?x.sourceUrls:[])].filter(Boolean).map(String);
const match=(o,x)=>urls(x).some(u=>u===o.url)||names(x).includes(norm(o.title))||names(x).includes(canonicalName(o.title));
const matched=[],missing=[];
for(const o of official){const p=hbProgrammes.find(x=>match(o,x));const s=hbStructures.find(x=>match(o,x));(p||s?matched:missing).push({title:o.title,url:o.url,programme:!!p,structure:!!s,programmeCode:p?.programCode??p?.code??null,structureCode:s?.programCode??s?.code??null});}
const uniqueUrls=new Set(official.map(x=>x.url));
console.log(JSON.stringify({catalogueLabelCount:77,extractedDisplayItems:official.length,uniqueProgrammePages:uniqueUrls.size,susaBoråsCount:hbProgrammes.length,structureBoråsCount:hbStructures.length,matchedCount:matched.length,missingCount:missing.length,matched,missing},null,2));
if(official.length<75||official.length>77)process.exitCode=2;
