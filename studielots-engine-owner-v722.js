(()=>{
'use strict';
const VERSION='724';
const OWNED=['canonicalPathResult','evaluateUniversityProgramV2'];
const captured={},locked=[],missing=[];
for(const name of OWNED){const fn=window[name];if(typeof fn!=='function'){missing.push(name);continue}captured[name]=fn;try{Object.defineProperty(window,name,{value:fn,writable:false,configurable:false,enumerable:true});locked.push(name)}catch(_){try{window[name]=fn;locked.push(name)}catch(__){missing.push(name)}}}
const pure=window.__studielotsPureEngine||{};
window.__studielotsEngine=Object.freeze({
 version:VERSION,pureVersion:pure.version||null,
 hpOf:pure.hpOf,courseName:pure.courseName,courseCode:pure.courseCode,isCredited:pure.isCredited,isAdvanced:pure.isAdvanced,isThesis:pure.isThesis,subjectOf:pure.subjectOf,
 normalizeCourses:pure.normalizeCourses,sumHp:pure.sumHp,summarizeCourses:pure.summarizeCourses,requirementGap:pure.requirementGap,degreeGaps:pure.degreeGaps,subjectMatch:pure.subjectMatch,evaluateRequirements:pure.evaluateRequirements,
 canonicalPathResult:(...args)=>captured.canonicalPathResult?.(...args),evaluateUniversityProgramV2:(...args)=>captured.evaluateUniversityProgramV2?.(...args),owned:[...locked],missing:[...missing]
});
window.__studielotsBuild={...(window.__studielotsBuild||{}),engineOwner:VERSION,engineOwnership:'single-owner-with-pure-requirement-engine'};
window.dispatchEvent(new CustomEvent('studielots:engine-ready',{detail:{version:VERSION,pureVersion:pure.version||null,owned:[...locked],missing:[...missing]}}));
})();