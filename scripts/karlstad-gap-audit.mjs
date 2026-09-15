#!/usr/bin/env node
import fs from 'node:fs/promises';
const DIR='data/karlstad';
const read=async n=>JSON.parse(await fs.readFile(`${DIR}/${n}`,'utf8'));
const [programmes,structures,courses,offerings,syllabi]=await Promise.all([
  read('programs.json'),read('program-structures.json'),read('courses.json'),read('course-offerings.json'),read('syllabus-versions.json')
]);
const code=x=>String(x?.courseCode||'').trim().toUpperCase();
const key=x=>String(x?.key||x?.programmeKey||'').trim();
const structured=new Set(structures.map(key).filter(Boolean));
const offered=new Set(offerings.map(code).filter(Boolean));
const syllabused=new Set(syllabi.map(code).filter(Boolean));
const report={
  university:'Karlstads universitet',
  generatedAt:new Date().toISOString(),
  counts:{programmes:programmes.length,courses:courses.length,programmeStructures:structures.length,courseOfferings:offerings.length,syllabusVersions:syllabi.length},
  gaps:{
    programmesWithoutStructure:programmes.filter(x=>!structured.has(key(x))).map(x=>({key:key(x),programmeCode:x.programmeCode||null,programmeName:x.programmeName||x.name||null,sourceUrl:x.sourceUrl||null})),
    coursesWithoutOffering:courses.filter(x=>!offered.has(code(x))).map(x=>({courseCode:code(x),courseName:x.courseName||x.name||null,sourceUrl:x.sourceUrl||null})),
    coursesWithoutSyllabus:courses.filter(x=>!syllabused.has(code(x))).map(x=>({courseCode:code(x),courseName:x.courseName||x.name||null,sourceUrl:x.sourceUrl||null}))
  }
};
report.remaining={programmesWithoutStructure:report.gaps.programmesWithoutStructure.length,coursesWithoutOffering:report.gaps.coursesWithoutOffering.length,coursesWithoutSyllabus:report.gaps.coursesWithoutSyllabus.length};
await fs.writeFile(`${DIR}/gap-audit.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.remaining,null,2));
