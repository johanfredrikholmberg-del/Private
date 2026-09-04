(()=>{
'use strict';
const VERSION='690';
const PACE_KEY='studielots_shared_planner_pace';
const PACES=[30,37.5,45];
let selectedPace=30;
let distancePending=false,distanceObserver=null,distanceTimer=0,beforeSnapshot='';
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const low=v=>norm(v).toLocaleLowerCase('sv-SE');
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const fmt=v=>String(Math.round(num(v)*10)/10).replace('.',',');
const esc=s=>norm(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hpOf=r=>num(r?.hp??r?.credits??r?.credit??r?.ects??r?.points);
const nameOf=r=>norm(r?.name??r?.courseName??r?.title??r?.course??r?.label??'Kurs');
const uniOf=r=>norm(r?.university??r?.provider??r?.school??r?.institution);
const keyOf=r=>norm(r?.offeringKey||r?.code||r?.courseCode||nameOf(r)).toLocaleLowerCase('sv-SE');
const isCredited=r=>Boolean(r?.credited||r?.completed||r?.done||r?.tillgodoraknad||r?.isCredited||r?.status==='credited'||r?.status==='completed');
const isPartial=r=>r?.status==='partial'||(num(r?.matchedHp)>0&&num(r?.matchedHp)<hpOf(r));
function snapshot(){try{return JSON.parse(sessionStorage.getItem('studielots_planner_snapshot')||'null')}catch(_){return null}}
function saveSnapshot(s){try{sessionStorage.setItem('studielots_planner_snapshot',JSON.stringify(s))}catch(_){}}
function distanceMode(s=snapshot()){
 let stored='';try{stored=[sessionStorage.getItem('studielots_mode'),sessionStorage.getItem('lotsen_mypath_mode')].join(' ')}catch(_){}
 return low(stored).includes('distance')||low(s?.selection?.university)==='distans'||low(s?.program?.university)==='distans'||s?.routeMode==='distance'||s?.distance===true;
}
function opportunity(){
 try{const key=sessionStorage.getItem('lotsen_detail_key');return window.opportunityByKey?.(key)||window.__studielotsLastOpportunity||null}catch(_){return window.__studielotsLastOpportunity||null}
}
function progressionStage(r){
 const t=low([nameOf(r),r?.requirement,r?.description,r?.level,r?.subject].filter(Boolean).join(' '));
 if(/(kandidatuppsats|examensarbete|självständigt arbete|sjalvstandigt arbete|thesis|c-uppsats)/.test(t))return 60;
 if(/(fördjup|fordjup|fortsättningskurs ii|fortsattningskurs ii|c-kurs|advanced)/.test(t))return 50;
 if(/(forskningsmetod|vetenskaplig metod|metod|statistik)/.test(t))return 40;
 if(/(fortsättningskurs|fortsattningskurs|fortsättning|fortsattning|b-kurs|psykologi ii|psykologi 2)/.test(t))return 30;
 if(/(grundkurs|introduktion|grundlägg|grundlagg|a-kurs|psykologi i|psykologi 1)/.test(t))return 10;
 return 20;
}
function semesterIndex(r){
 const raw=norm(r?.semester||r?.term||r?.startDate||r?.start||r?.date);
 let m=raw.match(/(20\d{2}).*?(VT|HT|VÅR|VAR|HÖST|HOST)/i);
 if(m)return Number(m[1])*2+(/HT|HÖST|HOST/i.test(m[2])?1:0);
 m=raw.match(/(VT|HT|VÅR|VAR|HÖST|HOST).*?(20\d{2})/i);
 if(m)return Number(m[2])*2+(/HT|HÖST|HOST/i.test(m[1])?1:0);
 const d=new Date(r?.startDate||r?.start||'');if(!Number.isNaN(d.getTime()))return d.getFullYear()*2+(d.getMonth()>=6?1:0);
 return 0;
}
function remainingTarget(s,rows){
 const explicit=num(s?.remainingHp);if(explicit>0)return explicit;
 return rows.filter(r=>!isCredited(r)).reduce((sum,r)=>sum+hpOf(r),0);
}
function requirementRows(s){return(Array.isArray(s?.rows)?s.rows:Array.isArray(s?.courses)?s.courses:[]).filter(Boolean)}
function courseCandidatesForNeed(need){
 try{const rows=window.verifiedDistanceCoursesForNeed?.(need);return Array.isArray(rows)?rows:[]}catch(_){return[]}
}
function chooseDistanceCourses(s){
 const source=requirementRows(s),target=remainingTarget(s,source);if(!source.length)return source;
 const credited=source.filter(isCredited),needs=source.filter(r=>!isCredited(r)).sort((a,b)=>progressionStage(a)-progressionStage(b));
 const picked=[],seen=new Set();
 for(const need of needs){
   const candidates=courseCandidatesForNeed(need).slice().sort((a,b)=>progressionStage(a)-progressionStage(b)||semesterIndex(a)-semesterIndex(b)||num(b.matchScore)-num(a.matchScore));
   for(const c of candidates){
     const k=keyOf(c);if(!k||seen.has(k))continue;
     const row={...need,...c,name:nameOf(c),hp:hpOf(c),status:'remaining',credited:false,isCredited:false,requirementName:nameOf(need),__slStage:Math.max(progressionStage(need),progressionStage(c)),__slSemester:semesterIndex(c),__slDistance:true};
     picked.push(row);seen.add(k);break;
   }
 }
 let rows=picked.length?picked:needs.map(r=>({...r,__slStage:progressionStage(r),__slSemester:semesterIndex(r),__slDistance:true}));
 rows=rows.sort((a,b)=>num(a.__slStage)-num(b.__slStage)||num(a.__slSemester)-num(b.__slSemester)||nameOf(a).localeCompare(nameOf(b),'sv'));
 if(target>0){
   const trimmed=[];let hp=0;
   for(const r of rows){if(hp>=target-.01)break;const h=hpOf(r);if(h<=0)continue;trimmed.push(r);hp+=h}
   if(trimmed.length)rows=trimmed;
 }
 return [...credited,...rows];
}
function chronologicalDistance(rows){
 const active=rows.filter(r=>!isCredited(r)).slice().sort((a,b)=>progressionStage(a)-progressionStage(b)||semesterIndex(a)-semesterIndex(b)||nameOf(a).localeCompare(nameOf(b),'sv'));
 const credited=rows.filter(isCredited).map((r,i)=>({...r,term:Number(r.term)||1,__slOriginalIndex:i}));
 const known=active.map(semesterIndex).filter(Boolean),baseSemester=known.length?Math.min(...known):0;
 let term=1,load=0,lastStage=0,lastTerm=1;
 const planned=active.map((r,i)=>{
   const stage=progressionStage(r),h=hpOf(r),available=semesterIndex(r),availableTerm=baseSemester&&available?Math.max(1,available-baseSemester+1):1;
   if(stage>lastStage&&lastStage>0&&load>0){term++;load=0}
   term=Math.max(term,availableTerm,lastTerm);
   if(load>0&&load+h>30.001){term++;load=0}
   const out={...r,term,semester:term,originalTerm:term,__slOriginalTerm:term,__slOriginalIndex:i,__slStage:stage,__slEarliestTerm:availableTerm,__slDistance:true,status:r.status||'remaining'};
   load+=h;lastStage=Math.max(lastStage,stage);lastTerm=term;return out;
 });
 return [...credited,...planned].sort((a,b)=>Number(a.term)-Number(b.term)||(a.__slOriginalIndex-b.__slOriginalIndex));
}
function normalizeDistanceSnapshot(s){
 if(!s||!distanceMode(s))return s;
 const rows=chronologicalDistance(chooseDistanceCourses(s));
 const total=num(s.totalHp)||180,credited=num(s.creditedHp)||Math.max(0,total-(num(s.remainingHp)||rows.filter(r=>!isCredited(r)).reduce((x,r)=>x+hpOf(r),0)));
 const next={...s,selection:{...(s.selection||{}),university:'Distans'},program:{...(s.program||{}),university:'Distans'},routeMode:'distance',distance:true,rows,plannerBaselineRows:rows,remainingHp:num(s.remainingHp)||rows.filter(r=>!isCredited(r)).reduce((x,r)=>x+hpOf(r),0),creditedHp:credited,sharedPlannerVersion:VERSION,distanceSchedule:'chronological-progression-offering'};
 saveSnapshot(next);window.__studielotsLastProgramSchedule={...next,rows,plannerBaselineRows:rows,scheduleSource:'distance-chronological-v635'};return next;
}
function plannerRows(s){
 const live=window.__studielotsLastProgramSchedule;
 let rows=Array.isArray(live?.plannerBaselineRows)?live.plannerBaselineRows:null;
 if(!rows?.length)rows=requirementRows(s);
 return(rows||[]).map((r,i)=>({...r,__slOriginalIndex:r.__slOriginalIndex??i,__slOriginalTerm:Number(r.__slOriginalTerm??r.originalTerm??r.term??r.semester)||1})).sort((a,b)=>Number(a.__slOriginalTerm)-Number(b.__slOriginalTerm)||(a.__slOriginalIndex-b.__slOriginalIndex));
}
function fastRows(base,pace,isDistance){
 if(pace===30)return base.map(r=>({...r,__planTerm:Number(r.__slOriginalTerm)||1}));
 const credited=base.filter(isCredited).map(r=>({...r,__planTerm:Number(r.__slOriginalTerm)||1}));
 const remaining=base.filter(r=>!isCredited(r));let term=1,load=0,lastStage=0;
 const planned=remaining.map(r=>{
   const h=hpOf(r),stage=progressionStage(r),earliest=isDistance?num(r.__slEarliestTerm):1;
   term=Math.max(term,earliest||1);
   if(isDistance&&stage>lastStage&&lastStage>0&&load>0){term++;load=0}
   if(load>0&&load+h>pace+.001){term++;load=0}
   const out={...r,__planTerm:term};load+=h;lastStage=Math.max(lastStage,stage);return out;
 });
 return [...credited,...planned].sort((a,b)=>num(a.__planTerm)-num(b.__planTerm)||(a.__slOriginalIndex-b.__slOriginalIndex));
}
function groupTerms(rows){const map=new Map();for(const r of rows){const t=num(r.__planTerm||r.__slOriginalTerm||r.term)||1;if(!map.has(t))map.set(t,[]);map.get(t).push(r)}return[...map.entries()].sort((a,b)=>a[0]-b[0]).map(([term,items])=>({term,rows:items,hp:items.filter(r=>!isCredited(r)).reduce((s,r)=>s+hpOf(r),0)}))}
function planTitle(s){const o=opportunity();return norm(s?.selection?.subject||o?.subject||o?.name||s?.program?.name||'Din studieplan')}
function degreeLabel(s){const o=opportunity();return norm(o?.degreeType||o?.degree||s?.degreeType||s?.program?.degree||'Examen')}
function routeLabel(s,isDistance){if(isDistance)return'Distans';return norm(s?.program?.university||s?.selection?.university||'Valt lärosäte')}
function courseMeta(r,isDistance){const bits=[];if(isDistance||r?.distance===true||r?.__slDistance)bits.push('Distans');const u=uniOf(r);if(u&&low(u)!=='distans')bits.push(u);const start=norm(r?.semester||r?.startDate||r?.start);if(start)bits.push(start);return bits.join(' · ')}
function courseHtml(r,isDistance){
 const credited=isCredited(r),partial=isPartial(r),matched=Math.min(hpOf(r),num(r?.matchedHp||r?.creditedHp));
 return`<div class="sl635-course ${credited?'credited':partial?'partial':''}"><span class="sl635-course-icon">${credited?'✓':'▢'}</span><div class="sl635-course-copy"><strong>${esc(nameOf(r))}</strong><div class="sl635-tags">${credited?'<span>Tillgodoräknas</span>':partial?`<span>${fmt(matched)} hp kan räknas</span>`:''}${courseMeta(r,isDistance)?`<small>${esc(courseMeta(r,isDistance))}</small>`:''}</div></div><b>${fmt(hpOf(r))} hp</b></div>`;
}
function renderSharedPlanner(force=false){
 const root=document.getElementById('plannerCleanContent'),screen=document.querySelector('.screen.active');if(!root||screen?.id!=='plannerClean')return false;
 let s=snapshot();if(!s)return false;const isDistance=distanceMode(s);if(isDistance)s=normalizeDistanceSnapshot(s);
 const base=plannerRows(s);if(!base.length)return false;
 try{selectedPace=Number(localStorage.getItem(PACE_KEY))||30}catch(_){selectedPace=30}if(!PACES.includes(selectedPace))selectedPace=30;
 const rows=fastRows(base,selectedPace,isDistance),terms=groupTerms(rows),ordinary=groupTerms(fastRows(base,30,isDistance));
 const remain=num(s.remainingHp)||base.filter(r=>!isCredited(r)).reduce((x,r)=>x+hpOf(r),0),route=routeLabel(s,isDistance),fast=selectedPace>30,saved=Math.max(0,ordinary.length-terms.length);
 root.innerHTML=`<div class="sl635-shell"><div class="sl635-crumb">Möjligheter <span>›</span> Planeraren</div><div class="sl635-title"><span>${isDistance?'PÅ DISTANS':'STUDIEPLAN'}</span><h1>${esc(planTitle(s))}</h1><p>${esc(degreeLabel(s))}</p></div><section class="sl635-summary"><div><b>${fmt(remain)} hp kvar</b><small>att läsa</small></div><div><b>${terms.length} terminer</b><small>${fast?`${fmt(selectedPace)} hp/termin`:'ordinarie takt'}</small></div><div><b>${esc(route)}</b><small>${isDistance?'flera lärosäten':'vald väg'}</small></div></section>${fast?`<div class="sl635-fast-result"><b>${saved?`Du kan bli klar ${saved} termin${saved===1?'':'er'} snabbare`:'Ingen säker tidsvinst med vald takt'}</b><span>Ordinarie ${ordinary.length} terminer · vald plan ${terms.length} terminer</span></div>`:`<div class="sl635-info"><span>✓</span><p>${isDistance?'Kurserna är ordnade efter progression och verifierade kurstillfällen så att vägen kan läsas i följd.':'Detta är din ordinarie studieplan. Tillgodoräknade kurser markeras direkt i planen.'}</p></div>`}<div class="sl635-terms">${terms.map((t,i)=>`<details class="sl635-term" ${i===0?'open':''}><summary><strong>Termin ${t.term}</strong><span>${fmt(t.hp)} hp</span><i>⌄</i></summary><div>${t.rows.map(r=>courseHtml(r,isDistance)).join('')}</div></details>`).join('')}</div><section class="sl635-fast-card"><div class="sl635-fast-head"><span>⚡</span><div><b>Kan du bli klar snabbare?</b><p>Se om tillgodoräknanden och högre studietakt kan korta din studietid.</p></div></div><div class="sl635-pace">${PACES.map(p=>`<button type="button" data-sl635-pace="${p}" class="${p===selectedPace?'active':''}">${fmt(p)} hp/termin</button>`).join('')}</div>${isDistance?'<small>Snabbare väg respekterar kursordning och kända kurstillfällen.</small>':'<small>Snabbare väg behåller programmets kursordning.</small>'}</section></div>`;
 root.querySelectorAll('[data-sl635-pace]').forEach(btn=>btn.onclick=()=>{const p=Number(btn.dataset.sl635Pace);try{localStorage.setItem(PACE_KEY,String(p))}catch(_){}selectedPace=p;renderSharedPlanner(true)});
 document.querySelector('#plannerClean .v549-planner-page')?.classList.add('sl635-active');return true;
}
function stopDistance(){distancePending=false;if(distanceObserver){distanceObserver.disconnect();distanceObserver=null}clearTimeout(distanceTimer);document.documentElement.classList.remove('sl635-distance-direct')}
function markDistanceSnapshot(){let s=snapshot();if(!s)return false;s={...s,selection:{...(s.selection||{}),university:'Distans'},program:{...(s.program||{}),university:'Distans'},routeMode:'distance',distance:true};saveSnapshot(s);return true}
function plannerCta(){const roots=[document.getElementById('myPathFlow')].filter(Boolean);for(const root of roots){for(const el of root.querySelectorAll('button,a')){const t=low(el.textContent);if((t.includes('planeraren')||t.includes('skapa plan'))&&!el.matches('[data-sl635-distance]'))return el}}return null}
function finishDistance(){
 if(!distancePending)return true;if(document.querySelector('.screen.active')?.id==='plannerClean'){markDistanceSnapshot();stopDistance();setTimeout(()=>renderSharedPlanner(true),40);return true}
 let current='';try{current=sessionStorage.getItem('studielots_planner_snapshot')||''}catch(_){}
 if(current&&current!==beforeSnapshot){markDistanceSnapshot();const c=plannerCta();if(c){distancePending=false;c.click();setTimeout(()=>{stopDistance();renderSharedPlanner(true)},80);return true}if(typeof window.openStudyPlanner==='function'){distancePending=false;window.openStudyPlanner();setTimeout(()=>{stopDistance();renderSharedPlanner(true)},80);return true}}
 const c=plannerCta();if(c){markDistanceSnapshot();distancePending=false;c.click();setTimeout(()=>{stopDistance();renderSharedPlanner(true)},80);return true}return false;
}
function beginDistance(trigger){beforeSnapshot='';try{beforeSnapshot=sessionStorage.getItem('studielots_planner_snapshot')||'';sessionStorage.setItem('studielots_mode','distance');sessionStorage.setItem('lotsen_mypath_mode','distance')}catch(_){}distancePending=true;document.documentElement.classList.add('sl635-distance-direct');if(distanceObserver)distanceObserver.disconnect();const root=document.getElementById('myPathFlow')||document.body;distanceObserver=new MutationObserver(finishDistance);distanceObserver.observe(root,{childList:true,subtree:true});try{trigger()}catch(e){console.warn('StudieLots distance planner',e);stopDistance();return}let tries=0;const tick=()=>{if(finishDistance())return;if(++tries<100)setTimeout(tick,50);else stopDistance()};setTimeout(tick,0);distanceTimer=setTimeout(stopDistance,5200)}
function distanceCard(root){const candidates=[...root.querySelectorAll('section,article,div')].filter(el=>{const t=low(el.textContent),buttons=[...el.querySelectorAll('button,a')];return t.includes('på distans')&&buttons.some(b=>low(b.textContent).includes('distansalternativ'))&&buttons.some(b=>low(b.textContent).includes('distansväg'))});return candidates.sort((a,b)=>a.querySelectorAll('*').length-b.querySelectorAll('*').length)[0]||null}
function unifyDistanceChoice(){const root=document.getElementById('degreeDetailContent');if(!root||document.querySelector('.screen.active')?.id!=='degreeDetail'||root.querySelector('[data-sl635-distance]'))return false;const card=distanceCard(root);if(!card)return false;const actions=[...card.querySelectorAll('button,a')],path=actions.find(b=>low(b.textContent).includes('distansväg'))||actions.find(b=>String(b.getAttribute('onclick')||'').includes('openDistancePathFromOpportunity'));if(!path)return false;const trigger=()=>path.click();card.classList.add('sl635-distance-card');card.innerHTML=`<button type="button" class="sl635-distance-row" data-sl635-distance="1"><div><strong>Distans</strong><span>Studieplan med kurser som kan läsas på distans</span></div><i>›</i></button>`;card.querySelector('[data-sl635-distance]').onclick=()=>beginDistance(trigger);return true}
function sync(){setTimeout(()=>{unifyDistanceChoice();renderSharedPlanner(false)},35)}
['studielots:screen-rendered','studielots:planner-open','studielots:planner-snapshot','studielots:pacechange'].forEach(n=>window.addEventListener(n,sync));window.addEventListener('pageshow',sync);document.addEventListener('click',e=>{if(e.target.closest('[data-screen="plannerClean"]'))setTimeout(()=>renderSharedPlanner(true),60)},true);requestAnimationFrame(sync);
if(!document.getElementById('sl635-style')){const s=document.createElement('style');s.id='sl635-style';s.textContent=`
#plannerClean .v549-planner-page.sl635-active>.eyebrow,#plannerClean .v549-planner-page.sl635-active>h1,#plannerClean .v549-planner-page.sl635-active>.v549-lead,#plannerClean .v549-planner-page.sl635-active>.v549-new{display:none!important}.sl635-shell{max-width:760px;margin:0 auto;padding:4px 0 110px}.sl635-crumb{font-size:13px;font-weight:750;color:#66717f;margin:4px 0 20px}.sl635-crumb span{padding:0 8px;color:#93a09e}.sl635-title>span{font-size:11px;letter-spacing:.14em;font-weight:900;color:#176b5b}.sl635-title h1{font-size:42px;line-height:1.02;letter-spacing:-.045em;margin:5px 0 3px;color:#082e34}.sl635-title p{margin:0 0 18px;color:#5e6973;font-size:17px}.sl635-summary{display:grid;grid-template-columns:repeat(3,1fr);background:#fff;border:1px solid rgba(22,79,72,.08);border-radius:22px;box-shadow:0 7px 22px rgba(24,58,54,.07);margin-bottom:14px;overflow:hidden}.sl635-summary>div{min-height:88px;padding:17px 10px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border-right:1px solid #edf0ee}.sl635-summary>div:last-child{border-right:0}.sl635-summary b{font-size:16px;color:#0a3638;line-height:1.15}.sl635-summary small{font-size:11px;color:#7a858b;margin-top:5px}.sl635-info,.sl635-fast-result{display:flex;gap:11px;align-items:flex-start;background:#edf6ef;border-radius:17px;padding:13px 15px;margin-bottom:15px;color:#254a43}.sl635-info span{display:grid;place-items:center;background:#176b5b;color:#fff;border-radius:50%;width:24px;height:24px;flex:none}.sl635-info p{margin:2px 0;font-size:12px;line-height:1.45}.sl635-fast-result{display:grid;gap:3px}.sl635-fast-result b{font-size:14px}.sl635-fast-result span{font-size:11px}.sl635-terms{display:grid;gap:10px}.sl635-term{background:#fff;border:1px solid rgba(22,79,72,.08);border-radius:20px;box-shadow:0 5px 18px rgba(24,58,54,.055);overflow:hidden}.sl635-term summary{list-style:none;display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:10px;padding:16px 18px;cursor:pointer}.sl635-term summary::-webkit-details-marker{display:none}.sl635-term summary strong{font-size:16px}.sl635-term summary span{background:#eaf5ed;color:#176b5b;font-weight:850;padding:5px 9px;border-radius:999px;font-size:12px}.sl635-term summary i{font-style:normal;color:#6d7b80}.sl635-term>div{border-top:1px solid #edf0ee;padding:2px 16px 7px}.sl635-course{display:grid;grid-template-columns:32px 1fr auto;align-items:center;gap:11px;padding:13px 1px;border-bottom:1px solid #eef1ef}.sl635-course:last-child{border-bottom:0}.sl635-course-icon{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#edf7f1;color:#176b5b;font-weight:900}.sl635-course.credited{opacity:.72;background:#f4f8f5}.sl635-course-copy{min-width:0}.sl635-course-copy strong{display:block;font-size:14px;color:#10373a}.sl635-course>b{white-space:nowrap;color:#176b5b;font-size:13px}.sl635-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px;align-items:center}.sl635-tags span{font-size:9px;background:#e6f4ea;color:#176b5b;padding:3px 7px;border-radius:999px}.sl635-tags small{font-size:10px;color:#758087}.sl635-fast-card{margin-top:14px;background:#fffaf0;border:1px solid #f1dfb5;border-radius:20px;padding:16px}.sl635-fast-head{display:flex;gap:11px;align-items:center}.sl635-fast-head>span{width:36px;height:36px;border-radius:50%;background:#fff0bf;display:grid;place-items:center;font-size:18px}.sl635-fast-head b{font-size:15px}.sl635-fast-head p{font-size:11px;line-height:1.4;color:#6b7174;margin:3px 0 0}.sl635-pace{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:13px}.sl635-pace button{border:1px solid #d8dfdc;background:#fff;border-radius:10px;padding:10px 5px;font-size:11px;font-weight:800;color:#244c47}.sl635-pace button.active{background:#176b5b;color:#fff;border-color:#176b5b}.sl635-fast-card>small{display:block;font-size:9px;color:#858a88;margin-top:8px}.sl635-distance-card{padding:0!important;overflow:hidden}.sl635-distance-row{width:100%;border:0!important;background:transparent!important;display:flex!important;align-items:center!important;justify-content:space-between!important;text-align:left!important;padding:26px 32px!important;min-height:116px;color:inherit}.sl635-distance-row div{display:grid;gap:5px}.sl635-distance-row strong{font-size:24px;color:#278a76}.sl635-distance-row span{font-size:17px;color:#737d91}.sl635-distance-row i{font-size:34px;color:#078cff;font-style:normal}html.sl635-distance-direct #myPath{visibility:hidden!important;pointer-events:none!important}@media(max-width:600px){.sl635-title h1{font-size:38px}.sl635-summary b{font-size:13px}.sl635-summary small{font-size:9px}.sl635-distance-row{padding:24px 28px!important}.sl635-distance-row strong{font-size:22px}.sl635-distance-row span{font-size:15px}}
`;document.head.appendChild(s)}
window.__studielotsSharedPlanner={version:VERSION,sameDesign:true,distanceChronology:true,progressionAware:true,offeringAware:true,fastRouteShared:true,fastPaces:PACES.slice(),legacyUniversityDetailRemoved:true};
})();
