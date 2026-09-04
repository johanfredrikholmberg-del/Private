(()=>{
'use strict';
const VERSION='697';
const norm=v=>String(v??'').trim();
const low=v=>norm(v).toLocaleLowerCase('sv-SE');
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const fmt=v=>String(Math.round(num(v)*10)/10).replace('.',',');
const esc=s=>norm(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- Susa: canonical distance source ---------- */
const distanceCache=new Map();
let activeDistanceKey='';
let distanceSerial=0;
const distanceKey=o=>[low(o?.subject),low(o?.kind||'candidate')].join('|');
const offeringKey=r=>String(r?.offeringKey||[r?.university,r?.code,r?.semester||r?.term||r?.startDate].join('|')).toLocaleLowerCase('sv-SE');
function uniqueDistance(rows){
 const seen=new Set(),out=[];
 for(const row of Array.isArray(rows)?rows:[]){
  if(!row||row.verified!==true||row.distance!==true||!(Number(row.hp)>0))continue;
  const k=offeringKey(row);if(seen.has(k))continue;seen.add(k);out.push(row);
 }
 return out;
}
async function canonicalDistanceLoad(o){
 const request={subject:norm(o?.subject),kind:norm(o?.kind||'candidate')};
 const key=distanceKey(request);activeDistanceKey=key;const serial=++distanceSerial;
 try{distanceApiState.loading=true;distanceApiState.error=false}catch(_){}
 try{
  let rows=distanceCache.get(key);
  if(!rows){
   const r=await fetch('/api/distance-courses?'+new URLSearchParams(request).toString(),{headers:{Accept:'application/json'}});
   if(!r.ok)throw new Error('distance api '+r.status);
   const data=await r.json();rows=uniqueDistance(data?.courses);distanceCache.set(key,rows);
   if(serial===distanceSerial)try{distanceApiState.updated=data?.updated||null}catch(_){}
  }
  if(serial!==distanceSerial||activeDistanceKey!==key)return rows;
  try{LIVE_DISTANCE_COURSES=rows;distanceApiState.loaded=true}catch(_){}
  return rows;
 }catch(error){
  if(serial===distanceSerial)try{distanceApiState.error=true;LIVE_DISTANCE_COURSES=[];distanceApiState.loaded=false}catch(_){}
  console.warn('StudieLots canonical distance API',error);return[];
 }finally{
  if(serial===distanceSerial){
   try{distanceApiState.loading=false}catch(_){}
   try{renderDistancePath(o)}catch(_){}
   try{if(myPathMode==='distance')renderMyPath()}catch(_){}
  }
 }
}
try{loadDistanceCourses=canonicalDistanceLoad}catch(_){};window.loadDistanceCourses=canonicalDistanceLoad;
try{
 allDistanceCourses=function(){
  const live=uniqueDistance(typeof LIVE_DISTANCE_COURSES!=='undefined'?LIVE_DISTANCE_COURSES:[]);
  try{if(distanceApiState.loaded&&activeDistanceKey)return live}catch(_){}
  return uniqueDistance(typeof DISTANCE_COURSE_INDEX!=='undefined'&&Array.isArray(DISTANCE_COURSE_INDEX)?DISTANCE_COURSE_INDEX:[]);
 };
 window.allDistanceCourses=allDistanceCourses;
}catch(_){}
const previousOpenDistance=window.openDistancePathFromOpportunity;
if(typeof previousOpenDistance==='function')window.openDistancePathFromOpportunity=function(key){
 const out=previousOpenDistance.apply(this,arguments);
 try{const o=window.opportunityByKey?.(key);if(o)canonicalDistanceLoad({subject:o.subject||o.name||'',kind:o.degreeType||o.kind||'candidate'})}catch(_){}
 return out;
};

/* ---------- Susa: requirement-first distance ranking ---------- */
const rankNorm=v=>low(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9åäö]+/g,' ').replace(/\s+/g,' ').trim();
const stop=new Set(['och','eller','i','for','för','till','av','med','inom','pa','på','en','ett','kurs','kurser','hp','hogskolepoang','högskolepoäng','grundniva','grundnivå','avancerad','niva','nivå','valbar','valbara','obligatorisk','obligatoriska']);
const tokens=v=>rankNorm(v).split(' ').filter(x=>x.length>2&&!stop.has(x));
const needText=n=>rankNorm([n?.label,n?.name,n?.title,n?.subject,n?.type,n?.kind,n?.level,n?.description,n?.requirement].filter(Boolean).join(' '));
const courseText=c=>rankNorm([c?.name,c?.subject,c?.code].filter(Boolean).join(' '));
const targetHp=n=>[n?.remainingHp,n?.missingHp,n?.requiredHp,n?.hp,n?.credits].map(v=>{const x=Number(v);return Number.isFinite(x)?x:null}).find(x=>x!==null&&x>0)||null;
const themes=[
 [/(examensarbete|uppsats|självständigt arbete|självstandigt arbete|thesis)/,/(examensarbete|uppsats|självständigt arbete|sjalvstandigt arbete|thesis)/],
 [/(metod|forskningsmetodik|vetenskaplig metod)/,/(metod|forskningsmetodik|vetenskaplig metod)/],
 [/(statistik|kvantitativ)/,/(statistik|kvantitativ)/],[/(redovisning|bokföring|bokforing|revision)/,/(redovisning|bokföring|bokforing|revision)/],
 [/(marknadsföring|marknadsforing|marketing)/,/(marknadsföring|marknadsforing|marketing)/],[/(organisation|organisering|ledarskap|management)/,/(organisation|organisering|ledarskap|management)/],
 [/(finans|finansiering|financial)/,/(finans|finansiering|financial)/],[/(nationalekonomi|mikroekonomi|makroekonomi)/,/(nationalekonomi|mikroekonomi|makroekonomi)/],
 [/(psykologi|psychology)/,/(psykologi|psychology)/],[/(idrott|träning|traning|sport)/,/(idrott|träning|traning|sport)/]
];
const codeKey=v=>String(v??'').trim().toUpperCase().replace(/[^A-Z0-9ÅÄÖ]/g,'');
const definitionKey=r=>String(r?.definitionKey||[rankNorm(r?.university),codeKey(r?.code),rankNorm(r?.name)].join('|'));
function semanticRelevant(course,need){const nt=needText(need),ct=courseText(course),subject=rankNorm(need?.subject||'');const nTokens=tokens(nt).filter(x=>x!==subject),cTokens=new Set(tokens(ct));const overlap=nTokens.some(x=>cTokens.has(x));const themed=themes.some(([nr,cr])=>nr.test(nt)&&cr.test(ct));const subjectNamed=subject&&tokens(subject).some(x=>ct.includes(x));const generic=!nTokens.length&&!themes.some(([nr])=>nr.test(nt));return overlap||themed||(generic&&subjectNamed)}
function scoreCourseForNeed(course,need){
 if(!course||course.verified!==true||course.distance!==true||!(Number(course.hp)>0)||course.noPhysicalMeetings===false)return-Infinity;
 const nt=needText(need),ct=courseText(course);let score=0;
 if(rankNorm(course?.subject)&&rankNorm(course?.subject)===rankNorm(need?.subject))score+=50;
 else if(need?.subject&&rankNorm(course?.subject)!==rankNorm(need.subject))return-Infinity;
 const cTokens=new Set(tokens(ct));score+=Math.min(32,tokens(nt).filter(x=>cTokens.has(x)).length*8);
 for(const [nr,cr] of themes)if(nr.test(nt))score+=cr.test(ct)?24:-18;
 if(/(examensarbete|uppsats|självständigt arbete|självstandigt arbete|thesis)/.test(nt)&&!/(examensarbete|uppsats|självständigt arbete|sjalvstandigt arbete|thesis)/.test(ct))return-Infinity;
 const target=targetHp(need),chp=Number(course.hp)||0;if(target){const d=Math.abs(chp-target);if(d<.01)score+=18;else if(chp<target)score+=Math.max(2,12-d);else score-=Math.min(18,(chp-target)*1.5)}
 if(course.noPhysicalMeetings===true)score+=10;if(Number(course.pace)>0&&Number(course.pace)<=50)score+=3;if(course.currentOffering===true)score+=5;return score;
}
function rankedCoursesForNeed(need){
 let rows=[];try{rows=typeof allDistanceCourses==='function'?allDistanceCourses():window.allDistanceCourses?.()||[]}catch(_){}
 const ranked=rows.map(course=>({course,score:scoreCourseForNeed(course,need)})).filter(x=>Number.isFinite(x.score)&&x.score>=42&&semanticRelevant(x.course,need)).sort((a,b)=>b.score-a.score||Number(a.course.semester||99999)-Number(b.course.semester||99999)||String(a.course.university||'').localeCompare(String(b.course.university||''),'sv'));
 const seen=new Set(),out=[];for(const x of ranked){const k=definitionKey(x.course);if(!k||seen.has(k))continue;seen.add(k);out.push({...x.course,sourceOfferingKey:x.course.offeringKey||'',offeringKey:'definition|'+k,semanticDistanceMatch:true,matchScore:x.score,distanceConfidence:x.course.noPhysicalMeetings===true?'no-physical-meetings-verified':'distance-verified-meetings-unknown'});if(out.length>=12)break}return out;
}
try{distanceCourseMatchesNeed=(c,n)=>scoreCourseForNeed(c,n)>=42&&semanticRelevant(c,n)}catch(_){};window.distanceCourseMatchesNeed=(c,n)=>scoreCourseForNeed(c,n)>=42&&semanticRelevant(c,n);
try{verifiedDistanceCoursesForNeed=rankedCoursesForNeed}catch(_){};window.verifiedDistanceCoursesForNeed=rankedCoursesForNeed;

/* ---------- Planner: choose real programme structure ---------- */
const hpOf=r=>num(r?.hp??r?.credits??r?.credit??r?.ects??r?.points);
const courseKey=r=>norm(r?.code||r?.courseCode||r?.name||r?.courseName).toUpperCase();
function getSnapshot(){try{return JSON.parse(sessionStorage.getItem('studielots_planner_snapshot')||'null')}catch(_){return null}}
function programmeCandidates(snapshot){
 let rows=[];try{rows=typeof window.normalizedProgramCatalog==='function'?window.normalizedProgramCatalog():[]}catch(_){}
 if(!Array.isArray(rows))return[];
 const university=low(snapshot?.program?.university||snapshot?.selection?.university),subject=low(snapshot?.selection?.subject||''),programmeName=low(snapshot?.program?.name||'');
 return rows.filter(p=>p&&!p.catalogOnly&&Array.isArray(p.courses)&&p.courses.length>=2&&(!university||low(p.university)===university)).map(p=>{
  let score=0;const track=low(p.track||''),name=low(p.name||'');if(subject&&track===subject)score+=100;if(subject&&name.includes(subject))score+=55;if(programmeName&&name===programmeName)score+=45;if(programmeName&&name&&programmeName.includes(name))score+=20;if(p.academicYear==='2026/2027')score+=20;if(p.engine==='v2')score+=10;if(p.coverage==='complete')score+=20;else if(p.coverage==='partial')score+=10;score+=Math.min(25,(p.courses||[]).filter(c=>num(c.hp)>0).length);score+=(p.courses||[]).some(c=>c.year||c.term||c.semester)?20:0;return{p,score};
 }).sort((a,b)=>b.score-a.score);
}
function matchParts(programme){try{const est=window.estimateProgram?.(programme);return Array.isArray(est?.parts)?est.parts:[]}catch(_){return[]}}
function partForCourse(parts,c){const k=courseKey(c);return parts.find(x=>courseKey(x?.pc)===k)||parts.find(x=>low(x?.pc?.name)===low(c?.name))||null}
function explicitTerm(c){const t=Number(c?.term??c?.semester??c?.termNo);return Number.isFinite(t)&&t>0?t:0}
function buildProgrammeRows(programme){
 const parts=matchParts(programme),rows=[],yearLoad={};let globalLoad=0;
 (programme.courses||[]).forEach((c,index)=>{const h=hpOf(c);if(h<=0)return;let term=explicitTerm(c);const y=Number(c?.year)||0;if(!term&&y>0){const used=yearLoad[y]||0;term=(y-1)*2+Math.floor(used/30)+1;yearLoad[y]=used+h}if(!term){term=Math.floor(globalLoad/30)+1;globalLoad+=h}const part=partForCourse(parts,c),matched=Math.min(h,num(part?.hp)),exact=part?.matchType==='replace'&&matched>=h-.01,partial=!exact&&matched>0;rows.push({...c,term,semester:term,originalTerm:term,__slOriginalTerm:term,__slOriginalIndex:index,status:exact?'credited':partial?'partial':'remaining',credited:exact,isCredited:exact,matchedHp:matched,matchType:part?.matchType||'none',matchReason:part?.reason||'',programmeSource:'catalog',programmeId:programme.id})});
 return rows.sort((a,b)=>a.term-b.term||a.__slOriginalIndex-b.__slOriginalIndex);
}
function sameShape(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((r,i)=>courseKey(r)===courseKey(b[i])&&Number(r.term)===Number(b[i].term)&&r.status===b[i].status)}
function installRealProgrammeRows(){
 const snap=getSnapshot();if(!snap)return false;const best=programmeCandidates(snap)[0];if(!best||best.score<45)return false;const rows=buildProgrammeRows(best.p);if(rows.length<2)return false;const current=Array.isArray(snap.rows)?snap.rows:[];if(snap.programmeStructureSource==='catalog-v633'&&sameShape(current,rows))return true;
 const creditedHp=rows.filter(r=>r.status==='credited').reduce((s,r)=>s+hpOf(r),0)+rows.filter(r=>r.status==='partial').reduce((s,r)=>s+num(r.matchedHp),0),totalHp=num(best.p.hp)||rows.reduce((s,r)=>s+hpOf(r),0);
 const next={...snap,program:{...(snap.program||{}),id:best.p.id,name:best.p.name,university:best.p.university,code:best.p.code||snap?.program?.code||''},rows,totalHp,creditedHp,remainingHp:Math.max(0,totalHp-creditedHp),programmeStructureSource:'catalog-v633',programmeStructureVerified:Boolean(best.p.verified),programmeStructureCoverage:best.p.coverage||'',programmeStructureVersion:VERSION};
 try{sessionStorage.setItem('studielots_planner_snapshot',JSON.stringify(next))}catch(_){}
 window.__studielotsLastProgramSchedule={...next,rows,plannerBaselineRows:rows,scheduleSource:'real-programme-courses-v633'};window.__studielotsPlannerProgramme={version:VERSION,programmeId:best.p.id,programmeCode:best.p.code||'',courses:rows.length,score:best.score};return true;
}

/* ---------- Planner UI + faster route, event driven ---------- */
const FAST_PACE_KEY='studielots_fast_pace_hp',PACES=[30,37.5,45];let lastPlannerSignature='';
const termOf=r=>Number(r?.__slOriginalTerm??r?.originalTerm??r?.term??r?.semester??r?.termNo)||1;
const nameOf=r=>norm(r?.name??r?.courseName??r?.title??r?.course??'Kurs');
const isCredited=r=>Boolean(r?.credited||r?.completed||r?.done||r?.tillgodoraknad||r?.isCredited||r?.matched===true||r?.status==='credited'||r?.status==='completed');
const isPartial=r=>r?.status==='partial'||(num(r?.matchedHp)>0&&num(r?.matchedHp)<hpOf(r));
function baselineRows(){const live=window.__studielotsLastProgramSchedule;let rows=Array.isArray(live?.plannerBaselineRows)?live.plannerBaselineRows:null;if(!rows?.length)try{const snap=getSnapshot();rows=Array.isArray(snap?.rows)?snap.rows:null}catch(_){}if(!rows?.length&&Array.isArray(live?.rows))rows=live.rows;return(rows||[]).map((r,i)=>({...r,__slOriginalIndex:r?.__slOriginalIndex??i,__slOriginalTerm:termOf(r)})).sort((a,b)=>termOf(a)-termOf(b)||(a.__slOriginalIndex-b.__slOriginalIndex))}
const plannerSignature=rows=>rows.map(r=>[courseKey(r),termOf(r),r?.status||'',num(r?.matchedHp)].join(':')).join('|');
function grouped(rows){const map=new Map();rows.forEach(r=>{const t=termOf(r);if(!map.has(t))map.set(t,[]);map.get(t).push(r)});return[...map.entries()].sort((a,b)=>a[0]-b[0]).map(([term,items])=>({term,rows:items,hp:items.reduce((s,r)=>s+hpOf(r),0),creditedHp:items.filter(isCredited).reduce((s,r)=>s+hpOf(r),0)}))}
function courseRow(r){const credited=isCredited(r),partial=isPartial(r),state=credited?'credited':partial?'partial':'remaining',matched=Math.min(hpOf(r),num(r?.matchedHp||r?.creditedHp||0)),sub=credited?'Kan hoppas över – tillgodoräknad':partial?`${fmt(matched)} av ${fmt(hpOf(r))} hp kan räknas in`:'Ordinarie programkurs';return`<div class="v572-course sl633-course ${credited?'sl633-skip':''}" data-status="${state}"><span class="v572-status ${state}">${credited?'✓':partial?'◐':'○'}</span><div class="v572-course-copy"><strong>${esc(nameOf(r))}</strong><small class="${state}">${esc(sub)}</small></div><b>${fmt(hpOf(r))} hp</b></div>`}
function renderPlanner(force=false){
 const root=document.getElementById('plannerClean');if(!root||document.querySelector('.screen.active')?.id!=='plannerClean')return false;root.querySelector('#sl-pace-picker')?.remove();const rows=baselineRows();if(!rows.length)return false;const sig=plannerSignature(rows);if(!force&&sig===lastPlannerSignature&&root.querySelector('.sl633-course'))return true;lastPlannerSignature=sig;const terms=grouped(rows),accordion=root.querySelector('.v572-accordion');
 if(accordion){accordion.innerHTML=terms.map((t,idx)=>`<section class="v572-term-section ${idx===0?'open':''}" data-term-section="${t.term}"><button type="button" class="v572-term-head"><span>Termin ${t.term}</span><b>${fmt(t.hp)} hp</b><i>${idx===0?'⌃':'⌄'}</i></button><div class="v572-term-body">${t.rows.map(courseRow).join('')}</div></section>`).join('');accordion.querySelectorAll('.v572-term-head').forEach(btn=>btn.onclick=()=>{const s=btn.closest('.v572-term-section'),open=s.classList.toggle('open');btn.querySelector('i').textContent=open?'⌃':'⌄'})}
 const strip=root.querySelector('.v572-term-strip');if(strip){strip.innerHTML=terms.map(t=>`<button type="button" class="v572-term ${t.creditedHp>=t.hp-.01?'done':t.creditedHp>0?'part':''}" data-term="${t.term}"><b>T${t.term}</b><small>Termin ${t.term}</small><span class="sl633-circle"></span><strong>${fmt(t.hp)} hp</strong><em>${t.creditedHp>0?`${fmt(t.creditedHp)} hp kan hoppas över`:'Ordinarie'}</em><i>Visa</i></button>`).join('');strip.querySelectorAll('[data-term]').forEach(btn=>btn.onclick=()=>{const sec=root.querySelector(`[data-term-section="${btn.dataset.term}"]`);if(!sec)return;sec.classList.add('open');sec.querySelector('.v572-term-head i').textContent='⌃';sec.scrollIntoView({behavior:'smooth',block:'start'})})}
 const fast=root.querySelector('.v572-fast-inline');if(fast){fast.classList.remove('quiet');fast.innerHTML='<span>⚡</span><div><div><b>SNABBARE VÄG TILL EXAMEN</b></div><p>Se om tillgodoräknanden och högre studietakt kan korta vägen till examen.</p></div><button type="button" data-sl633-fast="1">Räkna ut snabbare väg →</button>';fast.querySelector('[data-sl633-fast]')?.addEventListener('click',openFastRoute,{once:true})}return true;
}
function calculateFast(pace){const base=baselineRows(),remaining=base.filter(r=>!isCredited(r)),ordinaryTerms=Math.max(0,...base.map(termOf));let term=1,used=0;const planned=[];remaining.forEach(r=>{const h=hpOf(r);if(used>0&&used+h>pace+.001){term++;used=0}planned.push({...r,__fastTerm:term});used+=h});const byTerm=new Map();planned.forEach(r=>{if(!byTerm.has(r.__fastTerm))byTerm.set(r.__fastTerm,[]);byTerm.get(r.__fastTerm).push(r)});const fastTerms=Math.max(0,...planned.map(r=>r.__fastTerm));return{pace,ordinaryTerms,fastTerms,saved:Math.max(0,ordinaryTerms-fastTerms),remainingHp:remaining.reduce((s,r)=>s+hpOf(r),0),terms:[...byTerm.entries()].map(([t,rs])=>({term:t,rows:rs,hp:rs.reduce((s,r)=>s+hpOf(r),0)}))}}
function fastPanel(){const selected=Number(localStorage.getItem(FAST_PACE_KEY))||37.5,results=PACES.map(calculateFast),active=results.find(r=>r.pace===selected)||results[1];return`<div class="sl633-fast-sheet" role="dialog" aria-modal="true" aria-label="Snabbare väg"><div class="sl633-fast-head"><div><span>SNABBARE VÄG</span><h2>Hur snabbt kan du bli klar?</h2><p>Motorn behåller programkursernas ordning, tar bort belastningen för tillgodoräknade kurser och fyller terminer upp till vald takt.</p></div><button type="button" data-sl633-close>×</button></div><div class="sl633-results">${results.map(r=>`<button type="button" data-sl633-pace="${r.pace}" class="${r.pace===active.pace?'active':''}"><strong>${fmt(r.pace)} hp</strong><span>${r.fastTerms} terminer</span><small>${r.saved?`${r.saved} termin${r.saved===1?'':'er'} snabbare`:'Ingen tidsvinst'}</small></button>`).join('')}</div><div class="sl633-fast-summary"><strong>${fmt(active.remainingHp)} hp kvar att läsa</strong><span>Ordinarie program: ${active.ordinaryTerms} terminer · Snabbare väg: ${active.fastTerms} terminer</span></div><div class="sl633-fast-terms">${active.terms.map(t=>`<section><div><strong>Termin ${t.term}</strong><b>${fmt(t.hp)} hp</b></div>${t.rows.map(r=>`<p><span>${esc(nameOf(r))}</span><b>${fmt(hpOf(r))} hp</b></p>`).join('')}</section>`).join('')}</div><p class="sl633-caution">Preliminär plan. Förkunskapskrav, kursutbud och överlapp kan göra att en kurs inte går att tidigarelägga i praktiken.</p></div>`}
function openFastRoute(){let modal=document.getElementById('sl633-fast-modal');if(!modal){modal=document.createElement('div');modal.id='sl633-fast-modal';modal.className='sl633-fast-modal';document.body.appendChild(modal)}modal.innerHTML=fastPanel();modal.classList.add('open');document.body.classList.add('sl633-modal-open');modal.onclick=e=>{if(e.target===modal||e.target.closest('[data-sl633-close]')){modal.classList.remove('open');document.body.classList.remove('sl633-modal-open')}const p=e.target.closest('[data-sl633-pace]');if(p){try{localStorage.setItem(FAST_PACE_KEY,p.dataset.sl633Pace)}catch(_){}modal.innerHTML=fastPanel()}}}
function refreshPlanner(force=false){if(document.querySelector('.screen.active')?.id!=='plannerClean')return;installRealProgrammeRows();requestAnimationFrame(()=>renderPlanner(force))}

document.addEventListener('click',e=>{if(e.target.closest('[data-screen="plannerClean"]'))setTimeout(()=>refreshPlanner(false),50)},true);
['studielots:screen-rendered','studielots:planner-open','studielots:pacechange'].forEach(n=>window.addEventListener(n,()=>refreshPlanner(false)));
window.addEventListener('pageshow',()=>refreshPlanner(false));

if(!document.getElementById('sl633-style')){const style=document.createElement('style');style.id='sl633-style';style.textContent=`#sl-pace-picker{display:none!important}.sl633-course.sl633-skip{background:#f0f8f4!important;opacity:.82}.sl633-course.sl633-skip .v572-course-copy strong{text-decoration:line-through;text-decoration-thickness:1px;text-decoration-color:#4d8c79}.sl633-course .v572-course-copy small.credited{color:#17745f!important;font-weight:800}.sl633-circle{width:30px;height:30px;border:3px solid #b7c1bd;border-radius:50%;display:block;margin:9px auto}.v572-term.done .sl633-circle{border-color:#2b9c77;background:#dff3eb}.v572-term.part .sl633-circle{border-color:#e9b020}.v572-term>strong{display:block;font-size:18px}.v572-term>em{display:block;font-style:normal;font-size:10px;color:#74807f;margin-top:2px}.v572-term>i{display:block;font-style:normal;color:#17745f;font-weight:800;font-size:11px;margin-top:6px}.v572-fast-inline [data-sl633-fast]{display:inline-flex!important;margin-top:10px;border:0;border-radius:999px;background:#176b5b;color:#fff;padding:10px 14px;font-weight:850}.sl633-fast-modal{display:none;position:fixed;inset:0;z-index:5000;background:rgba(8,32,35,.42);padding:18px;align-items:flex-end;justify-content:center}.sl633-fast-modal.open{display:flex}.sl633-modal-open{overflow:hidden!important}.sl633-fast-sheet{width:min(720px,100%);max-height:88dvh;overflow:auto;background:#fbfaf6;border-radius:28px 28px 20px 20px;padding:20px 18px calc(22px + env(safe-area-inset-bottom));box-shadow:0 24px 60px rgba(8,32,35,.28)}.sl633-fast-head{display:flex;align-items:flex-start;gap:14px;justify-content:space-between}.sl633-fast-head span{font-size:10px;letter-spacing:.12em;font-weight:900;color:#17745f}.sl633-fast-head h2{margin:4px 0 6px;font-size:26px;letter-spacing:-.035em}.sl633-fast-head p{margin:0;color:#69757d;font-size:12px;line-height:1.45}.sl633-fast-head button{border:0;background:#eef2ef;border-radius:50%;width:34px;height:34px;font-size:22px;color:#49615b}.sl633-results{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:18px 0}.sl633-results button{border:1px solid rgba(21,88,79,.14);border-radius:17px;background:#fff;padding:12px 6px;color:#15584f}.sl633-results button.active{background:#176b5b;color:#fff}.sl633-results strong,.sl633-results span,.sl633-results small{display:block}.sl633-results strong{font-size:17px}.sl633-results span{font-size:11px;margin-top:3px}.sl633-results small{font-size:9px;margin-top:4px;opacity:.82}.sl633-fast-summary{padding:13px 14px;border-radius:16px;background:#eef6f2;display:grid;gap:3px}.sl633-fast-summary strong{font-size:14px}.sl633-fast-summary span{font-size:11px;color:#60736e}.sl633-fast-terms{display:grid;gap:10px;margin-top:14px}.sl633-fast-terms section{background:#fff;border:1px solid rgba(21,88,79,.1);border-radius:17px;padding:12px}.sl633-fast-terms section>div,.sl633-fast-terms p{display:flex;justify-content:space-between;gap:12px}.sl633-fast-terms section>div{padding-bottom:8px;border-bottom:1px solid #edf0ee}.sl633-fast-terms p{margin:8px 0 0;font-size:11px}.sl633-fast-terms p b{white-space:nowrap}.sl633-caution{font-size:10px;line-height:1.45;color:#7c8582;margin:14px 2px 0}`;document.head.appendChild(style)}

requestAnimationFrame(()=>refreshPlanner(true));
window.__studielotsRuntime={version:VERSION,modules:['susa-distance','distance-ranking','real-programme-planner','faster-route'],singleRuntime:true,noGlobalMutationObserver:true,legacyUniversityDetailRemoved:true,distancePolicyNative:true};
window.__studielotsDistanceSource={version:VERSION,primary:'skolverket-susa-navet',subjectAwareCache:true,dedupe:true};
window.__studielotsDistanceRanking={version:VERSION,policy:'requirement-first-semantic-definition-dedupe',rejectPhysicalMeetings:true,topPerNeed:12};
window.__studielotsFasterRoute={version:VERSION,ordinaryPlanAlwaysBaseline:true,fastPaces:PACES.slice(),optIn:true,calculate:calculateFast,eventDriven:true,noMutationObserver:true};
})();