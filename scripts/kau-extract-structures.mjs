#!/usr/bin/env node
import fs from 'node:fs/promises';

const rows=JSON.parse(await fs.readFile('data/susa/structures.json','utf8'));
const kau=rows.filter(x=>/karlstads universitet/i.test(String(x.university||'')))
  .sort((a,b)=>String(a.programCode||'').localeCompare(String(b.programCode||''),'sv'));
if(kau.length!==134)throw new Error(`Expected 134 Karlstad programme structures, got ${kau.length}`);
await fs.mkdir('data/kau',{recursive:true});
await fs.writeFile('data/kau/structures.json',JSON.stringify(kau,null,2)+'\n');
console.log(JSON.stringify({programStructures:kau.length,counts:kau.reduce((a,x)=>(a[x.coverage||'metadata-only']=(a[x.coverage||'metadata-only']||0)+1,a),{})},null,2));
