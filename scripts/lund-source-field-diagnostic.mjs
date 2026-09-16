#!/usr/bin/env node
import fs from 'node:fs/promises';
const structures=JSON.parse(await fs.readFile('data/lund/structures.json','utf8'));
const queue=JSON.parse(await fs.readFile('data/susa/structure-queue.json','utf8'));
const unresolved=structures.filter(x=>x.coverage==='metadata-only');
const byCode=new Map(queue.filter(x=>String(x.university||'').toLowerCase().includes('lunds universitet')).map(x=>[String(x.programCode||x.code||'').toUpperCase(),x]));
const fields={};const examples=[];
function scan(obj,path='',depth=0){if(depth>5||!obj||typeof obj!=='object')return;for(const [k,v] of Object.entries(obj)){const p=path?path+'.'+k:k;if(typeof v==='string'&&/^https?:\/\//i.test(v)){fields[p]=(fields[p]||0)+1;if(examples.length<15)examples.push({field:p,url:v.slice(0,250)})}else if(v&&typeof v==='object'){if(Array.isArray(v)){for(const item of v.slice(0,5))scan(item,p+'[]',depth+1)}else scan(v,p,depth+1)}}}
let matched=0;for(const x of unresolved){const q=byCode.get(String(x.programCode||'').toUpperCase());if(q){matched++;scan(q,'queue')}scan(x,'structure')}
const report={generatedAt:new Date().toISOString(),unresolved:unresolved.length,matchedQueueByCode:matched,urlFields:fields,examples,officialCatalogue:'https://www.lu.se/studera/kurser-program',note:'Field diagnostic only; no programme status changed.'};
await fs.writeFile('data/lund/source-field-diagnostic.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));