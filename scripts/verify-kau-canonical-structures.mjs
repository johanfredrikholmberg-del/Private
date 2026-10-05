#!/usr/bin/env node
// Promote only internally reconciled, source-backed KAU plans in StudieLots DB.
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const base='data/studielots-db/',db=read(base+'manifest.json');
const manifest=read(db.tables.programmeStructures.storageManifest);
const primary=base+manifest.parts[0],data=read(primary),rows=Array.isArray(data)?data:data.programs;
if(db.database!=='StudieLots DB'||!Array.isArray(rows)||rows.length<1)throw Error('Unexpected canonical structure storage');
const identities=[db.tables.programmes.storage,...(db.tables.programmes.additionalStorages||[])].flatMap(read);
const byCode=new Map();
for(const p of identities.filter(x=>x.university==='Karlstads universitet')){
 const code=String(p.programCode||'').toUpperCase(),a=byCode.get(code)||[];a.push(p);byCode.set(code,a);
}
const accepted=[],review=[];
for(const p of rows.filter(x=>x.university==='Karlstads universitet')){
 const reasons=[],identity=(byCode.get(String(p.programCode||'').toUpperCase())||[]).filter(x=>Number(x.programHp)===Number(p.hp));
 if(!['complete','choice-required'].includes(p.coverage))reasons.push('incomplete-coverage');
 if(identity.length!==1)reasons.push('programme-identity-or-credit-conflict');
 if(!/^https:\/\/(www\.|www3\.)kau\.se\//.test(p.sourceUrl||''))reasons.push('official-source-missing');
 const terms=Number(p.expectedTerms),credits=Number(p.hp),complete=p.completeTerms||[];
 if(!Number.isInteger(terms)||terms<1||Math.ceil(credits/30)!==terms||complete.length!==terms)reasons.push('term-coverage');
 const plan=Array.isArray(p.rows)?p.rows:[];
 if(!plan.length||plan.some(r=>!r.name||!(Number(r.hp)>0)||(!r.isSlot&&!r.code)))reasons.push('course-reference');
 if(!reasons.length)for(let t=1;t<=terms;t++){
   const target=t<terms?30:credits-30*(terms-1);
   const load=plan.reduce((n,r)=>{const first=Number(r.term),last=Number(r.endTerm||r.term);if(t<first||t>last)return n;return n+Number(r.hp)/(last-first+1)},0);if(!complete.includes(t)||Math.abs(load-target)>.2){reasons.push('term-credit-balance');break}
 }
 if(reasons.length){review.push({code:p.programCode,reasons});continue}
 accepted.push(p.programCode);
}
if(!accepted.length)throw Error('No KAU programme plan passed verification');
if(process.argv.includes('--write')){
 const codes=new Set(accepted);
 const next=rows.map(p=>p.university==='Karlstads universitet'&&codes.has(p.programCode)?{
  ...p,verified:true,courseCodesVerified:true,sourceEvidenceUrl:p.sourceUrl,verifiedAt:new Date().toISOString()
 }:p);
 fs.writeFileSync(primary,JSON.stringify(Array.isArray(data)?next:{...data,programs:next},null,2)+'\n');
}
fs.mkdirSync('data/import-reviews',{recursive:true});
fs.writeFileSync('data/import-reviews/kau-canonical-structure-verification.json',JSON.stringify({generatedAt:new Date().toISOString(),database:db.database,canonicalCount:manifest.count,accepted,review},null,2)+'\n');
console.log(JSON.stringify({accepted:accepted.length,review:review.length,codes:accepted}));
