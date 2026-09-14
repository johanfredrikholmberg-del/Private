#!/usr/bin/env node
import fs from 'node:fs/promises';
const FILE='data/HT26/syllabus-versions.json';
const OUT='data/gu/syllabus-quality-audit.json';
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const rows=JSON.parse(await fs.readFile(FILE,'utf8'));
const gu=rows.filter(x=>norm(x.university)==='goteborgs universitet');
const bad=[];
for(const x of gu){
 const issues=[];
 if(x.term!=='HT26'||x.requestedVersion!=='HT26'||x.versionVerified!==true) issues.push('exact-term');
 if(!clean(x.courseCode)) issues.push('course-code');
 if(!/^https:\/\/www\.gu\.se\/(syllabus|studera\/)/i.test(clean(x.sourceUrl))) issues.push('official-source-url');
 if(!clean(x.level)) issues.push('level');
 if(!clean(x.progression)) issues.push('progression');
 if(!Array.isArray(x.learningGoals)||!x.learningGoals.length) issues.push('learning-goals');
 // These fields are required before Snabbare väg may treat a course as safely selectable.
 if(!['yes','no','unknown'].includes(x.standalone)) issues.push('standalone-classification');
 if(!clean(x.validFromTerm)) issues.push('valid-from-term');
 if(!clean(x.versionId)) issues.push('version-id');
 if(!clean(x.decisionDate)) issues.push('decision-date');
 if(!clean(x.effectiveDate)) issues.push('effective-date');
 if(!clean(x.eligibility)) issues.push('eligibility');
 if(issues.length) bad.push({courseCode:x.courseCode,courseName:x.courseName,sourceUrl:x.sourceUrl,issues});
}
const counts={};for(const r of bad)for(const i of r.issues)counts[i]=(counts[i]||0)+1;
const report={generatedAt:new Date().toISOString(),term:'HT26',university:'Göteborgs universitet',total:gu.length,passed:gu.length-bad.length,needsReview:bad.length,issueCounts:counts,examples:bad.slice(0,100)};
await fs.writeFile(OUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,examples:undefined},null,2));
if(gu.length!==2836) process.exitCode=2;
