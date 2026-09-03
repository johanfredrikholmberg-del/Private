(()=>{
'use strict';
const VERSION='657';
const norm=v=>String(v??'').trim().toLocaleLowerCase('sv-SE');
const code=v=>String(v??'').trim().toUpperCase().replace(/[^A-Z0-9ÅÄÖ]/g,'');
function definitionKey(r){return String(r?.definitionKey||[norm(r?.university),code(r?.code),norm(r?.name)].join('|'))}
function harden(rows){const seen=new Set(),out=[];for(const r of Array.isArray(rows)?rows:[]){if(!r)continue;const k=definitionKey(r);if(!k||seen.has(k))continue;seen.add(k);out.push({...r,sourceOfferingKey:r.offeringKey||'',offeringKey:'definition|'+k})}return out}
function install(){const old=window.verifiedDistanceCoursesForNeed;if(typeof old!=='function'||old.__sl657)return false;const fn=function(){return harden(old.apply(this,arguments))};fn.__sl657=true;fn.__legacy=old;window.verifiedDistanceCoursesForNeed=fn;try{verifiedDistanceCoursesForNeed=fn}catch(_){}window.__studielotsBuild={...(window.__studielotsBuild||{}),distanceDuplicateGuard:VERSION,distanceCourseReuseBlocked:true};window.dispatchEvent(new CustomEvent('studielots:planner-open',{detail:{source:'distance-dedupe-guard',version:VERSION}}));return true}
let tries=0;function retry(){if(install())return;if(++tries<20)setTimeout(retry,100)}
retry();
})();