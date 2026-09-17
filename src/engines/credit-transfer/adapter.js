(()=>{'use strict';
const root=window.StudieLotsEngines=window.StudieLotsEngines||{},engine=()=>root.creditTransfer;
const hp=x=>Math.max(0,Number(x?.hp??x?.credits??x?.ects??0)||0);
const norm=x=>String(x??'').trim().toLowerCase();
const ordinaryMatchedKey=r=>norm(r?.matchedCourseCode||r?.creditMatchedCourseCode||r?.matchedMeritCode||r?.sourceCourseCode||r?.matchedCourse||r?.matchedMerit||r?.sourceCourse||'');
const rank=r=>r?.classification==='strong'?3:r?.classification==='relevant'?2:r?.classification==='limited'?1:0;
function assess(source,target,options={}){return engine()?.assess?.(source,target,options)||null}
function applyToRows(rows,merits,options={}){
 const targets=(Array.isArray(rows)?rows:[]).map(r=>({...r,creditTransfer:null,creditTransferCountsInStudyPlan:false,creditTransferMatchedHp:0,creditTransferMatchedCourse:'',creditTransferMatchedCourseCode:''}));
 const sources=(Array.isArray(merits)?merits:[]).map((merit,i)=>({merit,i}));
 const used=new Set();
 // An ordinary match reserves only its identified source merit, not every merit sharing a course code.
 for(const row of targets){if(!row?.credited)continue;const k=ordinaryMatchedKey(row);if(!k)continue;const match=sources.find(s=>!used.has(s.i)&&(k===norm(s.merit?.code||s.merit?.courseCode)||k===norm(s.merit?.name||s.merit?.title)));if(match)used.add(match.i)}
 const candidates=[];
 targets.forEach((row,ri)=>{if(row?.credited)return;sources.forEach(s=>{if(used.has(s.i)||!hp(s.merit)||!hp(row))return;const result=assess(s.merit,row,options);if(result?.classification==='strong')candidates.push({ri,s,result})})});
 const score=c=>{const e=c.result?.evidence||{},vals=['subject','content','learningOutcomes','level'].map(k=>Number(e?.[k]?.similarity??e?.[k]??0)).filter(Number.isFinite),academic=vals.reduce((a,b)=>a+b,0),extent=Math.min(1,hp(c.s.merit)/Math.max(1,hp(targets[c.ri])));return academic*10+extent};
 candidates.sort((a,b)=>score(b)-score(a)||a.ri-b.ri||a.s.i-b.s.i);
 const allocatedTargets=new Set();
 for(const c of candidates){if(allocatedTargets.has(c.ri)||used.has(c.s.i))continue;const row=targets[c.ri],matchedHp=Math.min(hp(row),hp(c.s.merit));if(!matchedHp)continue;targets[c.ri]={...row,creditTransfer:c.result,creditTransferCountsInStudyPlan:true,creditTransferMatchedHp:matchedHp,creditTransferMatchedCourse:c.s.merit?.name||c.s.merit?.title||'',creditTransferMatchedCourseCode:c.s.merit?.code||c.s.merit?.courseCode||''};allocatedTargets.add(c.ri);used.add(c.s.i)}
 // Relevant and limited evidence is informational only; historical approvals never cause deduction.
 targets.forEach((row,ri)=>{if(row?.credited||row.creditTransferCountsInStudyPlan)return;let best=null;sources.forEach(s=>{const result=assess(s.merit,row,options);if(!result||result.classification==='strong')return;const rr=rank(result);if(!best||rr>best.rank)best={rank:rr,result,merit:s.merit}});if(best)targets[ri]={...row,creditTransfer:best.result,creditTransferCountsInStudyPlan:false,creditTransferMatchedCourse:best.merit?.name||best.merit?.title||'',creditTransferMatchedCourseCode:best.merit?.code||best.merit?.courseCode||''}});
 return targets
}
function summary(rows){const a=(Array.isArray(rows)?rows:[]).filter(r=>r.creditTransfer),strong=a.filter(r=>r.creditTransferCountsInStudyPlan&&r.creditTransfer?.classification==='strong');return Object.freeze({strongCount:strong.length,strongHp:strong.reduce((s,r)=>s+Math.min(hp(r),Math.max(0,Number(r.creditTransferMatchedHp)||0)),0),relevantCount:a.filter(r=>r.creditTransfer?.classification==='relevant').length,limitedCount:a.filter(r=>r.creditTransfer?.classification==='limited').length})}
root.creditTransferAdapter=Object.freeze({assess,applyToRows,summary});
})();