#!/usr/bin/env node
import fs from 'node:fs/promises';
const evidence=JSON.parse(await fs.readFile('data/lund/official-course-evidence.json','utf8'));
const structures=JSON.parse(await fs.readFile('data/lund/structures.json','utf8'));
const byCode=new Map(structures.map(x=>[String(x.programCode||'').toUpperCase(),x]));
const round=n=>Math.round(n*100)/100;
const results=evidence.results.map(item=>{
 const source=byCode.get(String(item.programCode).toUpperCase());
 const termTotals={};const issues=[];const seen=new Set();
 if(!source)issues.push('missing-staged-program');
 if(source&&source.key!==item.key)issues.push('program-key-mismatch');
 if(item.status!=='course-rows-extracted')issues.push(item.status);
 for(const row of item.rows){
  const key=[row.term,row.name.toLocaleLowerCase('sv'),row.hp].join('|');
  if(seen.has(key))issues.push('duplicate-course-row');seen.add(key);
  if(!row.name||!Number.isInteger(row.term)||row.term<1||row.term>12||!Number.isFinite(row.hp)||row.hp<=0||row.hp>60)issues.push('invalid-course-row');
  termTotals[row.term]=round((termTotals[row.term]||0)+row.hp);
  if(/valbar|elective|optional|alternativ|choice/i.test(row.type||''))issues.push('elective-course');
 }
 for(const [term,hp] of Object.entries(termTotals))if(hp!==30)issues.push(`term-${term}-not-30hp:${hp}`);
 const terms=Object.keys(termTotals).map(Number).sort((a,b)=>a-b);
 if(terms.length&&terms.some((t,i)=>t!==i+1))issues.push('missing-or-nonconsecutive-terms');
 // Neither page extraction nor staging proves that the syllabus version applies to HT26.
 if(item.rows.length)issues.push('ht26-syllabus-version-not-verified');
 return {key:item.key,programCode:item.programCode,programName:item.programName,sourceUrl:item.sourceUrl,rowCount:item.rows.length,termTotals,issues:[...new Set(issues)],decision:'manual-review-required'};
});
const report={generatedAt:new Date().toISOString(),checked:results.length,withRows:results.filter(x=>x.rowCount>0).length,rows:results.reduce((n,x)=>n+x.rowCount,0),termTotalsAt30:results.filter(x=>x.rowCount>0&&Object.values(x.termTotals).every(hp=>hp===30)).length,verifiedForHT26:0,policy:'Read-only audit. A 30 hp term total alone does not establish a complete programme or HT26 applicability. No staging coverage or canonical database writes.',results};
await fs.writeFile('data/lund/course-evidence-quality.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({checked:report.checked,withRows:report.withRows,rows:report.rows,termTotalsAt30:report.termTotalsAt30,verifiedForHT26:report.verifiedForHT26},null,2));