(()=>{
'use strict';
const VERSION='805';
const VIEW_KEY='studielots_planner_view_v800';
let wasPlanner=false;
let revealed=false;
function activePlanner(){return document.querySelector('.screen.active')?.id==='plannerClean'}
function render(){setTimeout(()=>window.__studielotsRenderSharedPlanner?.(),0)}
function resetForEntry(){revealed=false;sessionStorage.removeItem(VIEW_KEY);render()}
function checkEntry(){const now=activePlanner();if(now&&!wasPlanner)resetForEntry();if(!now)revealed=false;wasPlanner=now}
function requestFastRouteAccess(meta={}){
  const gate=window.__studielotsFastRouteAccessGate;
  let allowed=true;
  if(typeof gate==='function'){
    try{allowed=gate({source:meta.source||'planner',version:VERSION})!==false}catch(_){allowed=false}
  }
  if(!allowed){window.dispatchEvent(new CustomEvent('studielots:fast-route-locked',{detail:{source:meta.source||'planner',version:VERSION}}));return false}
  revealed=true;
  window.dispatchEvent(new CustomEvent('studielots:fast-route-opened',{detail:{source:meta.source||'planner',version:VERSION}}));
  return true;
}
function gateClick(e){
  const b=e.target?.closest?.('[data-view="fast"]');
  if(!b||!activePlanner())return;
  if(!requestFastRouteAccess({source:'planner-click'})){
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}
function preventDirectFast(){if(activePlanner()&&!revealed&&sessionStorage.getItem(VIEW_KEY)==='fast'){sessionStorage.removeItem(VIEW_KEY);render()}}
function install(){
  document.addEventListener('click',gateClick,true);
  ['studielots:screen-rendered','pageshow','popstate','hashchange'].forEach(name=>window.addEventListener(name,()=>setTimeout(()=>{checkEntry();preventDirectFast()},0)));
  const screens=document.querySelectorAll('.screen');
  screens.forEach(s=>new MutationObserver(()=>{checkEntry();preventDirectFast()}).observe(s,{attributes:true,attributeFilter:['class']}));
  checkEntry();preventDirectFast();
  window.__studielotsRequestFastRouteAccess=requestFastRouteAccess;
  window.__studielotsFastAccess={version:VERSION,isRevealed:()=>revealed,reset:resetForEntry,request:requestFastRouteAccess};
  window.__studielotsBuild={...(window.__studielotsBuild||{}),fastRouteAccess:VERSION,paywallBoundary:true};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();