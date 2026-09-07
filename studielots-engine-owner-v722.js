(()=>{
'use strict';
const VERSION='722';
const OWNED=['canonicalPathResult','evaluateUniversityProgramV2'];
const captured={};
const locked=[];
const missing=[];
for(const name of OWNED){
  const fn=window[name];
  if(typeof fn!=='function'){missing.push(name);continue}
  captured[name]=fn;
  try{
    Object.defineProperty(window,name,{value:fn,writable:false,configurable:false,enumerable:true});
    locked.push(name);
  }catch(_){
    try{window[name]=fn;locked.push(name)}catch(__){missing.push(name)}
  }
}
window.__studielotsEngine=Object.freeze({
  version:VERSION,
  canonicalPathResult:(...args)=>captured.canonicalPathResult?.(...args),
  evaluateUniversityProgramV2:(...args)=>captured.evaluateUniversityProgramV2?.(...args),
  owned:[...locked],
  missing:[...missing]
});
window.__studielotsBuild={...(window.__studielotsBuild||{}),engineOwner:VERSION,engineOwnership:'single-owner-after-core'};
window.dispatchEvent(new CustomEvent('studielots:engine-ready',{detail:{version:VERSION,owned:[...locked],missing:[...missing]}}));
})();