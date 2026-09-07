(()=>{
'use strict';
const VERSION='723';
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const text=v=>String(v??'').replace(/\s+/g,' ').trim();
const low=v=>text(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const hpOf=c=>num(c?.hp??c?.credits??c?.credit??c?.ects??c?.points);
const courseName=c=>text(c?.name??c?.courseName??c?.title??c?.course??c?.label);
const courseCode=c=>text(c?.code??c?.courseCode).toUpperCase().replace(/\s+/g,'');
const isCredited=c=>Boolean(c?.credited||c?.completed||c?.done||c?.tillgodoraknad||c?.isCredited||c?.status==='credited'||c?.status==='completed');
const isAdvanced=c=>{const t=low([c?.level,c?.progression,c?.educationLevel,c?.name].filter(Boolean).join(' '));return /avancerad|advanced|a1n|a1f|a2e|a2f/.test(t)};
const isThesis=c=>{const t=low([courseName(c),c?.type,c?.category,c?.description].filter(Boolean).join(' '));return /kandidatuppsats|examensarbete|sjalvstandigt arbete|thesis|c-uppsats|masteruppsats|magisteruppsats/.test(t)};
const subjectOf=c=>text(c?.subject??c?.mainField??c?.huvudomrade??c?.field);
function normalizeCourses(courses){return (Array.isArray(courses)?courses:[]).filter(Boolean).map((c,i)=>({...c,__engineIndex:i,hp:hpOf(c),name:courseName(c),code:courseCode(c),subject:subjectOf(c),isAdvanced:isAdvanced(c),isThesis:isThesis(c)}))}
function sumHp(courses,predicate=()=>true){return normalizeCourses(courses).filter(predicate).reduce((s,c)=>s+c.hp,0)}
function summarizeCourses(courses){const rows=normalizeCourses(courses);return Object.freeze({courseCount:rows.length,totalHp:rows.reduce((s,c)=>s+c.hp,0),advancedHp:rows.filter(c=>c.isAdvanced).reduce((s,c)=>s+c.hp,0),thesisHp:rows.filter(c=>c.isThesis).reduce((s,c)=>s+c.hp,0),creditedHp:rows.filter(isCredited).reduce((s,c)=>s+c.hp,0)})}
function requirementGap({required=0,completed=0}){return Math.max(0,num(required)-num(completed))}
function degreeGaps(input={}){const totalGap=requirementGap({required:input.totalRequired,completed:input.totalCompleted});const subjectGap=requirementGap({required:input.subjectRequired,completed:input.subjectCompleted});const thesisGap=requirementGap({required:input.thesisRequired,completed:input.thesisCompleted});return Object.freeze({totalGap,subjectGap,thesisGap,remainingHp:Math.max(totalGap,subjectGap,thesisGap)})}
window.__studielotsPureEngine=Object.freeze({version:VERSION,hpOf,courseName,courseCode,isCredited,isAdvanced,isThesis,subjectOf,normalizeCourses,sumHp,summarizeCourses,requirementGap,degreeGaps});
window.__studielotsBuild={...(window.__studielotsBuild||{}),pureEngine:VERSION};
window.dispatchEvent(new CustomEvent('studielots:pure-engine-ready',{detail:{version:VERSION}}));
})();