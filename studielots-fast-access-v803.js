(()=>{
'use strict';
const VERSION='803';
const VIEW_KEY='studielots_planner_view_v800';
let wasPlanner=false;
let revealed=false;
function activePlanner(){return document.querySelector('.screen.active')?.id==='plannerClean'}
function render(){setTimeout(()=>window.__studielotsRenderSharedPlanner?.(),0)}
function resetForEntry(){revealed=false;sessionStorage.removeItem(VIEW_KEY);render()}
function checkEntry(){const now=activePlanner();if(now&&!wasPlanner)resetForEntry();if(!now)revealed=false;wasPlanner=now}
function gateClick(e){const b=e.target?.closest?.('[data-view="fast"]');if(!b||!activePlanner())return;const gate=window.__studielotsFastRouteAccessGate;if(typeof gate==='function'){
  let allowed=true;try{allowed=gate({source:'planner',version:VERSION})!==false}catch(_){allowed=false}
  if(!allowed){e.preventDefault();e.stopImmediatePropagation();window.dispatchEvent(new CustomEvent('studielots:fast-route-locked'));return}
}
revealed=true;window.dispatchEvent(new CustomEvent('studielots:fast-route-opened'));
}
function preventDirectFast(){if(activePlanner()&&!revealed&&sessionStorage.getItem(VIEW_KEY)==='fast'){sessionStorage.removeItem(VIEW_KEY);render()}}
function install(){document.addEventListener('click',gateClick,true);['studielots:screen-rendered','pageshow','popstate','hashchange'].forEach(name=>window.addEventListener(name,()=>setTimeout(()=>{checkEntry();preventDirectFast()},0)));const screens=document.querySelectorAll('.screen');screens.forEach(s=>new MutationObserver(()=>{checkEntry();preventDirectFast()}).observe(s,{attributes:true,attributeFilter:['class']}));checkEntry();preventDirectFast();window.__studielotsFastAccess={version:VERSION,isRevealed:()=>revealed,reset:resetForEntry};window.__studielotsBuild={...(window.__studielotsBuild||{}),fastRouteAccess:VERSION}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();