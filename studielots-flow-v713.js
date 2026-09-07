(()=>{
'use strict';
const VERSION='720';
let forwarding=false;
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0},txt=v=>String(v??'').replace(/\s+/g,' ').trim();
function activeId(){return document.querySelector('.screen.active')?.id||''}
function cta(){const root=document.getElementById('universityDetailContent');if(!root)return null;return [...root.querySelectorAll('button,a')].find(el=>/Skapa plan i Planeraren/i.test(el.textContent||''))||null}
function read(){try{return JSON.parse(sessionStorage.getItem('studielots_planner_snapshot')||'null')}catch(_){return null}}
function rowsOf(s){return Array.isArray(s?.plannerBaselineRows)&&s.plannerBaselineRows.length?s.plannerBaselineRows:Array.isArray(s?.rows)&&s.rows.length?s.rows:Array.isArray(s?.courses)?s.courses:[]}
function ready(){const s=read(),rows=rowsOf(s);return!!(s&&rows.length&&rows.reduce((a,r)=>a+n(r?.hp??r?.credits??r?.ects??r?.points),0)>0)}
function normalize(){const s=read();if(!s)return false;let rows=rowsOf(s);if(!rows.length)return false;rows=rows.map((r,i)=>({...r,__slOriginalIndex:Number.isFinite(Number(r?.__slOriginalIndex))?Number(r.__slOriginalIndex):i,__slOriginalTerm:n(r?.__slOriginalTerm??r?.originalTerm??r?.term??r?.semester)||1})).sort((a,b)=>a.__slOriginalTerm-b.__slOriginalTerm||a.__slOriginalIndex-b.__slOriginalIndex);const next={...s,rows,plannerBaselineRows:rows,plannerOrderVersion:VERSION};try{sessionStorage.setItem('studielots_planner_snapshot',JSON.stringify(next))}catch(_){}window.__studielotsLastProgramSchedule={...(window.__studielotsLastProgramSchedule||{}),...next};return true}
function wait(on){const s=document.getElementById('universityDetail');if(s)s.classList.toggle('sl720-waiting',on)}
function finish(attempt=0){if(ready()){normalize();wait(false);if(activeId()!=='plannerClean')window.go?.('plannerClean');window.dispatchEvent(new CustomEvent('studielots:planner-open',{detail:{source:'flow-v720'}}));forwarding=false;return}if(attempt>=20){wait(false);forwarding=false;return}setTimeout(()=>finish(attempt+1),100)}
function forward(){if(forwarding||activeId()!=='universityDetail')return;const b=cta();if(!b)return;forwarding=true;wait(true);try{b.click()}catch(_){forwarding=false;wait(false);return}setTimeout(()=>finish(0),20)}
function schedule(){[0,50,120,250,500].forEach(ms=>setTimeout(forward,ms))}
function style(){if(document.getElementById('sl720-flow-style'))return;const s=document.createElement('style');s.id='sl720-flow-style';s.textContent=`#universityDetail.sl720-waiting{position:relative;min-height:65vh}#universityDetail.sl720-waiting #universityDetailContent{opacity:0!important;pointer-events:none!important}#universityDetail.sl720-waiting:after{content:'Bygger din studieplan…';position:absolute;left:50%;top:120px;transform:translateX(-50%);font-weight:800;color:#176b5b;background:#fff;padding:14px 18px;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,.07);white-space:nowrap}`;document.head.appendChild(s)}
function install(){style();schedule();const u=document.getElementById('universityDetailContent');if(u)new MutationObserver(()=>{if(activeId()==='universityDetail'&&!forwarding)schedule()}).observe(u,{childList:true,subtree:true,characterData:true});['studielots:screen-rendered','pageshow'].forEach(e=>window.addEventListener(e,()=>{if(activeId()==='universityDetail'&&!forwarding)schedule()}));window.__studielotsBuild={...(window.__studielotsBuild||{}),flow:VERSION,plannerFlowRole:'handoff-only'}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();