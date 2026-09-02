(()=>{
  'use strict';
  const VERSION='613';
  const norm=v=>String(v??'').trim();
  const low=v=>norm(v).toLocaleLowerCase('sv-SE');
  const number=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
  const hp=v=>{const n=number(v);return n===null?null:Math.round(n*2)/2};
  const fmt=v=>String(hp(v)??0).replace('.',',');
  const esc=s=>norm(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function options(o){
    try{const rows=window.universityOptionsForOpportunity?.(o);return Array.isArray(rows)?rows:[]}
    catch(_){return[]}
  }
  function storedProfile(){try{return sessionStorage.getItem('lotsen_preferred_profile')||''}catch(_){return''}}
  const optionProfile=x=>norm(x?.d?.id||x?.profileId);
  const optionRemaining=x=>hp(x?.v2?.remaining??x?.remaining);
  function authority(o,profileId=''){
    const rows=options(o).filter(x=>optionRemaining(x)!==null);
    const wanted=norm(profileId||storedProfile());
    let row=wanted?rows.find(x=>optionProfile(x)===wanted):null;
    if(!row&&rows.length===1)row=rows[0];
    if(!row&&rows.length)row=rows.slice().sort((a,b)=>optionRemaining(a)-optionRemaining(b))[0];
    const fallback=o?.source==='advanced'?(low(o?.degreeType).includes('magister')?60:120):180;
    const total=hp(o?.total??o?.totalHp??o?.hp??fallback)??fallback;
    const remaining=row?optionRemaining(row):(hp(o?.remaining)??total);
    return{version:VERSION,total,remaining,credited:Math.max(0,total-remaining),profileId:row?optionProfile(row):wanted,university:norm(row?.d?.university||row?.university),row,options:rows};
  }
  window.__studielotsHpAuthority=authority;

  function wrap(name,maker){
    const current=window[name];
    if(typeof current!=='function'||current.__sl611)return;
    const wrapped=maker(current);
    wrapped.__sl611=true;
    window[name]=wrapped;
  }
  function installAuthority(){
    wrap('safeDegreeOpportunities',base=>function(){
      const out=base.apply(this,arguments);
      return Array.isArray(out)?out.map(o=>{const a=authority(o);return{...o,remaining:a.remaining,credited:a.credited,score:Math.max(0,Math.min(100,Math.round(100*a.credited/Math.max(1,a.total)))),canonicalProfileId:a.profileId,canonicalUniversity:a.university,hpAuthorityVersion:VERSION}}):out;
    });
    wrap('canonicalRemaining',base=>function(o,profileId=''){const a=authority(o,profileId);return a.remaining??base.apply(this,arguments)});
    wrap('opportunityRemainingLabel',base=>function(o){const a=authority(o);return a.remaining?fmt(a.remaining)+' hp kvar':'Klar'});
    wrap('opportunityStatus',base=>function(o){const a=authority(o);return{label:a.remaining?fmt(a.remaining)+' hp kvar':'Klar',kind:a.remaining===0?'ready':a.remaining<=30?'near':'normal'}});
    ['openUniversityPath','renderUniversityDetail'].forEach(name=>wrap(name,base=>function(profileId){
      if(profileId)try{sessionStorage.setItem('lotsen_preferred_profile',String(profileId))}catch(_){}
      const out=base.apply(this,arguments);requestAnimationFrame(syncVisible);return out;
    }));
    ['renderDegrees','refreshAll'].forEach(name=>wrap(name,base=>function(){const out=base.apply(this,arguments);requestAnimationFrame(syncVisible);return out}));
    wrap('renderDegreeDetail',base=>function(){const out=base.apply(this,arguments);requestAnimationFrame(syncVisible);return out});
  }

  function opportunityForDetail(){
    try{const key=sessionStorage.getItem('lotsen_detail_key');return window.opportunityByKey?.(key)||null}catch(_){return null}
  }
  function distanceHref(o){return '/?studielots-distance='+encodeURIComponent(o.key)+'&verify='+VERSION}
  function ensureDistanceLink(){
    const root=document.getElementById('degreeDetailContent');
    if(!root)return;
    const section=[...root.querySelectorAll('.detail-block')].find(s=>low(s.querySelector('h2')?.textContent)==='på distans');
    const o=opportunityForDetail();
    if(!section||!o)return;
    let link=section.querySelector('.sl-distance-entry-v611');
    if(!link){
      link=document.createElement('a');
      link.className='sl-distance-entry-v611';
      link.innerHTML='<div><strong>Visa distansväg</strong><small>Bygg en plan av kurser som kan läsas helt på distans</small></div><span aria-hidden="true">›</span>';
      const empty=[...section.querySelectorAll('.muted,.small,.tiny-help')].find(el=>/inga tydliga distansalternativ/i.test(el.textContent||''));
      if(empty)empty.replaceWith(link);else section.appendChild(link);
    }
    link.href=distanceHref(o);
  }
  function openDistance(o){
    try{
      sessionStorage.setItem('lotsen_mypath_mode','distance');
      sessionStorage.setItem('studielots_mode','distance');
      sessionStorage.setItem('lotsen_detail_key',o.key);
    }catch(_){}
    window.__studielotsLastOpportunity=o;
    window.__studielotsLastUniversityOptions=options(o);
    const root=document.getElementById('degreeDetailContent');
    if(!root)return false;
    let plan='';
    try{if(typeof window.myPathDistancePlanHtml==='function')plan=window.myPathDistancePlanHtml(o)}catch(_){}
    if(!plan)plan='<section class="mypath-distance-plan"><div class="mypath-distance-plan-head"><div><span>Distans</span><h3>Förslag att läsa</h3></div></div><p class="mypath-distance-intro">Distansplanen byggs av det som återstår till examen. Kurstillfällen visas först när de har verifierats som helt på distans.</p></section>';
    root.innerHTML='<div class="detail-hero"><div><div class="eyebrow">På distans</div><h1>'+esc(o.subject||o.name)+'</h1></div></div>'+plan+'<button class="secondary sl-distance-back-v611" type="button">‹ Välj annat lärosäte</button>';
    root.querySelector('.sl-distance-back-v611')?.addEventListener('click',()=>window.renderDegreeDetail?.(o.key),{once:true});
    window.scrollTo(0,0);
    return true;
  }
  let distanceOpened=false;
  function openDistanceFromUrl(){
    if(distanceOpened)return true;
    const key=new URL(location.href).searchParams.get('studielots-distance')||'';
    if(!key)return true;
    let o=null;
    try{o=window.opportunityByKey?.(key)||null}catch(_){}
    if(!o)return false;
    try{sessionStorage.setItem('lotsen_detail_key',key)}catch(_){}
    window.go?.('degreeDetail');
    window.renderDegreeDetail?.(key);
    distanceOpened=openDistance(o);
    return distanceOpened;
  }

  function repairHome(){
    let rows=[];try{rows=window.safeDegreeOpportunities?.()||[]}catch(_){}
    if(!Array.isArray(rows)||!rows.length)return;
    const sorted=xs=>xs.filter(x=>hp(x?.remaining)!==null).slice().sort((a,b)=>hp(a.remaining)-hp(b.remaining));
    const candidate=sorted(rows.filter(x=>x?.source!=='advanced'))[0];
    const advanced=sorted(rows.filter(x=>x?.source==='advanced'))[0];
    const shortest=sorted(rows)[0];
    const set=(id,value)=>{const el=document.getElementById(id);if(el&&el.textContent!==value)el.textContent=value};
    if(candidate){const a=authority(candidate);set('homeFastestCandidateName',candidate.name||candidate.subject||'Kandidatexamen');set('homeFastestCandidateMeta',fmt(a.credited)+' hp kan räknas · '+fmt(a.remaining)+' hp kvar')}
    if(advanced){const a=authority(advanced);set('homeFastestAdvancedName',advanced.name||advanced.subject||'Examen på avancerad nivå');set('homeFastestAdvancedMeta',fmt(a.credited)+' hp kan räknas · '+fmt(a.remaining)+' hp kvar')}
    if(shortest)set('shortest',fmt(authority(shortest).remaining)+' hp');
  }
  function repairCards(){
    let rows=[];try{rows=window.safeDegreeOpportunities?.().filter(o=>o?.source!=='advanced').slice(0,8)||[]}catch(_){return}
    [...document.querySelectorAll('#degreeResults .opportunity-discovery-card')].forEach((card,i)=>{
      const o=rows[i],badge=card.querySelector('.opportunity-status');if(!o||!badge)return;
      const a=authority(o);badge.textContent=a.remaining?fmt(a.remaining)+' hp kvar':'Klar';
      badge.classList.toggle('ready',a.remaining===0);badge.classList.toggle('near',a.remaining>0&&a.remaining<=30);badge.classList.toggle('normal',a.remaining>30);
    });
  }
  function repairDetail(){
    const root=document.querySelector('#universityDetailContent .v21-detail')||document.getElementById('universityDetailContent');
    const o=opportunityForDetail();if(!root||!o)return;
    const a=authority(o,storedProfile());if(!a.row)return;
    const summary=[...root.querySelectorAll('.v21-summary,.detail-summary,.canonical-summary')].find(el=>/hp kan räknas in i examen/i.test(el.textContent||''));
    if(summary)summary.innerHTML='<strong>'+fmt(a.credited)+' hp kan räknas in i examen · '+fmt(a.remaining)+' hp kvar</strong>';
  }

  const PACE_KEY='studielots_planner_pace_hp';
  const PACE_VALUES=[30,37.5,45];
  const getPace=()=>{let n=30;try{n=Number(localStorage.getItem(PACE_KEY))}catch(_){}return PACE_VALUES.includes(n)?n:30};
  const termOf=r=>Number(r?.term??r?.semester??r?.termNo??r?.originalTerm)||0;
  const periodOf=r=>Number(r?.period??r?.studyPeriod??r?.periodNo)||0;
  const rowHp=r=>hp(r?.hp??r?.credits??r?.credit??r?.ects??r?.points)??0;
  const courseName=r=>norm(r?.name??r?.courseName??r?.title??r?.course??'Kurs');
  const isCredited=r=>Boolean(r?.credited||r?.completed||r?.done||r?.tillgodoraknad||r?.isCredited||r?.matched===true||r?.status==='credited'||r?.status==='completed');
  function plannerPolicy(){
    const pace=getPace();
    return window.__studielotsPlannerPolicy={version:VERSION,mode:'faster-route',baseline:'program-schedule',scheduleSource:'program-term-rows',maxHpPerTerm:pace,preserveCourseOrder:true,preserveCreditedCourses:true,creditedCoursesCountTowardLoad:false,showPlanChanges:true,fasterRouteOptIn:pace>30};
  }
  function authoritativeRows(snapshot){
    const rows=Array.isArray(snapshot?.rows)?snapshot.rows:Array.isArray(snapshot?.courses)?snapshot.courses:[];
    return rows.map((r,i)=>({...r,__slOriginalIndex:i,__slOriginalTerm:termOf(r)||1,__slOriginalPeriod:periodOf(r)})).sort((a,b)=>(a.__slOriginalTerm-b.__slOriginalTerm)||(a.__slOriginalPeriod-b.__slOriginalPeriod)||(a.__slOriginalIndex-b.__slOriginalIndex));
  }
  function optimizeRows(snapshot){
    const pace=getPace(),all=authoritativeRows(snapshot),active=all.filter(r=>!isCredited(r));
    let term=1,used=0;
    const planned=active.map(r=>{
      const credits=rowHp(r);
      if(pace>30&&used>0&&used+credits>pace+.001){term++;used=0}
      const plannedTerm=pace===30?r.__slOriginalTerm:term;
      if(pace>30)used+=credits;
      return{...r,term:plannedTerm,plannedTerm,originalTerm:r.__slOriginalTerm,plannedHp:credits,loadHp:credits,movedEarlier:plannedTerm<r.__slOriginalTerm,credited:false};
    });
    const credited=all.filter(isCredited).map(r=>{
      const moved=planned.find(x=>x.movedEarlier),alternative=norm(r?.alternativeCourse??r?.replacementCourse??r?.suggestedAlternative??r?.alternative)||(moved?courseName(moved):'');
      return{...r,term:r.__slOriginalTerm,plannedTerm:r.__slOriginalTerm,originalTerm:r.__slOriginalTerm,plannedHp:0,loadHp:0,credited:true,isCredited:true,plannerStatus:'credited',suggestedAlternative:alternative,plannerChangeNote:alternative?'Tillgodoräknad. Frigjord plats kan användas för '+alternative+'.':'Tillgodoräknad. Den frigjorda platsen kan användas för en alternativ eller tidigarelagd kurs.'};
    });
    return [...planned,...credited].sort((a,b)=>(Number(a.plannedTerm)-Number(b.plannedTerm))||(a.__slOriginalPeriod-b.__slOriginalPeriod)||(a.__slOriginalIndex-b.__slOriginalIndex));
  }
  function buildProgramSchedule(snapshot){
    const rows=optimizeRows(snapshot),termTotals={};
    rows.forEach(r=>{const t=Number(r.plannedTerm)||1;termTotals[t]=hp((termTotals[t]||0)+(r.loadHp??rowHp(r)))});
    const out={...snapshot,rows,plannerPolicy:plannerPolicy(),scheduleSource:'program-term-rows',plannerBaselineRows:authoritativeRows(snapshot),plannerTermTotals:termTotals,plannerPace:getPace(),plannerOptimized:true,plannerOptimization:'stable-course-order-capacity',plannerPreservesCreditedCourses:true};
    window.__studielotsLastProgramSchedule=out;
    return out;
  }
  function decoratePlanner(){
    const root=document.getElementById('plannerClean'),schedule=window.__studielotsLastProgramSchedule;
    if(!root||!Array.isArray(schedule?.rows))return;
    const candidates=[...root.querySelectorAll('[data-course-name],.v572-course,.v572-row,.course-card,.course,.study-item,.analysis-row,.course-row')];
    schedule.rows.filter(r=>r.credited||r.movedEarlier).forEach(row=>{
      const name=courseName(row).toLocaleLowerCase('sv-SE');
      const node=candidates.filter(el=>low(el.textContent).includes(name)).sort((a,b)=>(a.textContent||'').length-(b.textContent||'').length)[0];
      if(!node||node.querySelector(':scope > .sl-change-wrap'))return;
      node.classList.add(row.credited?'sl-course-credited':'sl-course-moved');
      const box=document.createElement('div');box.className='sl-change-wrap';
      box.innerHTML=row.credited?'<span class="sl-change-badge credited">✓ Tillgodoräknad</span><span class="sl-change-copy">'+esc(row.suggestedAlternative?'Frigjord plats: förslag att läsa '+row.suggestedAlternative+' i stället.':'Kursen ligger kvar för jämförelse. Frigjord plats kan användas av en alternativ kurs.')+'</span>':'<span class="sl-change-badge moved">↗ Tidigarelagd</span><span class="sl-change-copy">Flyttad från termin '+row.originalTerm+' till termin '+row.plannedTerm+'.</span>';
      node.appendChild(box);
    });
  }
  function ensurePacePicker(){
    const root=document.getElementById('plannerClean');if(!root)return;
    let box=document.getElementById('sl-pace-picker');
    if(!box){
      box=document.createElement('div');box.id='sl-pace-picker';
      box.innerHTML='<div class="sl-pace-title">Snabbare väg</div><div class="sl-pace-sub">Utgår från programmets riktiga terminskurser.</div><div class="sl-pace-options"><button type="button" data-pace="30">30 hp</button><button type="button" data-pace="37.5">37,5 hp</button><button type="button" data-pace="45">45 hp</button></div><div class="sl-pace-note">Tillgodoräknade kurser ligger kvar i planen men räknas som 0 hp ny belastning.</div>';
      box.addEventListener('click',event=>{const button=event.target.closest('button[data-pace]');if(!button)return;const pace=Number(button.dataset.pace);try{localStorage.setItem(PACE_KEY,String(pace))}catch(_){}plannerPolicy();window.dispatchEvent(new CustomEvent('studielots:pacechange',{detail:{maxHpPerTerm:pace}}));ensurePacePicker()});
      const shell=root.querySelector('.v572-shell')||root.firstElementChild;root.insertBefore(box,shell||null);
    }
    const pace=getPace();box.querySelectorAll('[data-pace]').forEach(button=>button.classList.toggle('active',Number(button.dataset.pace)===pace));
  }
  function installPlanner(){
    window.__studielotsBuildProgramSchedule=buildProgramSchedule;
    window.__studielotsOptimizeProgramSchedule=optimizeRows;
    ['buildProgramSchedule','createProgramSchedule','buildPlannerSchedule','makePlannerSchedule'].forEach(name=>wrap(name,base=>function(){const result=base.apply(this,arguments);return result&&typeof result==='object'&&(Array.isArray(result.rows)||Array.isArray(result.courses))?buildProgramSchedule(result):result}));
    wrap('openStudyPlanner',base=>function(){const out=base.apply(this,arguments);requestAnimationFrame(()=>{ensurePacePicker();decoratePlanner()});return out});
    plannerPolicy();ensurePacePicker();decoratePlanner();
  }
  function removeEscapedNewlines(){[...document.body?.childNodes||[]].filter(n=>n.nodeType===3&&/^\s*(?:\\n)+\s*$/.test(n.nodeValue||'')).forEach(n=>n.remove())}
  function syncVisible(){installAuthority();installPlanner();repairHome();repairCards();repairDetail();ensureDistanceLink();removeEscapedNewlines();document.documentElement.dataset.studielotsRuntime=VERSION}
  function boot(){
    installAuthority();syncVisible();
    [0,250,900].forEach(delay=>setTimeout(()=>{if(!openDistanceFromUrl())syncVisible()},delay));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('pageshow',()=>{syncVisible();openDistanceFromUrl()});
  ['studielots:screen-rendered','studielots:planner-open','studielots:pacechange'].forEach(name=>window.addEventListener(name,()=>requestAnimationFrame(syncVisible)));
  if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('controllerchange',()=>{
    const key='studielots_sw_611_reloaded';
    try{if(!sessionStorage.getItem(key)){sessionStorage.setItem(key,'1');location.reload()}}catch(_){}
  });
  if(!document.getElementById('sl-runtime-611-style')){
    const style=document.createElement('style');style.id='sl-runtime-611-style';
    style.textContent='.sl-distance-entry-v611{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;box-sizing:border-box;margin-top:14px;padding:12px 0;color:#187566;text-decoration:none;touch-action:manipulation}.sl-distance-entry-v611 div{display:flex;flex-direction:column;gap:3px}.sl-distance-entry-v611 strong{font-size:1.05rem}.sl-distance-entry-v611 small{font-size:.86rem;line-height:1.35;color:#707b83;font-weight:400}.sl-distance-entry-v611>span{font-size:1.5rem;color:#1685df}#sl-pace-picker{margin:12px 14px 16px;padding:14px;border-radius:18px;background:#fff;border:1px solid rgba(15,76,67,.1)}#sl-pace-picker .sl-pace-title{font-weight:800;color:#113d3a}#sl-pace-picker .sl-pace-sub,#sl-pace-picker .sl-pace-note{font-size:12px;color:#74807f;margin-top:4px}#sl-pace-picker .sl-pace-options{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:10px}#sl-pace-picker button{border:1px solid rgba(15,76,67,.16);background:#f6f8f7;color:#155f57;border-radius:14px;padding:10px 5px;font-weight:800}#sl-pace-picker button.active{background:#155f57;color:#fff}.sl-change-wrap{margin-top:8px;display:grid;gap:5px}.sl-change-badge{display:inline-flex;width:max-content;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:800}.sl-change-badge.credited{background:#eaf6f1;color:#155f57}.sl-change-badge.moved{background:#eef3ff;color:#315db5}.sl-change-copy{font-size:11px;color:#6d7776}';
    document.head.appendChild(style);
  }
  window.__studielotsLatestPatch={version:VERSION,consolidatedRuntime:true,singleHpAuthority:true,distanceRealLink:true};
})();
