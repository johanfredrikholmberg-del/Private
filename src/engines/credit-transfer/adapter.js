(()=>{'use strict';
const root=window.StudieLotsEngines=window.StudieLotsEngines||{},engine=()=>root.creditTransfer;
const hp=x=>Number(x?.hp??x?.credits??x?.ects??0)||0;
const norm=x=>String(x??'').trim().toLowerCase();
const sourceKey=(m,i)=>norm(m?.id||m?.sourceId||m?.courseId||m?.code||m?.courseCode)||`${norm(m?.name||m?.title)}|${hp(m)}|${i}`;
const ordinaryMatchedKey=r=>norm(r?.matchedCourseCode||r?.creditMatchedCourseCode||r?.matchedMeritCode||r?.sourceCourseCode||r?.matchedCourse||r?.matchedMerit||r?.sourceCourse||'');
const rank=r=>r?.classification==='strong'?3:r?.classification==='relevant'?2:r?.classification==='limited'?1:0;
function assess(source,target,options={}){return engine()?.assess?.(source,target,options)||null}
function applyToRows(rows,merits,options={}){
 const targets=(Array.isArray(rows)?rows:[]).map(r=>({...r,creditTransfer:null,creditTransferCountsInStudyPlan:false,creditTransferMatchedCourse:'',creditTransferMatchedCourseCode:''}));
 const sources=(Array.isArray(merits)?merits:[]).map((merit,i)=>({merit,i,key:sourceKey(merit,i)}));
 const used=new Set();
 // Ordinary programme/degree matching always has priority over TG. Reserve any source merit we can identify.
 for(const row of targets){if(!row?.credited)continue;const k=ordinaryMatchedKey(row);if(!k)continue;for(const s of sources){const code=norm(s.merit?.code||s.merit?.courseCode),name=norm(s.merit?.name||s.merit?.title);if(k===code||k===name)used.add(s.key)}}
 const candidates=[];
 targets.forEach((row,ri)=>{if(row?.credited)return;sources.forEach(s=>{if(used.has(s.key))return;const result=assess(s.merit,row,options);if(result?.classification==='strong')candidates.push({ri,s,result})})});
 // Allocate strong matches one-to-one. Prefer stronger academic evidence and closer credit extent; stable tie-breaks make results deterministic.
 const score=c=>{const e=c.result?.evidence||{},vals=['subject','content','learningOutcomes','level'].map(k=>Number(e?.[k]?.similarity??e?.[k]??0)).filter(Number.isFinite),academic=vals.reduce((a,b)=>a+b,0),extent=Math.min(1,hp(c.s.merit)/Math.max(1,hp(targets[c.ri])));return academic*10+extent};
 candidates.sort((a,b)=>score(b)-score(a)||a.ri-b.ri||a.s.i-b.s.i);
 const allocatedTargets=new Set();
 for(const c of candidates){if(allocatedTargets.has(c.ri)||used.has(c.s.key))continue;const row=targets[c.ri];targets[c.ri]={...row,creditTransfer:c.result,creditTransferCountsInStudyPlan:true,creditTransferMatchedCourse:c.s.merit?.name||c.s.merit?.title||'',creditTransferMatchedCourseCode:c.s.merit?.code||c.s.merit?.courseCode||''};allocatedTargets.add(c.ri);used.add(c.s.key)}
 // Relevant/limited evidence may still be shown, but never reserves or counts a source course.
 targets.forEach((row,ri)=>{if(row?.credited||row.creditTransferCountsInStudyPlan)return;let best=null;sources.forEach(s=>{const result=assess(s.merit,row,options);if(!result||result.classification==='strong')return;const rr=rank(result);if(!best||rr>best.rank)best={rank:rr,result,merit:s.merit}});if(best)targets[ri]={...row,creditTransfer:best.result,creditTransferCountsInStudyPlan:false,creditTransferMatchedCourse:best.merit?.name||best.merit?.title||'',creditTransferMatchedCourseCode:best.merit?.code||best.merit?.courseCode||''}});
 return targets
}
function summary(rows){const a=(Array.isArray(rows)?rows:[]).filter(r=>r.creditTransfer),strong=a.filter(r=>r.creditTransferCountsInStudyPlan);return Object.freeze({strongCount:strong.length,strongHp:strong.reduce((s,r)=>s+hp(r),0),relevantCount:a.filter(r=>r.creditTransfer?.classification==='relevant').length,limitedCount:a.filter(r=>r.creditTransfer?.classification==='limited').length})}
root.creditTransferAdapter=Object.freeze({assess,applyToRows,summary});
})();