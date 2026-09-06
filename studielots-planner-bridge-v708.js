(()=>{
'use strict';
if(window.__studielotsPlannerBridge708)return;
window.__studielotsPlannerBridge708=true;
function load(){
  if(document.querySelector('script[data-studielots-planner="690"]'))return;
  const s=document.createElement('script');
  s.src='/studielots-planner.js?v=690';
  s.async=false;
  s.dataset.studielotsPlanner='690';
  s.onload=()=>{
    window.dispatchEvent(new CustomEvent('studielots:planner-open',{detail:{source:'planner-bridge-v708',version:'708'}}));
  };
  document.body.appendChild(s);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
