(()=>{
'use strict';
const VERSION='689',HOST='universityDetailContent';
function host(){let el=document.getElementById(HOST);if(el)return el;el=document.createElement('div');el.id=HOST;el.hidden=true;el.setAttribute('aria-hidden','true');el.dataset.studielotsDirectBridge=VERSION;document.body.appendChild(el);return el}
function installGoGuard(){const old=window.go;if(typeof old!=='function'||old.__sl689)return;const next=function(screen){if(screen==='universityDetail'){host();return true}return old.apply(this,arguments)};next.__sl689=true;next.__legacy=old;window.go=next}
function clearHost(){const el=document.getElementById(HOST);if(el?.dataset?.studielotsDirectBridge===VERSION)el.replaceChildren()}
function install(){host();installGoGuard();document.addEventListener('pointerdown',e=>{if(e.target.closest('#degreeDetail .uni-path-btn'))host()},true);document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest('#degreeDetail .uni-path-btn'))host()},true);window.addEventListener('studielots:screen-rendered',()=>{installGoGuard();if(document.querySelector('.screen.active')?.id==='plannerClean')clearHost()});window.addEventListener('studielots:planner-open',clearHost);window.__studielotsBuild={...(window.__studielotsBuild||{}),directUniversityBridge:VERSION,obsoleteUniversityScreenRemoved:true}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();