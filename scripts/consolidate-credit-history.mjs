#!/usr/bin/env node
// Reproducible, conflict-aware migration of legacy evidence into StudieLots DB.
import fs from 'node:fs';
import path from 'node:path';

const root='data/studielots-db';
const manifestPath=`${root}/manifest.json`;
const target=`${root}/credit-transfer-evidence.json`;
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const sources=manifest.historicalCreditTransferSources||[];
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const existing=fs.existsSync(target)?read(target):[];
if(!Array.isArray(existing))throw Error('Evidence table must be an array');
const rows=new Map();
const identity=x=>String(x.id||'').trim();
const signature=x=>JSON.stringify(x);
for(const row of existing){
  const id=identity(row);
  if(!id||rows.has(id))throw Error(`Duplicate or missing existing evidence ID: ${id}`);
  rows.set(id,row);
}
let added=0,duplicates=0;
for(const source of sources){
  const batch=read(source);
  if(!Array.isArray(batch))throw Error(`Invalid source: ${source}`);
  for(const row of batch){
    const id=identity(row);
    if(!id||!row.university||!row.targetCode||row.decision!=='approved')throw Error(`Unverified evidence: ${source} ${id}`);
    const prior=rows.get(id);
    if(prior){
      if(signature(prior)!==signature(row))throw Error(`Evidence conflict: ${id}`);
      duplicates++;
    }else{rows.set(id,row);added++;}
  }
}
const output=[...rows.values()];
const report={existing:existing.length,sources:sources.length,added,duplicates,total:output.length};
if(process.argv.includes('--write')){
  const tmp=path.join(root,`.credit-transfer-evidence-${process.pid}.tmp`);
  fs.writeFileSync(tmp,JSON.stringify(output)+'\n',{flag:'wx'});
  if(read(tmp).length!==output.length){fs.unlinkSync(tmp);throw Error('Write verification failed');}
  fs.renameSync(tmp,target);
  manifest.tables.creditTransferEvidence={storage:target,rows:output.length};
  const manifestTmp=path.join(root,`.manifest-${process.pid}.tmp`);
  fs.writeFileSync(manifestTmp,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  fs.renameSync(manifestTmp,manifestPath);
}
console.log(JSON.stringify(report));
