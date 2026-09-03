(()=>{
  'use strict';
  function loadScript(src,marker,onload){
    const existing=document.querySelector(`script[${marker}]`);
    if(existing){
      if(onload){
        if(existing.dataset.loaded==='1')onload();
        else existing.addEventListener('load',onload,{once:true});
      }
      return;
    }
    const script=document.createElement('script');
    script.src=src;
    script.setAttribute(marker,'1');
    script.async=false;
    script.addEventListener('load',()=>{
      script.dataset.loaded='1';
      if(onload)onload();
    },{once:true});
    document.body.appendChild(script);
  }
  function usablePlannerSnapshot(){
    try{
      const s=JSON.parse(sessionStorage.getItem('studielots_planner_snapshot')||'null');
      return !!(s&&(Array.isArray(s.rows)&&s.rows.length||Array.isArray(s.courses)&&s.courses.length));
    }catch(_){return false;}
  }
  function installFastPlannerOpen(){
    const legacyOpen=window.openStudyPlanner;
    if(typeof legacyOpen!=='function'||legacyOpen.__studielotsFastOpen)return;
    const fastOpen=function(){
      if(!usablePlannerSnapshot())return legacyOpen.apply(this,arguments);
      try{
        if(typeof window.go==='function')window.go('plannerClean');
        else{
          document.querySelectorAll('.screen').forEach(el=>el.classList.remove('active'));
          document.getElementById('plannerClean')?.classList.add('active');
        }
        window.dispatchEvent(new CustomEvent('studielots:planner-open',{detail:{source:'fast-open',version:'636'}}));
        return true;
      }catch(e){
        console.warn('[StudieLots] fast planner open fallback',e);
        return legacyOpen.apply(this,arguments);
      }
    };
    fastOpen.__studielotsFastOpen=true;
    fastOpen.__legacyOpen=legacyOpen;
    window.openStudyPlanner=fastOpen;
    window.__studielotsBuild={...(window.__studielotsBuild||{}),plannerOpenGuard:'636'};
  }
  loadScript('/studielots-runtime.js?v=633','data-studielots-runtime');
  loadScript('/studielots-planner.js?v=635','data-studielots-shared-planner',installFastPlannerOpen);
})();
