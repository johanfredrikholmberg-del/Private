(()=>{
'use strict';
const VERSION='694',SNAPSHOT='studielots_planner_snapshot';
function ensureNewPlan(){
 if(typeof window.__v549NewPlan==='function')return;
 window.__v549NewPlan=()=>{try{sessionStorage.removeItem(SNAPSHOT);sessionStorage.removeItem('studielots_planner_origin')}catch(_){};if(typeof window.go==='function')window.go('degrees')};
}
function targetScreen(el){const id=el?.dataset?.screen||el?.dataset?.navTarget||'';return id&&document.getElementById(id)?id:''}
function installNavFallback(){
 document.addEventListener('click',e=>{const b=e.target.closest('.lotsen-bottomnav [data-screen]');if(!b||b.hasAttribute('onclick'))return;const id=targetScreen(b);if(id&&typeof window.go==='function')window.go(id)},false);
}
function audit(){
 const all=[...document.querySelectorAll('button')],issues=[];
 for(const b of all){if(b.disabled)continue;const inline=b.getAttribute('onclick'),screen=targetScreen(b),type=(b.getAttribute('type')||'').toLowerCase();if(inline||screen||type==='submit'||b.closest('details,form')||b.matches('[data-sl635-pace],[data-sl633-fast],[data-sl633-close],[data-sl633-pace],[data-v641-pace],[data-sl635-distance]'))continue;if(b.dataset&&Object.keys(b.dataset).length)continue;issues.push((b.textContent||'').replace(/\s+/g,' ').trim().slice(0,80)||'(utan text)')}
 window.__studielotsButtonAudit={version:VERSION,total:all.length,unwired:issues};
 return issues;
}
function refresh(){ensureNewPlan();setTimeout(audit,0)}
installNavFallback();['studielots:planner-snapshot','studielots:planner-open','studielots:screen-rendered','pageshow'].forEach(n=>window.addEventListener(n,refresh));if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else refresh();
window.__studielotsBuild={...(window.__studielotsBuild||{}),interactionGuard:VERSION,buttonAudit:'enabled',officialSnapshotRepair:'removed-v694',newPlanFallback:'enabled'};
})();
