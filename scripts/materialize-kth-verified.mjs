#!/usr/bin/env node
// Merge only complete official KTH plans; preserve every existing DB shard.
import fs from 'node:fs';
const dir='data/studielots-db/',read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const db=read(dir+'manifest.json'),manifest=read(db.tables.programmeStructures.storageManifest);
const identities=read(db.tables.programmes.storage).filter(x=>x.providerId==='p.uoh.kth');
const byCode=new Map(identities.map(x=>[x.programCode,x]));
const current=manifest.parts.flatMap(name=>{const x=read(dir+name);return Array.isArray(x)?x:x.programs});
// Shards are authoritative. Repair stale aggregate counters before appending.
manifest.count=current.length;
const counts=new Map();
for(const p of current){const u=String(p.university||'').trim();if(u)counts.set(u,(counts.get(u)||0)+1)}
manifest.universities=[...counts.entries()].map(([university,count])=>({university,count}));
const known=new Set(current.filter(x=>/kth|kungl\.? tekniska/i.test(x.university||'')).map(x=>x.programCode));
const source=read('data/HT26/program-structures.json');
const accepted=[];
for(const p of source.filter(x=>x.university==='KTH'&&Array.isArray(x.courses)&&x.courses.length)){
  const identity=byCode.get(p.programCode);
  if(!identity||known.has(p.programCode))continue;
  const terms=Number(identity.programHp)/30,quality=p.quality||{};
  if(!Number.isInteger(terms)||quality.complete!==true||quality.expectedTerms!==terms||!p.sourceUrls?.every(x=>/^https:\/\/www\.kth\.se\//.test(x)))continue;
  const rows=p.courses.map(x=>({term:Number(x.term),code:x.code,name:x.name,hp:Number(x.hp),category:x.category||x.programmeCategory||'unknown'}));
  if(rows.some(x=>!x.code||!x.name||!(x.hp>0)||x.term<1||x.term>terms))continue;
  // Do not require exactly 30 listed HP per term: KTH programme plans may publish
  // alternative/elective choice sets whose combined HP exceeds 30. quality.complete
  // already guarantees official allocation coverage for every programme term.
  accepted.push({id:`kth:${p.programCode}:2026HT`,key:`kungl-tekniska-hogskolan:${p.programCode}`,university:identity.university,programCode:p.programCode,programName:identity.programName,programHp:identity.programHp,hp:identity.programHp,validFrom:'2026HT',coverage:'complete-semester-sequence',verified:true,source:'kth-official-programplan',sourceEvidenceUrl:p.sourceUrls[0],sourceUrls:p.sourceUrls,rows});
  known.add(p.programCode);
}
const target='programme-structures-kth-verified.json';
if(process.argv.includes('--write')&&accepted.length){
  const old=fs.existsSync(dir+target)?read(dir+target):{schemaVersion:1,programs:[]};
  const merged=[...old.programs,...accepted];
  fs.writeFileSync(dir+target,JSON.stringify({...old,programs:merged},null,2)+'\n');
  if(!manifest.parts.includes(target))manifest.parts.push(target);
  manifest.count+=accepted.length;
  const university='Kungl. Tekniska högskolan',u=manifest.universities.find(x=>x.university===university);
  if(u)u.count+=accepted.length;else manifest.universities.push({university,count:accepted.length});
  db.tables.programmeStructures.rows=manifest.count;
  fs.writeFileSync(dir+'programme-structures-manifest.json',JSON.stringify(manifest,null,2)+'\n');
  fs.writeFileSync(dir+'manifest.json',JSON.stringify(db,null,2)+'\n');
}
console.log(JSON.stringify({candidates:source.filter(x=>x.university==='KTH'&&x.courses?.length).length,accepted:accepted.map(x=>x.programCode),existing:current.length,after:current.length+accepted.length}));
