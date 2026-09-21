#!/usr/bin/env node
/** Compare SUSA Lund identities against HT26 canonical records; report gaps without inventing offerings. */
import fs from 'node:fs/promises';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const norm=v=>String(v??'').trim().toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const code=v=>String(v??'').trim().toUpperCase();
const isLund=x=>norm(x.university)==='lunds universitet';
const [susaCourses,susaProgrammes,courses,programmes,details]=await Promise.all([
 read('data/susa/courses.json'),read('data/susa/programmes.json'),read('data/HT26/courses.json'),read('data/HT26/programmes.json'),read('data/HT26/course-details.json')
]);
for(const table of [susaCourses,susaProgrammes,courses,programmes,details])if(!Array.isArray(table))throw Error('Expected array data');
const canonicalCourses=courses.filter(isLund),canonicalProgrammes=programmes.filter(isLund);
const courseCodes=new Set(canonicalCourses.map(x=>code(x.code)).filter(Boolean));
const programmeCodes=new Set(canonicalProgrammes.map(x=>code(x.code)).filter(Boolean));
const detailCodes=new Set(details.filter(isLund).map(x=>code(x.code)).filter(Boolean));
const source=susaCourses.filter(isLund),sourceProgrammes=susaProgrammes.filter(isLund);
const identity=x=>({susaId:x.susaId||null,code:code(x.code)||null,name:x.name||null,hp:x.hp??null,officialUrls:x.urls||[]});
const missingCourses=source.filter(x=>!code(x.code)||!courseCodes.has(code(x.code))).map(identity);
const missingProgrammes=sourceProgrammes.filter(x=>!code(x.code)||!programmeCodes.has(code(x.code))).map(identity);
const missingDetails=source.filter(x=>code(x.code)&&courseCodes.has(code(x.code))&&!detailCodes.has(code(x.code))).map(identity);
const report={generatedAt:new Date().toISOString(),scope:'Lunds universitet',baseline:'data/susa',canonical:'data/HT26',note:'Code-based audit only. Missing code, duplicate codes, semester offerings and programme structures require separate verification.',counts:{susaCourses:source.length,canonicalCourses:canonicalCourses.length,susaProgrammes:sourceProgrammes.length,canonicalProgrammes:canonicalProgrammes.length,missingCourses:missingCourses.length,missingProgrammes:missingProgrammes.length,missingCourseDetails:missingDetails.length},missingCourses,missingProgrammes,missingCourseDetails:missingDetails};
await fs.mkdir('data/import-reviews',{recursive:true});
await fs.writeFile('data/import-reviews/lund-susa-coverage.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.counts));
