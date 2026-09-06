(()=>{
'use strict';
const VERSION='711',KEY='studielots_planner_snapshot';
const rowsOf=s=>Array.isArray(s?.plannerBaselineRows)&&s.plannerBaselineRows.length?s.plannerBaselineRows:Array.isArray(s?.rows)&&s.rows.length?s.rows:Array.isArray(s?.courses)&&s.courses.length?s.courses:[];
function read(){try{return JSON.parse(sessionStorage.getItem(KEY)||'null')}catch(_){return null}}
function write(s){try{sessionStorage.setItem(KEY,JSON.stringify(s));return true}catch(_){return false}}
function render(){try{return window.__studielotsRenderSharedPlanner?.(true)===true}catch(_){return false}}
function repair(){
  let s=read(),rows=rowsOf(s),live=window.__studielotsLastProgramSchedule;
  if(!rows.length&&live&&rowsOf(live).length){
    const liveRows=rowsOf(live);
    s={...(s||{}),...live,selection:{...(s?.selection||{}),...(live.selection||{})},program:{...(s?.program||{}),...(live.program||{})},rows:liveRows,plannerBaselineRows:liveRows,plannerHandoffVersion:VERSION};
    rows=liveRows;write(s);
  }else if(rows.length&&(!Array.isArray(s?.rows)||!s.rows.length||!Array.isArray(s?.plannerBaselineRows)||!s.plannerBaselineRows.length)){
    s={...s,rows,plannerBaselineRows:rows,plannerHandoffVersion:VERSION};write(s);
  }
  if(rows.length){
    window.__studielotsLastProgramSchedule={...(window.__studielotsLastProgramSchedule||{}),...s,rows,plannerBaselineRows:rows};
    window.dispatchEvent(new CustomEvent('studielots:planner-snapshot',{detail:{source:'planner-handoff-v711',version:VERSION,rows:rows.length}}));
    window.dispatchEvent(new CustomEvent('studielots:planner-open',{detail:{source:'planner-handoff-v711',version:VERSION,rows:rows.length}}));
    render();setTimeout(render,40);setTimeout(render,140);
    return true;
  }
  render();return false;
}
function whenPlanner(){[0,40,120,260,600].forEach(ms=>setTimeout(()=>{if(document.querySelector('.screen.active')?.id==='plannerClean')repair()},ms))}
document.addEventListener('click',whenPlanner,true);
['studielots:screen-rendered','studielots:baseline-ready','studielots:planner-snapshot','pageshow'].forEach(e=>window.addEventListener(e,whenPlanner));
window.__studielotsRepairPlannerHandoff=repair;
window.__studielotsBuild={...(window.__studielotsBuild||{}),plannerHandoff:VERSION};
})();
