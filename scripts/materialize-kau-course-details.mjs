#!/usr/bin/env node
// Publish verified Karlstad details in the single canonical StudieLots DB.
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const root='data/studielots-db/',manifestPath=root+'manifest.json';
const manifest=read(manifestPath),courses=read(manifest.tables.courses.storage);
if(manifest.database!=='StudieLots DB')throw Error('Unexpected database');
const identities=new Map();
for(const course of courses.filter(x=>x.university==='Karlstads universitet')){
  const code=String(course.code||'').toUpperCase();
  identities.set(code,(identities.get(code)||0)+1);
}
const details=read('data/HT26/course-details.json').filter(x=>x.university==='Karlstads universitet');
const seen=new Set();
for(const detail of details){
  const code=String(detail.code||'').toUpperCase();
  if(seen.has(code)||identities.get(code)!==1||!detail.name||detail.sourceType!=='official-university-course-page'||!/^https:\/\/www\.kau\.se\//.test(detail.sourceUrl||''))throw Error('Invalid Karlstad detail: '+code);
  seen.add(code);
}
if(!details.length)throw Error('No verified Karlstad details');
const target=root+'course-details-kau.json';
const table={storage:target,rows:details.length,university:'Karlstads universitet'};
if(process.argv.includes('--write')){
  fs.writeFileSync(target,JSON.stringify(details,null,2)+'\n');
  manifest.tables.courseDetails=table;
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
}
console.log(JSON.stringify({database:manifest.database,table:'courseDetails',rows:details.length,storage:target}));
