#!/usr/bin/env node
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const norm=v=>String(v??'').toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const raw=read('data/susa/programmes.json');
const rows=Array.isArray(raw)?raw:(raw.programmes||raw.items||raw.data||[]);
const candidates=rows.filter(x=>/linkopings universitet|linkoping university/.test(norm(JSON.stringify(x))));
const base='data/studielots-db/';
const m=read(base+'programme-structures-manifest.json');
const structures=m.parts.flatMap(p=>{const x=read(base+p);return Array.isArray(x)?x:(x.programs||[])});
const canonical=structures.filter(x=>/linkopings universitet|linkoping university/.test(norm(x.university)));
const report={generatedAt:new Date().toISOString(),university:'Linköpings universitet',catalogueCandidates:candidates.length,canonicalStructures:canonical.length,verifiedCanonical:canonical.filter(x=>x.verified===true).length,status:'candidate-inventory',policy:'Only verified programme structures may be promoted to StudieLots DB.'};
fs.mkdirSync('data/import-reviews',{recursive:true});
fs.writeFileSync('data/import-reviews/linkoping-import-latest.json',JSON.stringify(report,null,2)+'\n');
fs.writeFileSync('data/import-reviews/linkoping-programme-candidates.json',JSON.stringify(candidates,null,2)+'\n');
console.log(JSON.stringify(report));
