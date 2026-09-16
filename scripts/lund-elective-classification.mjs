#!/usr/bin/env node
import fs from 'node:fs/promises';
const evidence=JSON.parse(await fs.readFile('data/lund/official-course-evidence.json','utf8'));
const quality=JSON.parse(await fs.readFile('data/lund/course-evidence-quality.json','utf8'));
const review=JSON.parse(await fs.readFile('data/lund/egeko-ht26-source-review.json','utf8'));
if(evidence.checked!==quality.checked||evidence.totalRows!==quality.rows)throw Error('Evidence and quality report mismatch');
if(review.programCode!=='EGEKO'||review.reviewedFor!=='HT2026'||review.canonicalImportAllowed!==false)throw Error('Unexpected EGEKO review');
const requirement=term=>review.termRequirements.find(x=>x.term===term);
const results=evidence.results.map(program=>{
  const isEgeko=program.programCode==='EGEKO';
  const courses=program.rows.map(row=>{
    const type=String(row.type||'').trim().toLowerCase();
    const name=String(row.name||'').trim();
    let classification=/^obligatorisk(?:\b|$)/i.test(type)?'mandatory':/^valbar(?:\b|$)/i.test(type)?'elective':/^valfri(?:\b|$)/i.test(type)?'free-choice':'unclassified';
    let classificationNote=null;
    // Source table's broad 'Valbar' label is not a claim that every credit is freely elective.
    if(isEgeko&&row.term===6){classification='mixed-major-and-thesis';classificationNote='Major-area studies and thesis: do not count as unrestricted elective credits.';}
    else if(isEgeko&&row.term===5){classification='elective';classificationNote='Programme review confirms a 30 hp elective term; options must not be added together.';}
    else if(/^valbar(?:a)? kurs(?:er)?\b/i.test(name)&&classification==='mandatory'){
      classification='unclassified';classificationNote='Course name and source type conflict; requires source-level review.';
    }
    return {...row,classification,classificationNote,sourceUrl:program.sourceUrl,ht26Verified:false};
  });
  const termNumbers=new Set(courses.map(x=>x.term));
  if(isEgeko)termNumbers.add(4); // Source parser omitted the choice row because it has no numeric hp.
  const terms=[...termNumbers].sort((a,b)=>a-b).map(term=>{
    const rows=courses.filter(x=>x.term===term);
    const sum=kind=>rows.filter(x=>x.classification===kind).reduce((n,x)=>n+x.hp,0);
    const r=isEgeko?requirement(term):null;
    return {term,mandatoryHp:sum('mandatory'),electiveOptionsHp:sum('elective'),freeChoiceOptionsHp:sum('free-choice'),mixedRequirementHp:sum('mixed-major-and-thesis'),unclassified:rows.filter(x=>x.classification==='unclassified').length,requiredElectiveHp:isEgeko&&term===5?r?.requiredHp??null:null,requiredFreeChoiceHp:null,majorChoiceOptions:isEgeko&&term===4?r?.options??[]:[],requiredMajorChoiceHp:null,thesisHp:isEgeko&&term===6?r?.thesisHp??null:null,termComplete:false};
  });
  return {key:program.key,programCode:program.programCode,programName:program.programName,sourceUrl:program.sourceUrl,courses,terms,ht26Verified:false,coveragePromotionAllowed:false};
});
const all=results.flatMap(x=>x.courses);
const count=kind=>all.filter(x=>x.classification===kind).length;
const summary={programmes:results.length,withRows:results.filter(x=>x.courses.length).length,rows:all.length,mandatory:count('mandatory'),elective:count('elective'),freeChoice:count('free-choice'),mixedMajorAndThesis:count('mixed-major-and-thesis'),unclassified:count('unclassified')};
if(summary.rows!==evidence.totalRows||summary.mandatory+summary.elective+summary.freeChoice+summary.mixedMajorAndThesis+summary.unclassified!==summary.rows)throw Error('Row count changed');
const egeko=results.find(x=>x.programCode==='EGEKO');
if(!egeko||egeko.terms.find(x=>x.term===5)?.requiredElectiveHp!==30||egeko.terms.find(x=>x.term===6)?.thesisHp!==15||egeko.terms.find(x=>x.term===6)?.mixedRequirementHp!==30||egeko.terms.find(x=>x.term===4)?.majorChoiceOptions.length!==2)throw Error('EGEKO requirement regression');
const report={generatedAt:new Date().toISOString(),summary,policy:'Evidence-only classification. Mixed major/thesis rows are not free electives; options are not additive. EGEKO requirements are programme-level evidence, not verified course-level HT26 structures. No coverage or canonical writes.',results};
await fs.writeFile('data/lund/elective-classification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));