(()=>{
  'use strict';
  const VERSION='631.1';
  let pending=false;
  let timer=0;
  let observer=null;

  function activeScreen(){return document.querySelector('.screen.active')?.id||''}
  function plannerCta(){return document.querySelector('#universityDetailContent .v550-plan-button, #universityDetailContent [data-v550-plan-cta] button, #universityDetailContent button.primary')}
  function stopObserver(){if(observer){observer.disconnect();observer=null}}
  function finish(){
    if(!pending)return true;
    const btn=plannerCta();
    if(btn){
      pending=false;
      clearTimeout(timer);
      stopObserver();
      btn.click();
      return true;
    }
    return false;
  }
  function begin(){
    pending=true;
    clearTimeout(timer);
    stopObserver();
    document.documentElement.classList.add('sl631-direct-planner');
    observer=new MutationObserver(()=>{if(pending&&finish())cleanupSoon()});
    observer.observe(document.getElementById('universityDetailContent')||document.body,{childList:true,subtree:true});
    let tries=0;
    const tick=()=>{
      if(finish())return cleanupSoon();
      if(++tries<16)return setTimeout(tick,25);
      pending=false;
      stopObserver();
      document.documentElement.classList.remove('sl631-direct-planner');
      if(typeof window.openStudyPlanner==='function')window.openStudyPlanner();
    };
    setTimeout(tick,0);
    timer=setTimeout(()=>{pending=false;stopObserver();document.documentElement.classList.remove('sl631-direct-planner')},800);
  }
  function cleanupSoon(){setTimeout(()=>document.documentElement.classList.remove('sl631-direct-planner'),60)}

  document.addEventListener('click',e=>{
    const btn=e.target.closest('.uni-path-btn');
    if(!btn||activeScreen()!=='degreeDetail')return;
    begin();
  },true);

  if(!document.getElementById('sl631-style')){
    const style=document.createElement('style');
    style.id='sl631-style';
    style.textContent='html.sl631-direct-planner #universityDetail{visibility:hidden!important;pointer-events:none!important}';
    document.head.appendChild(style);
  }

  window.__studielotsDirectPlanner={version:VERSION,skipUniversitySummary:true,preserveExistingPlannerSave:true,observerScoped:true};
})();
