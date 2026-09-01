(()=>{
  'use strict';
  const VERSION='611';
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
  function removeEscapedNewlines(){[...document.body?.childNodes||[]].filter(n=>n.nodeType===3&&/^\s*(?:\\n)+\s*$/.test(n.nodeValue||'')).forEach(n=>n.remove())}
  function syncVisible(){installAuthority();repairHome();repairCards();repairDetail();ensureDistanceLink();removeEscapedNewlines();document.documentElement.dataset.studielotsRuntime=VERSION}
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
    style.textContent='.sl-distance-entry-v611{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;box-sizing:border-box;margin-top:14px;padding:12px 0;color:#187566;text-decoration:none;touch-action:manipulation}.sl-distance-entry-v611 div{display:flex;flex-direction:column;gap:3px}.sl-distance-entry-v611 strong{font-size:1.05rem}.sl-distance-entry-v611 small{font-size:.86rem;line-height:1.35;color:#707b83;font-weight:400}.sl-distance-entry-v611>span{font-size:1.5rem;color:#1685df}';
    document.head.appendChild(style);
  }
  window.__studielotsLatestPatch={version:VERSION,consolidatedRuntime:true,singleHpAuthority:true,distanceRealLink:true};
})();
