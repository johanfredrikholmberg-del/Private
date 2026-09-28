#!/usr/bin/env node
// Imports previously collected, complete official GU plans into the single
// canonical programme-structure table. Dry-run by default; conflict fails closed.
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const base='data/studielots-db/';
const manifestPath=base+'programme-structures-manifest.json';
const manifest=read(manifestPath);
const parts=manifest.parts.map(p=>read(base+p));
const existing=parts.flatMap(x=>x.programs||[]);
const db=read(base+'manifest.json');
const programmes=read(db.tables.programmes.storage);
const candidates=read('data/HT26/program-structures.json').filter(x=>x.university==='Göteborgs universitet'&&x.coverage==='complete'&&x.reason==='official-gu-complete-term-sequence');
const normalize=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const key=p=>normalize(p.university)+'|'+String(p.programCode||'').toUpperCase();
const current=new Set(existing.map(key));
const accepted=[];
for(const item of candidates){
  if(current.has(key(item)))continue;
  const match=programmes.filter(x=>key(x)===key(item));
  if(match.length!==1||Number(match[0].programHp)!==Number(item.hp))throw Error(`Programme identity or credit conflict: ${item.programCode}`);
  if(!/^https:\/\/www\.gu\.se\//.test(item.sourceUrl)||!Array.isArray(item.rows))throw Error(`Missing official source: ${item.programCode}`);
  const terms=Number(item.hp)/30;
  if(!Number.isInteger(terms))throw Error(`Invalid programme credits: ${item.programCode}`);
  for(let term=1;term<=terms;term++){
    const rows=item.rows.filter(x=>Number(x.term)===term);
    if(!rows.length||Math.abs(rows.reduce((n,x)=>n+Number(x.hp),0)-30)>.001)throw Error(`Incomplete term ${term}: ${item.programCode}`);
    if(rows.some(x=>!x.code||!x.name||!(Number(x.hp)>0)))throw Error(`Invalid course reference: ${item.programCode}`);
  }
  if(item.rows.some(x=>Number(x.term)>terms))throw Error(`Unexpected term: ${item.programCode}`);
  accepted.push({id:`gu:${item.programCode}:2026HT`,key:match[0].key,university:item.university,programCode:item.programCode,programName:item.programName,programHp:item.hp,hp:item.hp,level:match[0].level||'',validFrom:'2026HT',coverage:'complete',verified:true,source:item.source,sourceEvidenceUrl:item.sourceUrl,sourceUrls:item.sourceUrls,rows:item.rows});
  current.add(key(item));
}
const result={guCandidates:candidates.length,existing:existing.length,accepted:accepted.map(x=>x.programCode),after:existing.length+accepted.length};
if(process.argv.includes('--write')&&accepted.length){
  const target=base+manifest.parts.at(-1),last=parts.at(-1);
  const merged={...last,programs:[...last.programs,...accepted]};
  const next={...manifest,count:result.after,universities:manifest.universities.map(x=>x.university==='Göteborgs universitet'?{...x,count:x.count+accepted.length}:x)};
  // Write new data first; the manifest is the final activation step.
  fs.writeFileSync(target+'.tmp',JSON.stringify(merged,null,2)+'\n');
  if(read(target+'.tmp').programs.length!==merged.programs.length)throw Error('Verification failed');
  fs.renameSync(target+'.tmp',target);
  fs.writeFileSync(manifestPath+'.tmp',JSON.stringify(next,null,2)+'\n');
  if(read(manifestPath+'.tmp').count!==result.after)throw Error('Manifest verification failed');
  fs.renameSync(manifestPath+'.tmp',manifestPath);
}
console.log(JSON.stringify(result));
