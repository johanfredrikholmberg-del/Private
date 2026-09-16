(()=>{'use strict';
const root=window.StudieLotsV2||{},planner=document.getElementById('planner');
if(!planner)return;
const ordinary=document.getElementById('ordinaryPlan'),fast=document.getElementById('fastPlan'),fastTab=planner.querySelector('[data-route="fast"]'),switcher=planner.querySelector('.route-switch');
if(!ordinary||!fast||!fastTab||!switcher)return;
const style=document.createElement('style');style.textContent=`
#planner .route-switch{margin-bottom:16px}#planner .planner-route-help{display:none!important}
#planner .fast-controls{display:flex;flex-direction:column;gap:14px;padding:18px;border:1px solid var(--line,#dce4df);border-radius:20px;background:#fff;margin-bottom:16px}
#planner .fast-controls label{display:flex;flex-direction:column;align-items:stretch;gap:8px;min-width:0;font-size:14px;font-weight:700;line-height:1.35}
#planner .fast-controls select{display:block;width:100%;max-width:100%;min-width:0;box-sizing:border-box;padding:12px;border:1px solid #dce4df;border-radius:12px;background:#f5f8f6;color:#173c34;font-size:14px;white-space:normal}
#planner .fast-controls .summer-toggle{display:flex;flex-direction:row;align-items:center;gap:10px;font-size:14px}#planner .fast-controls .summer-toggle input{width:20px;height:20px;flex:0 0 20px}
#planner .fast-result-note{margin:0 0 14px}#planner .fast-result-note b{display:block;margin-bottom:5px}#planner .fast-result-note span{display:block;line-height:1.5}
#planner #studyPlanCta{display:flex;width:100%;margin-top:18px}#planner #fastCta{display:none!important}
`;document.head.appendChild(style);
let pending=false;
function sync(){pending=false;const data=root.appContext?.state?.plannerData,hasPlan=Array.isArray(data?.rows)&&data.rows.length>0,canOptimize=hasPlan&&data.verified===true;
fastTab.hidden=!canOptimize;
ordinary.querySelector('#fastCta')?.remove();
// The preview already contains its analysis. Do not show an extra button that merely repeats it.
ordinary.querySelectorAll('button,a').forEach(el=>{if(/^(se analys och förslag|visa förhandsanalys)$/i.test(el.textContent.trim()))el.remove()});
const unlock=ordinary.querySelector('#studyPlanCta');if(unlock){unlock.querySelector('b')?.replaceChildren(document.createTextNode('Lås upp din studieplan'));const small=unlock.querySelector('small');if(small)small.textContent='Testläge · öppet utan betalning';}
if(!canOptimize&&fastTab.classList.contains('active'))planner.querySelector('[data-route="ordinary"]')?.click();
fast.querySelectorAll('.fast-result-note').forEach(el=>el.remove());
if(fast.hidden||!canOptimize||fast.textContent.includes('Optimerar studieplanen'))return;
const controls=fast.querySelector('.fast-controls');if(!controls)return;
const win=fast.querySelector('.fast-win'),unscheduled=fast.querySelector('.info-note');
const note=document.createElement('div');note.className='info-note fast-result-note';const heading=document.createElement('b'),detail=document.createElement('span');
heading.textContent=win?'Jämför med ordinarie väg':unscheduled?'Snabbare väg kan ännu inte bekräftas':'Ingen säker tidsvinst hittades';
detail.textContent=win?'Den beräknade tidsvinsten och tillgängliga kurstillfällen visas nedan.':unscheduled?'Alla återstående kurser kan inte placeras med verifierade tillfällen. Ordinarie väg gäller tills vidare.':'Inga verifierade kurstillfällen ger just nu en kortare komplett studieplan.';
note.append(heading,detail);controls.after(note);
}
const observer=new MutationObserver(()=>{if(pending)return;pending=true;queueMicrotask(sync)});observer.observe(planner,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class']});sync();
})();