#!/usr/bin/env node
/** Read-only audit of the exact completeness rules used by api/program-index.js.
 * Run from the repository root: node scripts/audit-ht26-search-readiness.mjs
 * Never writes to canonical data or treats a source's complete flag as proof.
 */
import {readFileSync} from 'node:fs';
const read=name=>JSON.parse(readFileSync(`data/HT26/${name}.json`,'utf8'));
const programs=read('programs'),structures=read('program-structures');
const norm=v=>String(v??'').trim().toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const code=v=>String(v??'').trim().toUpperCase();
const identity=(university,programCode)=>`${norm(university)}:${code(programCode)}`;
const byKey=new Map(programs.map(p=>[p.key,p])),byIdentity=new Map();
for(const p of programs){if(!code(p.programCode))continue;const id=identity(p.university,p.programCode);byIdentity.set(id,[...(byIdentity.get(id)||[]),p]);}
function full(s,p){const rows=s.rows,total=Number(p.programHp);if(!Number.isFinite(total)||total<=0||!Array.isArray(rows)||!rows.length)return false;const terms=new Set();let credits=0;for(const r of rows){const term=Number(r.term),hp=Number(r.hp);if(!Number.isInteger(term)||term<1||!Number.isFinite(hp)||hp<=0||!(r.name||r.code))return false;terms.add(term);credits+=hp;}if(Math.abs(credits-total)>.01)return false;const last=Math.max(...terms);return Number.isFinite(last)&&last<=Math.ceil(total/30)+2&&Array.from({length:last},(_,i)=>i+1).every(t=>terms.has(t));}
const reasons={},eligible=new Map(),conflicts=new Set();
const reject=reason=>{reasons[reason]=(reasons[reason]||0)+1;};
for(const s of structures){
 if(String(s.coverage||s.structureCoverage||'').toLowerCase()!=='complete'){reject('notMarkedComplete');continue;}
 const evidence=s.sourceEvidenceUrl||s.sourceUrl||s.sourceUrls?.[0];if(!/^https:\/\//i.test(String(evidence||''))){reject('missingHttpsEvidence');continue;}
 const exact=byKey.get(s.key),matches=exact?[exact]:(byIdentity.get(identity(s.university,s.programCode))||[]);
 if(matches.length!==1){reject('missingOrAmbiguousProgramIdentity');continue;}
 const p=matches[0];if(Number(s.hp)>0&&Number(p.programHp)>0&&Math.abs(Number(s.hp)-Number(p.programHp))>.01){reject('structureHpMismatch');continue;}
 if(!full(s,p)){reject('incompleteTermsOrCredits');continue;}
 if(eligible.has(p.key)){conflicts.add(p.key);reject('duplicateEligibleStructure');continue;}
 eligible.set(p.key,s);
}
for(const key of conflicts)eligible.delete(key);
const searchable=programs.filter(p=>p.university&&(p.programName||p.name)&&eligible.has(p.key));
const report={canonical:'data/HT26',totalPrograms:programs.length,totalStructures:structures.length,searchablePrograms:searchable.length,excludedPrograms:programs.length-searchable.length,structureExclusionReasons:reasons,duplicateEligibleProgramKeys:[...conflicts].sort(),sampleSearchable:searchable.slice(0,10).map(p=>({key:p.key,name:p.programName||p.name,university:p.university}))};
console.log(JSON.stringify(report,null,2));
if(conflicts.size){console.error('Duplicate complete structures require manual resolution.');process.exitCode=1;}
