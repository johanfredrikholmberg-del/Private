#!/usr/bin/env node
// Activate previously verified GU structures in the canonical StudieLots DB.
import fs from 'node:fs';
const dir='data/studielots-db/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const db=read(dir+'manifest.json');
const manifest=read(db.tables.programmeStructures.storageManifest);
const identities=[db.tables.programmes.storage,...(db.tables.programmes.additionalStorages||[])].flatMap(read);
const sources=['programme-structures-gu-2027.json','programme-structures-gu-batch-3.json','programme-structures-gu-batch-4.json','programme-structures-gu-next.json'];
const verified=sources.flatMap(name=>read(dir+name).programs);
const identity=new Map(identities.filter(x=>x.university==='Göteborgs universitet').map(x=>[x.programCode,x]));
const byCode=new Map();
for(const item of verified){
  const id=identity.get(item.programCode);
  if(!id||id.key!==item.key||Number(id.programHp)!==Number(item.programHp))throw Error('GU identity conflict: '+item.programCode);
  if(byCode.has(item.programCode)||item.verified!==true||!/^https:\/\/www\.gu\.se\//.test(item.sourceEvidenceUrl||''))throw Error('GU provenance conflict: '+item.programCode);
  const terms=Number(item.programHp)/30;
  if(!Number.isInteger(terms)||!Array.isArray(item.rows))throw Error('GU term count: '+item.programCode);
  for(let t=1;t<=terms;t++)if(Math.abs(item.rows.filter(r=>r.term===t).reduce((n,r)=>n+Number(r.hp),0)-30)>.001)throw Error(`GU credits: ${item.programCode} term ${t}`);
  byCode.set(item.programCode,item);
}
const parts=manifest.parts.map(name=>({name,rows:read(dir+name)}));
const present=new Map(parts.flatMap(part=>(Array.isArray(part.rows)?part.rows:part.rows.programs).map(x=>[x.programCode,x])));
const replaced=[],added=[];
for(const [code,item] of byCode){
  const current=present.get(code);
  if(current?.verified){
    if(JSON.stringify(current.rows)!==JSON.stringify(item.rows)){
      const higherCoverage=current.coverage==='complete'&&item.coverage==='choice-required'
        &&Number(current.programHp)===Number(item.programHp)
        &&current.sourceEvidenceUrl===item.sourceEvidenceUrl
        &&Array.isArray(current.rows)&&current.rows.length>0;
      if(!higherCoverage)throw Error('Existing verified GU structure differs: '+code);
    }
    continue;
  }
  if(current){
    if(current.university!=='Göteborgs universitet'||current.rows?.length)throw Error('Cannot replace non-metadata GU structure: '+code);
    replaced.push(code);
  }else added.push(code);
}
const result={sources:sources.length,verified:verified.length,replaced,added};
if(process.argv.includes('--write')&&(replaced.length||added.length)){
  // The main canonical shard holds metadata-only placeholders. Replace only those.
  const first=parts[0];
  const firstRows=Array.isArray(first.rows)?first.rows:first.rows.programs;
  if(replaced.some(code=>!firstRows.some(x=>x.programCode===code)))throw Error('Replacement outside canonical shard');
  const updated=firstRows.map(x=>replaced.includes(x.programCode)?{...byCode.get(x.programCode),key:x.key}:x);
  updated.push(...added.map(code=>({...byCode.get(code),key:`goteborgs-universitet:${code}`})));
  const target=dir+first.name;
  fs.writeFileSync(target+'.tmp',JSON.stringify(Array.isArray(first.rows)?updated:{...first.rows,programs:updated},null,2)+'\n');
  if((Array.isArray(read(target+'.tmp'))?read(target+'.tmp'):read(target+'.tmp').programs).length!==updated.length)throw Error('GU write verification failed');
  fs.renameSync(target+'.tmp',target);
  manifest.count+=added.length;
  manifest.universities.find(x=>x.university==='Göteborgs universitet').count+=added.length;
  db.tables.programmeStructures.rows=manifest.count;
  fs.writeFileSync(dir+'programme-structures-manifest.json',JSON.stringify(manifest,null,2)+'\n');
  fs.writeFileSync(dir+'manifest.json',JSON.stringify(db,null,2)+'\n');
}
console.log(JSON.stringify(result));
