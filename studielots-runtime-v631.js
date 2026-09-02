(()=>{
  'use strict';
  const VERSION='631';
  let pending=false;
  let timer=0;

  function activeScreen(){return document.querySelector('.screen.active')?.id||''}
  function plannerCta(){
    return document.querySelector('#universityDetailContent .v550-plan-button, #universityDetailContent [data-v550-plan-cta] button, #universityDetailContent button.primary');
  }
  function finish(){
    if(!pending)return true;
    const btn=plannerCta();
    if(btn){
      pending=false;
      clearTimeout(timer);
      btn.click();
      return true;
    }
    return false;
  }
  function begin(){
    pending=true;
    clearTimeout(timer);
    document.documentElement.classList.add('sl631-direct-planner');
    let tries=0;
    const tick=()=>{
      if(finish())return cleanupSoon();
      if(++tries<24)return setTimeout(tick,25);
      pending=false;
      document.documentElement.classList.remove('sl631-direct-planner');
      if(typeof window.openStudyPlanner==='function')window.openStudyPlanner();
    };
    setTimeout(tick,0);
    timer=setTimeout(()=>{pending=false;document.documentElement.classList.remove('sl631-direct-planner')},1200);
  }
  function cleanupSoon(){setTimeout(()=>document.documentElement.classList.remove('sl631-direct-planner'),60)}

  // Degree opportunity -> university choice -> planner directly.
  // The existing CTA is clicked programmatically so its current saveSelection/
  // snapshot logic stays authoritative; only the redundant summary screen is skipped.
  document.addEventListener('click',e=>{
    const btn=e.target.closest('.uni-path-btn');
    if(!btn||activeScreen()!=='degreeDetail')return;
    begin();
  },true);

  const observer=new MutationObserver(()=>{if(pending&&finish())cleanupSoon()});
  observer.observe(document.documentElement,{childList:true,subtree:true});

  if(!document.getElementById('sl631-style')){
    const style=document.createElement('style');
    style.id='sl631-style';
    style.textContent='html.sl631-direct-planner #universityDetail{visibility:hidden!important;pointer-events:none!important}';
    document.head.appendChild(style);
  }

  window.__studielotsDirectPlanner={version:VERSION,skipUniversitySummary:true,preserveExistingPlannerSave:true};
})();
