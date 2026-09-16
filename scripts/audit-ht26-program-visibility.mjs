#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
const read=async name=>JSON.parse(await readFile(new URL(`../data/HT26/${name}.json`,import.meta.url),'utf8'));
const [programs,structures]=await Promise.all([read('programs'),read('program-structures')]);
const norm=v=>String(v??'').trim().toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const code=v=>String(v??'').trim().toUpperCase();
const id=(university,programCode)=>`${norm(university)}:${code(programCode)}`;
const byKey=new Map(programs.map(p=>[p.key,p]));
const byId=new Map();for(const p of programs){if(!code(p.programCode))continue;const k=id(p.university,p.programCode);if(!byId.has(k))byId.set(k,[]);byId.get(k).push(p)}
const counts={programs:programs.length,structures:structures.length,exactKey:0,uniqueUniversityCode:0,ambiguousUniversityCode:0,unmatched:0,complete:0,verifiedComplete:0};
const samples={unmatched:[],ambiguous:[],complete:[],verifiedComplete:[]};
for(const s of structures){let p=byKey.get(s.key);if(p)counts.exactKey++;else{const candidates=byId.get(id(s.university,s.programCode))||[];if(candidates.length===1){p=candidates[0];counts.uniqueUniversityCode++}else if(candidates.length>1){counts.ambiguousUniversityCode++;if(samples.ambiguous.length<3)samples.ambiguous.push({structure:s.key,programs:candidates.map(x=>x.key)})}else{counts.unmatched++;if(samples.unmatched.length<3)samples.unmatched.push({key:s.key,university:s.university,code:s.programCode})}}const coverage=String(s.coverage||s.structureCoverage||'').toLowerCase();if(coverage==='complete'){counts.complete++;if(samples.complete.length<3)samples.complete.push({key:s.key,source:s.source,verified:s.verified,verification:s.verification,matched:p?.key})}if(coverage==='complete'&&(s.verified===true||s.verification?.status==='verified'||s.verificationStatus==='verified')){counts.verifiedComplete++;if(samples.verifiedComplete.length<3)samples.verifiedComplete.push({key:s.key,matched:p?.key})}}
console.log(JSON.stringify({counts,programExample:programs[0],structureExample:structures[0],samples},null,2));
if(counts.exactKey+counts.uniqueUniversityCode===0)process.exitCode=1;
