(()=>{'use strict';
// One route switch is the sole entry point. The study plan is already visible in test mode.
const root=window.StudieLotsV2||{};
const planner=document.getElementById('planner');
if(!planner)return;
const ordinary=document.getElementById('ordinaryPlan');
const fast=document.getElementById('fastPlan');
const fastTab=planner.querySelector('[data-route="fast"]');
const switcher=planner.querySelector('.route-switch');
if(!ordinary||!fast||!fastTab||!switcher)return;
const note=document.createElement('p');
note.className='planner-route-help';
note.setAttribute('aria-live','polite');
switcher.insertAdjacentElement('afterend',note);
const style=document.createElement('style');
style.textContent='.planner-route-help{font-size:12px;line-height:1.5;color:var(--muted,#64746d);margin:8px 4px 16px}.route-switch [data-route]{min-width:0}.fast-result-note{margin:12px 0 16px}';
document.head.appendChild(style);
let pending=false;
function sync(){
  pending=false;
  const data=root.appContext?.state?.plannerData;
  const hasPlan=Array.isArray(data?.rows)&&data.rows.length>0;
  const canOptimize=hasPlan&&data.verified===true;
  fastTab.hidden=!canOptimize;
  // The two old CTA buttons duplicated the route switch and the unlock button did not unlock anything.
  ordinary.querySelector('#studyPlanCta')?.remove();
  ordinary.querySelector('#fastCta')?.remove();
  if(!canOptimize&&fastTab.classList.contains('active')){
    planner.querySelector('[data-route="ordinary"]')?.click();
  }
  note.textContent=!hasPlan?'Välj ett program för att se din studieplan.':canOptimize?'Välj ordinarie väg eller undersök om en snabbare väg går att styrka med tillgängliga kurstillfällen.':'Ordinarie studieplan visas. Snabbare väg visas först när programplanen är verifierad.';
  if(!fast.hidden&&canOptimize&&!fast.querySelector('.fast-result-note')&&!fast.querySelector('.info-note b')?.textContent?.includes('Optimerar')){
    const hasWin=!!fast.querySelector('.fast-win');
    const unscheduled=!!fast.querySelector('.info-note');
    const result=document.createElement('div');
    result.className='info-note fast-result-note';
    const title=document.createElement('b');
    const detail=document.createElement('span');
    title.textContent=hasWin?'Jämför med ordinarie väg':unscheduled?'Snabbare väg kan ännu inte bekräftas':'Ingen verifierad tidsvinst hittades';
    detail.textContent=hasWin?'Se den beräknade tidsvinsten och kurstillfällena nedan.':unscheduled?'Alla återstående kurser kan inte placeras säkert. Ordinarie väg är fortsatt utgångspunkten.':'Vi hittade ingen kortare komplett väg med de kurstillfällen som finns i databasen. Ordinarie väg är fortsatt utgångspunkten.';
    result.append(title,detail);
    fast.insertBefore(result,fast.querySelector('.fast-controls')?.nextSibling||fast.firstChild);
  }
}
const observer=new MutationObserver(()=>{if(pending)return;pending=true;queueMicrotask(sync)});
observer.observe(planner,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class']});
sync();
})();