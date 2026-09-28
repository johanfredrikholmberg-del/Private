#!/usr/bin/env node
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const base='data/studielots-db/';
const db=read(base+'manifest.json'),manifest=read(base+'programme-structures-manifest.json');
const structures=manifest.parts.flatMap(p=>read(base+p).programs);
const identities=[db.tables.programmes.storage,...(db.tables.programmes.additionalStorages||[])].flatMap(read);
const codes=['N1FAR','M2PHP','S2IAM','S2PSM'];
if(structures.length!==manifest.count||db.tables.programmeStructures.rows!==manifest.count)throw Error('Canonical row-count mismatch');
if(structures.filter(x=>x.university==='Göteborgs universitet').length!==manifest.universities.find(x=>x.university==='Göteborgs universitet').count)throw Error('GU structure count mismatch');
for(const code of codes){
 const matches=structures.filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
 const identity=identities.filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
 if(matches.length!==1||identity.length!==1||matches[0].programHp!==identity[0].programHp)throw Error(`Canonical identity conflict: ${code}`);
 const structure=matches[0];
 for(let term=1;term<=structure.programHp/30;term++){
  const rows=structure.rows.filter(x=>x.term===term);
  if(!rows.length||rows.reduce((n,x)=>n+x.hp,0)!==30)throw Error(`Wrong term credits: ${code}/${term}`);
 }
 if(!structure.sourceEvidenceUrl.startsWith('https://www.gu.se/'))throw Error(`Non-GU source: ${code}`);
 const response=await fetch(structure.sourceEvidenceUrl,{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error(`GU source unavailable for ${code}: ${response.status}`);
 const html=await response.text();
 for(const row of structure.rows)if(row.code&&!html.includes(row.code))throw Error(`Source no longer lists ${code}/${row.code}`);
}
console.log(JSON.stringify({checked:codes,structures:structures.length,gu:structures.filter(x=>x.university==='Göteborgs universitet').length}));
