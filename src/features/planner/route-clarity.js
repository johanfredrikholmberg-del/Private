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
if(fastTab.hidden===canOptimize)fastTab.hidden=!canOptimize;
ordinary.querySelector('#fastCta')?.remove();
ordinary.querySelectorAll('button,a').forEach(el=>{if(/^(se analys och förslag|visa förhandsanalys)$/i.test(el.textContent.trim()))el.remove()});
const unlock=ordinary.querySelector('#studyPlanCta');if(unlock){const heading=unlock.querySelector('b');if(heading&&heading.textContent!=='Lås upp din studieplan')heading.textContent='Lås upp din studieplan';const small=unlock.querySelector('small');if(small&&small.textContent!=='Testläge · öppet utan betalning')small.textContent='Testläge · öppet utan betalning';}
if(!canOptimize&&fastTab.classList.contains('active'))planner.querySelector('[data-route="ordinary"]')?.click();
const controls=fast.querySelector('.fast-controls'),existing=fast.querySelector('.fast-result-note');
if(fast.hidden||!canOptimize||fast.textContent.includes('Optimerar studieplanen')||!controls){existing?.remove();return;}
const win=fast.querySelector('.fast-win'),unscheduled=fast.querySelector('.info-note:not(.fast-result-note)');
const heading=win?'Jämför med ordinarie väg':unscheduled?'Snabbare väg kan ännu inte bekräftas':'Ingen säker tidsvinst hittades';
const detail=win?'Den beräknade tidsvinsten och tillgängliga kurstillfällen visas nedan.':unscheduled?'Alla återstående kurser kan inte placeras med verifierade tillfällen. Ordinarie väg gäller tills vidare.':'Inga verifierade kurstillfällen ger just nu en kortare komplett studieplan.';
if(existing&&existing.querySelector('b')?.textContent===heading&&existing.querySelector('span')?.textContent===detail&&existing.previousElementSibling===controls)return;
existing?.remove();const note=document.createElement('div');note.className='info-note fast-result-note';const b=document.createElement('b'),span=document.createElement('span');b.textContent=heading;span.textContent=detail;note.append(b,span);controls.after(note);
}
const observer=new MutationObserver(()=>{if(pending)return;pending=true;setTimeout(sync,50)});observer.observe(planner,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class']});sync();
})();