#!/usr/bin/env node
// Fail closed if the programme overview changes or a canonical code conflicts.
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const root='data/studielots-db/';
const manifest=read(root+'manifest.json');
const structureManifest=read(root+'programme-structures-manifest.json');
const programs=structureManifest.parts.flatMap(p=>read(root+p).programs);
const plan=programs.find(p=>p.programCode==='S2EUA'&&p.validFrom==='2027VT');
if(!plan||programs.length!==structureManifest.count||plan.programHp!==60)throw Error('Structure missing or manifest mismatch');
const identities=[...read(manifest.tables.programmes.storage),...manifest.tables.programmes.additionalStorages.flatMap(read)];
if(identities.filter(p=>p.university===plan.university&&p.programCode===plan.programCode).length!==1)throw Error('Programme identity conflict');
const courses=[...read(manifest.tables.courses.storage),...manifest.tables.courses.additionalStorages.flatMap(read)];
const imported=read(root+'courses-gu-2027-eu.json');
if(courses.length!==manifest.tables.courses.rows||imported.length!==6)throw Error('Course count mismatch');
for(const course of imported){
  if(courses.filter(c=>c.university===course.university&&c.code===course.code).length!==1)throw Error(`Course code conflict: ${course.code}`);
  const row=plan.rows.find(r=>r.code===course.code)||plan.rows.flatMap(r=>r.options||[]).find(r=>r.code===course.code);
  if(!row||row.name!==course.name||row.hp!==course.hp||course.syllabusPublished!==false)throw Error(`Course does not match provisional plan: ${course.code}`);
}
for(let term=1;term<=2;term++)if(plan.rows.filter(r=>r.term===term).reduce((n,r)=>n+r.hp,0)!==30)throw Error(`Incomplete term ${term}`);
const url=plan.sourceEvidenceUrl;
const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
if(!response.ok)throw Error(`Official source unavailable: ${response.status}`);
const html=await response.text();
for(const course of imported)if(!html.includes(course.code))throw Error(`Official source no longer lists ${course.code}`);
if(!html.includes('2027')||!html.includes('Kursplanerna har ännu inte publicerats'))throw Error('Programme date or syllabus status changed; manually review');
console.log(JSON.stringify({programme:plan.programCode,terms:2,courseCodes:imported.map(x=>x.code),coursePlansPublished:false,structures:programs.length,courses:courses.length}));
