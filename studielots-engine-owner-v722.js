(()=>{
'use strict';
const VERSION='725';
const OWNED=['canonicalPathResult','evaluateUniversityProgramV2'];
const pure=window.__studielotsPureEngine||{};
const original={},locked=[],missing=[];
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const txt=v=>String(v??'').replace(/\s+/g,' ').trim();
function looksCourse(c){return!!(c&&typeof c==='object'&&(num(c.hp??c.credits??c.ects??c.points)!=null||txt(c.name??c.courseName??c.title??c.course)))}
function findCourses(args){for(const a of args){if(Array.isArray(a)&&a.some(looksCourse))return a;if(a&&typeof a==='object'){for(const k of ['courses','merits','rows','completedCourses','eligibleCourses']){const v=a[k];if(Array.isArray(v)&&v.some(looksCourse))return v}}}return[]}
function pick(obj,keys){if(!obj||typeof obj!=='object')return undefined;for(const k of keys)if(obj[k]!=null&&obj[k]!=='')return obj[k]}
function inferRequirements(args,result){const objs=[...args.filter(a=>a&&typeof a==='object'&&!Array.isArray(a)),result].filter(Boolean);for(const o of objs){const total=pick(o,['totalHp','totalRequired','degreeHp','requiredHp','creditsRequired']);const subjectHp=pick(o,['subjectHp','subjectRequired','mainFieldHp','majorHp']);const thesisHp=pick(o,['thesisHp','thesisRequired','essayHp']);const subject=pick(o,['subject','mainField','huvudomrade','huvudområde','field']);if(total!=null||subjectHp!=null||thesisHp!=null||subject)return{totalHp:total??0,subjectHp:subjectHp??0,thesisHp:thesisHp??0,subject:subject??'',excludeAdvancedFromTotal:Boolean(pick(o,['excludeAdvancedFromTotal','excludeAdvanced','candidateExcludeAdvanced']))}}return null}
function legacyRemaining(result){if(result==null)return null;if(typeof result==='number')return num(result);if(typeof result!=='object')return null;for(const k of ['remainingHp','remaining','hpRemaining','missingHp','remainingCredits']){const n=num(result[k]);if(n!=null)return n}if(result.gaps&&typeof result.gaps==='object'){const n=num(result.gaps.remainingHp);if(n!=null)return n}return null}
const stats={version:VERSION,calls:0,comparable:0,matches:0,mismatches:0,last:null};
function shadow(name,args,result){stats.calls++;if(typeof pure.evaluateRequirements!=='function')return;const courses=findCourses(args),requirements=inferRequirements(args,result),legacy=legacyRemaining(result);if(!courses.length||!requirements||legacy==null)return;try{const next=pure.evaluateRequirements(courses,requirements),fresh=num(next?.remainingHp);if(fresh==null)return;const delta=Math.round((fresh-legacy)*10)/10,match=Math.abs(delta)<0.01;stats.comparable++;if(match)stats.matches++;else stats.mismatches++;stats.last={at:new Date().toISOString(),entry:name,legacyRemainingHp:legacy,pureRemainingHp:fresh,deltaHp:delta,match,courseCount:courses.length,requirements:next.requirements};try{sessionStorage.setItem('studielots_engine_shadow_v725',JSON.stringify(stats.last))}catch(_){}window.dispatchEvent(new CustomEvent('studielots:engine-shadow',{detail:stats.last}))}catch(_){}
}
function wrap(name,fn){return function(...args){const result=fn.apply(this,args);if(result&&typeof result.then==='function')return result.then(v=>{shadow(name,args,v);return v});shadow(name,args,result);return result}}
for(const name of OWNED){const fn=window[name];if(typeof fn!=='function'){missing.push(name);continue}original[name]=fn;const owned=wrap(name,fn);try{Object.defineProperty(window,name,{value:owned,writable:false,configurable:false,enumerable:true});locked.push(name)}catch(_){try{window[name]=owned;locked.push(name)}catch(__){missing.push(name)}}}
window.__studielotsEngineShadow=stats;
window.__studielotsEngine=Object.freeze({
 version:VERSION,pureVersion:pure.version||null,shadowMode:true,
 hpOf:pure.hpOf,courseName:pure.courseName,courseCode:pure.courseCode,isCredited:pure.isCredited,isAdvanced:pure.isAdvanced,isThesis:pure.isThesis,subjectOf:pure.subjectOf,
 normalizeCourses:pure.normalizeCourses,sumHp:pure.sumHp,summarizeCourses:pure.summarizeCourses,requirementGap:pure.requirementGap,degreeGaps:pure.degreeGaps,subjectMatch:pure.subjectMatch,evaluateRequirements:pure.evaluateRequirements,
 canonicalPathResult:(...args)=>window.canonicalPathResult?.(...args),evaluateUniversityProgramV2:(...args)=>window.evaluateUniversityProgramV2?.(...args),owned:[...locked],missing:[...missing]
});
window.__studielotsBuild={...(window.__studielotsBuild||{}),engineOwner:VERSION,engineOwnership:'single-owner-shadow-comparison',pureEngineShadow:true};
window.dispatchEvent(new CustomEvent('studielots:engine-ready',{detail:{version:VERSION,pureVersion:pure.version||null,shadowMode:true,owned:[...locked],missing:[...missing]}}));
})();