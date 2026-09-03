(()=>{
'use strict';
const VERSION='649',CORE='/studielots-runtime-core-v641.js?v=641',UI='/studielots-planner-ui-v647.js?v=649',SNAPSHOT='studielots_planner_snapshot',ORIGIN='studielots_planner_origin';
let busy=false;
function snapshot(){try{return JSON.parse(sessionStorage.getItem(SNAPSHOT)||'null')}catch(_){return null}}
function usable(){const s=snapshot();return!!(s&&((Array.isArray(s.rows)&&s.rows.length)||(Array.isArray(s.courses)&&s.courses.length)))}
function setOrigin(v){try{sessionStorage.setItem(ORIGIN,v)}catch(_){}}
function summaryScreen(){const a=document.querySelector('.screen.active');if(!a||a.id==='plannerClean')return null;const t=(a.textContent||'').replace(/\s+/g,' ');return /Skapa plan i Planeraren/i.test(t)&&/Tillgodoräknat/i.test(t)&&/Kvar/i.test(t)?a:null}
function openPlanner(source){if(!usable())return false;try{window.go?.('plannerClean');window.dispatchEvent(new CustomEvent('studielots:planner-open',{detail:{source,version:VERSION}}));return true}catch(_){return false}}
function finish(a,isProgram,attempt=0){if(usable()){busy=false;a?.classList.remove('sl645-directing');setOrigin(isProgram?'program':'opportunity');openPlanner(isProgram?'program-summary-auto':'obsolete-summary-auto');return}if(attempt<12)setTimeout(()=>finish(a,isProgram,attempt+1),25);else{busy=false;a?.classList.remove('sl645-directing')}}
function skipSummary(){const a=summaryScreen();if(!a)return;const isProgram=a.id==='programMatch';setOrigin(isProgram?'program':'opportunity');if(usable()){openPlanner(isProgram?'program-summary-skip':'obsolete-summary-skip');return}if(busy)return;const cta=[...a.querySelectorAll('button')].find(b=>/Skapa plan i Planeraren/i.test(b.textContent||''));if(!cta)return;busy=true;a.classList.add('sl645-directing');cta.click();finish(a,isProgram)}
function schedule(){requestAnimationFrame(skipSummary);setTimeout(skipSummary,35);setTimeout(skipSummary,100)}
function loadUi(){if(document.querySelector('script[data-studielots-planner-ui="649"]'))return;const u=document.createElement('script');u.src=UI;u.async=false;u.dataset.studielotsPlannerUi='649';document.body.appendChild(u)}
function install(){document.addEventListener('click',schedule,true);window.addEventListener('studielots:planner-snapshot',schedule);window.addEventListener('studielots:screen-rendered',schedule);window.addEventListener('pageshow',schedule);if(!document.getElementById('sl645-style')){const st=document.createElement('style');st.id='sl645-style';st.textContent='.screen.sl645-directing{visibility:hidden!important}';document.head.appendChild(st)}window.__studielotsBuild={...(window.__studielotsBuild||{}),plannerOpenGuard:VERSION,obsoleteSummaryAuto:'enabled'};loadUi();schedule()}
const s=document.createElement('script');s.src=CORE;s.async=false;s.addEventListener('load',install,{once:true});document.body.appendChild(s);
})();