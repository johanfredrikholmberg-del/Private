(()=>{'use strict';
const VERSION='1';
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const text=v=>String(v??'').replace(/\s+/g,' ').trim();
const low=v=>text(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const words=v=>low(v).split(/[^a-z0-9]+/).filter(Boolean);
const phraseMatch=(value,wanted)=>{const a=words(value),b=words(wanted);if(!a.length||!b.length)return false;if(a.join(' ')===b.join(' '))return true;if(b.length===1)return a.includes(b[0]);for(let i=0;i<=a.length-b.length;i++)if(b.every((w,j)=>a[i+j]===w))return true;return false};
const hpOf=c=>num(c?.hp??c?.credits??c?.credit??c?.ects??c?.points);
const courseName=c=>text(c?.name??c?.courseName??c?.title??c?.course??c?.label);
const courseCode=c=>text(c?.code??c?.courseCode).toUpperCase().replace(/\s+/g,'');
const progressionOf=c=>{for(const raw of [c?.progression,c?.levelCode,c?.progressionCode,c?.level]){const p=text(raw).toUpperCase().replace(/\s+/g,'');if(/^(?:A|G)(?:1N|1F|1E|2F|2E|XX)$/.test(p))return p}return''};
const isAdvanced=c=>{const p=progressionOf(c);if(/^A/.test(p))return true;if(/^G/.test(p))return false;return /\bavancerad(?:\s+niva)?\b|\badvanced(?:\s+level)?\b/.test(low([c?.level,c?.educationLevel].filter(Boolean).join(' ')))};
const isThesis=c=>{if(c?.isThesis||c?.thesis||c?.independentWork||c?.examensarbete)return true;const p=progressionOf(c);if(/^(G2E|A1E|A2E)$/.test(p))return true;return /\bkandidatuppsats\b|\bexamensarbete\b|\bsjalvstandigt arbete\b|\bthesis\b|\bc-uppsats\b|\bmasteruppsats\b|\bmagisteruppsats\b/.test(low([courseName(c),c?.type,c?.category].filter(Boolean).join(' ')))};
const subjectOf=c=>text(c?.subject??c?.mainField??c?.huvudomrade??c?.field);
const subjectMatch=(c,s)=>{const wanted=text(s);if(!wanted)return false;const actual=subjectOf(c);if(actual)return phraseMatch(actual,wanted);return phraseMatch(courseName(c),wanted)};
function normalizeCourses(courses){return(Array.isArray(courses)?courses:[]).filter(Boolean).map((c,i)=>({...c,id:c.id||`course-${i}`,hp:hpOf(c),name:courseName(c),code:courseCode(c),subject:subjectOf(c),isAdvanced:isAdvanced(c),isThesis:isThesis(c)}))}
function evaluate(courses,requirements={}){const all=normalizeCourses(courses),eligible=requirements.excludeAdvancedFromTotal?all.filter(c=>!c.isAdvanced):all,subject=text(requirements.subject),totalRequired=num(requirements.totalHp),subjectRequired=num(requirements.subjectHp),thesisRequired=num(requirements.thesisHp),totalCompleted=eligible.reduce((s,c)=>s+c.hp,0),subjectRows=eligible.filter(c=>subjectMatch(c,subject)),subjectCompleted=subjectRows.reduce((s,c)=>s+c.hp,0),thesisCompleted=subjectRows.filter(c=>c.isThesis).reduce((s,c)=>s+c.hp,0),totalGap=Math.max(0,totalRequired-totalCompleted),subjectGap=Math.max(0,subjectRequired-subjectCompleted),thesisGap=Math.max(0,thesisRequired-thesisCompleted);return{version:VERSION,completed:{totalHp:totalCompleted,subjectHp:subjectCompleted,thesisHp:thesisCompleted},gaps:{totalGap,subjectGap,thesisGap},remainingHp:Math.max(totalGap,subjectGap,thesisGap),courses:all}}
window.StudieLotsV2=window.StudieLotsV2||{};window.StudieLotsV2.engine=Object.freeze({version:VERSION,normalizeCourses,evaluate,subjectMatch,isAdvanced,isThesis});
})();