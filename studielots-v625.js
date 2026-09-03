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
  function plannerSnapshot(){
    try{return JSON.parse(sessionStorage.getItem('studielots_planner_snapshot')||'null')}catch(_){return null}
  }
  function usablePlannerSnapshot(){
    const s=plannerSnapshot();
    return !!(s&&((Array.isArray(s.rows)&&s.rows.length)||(Array.isArray(s.courses)&&s.courses.length)));
  }
  function openSharedPlanner(source){
    if(!usablePlannerSnapshot())return false;
    try{
      if(typeof window.go==='function')window.go('plannerClean');
      else{
        document.querySelectorAll('.screen').forEach(el=>el.classList.remove('active'));
        document.getElementById('plannerClean')?.classList.add('active');
      }
      window.dispatchEvent(new CustomEvent('studielots:planner-open',{detail:{source:source||'direct-open',version:'637'}}));
      return true;
    }catch(e){console.warn('[StudieLots] direct planner open failed',e);return false}
  }
  function installFastPlannerOpen(){
    const legacyOpen=window.openStudyPlanner;
    if(typeof legacyOpen==='function'&&!legacyOpen.__studielotsFastOpen){
      const fastOpen=function(){
        if(openSharedPlanner('fast-open'))return true;
        return legacyOpen.apply(this,arguments);
      };
      fastOpen.__studielotsFastOpen=true;
      fastOpen.__legacyOpen=legacyOpen;
      window.openStudyPlanner=fastOpen;
    }

    /* University choice should never stop on the old university/program summary.
       Let legacy selection logic create the snapshot, then immediately continue
       to the one shared Planner used by both university and distance routes. */
    const candidates=['openUniversityPathFromOpportunity','openProgramFromOpportunity','selectOpportunityUniversity','selectUniversityForOpportunity'];
    candidates.forEach(name=>{
      const legacy=window[name];
      if(typeof legacy!=='function'||legacy.__studielotsDirectPlanner)return;
      const wrapped=function(){
        const out=legacy.apply(this,arguments);
        const continueToPlanner=()=>openSharedPlanner('university-direct');
        if(!continueToPlanner()){
          requestAnimationFrame(()=>{
            if(!continueToPlanner())setTimeout(continueToPlanner,0);
          });
        }
        return out;
      };
      wrapped.__studielotsDirectPlanner=true;
      wrapped.__legacyOpen=legacy;
      window[name]=wrapped;
    });

    /* Catch the obsolete summary screen even if an inline handler calls an
       internal selector that is not exported on window. We only redirect when
       a complete planner snapshot already exists, so normal selection remains safe. */
    const redirectObsoleteSummary=()=>{
      if(!usablePlannerSnapshot())return;
      const active=document.querySelector('.screen.active');
      if(!active||active.id==='plannerClean')return;
      const text=(active.textContent||'').replace(/\s+/g,' ').trim();
      if(/Skapa plan i Planeraren/i.test(text)&&/Tillgodoräknat/i.test(text)&&/Kvar/i.test(text))openSharedPlanner('obsolete-summary-skip');
    };
    document.addEventListener('click',()=>requestAnimationFrame(redirectObsoleteSummary),true);
    window.addEventListener('studielots:planner-snapshot',()=>requestAnimationFrame(redirectObsoleteSummary));
    window.__studielotsBuild={...(window.__studielotsBuild||{}),plannerOpenGuard:'637',obsoleteUniversitySummary:'skipped'};
  }
  loadScript('/studielots-runtime.js?v=633','data-studielots-runtime');
  loadScript('/studielots-planner.js?v=635','data-studielots-shared-planner',installFastPlannerOpen);
})();
