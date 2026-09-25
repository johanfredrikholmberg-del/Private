(()=>{'use strict';
const root=window.StudieLotsEngines=window.StudieLotsEngines||{},engine=()=>root.creditTransfer;
const hp=x=>Math.max(0,Number(x?.hp??x?.credits??x?.ects??0)||0);
const norm=x=>String(x??'').trim().toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const ordinaryMatchedKey=r=>norm(r?.matchedCourseCode||r?.creditMatchedCourseCode||r?.matchedMeritCode||r?.sourceCourseCode||r?.matchedCourse||r?.matchedMerit||r?.sourceCourse||'');
const rank=r=>r?.classification==='strong'?3:r?.classification==='relevant'?2:r?.classification==='limited'?1:0;\nconst historicalApprovals=r=>Math.max(0,Number(r?.evidence?.historical?.verifiedApprovalCount??r?.evidence?.historical?.approved??0)||0);\nconst countsAsCredited=r=>r?.classification==='strong'||(r?.classification==='relevant'&&historicalApprovals(r)>0);
const slotType=r=>norm(r?.slotType||r?.programmeCategory||'');
const isElective=r=>r?.isSlot===true&&['elective-slot','elective-requirement'].includes(slotType(r))||r?.category==='elective-slot';
const isRestricted=r=>Boolean(r?.electiveRequirements?.subject||r?.electiveRequirements?.subjects?.length||r?.electiveRequirements?.minProgression||r?.electiveRequirements?.minLevel||r?.electiveRequirements?.maxLevel||r?.electiveRequirements?.allowedCodes?.length||r?.electiveRequirements?.excludedCodes?.length||r?.electiveRequirements?.requiresApproval||r?.electiveRequirements?.requiresContentReview);
const courseCode=c=>norm(c?.code||c?.courseCode);
const degreeUsed=c=>c?.alreadyUsedInDegree===true||c?.usedInDegree===true||c?.includedInAwardedDegree===true||c?.degreeUsed===true;
const isThesis=c=>c?.isThesis===true||/kandidatuppsats|examensarbete|degree project|bachelor thesis/i.test(String(c?.name||c?.title||''));
const isAdvanced=c=>/^A[12]/i.test(String(c?.progression||c?.progressionCode||c?.levelCode||''))||/avancerad|second cycle|advanced/i.test(String(c?.educationLevel||''));
const basicCourse=c=>!isAdvanced(c)&&!degreeUsed(c)&&!isThesis(c)&&hp(c)>0&&Boolean(String(c?.name||c?.title||c?.code||'').trim())&&c?.passed!==false&&c?.status!=='failed';
function electiveEligible(merit,row){if(!basicCourse(merit))return false;const rules=row?.electiveRequirements||{};if(rules.requiresApproval||rules.requiresContentReview)return false;const subject=norm(merit.subject||merit.mainField||merit.subjectArea),allowed=[...(rules.subjects||[]),...(rules.subject?[rules.subject]:[])].map(norm);if(allowed.length&&(!subject||!allowed.includes(subject)))return false;const code=courseCode(merit);if(rules.allowedCodes?.length&&!rules.allowedCodes.map(norm).includes(code))return false;if(rules.excludedCodes?.map(norm).includes(code))return false;const p=String(merit.progression||merit.progressionCode||merit.levelCode||'').toUpperCase();if(rules.minProgression&&!p)return false;if(rules.minProgression&&p<String(rules.minProgression).toUpperCase())return false;if(rules.minLevel&&(!merit.educationLevel||norm(merit.educationLevel)!==norm(rules.minLevel)))return false;if(rules.maxLevel&&(!merit.educationLevel||norm(merit.educationLevel)!==norm(rules.maxLevel)))return false;return true}
function assess(source,target,options={}){return engine()?.assess?.(source,target,options)||null}
function applyToRows(rows,merits,options={}){
 const targets=(Array.isArray(rows)?rows:[]).map(r=>({...r,creditTransfer:null,creditTransferCountsInStudyPlan:false,creditTransferMatchedHp:0,creditTransferMatchedCourse:'',creditTransferMatchedCourseCode:''}));
 const sources=(Array.isArray(merits)?merits:[]).map((merit,i)=>({merit,i}));
 const used=new Set();
 // Exact ordinary matches reserve only their own source; possible matches are not reservations.
 for(const row of targets){if(!row?.credited)continue;const k=ordinaryMatchedKey(row);if(!k)continue;const match=sources.find(s=>!used.has(s.i)&&(k===courseCode(s.merit)||k===norm(s.merit?.name||s.merit?.title)));if(match)used.add(match.i)}
 const candidates=[];
 targets.forEach((row,ri)=>{if(row?.credited||isElective(row))return;sources.forEach(s=>{if(used.has(s.i)||!hp(s.merit)||!hp(row))return;const result=assess(s.merit,row,options);if(countsAsCredited(result))candidates.push({ri,s,result})})});
 const score=c=>{const e=c.result?.evidence||{},vals=['fieldSimilarity','contentSimilarity','learningSimilarity'].map(k=>Number(e?.[k]??0)).filter(Number.isFinite),academic=vals.reduce((a,b)=>a+b,0),extent=Math.min(1,hp(c.s.merit)/Math.max(1,hp(targets[c.ri])));return academic*10+extent};
 candidates.sort((a,b)=>score(b)-score(a)||a.ri-b.ri||a.s.i-b.s.i);
 const allocatedTargets=new Set();
 for(const c of candidates){if(allocatedTargets.has(c.ri)||used.has(c.s.i))continue;const row=targets[c.ri],matchedHp=Math.min(hp(row),hp(c.s.merit));if(!matchedHp)continue;targets[c.ri]={...row,creditTransfer:c.result,creditTransferCountsInStudyPlan:true,creditTransferMatchedHp:matchedHp,creditTransferMatchedCourse:c.s.merit?.name||c.s.merit?.title||'',creditTransferMatchedCourseCode:c.s.merit?.code||c.s.merit?.courseCode||''};allocatedTargets.add(c.ri);used.add(c.s.i)}
 // Fill explicit elective slots only after mandatory matches. No historical decisions are needed.
 targets.forEach((row,ri)=>{if(!isElective(row)||row.credited||row.creditTransferCountsInStudyPlan)return;const capacity=hp(row);if(!capacity)return;
 // An options list may describe a restricted choice, not a free elective block.
 const optionsList=Array.isArray(row.options)?row.options:[];
 if(optionsList.length&&!row.electiveRequirements?.unrestricted&&!isRestricted(row))return;
 const picked=[];let filled=0;
 for(const s of sources){if(used.has(s.i)||!electiveEligible(s.merit,row))continue;if(filled+hp(s.merit)>capacity+.01)continue;picked.push(s);filled+=hp(s.merit);if(filled>=capacity-.01)break}
 if(!filled)return;for(const s of picked)used.add(s.i);
 const full=filled>=capacity-.01;
 targets[ri]={...row,creditTransfer:{classification:'strong',label:full?'Preliminärt uppfyllt valfritt utrymme':'Delvis matchat valfritt utrymme',elective:true,disclaimer:'Preliminär matchning mot programmets valfria utrymme. Lärosätet avgör om kurserna får ingå i examen.'},creditTransferCountsInStudyPlan:true,creditTransferMatchedHp:filled,creditTransferMatchedCourse:picked.map(s=>s.merit.name||s.merit.title||s.merit.code).join(' + '),creditTransferMatchedCourseCode:picked.map(s=>s.merit.code||s.merit.courseCode).filter(Boolean).join(', ')};
 });
 // Relevant/limited matches remain informational; never consume or deduct a source.
 targets.forEach((row,ri)=>{if(row?.credited||row.creditTransferCountsInStudyPlan||isElective(row))return;let best=null;sources.forEach(s=>{const result=assess(s.merit,row,options);if(!result||countsAsCredited(result))return;const rr=rank(result);if(!best||rr>best.rank)best={rank:rr,result,merit:s.merit}});if(best)targets[ri]={...row,creditTransfer:best.result,creditTransferCountsInStudyPlan:false,creditTransferMatchedCourse:best.merit?.name||best.merit?.title||'',creditTransferMatchedCourseCode:best.merit?.code||best.merit?.courseCode||''}});
 return targets
}
function presentation(row){const ct=row?.creditTransfer;if(!ct)return null;const classification=['strong','relevant'].includes(ct.classification)?ct.classification:'limited';const label=classification==='strong'?'Starkt underlag':classification==='relevant'?'Relevant underlag':'Begränsat underlag';const h=ct?.evidence?.historical||{};const historicalApprovalCount=Math.max(0,Number(h.verifiedApprovalCount??h.approved??0)||0);return Object.freeze({classification,label,countsInStudyPlan:countsAsCredited(ct)&&row?.creditTransferCountsInStudyPlan===true,historicalApprovals:historicalApprovalCount,historicalLabel:historicalApprovalCount?'Historiskt tillgodoräknad · '+historicalApprovalCount+' tidigare bifall':'',showHistorical:historicalApprovalCount>0});}\nfunction summary(rows){const a=(Array.isArray(rows)?rows:[]).filter(r=>r.creditTransfer),credited=a.filter(r=>r.creditTransferCountsInStudyPlan&&countsAsCredited(r.creditTransfer));return Object.freeze({strongCount:a.filter(r=>r.creditTransfer?.classification==='strong').length,strongHp:credited.reduce((s,r)=>s+Math.min(hp(r),Math.max(0,Number(r.creditTransferMatchedHp)||0)),0),creditedCount:credited.length,relevantCount:a.filter(r=>r.creditTransfer?.classification==='relevant').length,limitedCount:a.filter(r=>r.creditTransfer?.classification==='limited').length})}
root.creditTransferAdapter=Object.freeze({assess,applyToRows,presentation,summary,electiveEligible});
})();