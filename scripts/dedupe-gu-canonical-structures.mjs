#!/usr/bin/env node
// Collapse GU placeholders duplicated by an already verified canonical plan across all canonical shards.
import fs from 'node:fs';
const base='data/studielots-db/',read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const db=read(base+'manifest.json'),manifest=read(db.tables.programmeStructures.storageManifest);
if(db.database!=='StudieLots DB'||manifest.parts[0]!=='programme-structures-ht26.json')throw Error('Unexpected canonical storage');
const shards=manifest.parts.map(part=>({part,path:base+part,rows:read(base+part)}));
for(const s of shards){if(!Array.isArray(s.rows))s.rows=s.rows.programs;if(!Array.isArray(s.rows))throw Error('Unexpected structure shard: '+s.part)}
const byCode=new Map();
for(const [si,s] of shards.entries())for(const [ri,row] of s.rows.entries())if(row.university==='Göteborgs universitet'){
  const code=String(row.programCode||'').trim();if(!code)continue;
  const group=byCode.get(code)||[];group.push({si,ri,row});byCode.set(code,group);
}
const compact=x=>(x.rows||[]).map(r=>[Number(r.term),String(r.code||''),String(r.name||''),Number(r.hp)]);
const remove=new Set(),merged=[];
for(const [code,group] of byCode){
  if(group.length===1)continue;
  const good=group.filter(x=>x.row.verified===true&&x.row.rows?.length);
  const plannerReady=good.filter(x=>x.row.coverage==='complete'&&String(x.row.sourceEvidenceUrl||'').startsWith('https://'));
  // Prefer the sole verified Planner-ready structure (including explicit branch
  // groups) over verified partial/choice-required imports. Never guess between
  // multiple complete plans.
  const candidates=plannerReady.length===1?plannerReady:good;
  if(candidates.length!==1)throw Error('Ambiguous duplicate GU code: '+code);
  const keep=candidates[0];
  for(const other of group){
    if(other===keep)continue;
    if(other.row.verified===true){
      const ohp=Number(other.row.programHp||other.row.hp),khp=Number(keep.row.programHp||keep.row.hp);
      if(ohp&&khp&&ohp!==khp)throw Error('Conflicting GU programme hp: '+code);
      if(keep.row.coverage!=='complete')throw Error('Conflicting verified GU structures: '+code);
    }
    const ohp=Number(other.row.programHp||other.row.hp),khp=Number(keep.row.programHp||keep.row.hp);
    if(ohp&&khp&&ohp!==khp)throw Error('Conflicting GU programme hp: '+code);
    // A verified source-backed plan supersedes older unverified/placeholder rows.
    // Differing placeholder rows are expected during migration and must not block
    // canonical deduplication; conflicting *verified* rows are still rejected above.
    remove.add(other.si+':'+other.ri);
  }
  merged.push(code);
}
let removed=0;
for(const [si,s] of shards.entries()){
  const next=s.rows.filter((_,ri)=>!remove.has(si+':'+ri));removed+=s.rows.length-next.length;
  if(process.argv.includes('--write')&&next.length!==s.rows.length)fs.writeFileSync(s.path,JSON.stringify(next,null,2)+'\n');
}
const before=shards.reduce((n,s)=>n+s.rows.length,0),after=before-removed;
const report={generatedAt:new Date().toISOString(),merged,removed,canonicalBefore:before,canonicalAfter:after};
if(process.argv.includes('--write')&&removed){
  manifest.count=after;
  const guCount=shards.reduce((n,s,si)=>n+s.rows.filter((r,ri)=>r.university==='Göteborgs universitet'&&!remove.has(si+':'+ri)).length,0);
  const gu=manifest.universities.find(x=>x.university==='Göteborgs universitet');if(gu)gu.count=guCount;
  db.tables.programmeStructures.rows=after;
  fs.writeFileSync(base+'programme-structures-manifest.json',JSON.stringify(manifest,null,2)+'\n');
  fs.writeFileSync(base+'manifest.json',JSON.stringify(db,null,2)+'\n');
}
fs.mkdirSync('data/import-reviews',{recursive:true});
fs.writeFileSync('data/import-reviews/gu-canonical-deduplication.json',JSON.stringify(report,null,2)+'\n');
console.log(report);
