#!/usr/bin/env node
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const root='data/studielots-db/';
const manifest=read(root+'programme-structures-manifest.json');
const db=read(root+'manifest.json');
const all=manifest.parts.flatMap(p=>read(root+p).programs);
const identities=[db.tables.programmes.storage,...(db.tables.programmes.additionalStorages||[])].flatMap(read);
if(all.length!==manifest.count||db.tables.programmeStructures.rows!==all.length)throw Error('Structure table count mismatch');
const checked=[];
for(const code of ['S2EUM','S1EUR','S2SPE','S2IAG']){
 const matches=all.filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
 const identity=identities.filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
 if(matches.length!==1||identity.length!==1||matches[0].programHp!==identity[0].programHp)throw Error(`Identity mismatch: ${code}`);
 const p=matches[0];
 for(let t=1;t<=p.programHp/30;t++){
  const rows=p.rows.filter(x=>x.term===t);
  if(!rows.length||rows.reduce((n,x)=>n+x.hp,0)!==30)throw Error(`Term credits: ${code}/${t}`);
  for(const x of rows)if((x.options||[]).some(o=>o.hp!==x.hp))throw Error(`Alternative cannot represent whole slot: ${code}/${t}`);
 }
 if(!p.sourceEvidenceUrl.startsWith('https://www.gu.se/'))throw Error(`Invalid source: ${code}`);
 const response=await fetch(p.sourceEvidenceUrl,{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error(`Official GU source unavailable: ${code} ${response.status}`);
 const html=await response.text();
 for(const x of p.rows)if(x.code&&!html.includes(x.code))throw Error(`GU source no longer lists ${code}/${x.code}`);
 checked.push(code);
}
if(all.filter(x=>x.university==='Göteborgs universitet').length!==manifest.universities.find(x=>x.university==='Göteborgs universitet').count)throw Error('GU count mismatch');
console.log(JSON.stringify({checked,total:all.length,gu:manifest.universities.find(x=>x.university==='Göteborgs universitet').count}));
