#!/usr/bin/env node
/** Offline, read-only preflight before merging Karlstad staging data into canonical HT26.
 * No network calls, no Vercel requests, no database writes. Fail closed on ambiguity.
 */
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const canonical=read('data/HT26/manifest.json');
if(canonical.canonical!==true||canonical.term!=='HT26')throw Error('Unexpected canonical database');
const programmes=read('data/HT26/programs.json');
const courses=read('data/HT26/courses.json');
const stagedPrograms=read('data/kau/programmes.json');
const stagedCourses=read('data/kau/courses.json');
const norm=s=>String(s??'').trim().toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const code=s=>String(s??'').trim().toUpperCase();
const isKau=s=>norm(s)==='karlstads-universitet';
if(!Array.isArray(programmes)||!Array.isArray(courses)||!Array.isArray(stagedPrograms)||!Array.isArray(stagedCourses))throw Error('Expected array tables');
if(programmes.length!==canonical.tables.programs.rows||courses.length!==canonical.tables.courses.rows)throw Error('Canonical manifest does not match actual rows');
if(stagedPrograms.length!==134||stagedCourses.length<500)throw Error('Incomplete Karlstad staging batch');
if(stagedPrograms.some(p=>!isKau(p.university)||!code(p.code)||!p.sourceUrl))throw Error('Invalid staged programme identity or provenance');
if(stagedCourses.some(c=>!isKau(c.university)||!code(c.code)||!c.name))throw Error('Invalid staged course identity');
const index=(rows,codeField)=>{const map=new Map();for(const row of rows){if(!isKau(row.university))continue;const key=code(row[codeField]);if(!key)continue;map.set(key,[...(map.get(key)||[]),row]);}return map};
const programIndex=index(programmes,'programCode');
const courseIndex=index(courses,'code');
const classify=(rows,idx)=>({matchedUnique:rows.filter(r=>(idx.get(code(r.code))||[]).length===1).length,missing:rows.filter(r=>!(idx.get(code(r.code))||[]).length).length,ambiguous:rows.filter(r=>(idx.get(code(r.code))||[]).length>1).length});
const report={canonical:'data/HT26',staging:'data/kau',programmes:{staged:stagedPrograms.length,...classify(stagedPrograms,programIndex)},courses:{staged:stagedCourses.length,...classify(stagedCourses,courseIndex),officiallyVerifiedStandalone:stagedCourses.filter(c=>c.standalone===true&&c.standaloneStatus==='verified-standalone-offering').length},safeToAutoMerge:false,reason:'Read-only preflight: canonical field mapping and ambiguous identities require explicit validation before any write.'};
console.log(JSON.stringify(report,null,2));
if(report.programmes.ambiguous||report.courses.ambiguous)console.error('Ambiguous identities must not be auto-merged.');
