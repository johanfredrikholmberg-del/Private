#!/usr/bin/env node
import fs from 'node:fs/promises';

const UNI='Karlstads universitet';
const TERM='HT26';
const BASE='data/HT26';
const OUT='data/karlstad';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const write=async(p,v)=>{await fs.mkdir(OUT,{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n')};
const isKau=x=>String(x?.university||x?.providerName||x?.provider||'').trim()===UNI;

const [programs,structures,courses,offerings,syllabi]=await Promise.all([
  read(`${BASE}/programs.json`),read(`${BASE}/program-structures.json`),read(`${BASE}/courses.json`),read(`${BASE}/course-offerings.json`),read(`${BASE}/syllabus-versions.json`)
]);
const kp=programs.filter(isKau);
const ks=structures.filter(isKau);
const kc=courses.filter(isKau);
const ko=offerings.filter(isKau);
const kv=syllabi.filter(isKau);
const programmeKeys=new Set(kp.map(x=>x.key));
const courseCodes=new Set(kc.map(x=>String(x.courseCode||'').toUpperCase()).filter(Boolean));
const structured=new Set(ks.filter(x=>['complete','choice-required','partial-structure'].includes(x.coverage)).map(x=>x.key));
const offered=new Set(ko.map(x=>String(x.courseCode||'').toUpperCase()).filter(Boolean));
const syllabusCodes=new Set(kv.map(x=>String(x.courseCode||'').toUpperCase()).filter(Boolean));
const meta={database:'StudieLots HT26',term:TERM,university:UNI,schemaVersion:2,generatedAt:new Date().toISOString(),programmes:kp.length,programmeStructures:ks.length,structuredProgrammes:[...structured].filter(x=>programmeKeys.has(x)).length,courses:kc.length,courseOfferings:ko.length,coursesWithOfferings:[...offered].filter(x=>courseCodes.has(x)).length,syllabusVersions:kv.length,coursesWithSyllabus:[...syllabusCodes].filter(x=>courseCodes.has(x)).length,policy:'Same canonical model as GU; no guessed values.'};
await Promise.all([write(`${OUT}/programs.json`,kp),write(`${OUT}/program-structures.json`,ks),write(`${OUT}/courses.json`,kc),write(`${OUT}/course-offerings.json`,ko),write(`${OUT}/syllabus-versions.json`,kv),write(`${OUT}/meta.json`,meta)]);
console.log(JSON.stringify(meta,null,2));
