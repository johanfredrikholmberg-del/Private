#!/usr/bin/env node
import fs from 'node:fs/promises';
const evidence=JSON.parse(await fs.readFile('data/lund/official-course-evidence.json','utf8'));
const quality=JSON.parse(await fs.readFile('data/lund/course-evidence-quality.json','utf8'));
if(evidence.checked!==quality.checked||evidence.totalRows!==quality.rows)throw Error('Evidence and quality report mismatch');
const results=evidence.results.map(program=>{
  const courses=program.rows.map(row=>{
    const type=String(row.type||'').trim().toLowerCase();
    const classification=/^obligatorisk(?:\b|$)/i.test(type)?'mandatory':/^valbar(?:\b|$)/i.test(type)?'elective':/^valfri(?:\b|$)/i.test(type)?'free-choice':'unclassified';
    return {...row,classification,sourceUrl:program.sourceUrl,ht26Verified:false};
  });
  const terms=[...new Set(courses.map(x=>x.term))].sort((a,b)=>a-b).map(term=>{
    const rows=courses.filter(x=>x.term===term);
    const mandatoryHp=rows.filter(x=>x.classification==='mandatory').reduce((n,x)=>n+x.hp,0);
    const electiveOptionsHp=rows.filter(x=>x.classification==='elective').reduce((n,x)=>n+x.hp,0);
    const freeChoiceOptionsHp=rows.filter(x=>x.classification==='free-choice').reduce((n,x)=>n+x.hp,0);
    return {term,mandatoryHp,electiveOptionsHp,freeChoiceOptionsHp,unclassified:rows.filter(x=>x.classification==='unclassified').length,requiredElectiveHp:null,requiredFreeChoiceHp:null,termComplete:false};
  });
  return {key:program.key,programCode:program.programCode,programName:program.programName,sourceUrl:program.sourceUrl,courses,terms,ht26Verified:false,coveragePromotionAllowed:false};
});
const summary={programmes:results.length,withRows:results.filter(x=>x.courses.length).length,rows:results.reduce((n,x)=>n+x.courses.length,0),mandatory:results.flatMap(x=>x.courses).filter(x=>x.classification==='mandatory').length,elective:results.flatMap(x=>x.courses).filter(x=>x.classification==='elective').length,freeChoice:results.flatMap(x=>x.courses).filter(x=>x.classification==='free-choice').length,unclassified:results.flatMap(x=>x.courses).filter(x=>x.classification==='unclassified').length};
if(summary.rows!==evidence.totalRows)throw Error('Row count changed');
const report={generatedAt:new Date().toISOString(),summary,policy:'Evidence-only classification. Elective options are not additive requirements. Required elective credits and HT26 syllabus version must be verified independently. No structure, coverage, or canonical writes.',results};
await fs.writeFile('data/lund/elective-classification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));