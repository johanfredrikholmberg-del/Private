(()=>{
'use strict';
const VERSION='720',KEY='studielots_planner_snapshot';
const rowsOf=s=>Array.isArray(s?.plannerBaselineRows)&&s.plannerBaselineRows.length?s.plannerBaselineRows:Array.isArray(s?.rows)&&s.rows.length?s.rows:Array.isArray(s?.courses)&&s.courses.length?s.courses:[];
function read(){try{return JSON.parse(sessionStorage.getItem(KEY)||'null')}catch(_){return null}}
function write(s){try{sessionStorage.setItem(KEY,JSON.stringify(s));return true}catch(_){return false}}
function repair(){let s=read(),rows=rowsOf(s),live=window.__studielotsLastProgramSchedule;if(!rows.length&&live&&rowsOf(live).length){rows=rowsOf(live);s={...(s||{}),...live,rows,plannerBaselineRows:rows,plannerHandoffVersion:VERSION};write(s)}else if(rows.length&&(!Array.isArray(s?.rows)||!s.rows.length||!Array.isArray(s?.plannerBaselineRows)||!s.plannerBaselineRows.length)){s={...s,rows,plannerBaselineRows:rows,plannerHandoffVersion:VERSION};write(s)}if(rows.length)window.__studielotsLastProgramSchedule={...(window.__studielotsLastProgramSchedule||{}),...s,rows,plannerBaselineRows:rows};return rows.length>0}
function whenPlanner(){[0,60,180].forEach(ms=>setTimeout(()=>{if(document.querySelector('.screen.active')?.id==='plannerClean'&&repair())window.__studielotsRenderSharedPlanner?.()},ms))}
['studielots:screen-rendered','studielots:baseline-ready','pageshow'].forEach(e=>window.addEventListener(e,whenPlanner));window.__studielotsRepairPlannerHandoff=repair;window.__studielotsBuild={...(window.__studielotsBuild||{}),plannerHandoff:VERSION,plannerHandoffRole:'repair-only'};
})();