#!/usr/bin/env node
import fs from 'node:fs/promises';
const TOTAL=Number(process.env.KAU_SHARD_TOTAL||8);
const all=[];
for(let i=0;i<TOTAL;i++){
  const rows=JSON.parse(await fs.readFile(`data/kau/shard-${i}.json`,'utf8'));
  all.push(...rows);
}
const byCode=new Map(all.map(x=>[String(x.programCode||'').toUpperCase(),x]));
if(byCode.size!==134) throw new Error(`Expected 134 unique KAU programmes, got ${byCode.size}`);
const fresh=[...byCode.values()].sort((a,b)=>String(a.programCode).localeCompare(String(b.programCode),'sv'));
let old=[];try{old=JSON.parse(await fs.readFile('data/susa/structures.json','utf8'))}catch{}
const withoutKau=old.filter(x=>!/karlstads universitet/i.test(String(x.university||'')));
await fs.writeFile('data/susa/structures.json',JSON.stringify([...withoutKau,...fresh],null,2)+'\n');
const counts=fresh.reduce((a,x)=>(a[x.coverage]=(a[x.coverage]||0)+1,a),{});
const meta={generatedAt:new Date().toISOString(),officialProgrammes:134,processed:134,counts,underPlanning:fresh.filter(x=>x.underPlanning).length,withParsedRows:fresh.filter(x=>(x.rawRows||0)>0).length,shards:TOTAL,policy:'All official KAU programmes are accounted for. Complete/choice-required only when official published terms reconcile to target hp.'};
await fs.writeFile('data/kau/structure-meta.json',JSON.stringify(meta,null,2)+'\n');
console.log(JSON.stringify(meta,null,2));
