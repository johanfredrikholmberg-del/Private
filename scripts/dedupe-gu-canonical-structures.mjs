#!/usr/bin/env node
// Collapse GU placeholders duplicated by an already verified canonical plan.
import fs from 'node:fs';
const base='data/studielots-db/',read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const db=read(base+'manifest.json'),manifest=read(db.tables.programmeStructures.storageManifest);
if(db.database!=='StudieLots DB'||manifest.parts[0]!=='programme-structures-ht26.json')throw Error('Unexpected canonical storage');
const path=base+manifest.parts[0],rows=read(path);
if(!Array.isArray(rows))throw Error('Unexpected primary structure shard');
const byCode=new Map();
for(const [i,row] of rows.entries())if(row.university==='Göteborgs universitet'){
  const code=String(row.programCode||'').trim(),group=byCode.get(code)||[];
  group.push({i,row});byCode.set(code,group);
}
const compact=x=>(x.rows||[]).map(r=>[Number(r.term),String(r.code||''),String(r.name||''),Number(r.hp)]);
const replacement=new Map(),remove=new Set(),merged=[];
for(const [code,group] of byCode){
  if(group.length===1)continue;
  const good=group.filter(x=>x.row.verified===true&&x.row.rows?.length);
  if(group.length!==2||good.length!==1)throw Error('Ambiguous duplicate GU code: '+code);
  const verified=good[0],other=group.find(x=>x!==verified);
  if(other.row.verified===true||Number(other.row.hp)!==Number(verified.row.programHp||verified.row.hp)||
    (other.row.rows?.length&&JSON.stringify(compact(other.row))!==JSON.stringify(compact(verified.row))))throw Error('Conflicting GU structures: '+code);
  const source=verified.row.sourceEvidenceUrl||verified.row.sourceUrls?.find(u=>/^https:\/\/www\.gu\.se\//.test(u))||other.row.sourceUrl;
  if(!/^https:\/\/www\.gu\.se\//.test(source)||!other.row.key)throw Error('Missing GU identity/source: '+code);
  replacement.set(other.i,{...other.row,...verified.row,key:other.row.key,hp:Number(other.row.hp),programHp:Number(other.row.hp),sourceUrl:source,sourceEvidenceUrl:source});
  remove.add(verified.i);merged.push(code);
}
const next=rows.flatMap((row,i)=>remove.has(i)?[]:[replacement.get(i)||row]);
if(next.length!==rows.length-merged.length)throw Error('GU deduplication count mismatch');
const report={generatedAt:new Date().toISOString(),merged,canonicalBefore:manifest.count,canonicalAfter:manifest.count-merged.length};
if(process.argv.includes('--write')&&merged.length){
  fs.writeFileSync(path,JSON.stringify(next,null,2)+'\n');
  manifest.count-=merged.length;
  manifest.universities.find(x=>x.university==='Göteborgs universitet').count-=merged.length;
  db.tables.programmeStructures.rows=manifest.count;
  fs.writeFileSync(base+'programme-structures-manifest.json',JSON.stringify(manifest,null,2)+'\n');
  fs.writeFileSync(base+'manifest.json',JSON.stringify(db,null,2)+'\n');
}
fs.mkdirSync('data/import-reviews',{recursive:true});
fs.writeFileSync('data/import-reviews/gu-canonical-deduplication.json',JSON.stringify(report,null,2)+'\n');
console.log(report);
