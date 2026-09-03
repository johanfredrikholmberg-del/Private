(()=>{
'use strict';
const VERSION='653';
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
function requestRerender(source){if(rerenderPending)return;rerenderPending=true;setTimeout(()=>{rerenderPending=false;window.dispatchEvent(new CustomEvent('studielots:planner-open',{detail:{source,version:VERSION}}))},0)}
function enforceState(){let changed=false;try{if(localStorage.getItem(BASE_PACE)!=='30'){localStorage.setItem(BASE_PACE,'30');changed=true}}catch(_){}
 const s=snapshot();if(!s)return changed;
 const live=window.__studielotsLastProgramSchedule;if(liveMismatch(s,live)){window.__studielotsLastProgramSchedule=null;changed=true}
 const rows=rowsOf(s);if(realStructure(s)&&rows.length>=2){const remaining=rows.filter(r=>!credited(r)).reduce((z,r)=>z+hp(r),0);if(Math.abs(num(s.remainingHp)-remaining)>.01){saveSnapshot({...s,remainingHp:remaining});changed=true}}
 if(changed&&document.querySelector('.screen.active')?.id==='plannerClean')requestRerender('planner-consistency-guard');return changed}
function audit(){if(document.querySelector('.screen.active')?.id!=='plannerClean')return null;const root=document.getElementById('plannerCleanContent');if(!root)return null;const s=snapshot(),rows=rowsOf(s),remainingRows=rows.filter(r=>!credited(r)),remainingHp=remainingRows.reduce((z,r)=>z+hp(r),0),summary=text(root.querySelector('.sl635-summary')),fastCard=root.querySelector('.sl635-fast-card'),fastToggle=fastCard?.querySelector('.sl638-fast-toggle'),termLabels=[...root.querySelectorAll('.sl635-term summary strong')].map(x=>text(x));const result={version:VERSION,ordinaryMainPlan:/ordinarie takt/i.test(summary)||!/(37,5|45)\s*hp\/termin/i.test(summary),fastRoutePresent:!!fastCard,fastRouteClickable:!!fastToggle||!!fastCard?.querySelector('button'),duplicateTermLabels:termLabels.filter(x=>/Termin\s+(\d+)\s*[–—-]\s*\1/i.test(x)).length,hpConsistent:!realStructure(s)||Math.abs(num(s?.remainingHp)-remainingHp)<.01,remainingHp,rowRemainingHp:remainingHp,staleLiveSchedule:liveMismatch(s,window.__studielotsLastProgramSchedule),technicalSourceVisible:/\bSusa\b/i.test(text(root))};result.ok=result.ordinaryMainPlan&&result.fastRoutePresent&&result.fastRouteClickable&&!result.duplicateTermLabels&&result.hpConsistent&&!result.staleLiveSchedule&&!result.technicalSourceVisible;window.__studielotsPlannerAudit=result;return result}
function run(){queued=false;enforceState();setTimeout(audit,70)}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(run)}
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-sl635-pace]');if(b){e.preventDefault();e.stopImmediatePropagation();const p=Number(b.dataset.sl635Pace);if([30,37.5,45].includes(p)){try{localStorage.setItem(BASE_PACE,'30');sessionStorage.setItem(FAST_OPEN,'1');sessionStorage.setItem(FAST_PACE,String(p))}catch(_){}const card=b.closest('.sl635-fast-card');if(card)card.dataset.v641='0';window.dispatchEvent(new CustomEvent('studielots:planner-open',{detail:{source:'fast-route-separated',version:VERSION}}));return}schedule()},true);
['studielots:planner-snapshot','studielots:planner-open','studielots:planner-baseline','studielots:screen-rendered','pageshow'].forEach(e=>window.addEventListener(e,schedule));
window.__studielotsRunPlannerAudit=()=>{enforceState();return audit()};
window.__studielotsBuild={...(window.__studielotsBuild||{}),plannerConsistencyGuard:VERSION,ordinaryPlanLocked:true,fastRouteSeparated:true,hpConsistencyGuard:true,staleScheduleGuard:true};
schedule();setTimeout(schedule,160);setTimeout(schedule,500);
})();