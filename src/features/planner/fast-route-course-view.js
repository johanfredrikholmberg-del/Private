(()=>{'use strict';
// Presentation only: the fast-route engine owns scheduling and hp calculations.
const root=window.StudieLotsV2=window.StudieLotsV2||{};
if(root.__fastRouteCourseView)return;
root.__fastRouteCourseView=true;
const host=()=>document.querySelector('#fastPlan');
function enhance(){
 const el=host();if(!el||el.hidden)return;
 const terms=el.querySelectorAll('.term-list .term-row');
 terms.forEach((term,index)=>{
  const heading=term.querySelector('.term-summary b');
  if(heading&&!heading.dataset.fastTermLabel){
   const season=heading.textContent.trim();
   heading.textContent=`Termin ${index+1} · ${season}`;
   heading.dataset.fastTermLabel='1';
  }
  term.querySelectorAll('.course').forEach(course=>{
   // Every course in this view is still to be studied; evidence belongs in the separate underlag view.
   course.querySelectorAll('.status,.match-note,.evidence-details,.strong-evidence-details').forEach(node=>node.remove());
   course.classList.remove('strong-evidence','relevant-evidence','limited-evidence');
   course.removeAttribute('data-evidence-level');
  });
 });
}
let observing=false;
function start(){const el=host();if(!el||observing)return;observing=true;const observer=new MutationObserver(()=>{observer.disconnect();enhance();observer.observe(el,{childList:true,subtree:true})});observer.observe(el,{childList:true,subtree:true});enhance();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
