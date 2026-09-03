(()=>{
'use strict';
const VERSION='655';
const SNAPSHOT='studielots_planner_snapshot';
const BASE_PACE='studielots_shared_planner_pace';
const FAST_OPEN='studielots_fast_panel_open';
const FAST_PACE='studielots_fast_panel_pace';
let queued=false,rerenderPending=false;
const text=v=>String(v??'').replace(/\s+/g,' ').trim();
const low=v=>text(v).toLocaleLowerCase('sv-SE');
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const hp=r=>num(r?.hp??r?.credits??r?.ects??r?.points);
const credited=r=>!!(r?.credited||r?.completed||r?.done||r?.isCredited||r?.status==='credited'||r?.status==='completed');
function snapshot(){try{return JSON.parse(sessionStorage.getItem(SNAPSHOT)||'null')}catch(_){return null}}
function saveSnapshot(s){try{sessionStorage.setItem(SNAPSHOT,JSON.stringify(s))}catch(_){}}
function programmeName(s){return text(s?.program?.name||s?.selection?.program)}
function university(s){return text(s?.program?.university||s?.selection?.university)}
function liveMismatch(s,live){if(!s||!live)return false;const su=university(s),lu=university(live);if(su&&lu&&low(su)!==low(lu))return true;const sp=programmeName(s),lp=programmeName(live);if(sp&&lp&&low(sp)!==low(lp))return true;return false}
function realStructure(s){const src=[s?.programmeStructureSource,s?.scheduleSource,s?.source].map(low).join(' ');return /(catalog|real-programme|auto-v641|national-path|susa-auto)/.test(src)}
function rowsOf(s){if(Array.isArray(s?.plannerBaselineRows)&&s.plannerBaselineRows.length)return s.plannerBaselineRows;if(Array.isArray(s?.rows)&&s.rows.length)return s.rows;if(Array.isArray(s?.courses)&&s.courses.length)return s.courses;return[]}
function termOf(r){return Math.max(1,num(r?.__slOriginalTerm??r?.originalTerm??r?.term??r?.semester)||1)}
function remainingTermCount(rows){return new Set(rows.filter(r=>!credited(r)&&hp(r)>0).map(termOf)).size}
function requestRerender(source){if(rerenderPending)return;rerenderPending=true;setTimeout(()=>{rerenderPending=false;window.dispatchEvent(new CustomEvent('studielots:planner-open',{detail:{source,version:VERSION}}))},0)}
function enforceState(){let changed=false;try{if(localStorage.getItem(BASE_PACE)!=='30'){localStorage.setItem(BASE_PACE,'30');changed=true}}catch(_){}
 const s=snapshot();if(!s)return changed;
 const live=window.__studielotsLastProgramSchedule;if(liveMismatch(s,live)){window.__studielotsLastProgramSchedule=null;changed=true}
 const rows=rowsOf(s);if(realStructure(s)&&rows.length>=2){const remaining=rows.filter(r=>!credited(r)).reduce((z,r)=>z+hp(r),0);if(Math.abs(num(s.remainingHp)-remaining)>.01){saveSnapshot({...s,remainingHp:remaining});changed=true}}
 if(changed&&document.querySelector('.screen.active')?.id==='plannerClean')requestRerender('planner-consistency-guard');return changed}
function fastPanelState(root,remainTerms){const panel=root.querySelector('.sl638-fast-panel');if(!panel)return{pace:30,terms:remainTerms,loadsOk:true};let pace=37.5;try{pace=Number(sessionStorage.getItem(FAST_PACE))||37.5}catch(_){}if(![30,37.5,45].includes(pace))pace=37.5;const terms=[...panel.querySelectorAll('.sl635-term')].filter(d=>[...d.querySelectorAll('.sl635-course')].some(x=>!x.classList.contains('credited')));const loads=terms.map(d=>{const m=text(d.querySelector('summary span')).match(/([\d,.]+)\s*hp/i);return m?Number(m[1].replace(',','.')):0});return{pace,terms:pace===30?remainTerms:terms.length||remainTerms,loadsOk:pace===30||loads.every(v=>v<=pace+.01),loads}}
function correctVisiblePlan(){if(document.querySelector('.screen.active')?.id!=='plannerClean')return;const root=document.getElementById('plannerCleanContent');if(!root)return;const s=snapshot(),rows=rowsOf(s);if(!s||!rows.length)return;
 const remainTerms=remainingTermCount(rows),summaryBoxes=[...root.querySelectorAll('.sl635-summary>div')];if(summaryBoxes[1]){const b=summaryBoxes[1].querySelector('b'),small=summaryBoxes[1].querySelector('small');if(b)b.textContent=`${remainTerms} terminer`;if(small&&!/(37,5|45)/.test(text(small)))small.textContent='kvar vid ordinarie takt'}
 for(const d of root.querySelectorAll('.sl635-terms>.sl635-term')){const rowsDom=[...d.querySelectorAll('.sl635-course')],allDone=rowsDom.length&&rowsDom.every(x=>x.classList.contains('credited'));const span=d.querySelector('summary span');if(allDone&&span){span.textContent='Klar';d.classList.add('sl654-complete-term')}else d.classList.remove('sl654-complete-term')}
 const state=fastPanelState(root,remainTerms),fastResult=root.querySelector('.sl638-fast-result');if(fastResult){const b=fastResult.querySelector('b'),span=fastResult.querySelector('span');if(span)span.textContent=`Ordinarie: ${remainTerms} terminer · vald väg: ${state.terms} terminer`;if(b&&state.pace>30&&!state.loadsOk)b.textContent='Ingen säker tidsvinst';}
 const note=root.querySelector('.sl638-fast-note');if(note&&state.pace>30&&!/förkunskapskrav/i.test(text(note)))note.textContent='Kursordningen behålls. Kontrollera förkunskapskrav och kurstillfällen med universitetet innan du väljer högre studietakt.';
}
function audit(){if(document.querySelector('.screen.active')?.id!=='plannerClean')return null;const root=document.getElementById('plannerCleanContent');if(!root)return null;const s=snapshot(),rows=rowsOf(s),remainingRows=rows.filter(r=>!credited(r)),remainingHp=remainingRows.reduce((z,r)=>z+hp(r),0),summary=text(root.querySelector('.sl635-summary')),fastCard=root.querySelector('.sl635-fast-card'),fastToggle=fastCard?.querySelector('.sl638-fast-toggle'),termLabels=[...root.querySelectorAll('.sl635-term summary strong')].map(x=>text(x)),remainTerms=remainingTermCount(rows),fastState=fastPanelState(root,remainTerms);const result={version:VERSION,ordinaryMainPlan:/ordinarie takt|kvar vid ordinarie takt/i.test(summary)||!/(37,5|45)\s*hp\/termin/i.test(summary),fastRoutePresent:!!fastCard,fastRouteClickable:!!fastToggle||!!fastCard?.querySelector('button'),duplicateTermLabels:termLabels.filter(x=>/Termin\s+(\d+)\s*[–—-]\s*\1/i.test(x)).length,hpConsistent:!realStructure(s)||Math.abs(num(s?.remainingHp)-remainingHp)<.01,remainingHp,rowRemainingHp:remainingHp,remainingTerms:remainTerms,fastTerms:fastState.terms,fastLoadWithinPace:fastState.loadsOk,fastNeverLonger:fastState.terms<=remainTerms,staleLiveSchedule:liveMismatch(s,window.__studielotsLastProgramSchedule),technicalSourceVisible:/\bSusa\b/i.test(text(root))};result.ok=result.ordinaryMainPlan&&result.fastRoutePresent&&result.fastRouteClickable&&!result.duplicateTermLabels&&result.hpConsistent&&result.fastLoadWithinPace&&result.fastNeverLonger&&!result.staleLiveSchedule&&!result.technicalSourceVisible;window.__studielotsPlannerAudit=result;return result}
function run(){queued=false;enforceState();setTimeout(()=>{correctVisiblePlan();audit()},70)}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(run)}
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-sl635-pace]');if(b){e.preventDefault();e.stopImmediatePropagation();const p=Number(b.dataset.sl635Pace);if([30,37.5,45].includes(p)){try{localStorage.setItem(BASE_PACE,'30');sessionStorage.setItem(FAST_OPEN,'1');sessionStorage.setItem(FAST_PACE,String(p))}catch(_){}const card=b.closest('.sl635-fast-card');if(card)card.dataset.v641='0';window.dispatchEvent(new CustomEvent('studielots:planner-open',{detail:{source:'fast-route-separated',version:VERSION}}));setTimeout(schedule,120);return}schedule()},true);
['studielots:planner-snapshot','studielots:planner-open','studielots:planner-baseline','studielots:screen-rendered','pageshow'].forEach(e=>window.addEventListener(e,schedule));
if(!document.getElementById('sl654-style')){const st=document.createElement('style');st.id='sl654-style';st.textContent='.sl654-complete-term{opacity:.78}.sl654-complete-term summary span{font-weight:800}';document.head.appendChild(st)}
window.__studielotsRunPlannerAudit=()=>{enforceState();correctVisiblePlan();return audit()};
window.__studielotsBuild={...(window.__studielotsBuild||{}),plannerConsistencyGuard:VERSION,ordinaryPlanLocked:true,fastRouteSeparated:true,hpConsistencyGuard:true,staleScheduleGuard:true,remainingTermCountFixed:true,completedTermsMarked:true,fastLoadValidation:true,fastPrerequisiteNotice:true};
schedule();setTimeout(schedule,160);setTimeout(schedule,500);
})();