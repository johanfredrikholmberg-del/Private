import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const legacyPath=path.join(root,'data','HT26','program-structures.json');
const dbDir=path.join(root,'data','studielots-db');
const targetName='programme-structures-ht26.json';
const targetPath=path.join(dbDir,targetName);
const manifestPath=path.join(dbDir,'programme-structures-manifest.json');
const dbManifestPath=path.join(dbDir,'manifest.json');

const raw=JSON.parse(await fs.readFile(legacyPath,'utf8'));
const rows=Array.isArray(raw)?raw:(raw.programs||[]);

// Migrate already collected, explicitly verified legacy programme plans into
// the canonical StudieLots DB. These files are migration inputs only.
for(const name of ['program-db.json','program-db-variants.json']){
  const p=path.join(root,'data',name);
  try{
    const legacy=JSON.parse(await fs.readFile(p,'utf8'));
    for(const row of legacy.programs||[]){
      if(row?.verified===true && Array.isArray(row.rows) && row.rows.length){
        rows.push({...row, migrationSource:name});
      }
    }
  }catch(err){
    if(err?.code!=='ENOENT')throw err;
  }
}
if(!rows.length)throw new Error('No programme structures found');

const clean=v=>String(v??'').trim().toLocaleLowerCase('sv-SE');
const key=x=>[
  clean(x.university||x.provider||x.universityName),
  clean(x.programCode||x.code),
  clean(x.programName||x.name),
  clean(x.term||x.startTerm||x.admissionTerm)
].join('|');

const dedup=new Map();
for(const row of rows){
  const k=key(row);
  if(!k.replaceAll('|',''))continue;
  const old=dedup.get(k);
  const score=x=>(x?.courses?.length||x?.rows?.length||0)*100+Object.keys(x||{}).length;
  if(!old||score(row)>score(old))dedup.set(k,row);
}
const programs=[...dedup.values()];
await fs.writeFile(targetPath,JSON.stringify(programs,null,2)+'\n');

const counts={};
for(const p of programs){
  const u=p.university||p.provider||p.universityName||'Unknown';
  counts[u]=(counts[u]||0)+1;
}
const manifest={
  schemaVersion:1,
  generatedAt:new Date().toISOString(),
  kind:'canonical-programme-structure-manifest',
  count:programs.length,
  parts:[targetName],
  universities:Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([university,count])=>({university,count})),
  sourcePolicy:'StudieLots DB is the only runtime source; HT26 is migration input only.'
};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');

const db=JSON.parse(await fs.readFile(dbManifestPath,'utf8'));
db.generatedAt=new Date().toISOString();
db.tables.programmeStructures.rows=programs.length;
await fs.writeFile(dbManifestPath,JSON.stringify(db,null,2)+'\n');

console.log(JSON.stringify({input:rows.length,canonical:programs.length,duplicatesRemoved:rows.length-programs.length,universities:manifest.universities},null,2));
