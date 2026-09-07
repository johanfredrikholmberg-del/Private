(()=>{
'use strict';
const VERSION='731';
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const text=v=>String(v??'').replace(/\s+/g,' ').trim();
const low=v=>text(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const hpOf=c=>num(c?.hp??c?.credits??c?.credit??c?.ects??c?.points);
const courseName=c=>text(c?.name??c?.courseName??c?.title??c?.course??c?.label);
const courseCode=c=>text(c?.code??c?.courseCode).toUpperCase().replace(/\s+/g,'');
const isCredited=c=>Boolean(c?.credited||c?.completed||c?.done||c?.tillgodoraknad||c?.isCredited||c?.status==='credited'||c?.status==='completed');
const progressionOf=c=>{for(const raw of [c?.progression,c?.levelCode,c?.progressionCode,c?.level]){const p=text(raw).toUpperCase().replace(/\s+/g,'');if(/^(?:A|G)(?:1N|1F|1E|2F|2E|XX)$/.test(p))return p}return''};
const isAdvanced=c=>{const p=progressionOf(c);if(/^A/.test(p))return true;if(/^G/.test(p))return false;const t=low([c?.level,c?.educationLevel].filter(Boolean).join(' '));return /\bavancerad(?:\s+niva)?\b|\badvanced(?:\s+level)?\b/.test(t)};
const thesisFlag=c=>Boolean(c?.isThesis||c?.thesis||c?.independentWork||c?.examensarbete);
const isThesis=c=>{if(thesisFlag(c))return true;const p=progressionOf(c);if(/^(G2E|A1E|A2E)$/.test(p))return true;const t=low([courseName(c),c?.type,c?.category].filter(Boolean).join(' '));return /\bkandidatuppsats\b|\bexamensarbete\b|\bsjalvstandigt arbete\b|\bthesis\b|\bc-uppsats\b|\bmasteruppsats\b|\bmagisteruppsats\b/.test(t)};
const subjectOf=c=>text(c?.subject??c?.mainField??c?.huvudomrade??c?.field);
function normalizeCourses(courses){return (Array.isArray(courses)?courses:[]).filter(Boolean).map((c,i)=>({...c,__engineIndex:i,hp:hpOf(c),name:courseName(c),code:courseCode(c),subject:subjectOf(c),isAdvanced:isAdvanced(c),isThesis:isThesis(c)}))}
function sumHp(courses,predicate=()=>true){return normalizeCourses(courses).filter(predicate).reduce((s,c)=>s+c.hp,0)}
function summarizeCourses(courses){const rows=normalizeCourses(courses);return Object.freeze({courseCount:rows.length,totalHp:rows.reduce((s,c)=>s+c.hp,0),advancedHp:rows.filter(c=>c.isAdvanced).reduce((s,c)=>s+c.hp,0),thesisHp:rows.filter(c=>c.isThesis).reduce((s,c)=>s+c.hp,0),creditedHp:rows.filter(isCredited).reduce((s,c)=>s+c.hp,0)})}
function requirementGap({required=0,completed=0}){return Math.max(0,num(required)-num(completed))}
function degreeGaps(input={}){const totalGap=requirementGap({required:input.totalRequired,completed:input.totalCompleted});const subjectGap=requirementGap({required:input.subjectRequired,completed:input.subjectCompleted});const thesisGap=requirementGap({required:input.thesisRequired,completed:input.thesisCompleted});return Object.freeze({totalGap,subjectGap,thesisGap,remainingHp:Math.max(totalGap,subjectGap,thesisGap)})}
function subjectMatch(course,subject){const wanted=low(subject);if(!wanted)return false;const actual=low(subjectOf(course));if(actual&&(actual===wanted||actual.includes(wanted)||wanted.includes(actual)))return true;const hay=low([courseName(course),course?.subjectArea,course?.mainField].filter(Boolean).join(' '));return Boolean(hay)&&hay.includes(wanted)}
function evaluateRequirements(courses,requirements={}){
 const rows=normalizeCourses(courses),excludeAdvanced=Boolean(requirements.excludeAdvancedFromTotal),eligible=excludeAdvanced?rows.filter(c=>!c.isAdvanced):rows;
 const subject=text(requirements.subject??requirements.mainField??requirements.huvudomrade),totalRequired=num(requirements.totalHp??requirements.totalRequired),subjectRequired=num(requirements.subjectHp??requirements.subjectRequired),thesisRequired=num(requirements.thesisHp??requirements.thesisRequired);
 const totalCompleted=eligible.reduce((s,c)=>s+c.hp,0),subjectRows=eligible.filter(c=>subjectMatch(c,subject)),subjectCompleted=subjectRows.reduce((s,c)=>s+c.hp,0),thesisRows=subjectRows.filter(c=>c.isThesis),thesisCompleted=thesisRows.reduce((s,c)=>s+c.hp,0);
 const gaps=degreeGaps({totalRequired,totalCompleted,subjectRequired,subjectCompleted,thesisRequired,thesisCompleted});
 return Object.freeze({engineVersion:VERSION,requirements:Object.freeze({subject,totalRequired,subjectRequired,thesisRequired,excludeAdvancedFromTotal:excludeAdvanced}),completed:Object.freeze({totalHp:totalCompleted,subjectHp:subjectCompleted,thesisHp:thesisCompleted}),gaps,remainingHp:gaps.remainingHp,eligibleCourseCount:eligible.length,subjectCourseCount:subjectRows.length,thesisCourseCount:thesisRows.length});
}
window.__studielotsPureEngine=Object.freeze({version:VERSION,hpOf,courseName,courseCode,isCredited,progressionOf,isAdvanced,isThesis,subjectOf,normalizeCourses,sumHp,summarizeCourses,requirementGap,degreeGaps,subjectMatch,evaluateRequirements});
window.__studielotsBuild={...(window.__studielotsBuild||{}),pureEngine:VERSION,pureRequirementEngine:true};
window.dispatchEvent(new CustomEvent('studielots:pure-engine-ready',{detail:{version:VERSION}}));
})();