#!/usr/bin/env node
/** Lund standalone-course staging: no writes to canonical data without --apply. */
import fs from 'node:fs/promises';
const canonicalPath='data/HT26/courses.json';
const inputPath=process.argv.find(x=>x.startsWith('--input='))?.slice(8);
const apply=process.argv.includes('--apply');
if(!inputPath)throw Error('Ange --input=fil.json med verifierade Lundkurser; ingen data har ändrats.');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const original=await read(canonicalPath),incoming=await read(inputPath);
if(!Array.isArray(original)||!Array.isArray(incoming))throw Error('Båda filerna måste innehålla JSON-arrayer.');
const clean=x=>String(x??'').normalize('NFKC').trim().toUpperCase().replace(/\s+/g,'');
const provider=x=>clean(x.providerId??x.providerCode??x.provider??x.university??x.institution??x.larosate??'');
const code=x=>clean(x.courseCode??x.code??x.kurskod??'');
const hp=x=>Number(String(x.credits??x.hp??x.creditPoints??'').replace(',','.'));
const isLund=x=>/LUNDS?UNIVERSITET|^LU$|^LUND$|LUND-UNIVERSITY/.test(provider(x));
const key=x=>`${provider(x)}|${code(x)}|${hp(x)}`;
const known=new Set(original.filter(x=>code(x)&&Number.isFinite(hp(x))&&hp(x)>0).map(key));
const staged=[],duplicates=[],rejected=[];
for(const x of incoming){
 if(!isLund(x)||!code(x)||!Number.isFinite(hp(x))||hp(x)<=0){rejected.push({code:code(x),reason:'Saknar entydigt LU-lärosäte, kurskod eller hp'});continue;}
 // Course identity and offering identity are distinct. A programme-only course must not be treated as standalone.
 const standalone=x.standalone===true||x.isStandalone===true||x.applicationType==='standalone';
 if(!standalone){rejected.push({code:code(x),reason:'Fristående sökbarhet ej verifierad'});continue;}
 const k=key(x);if(known.has(k)){duplicates.push(k);continue;}known.add(k);staged.push(x);
}
const report={existing:original.length,candidates:incoming.length,newCourses:staged.length,duplicates:duplicates.length,rejected:rejected.length,rejectedDetails:rejected};
console.log(JSON.stringify(report,null,2));
if(apply){if(rejected.length)throw Error('Avbrutet: kontrollera avvisade poster före import.');await fs.writeFile(canonicalPath,JSON.stringify([...original,...staged],null,2)+'\n');console.log(`Skrev ${staged.length} nya kurser till ${canonicalPath}`)}
else console.log('Dry run: kanonisk databas är oförändrad.');
