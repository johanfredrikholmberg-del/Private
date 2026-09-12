#!/usr/bin/env node
// StudieLots: Borås catalogue reconciliation audit.
// Reads the official HB programme catalogue and local SUSA data without modifying generated data.
// This file is included in the official programme-structures workflow path filters.
import fs from 'node:fs/promises';
const URL='https://www.hb.se/utbildning/program-och-kurser/?lang=sv&types=Programme&userInput=true';
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const norm=s=>clean(s).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const html=await (await fetch(URL,{headers:{'user-agent':'StudieLots-HB-audit/1.0'}})).text();
const rows=[...html.matchAll(/href=["']([^"']*\/utbildning\/program-och-kurser\/program\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m=>({url:new URL(m[1],URL).href,title:clean(m[2].replace(/<[^>]+>/g,' '))}));
const official=[...new Map(rows.filter(x=>x.title).map(x=>[norm(x.title),x])).values()];
const programmes=JSON.parse(await fs.readFile('data/susa/programmes.json','utf8'));
const structures=JSON.parse(await fs.readFile('data/susa/structures.json','utf8'));
const isHb=x=>/högskolan i borås|hogskolan i boras/i.test(JSON.stringify(x));
const hbProgrammes=programmes.filter(isHb), hbStructures=structures.filter(isHb);
const names=x=>[x.programName,x.name,x.title,x.programmeName].filter(Boolean).map(norm);
const matched=[],missing=[];
for(const o of official){const p=hbProgrammes.find(x=>names(x).includes(norm(o.title)));const s=hbStructures.find(x=>names(x).includes(norm(o.title)));(p||s?matched:missing).push({title:o.title,url:o.url,programme:!!p,structure:!!s});}
console.log(JSON.stringify({officialCount:official.length,susaBoråsCount:hbProgrammes.length,structureBoråsCount:hbStructures.length,matchedCount:matched.length,missingCount:missing.length,missing},null,2));
if(official.length!==77)process.exitCode=2;
