(()=>{
'use strict';
const VERSION='634';
const previousOpenDistance=window.openDistancePathFromOpportunity;
let pending=false;
let observer=null;
let timeout=0;
let beforeSnapshot='';

const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const low=v=>clean(v).toLocaleLowerCase('sv-SE');

function stopPending(){
 pending=false;
 if(observer){observer.disconnect();observer=null}
 clearTimeout(timeout);
 document.documentElement.classList.remove('sl634-distance-direct');
}

function activePlanner(){
 return document.querySelector('.screen.active')?.id==='plannerClean';
}

function plannerCta(){
 const roots=[document.getElementById('myPathFlow'),document.getElementById('universityDetailContent')].filter(Boolean);
 for(const root of roots){
  const preferred=root.querySelector('.v550-plan-button,[data-v550-plan-cta] button,[data-plan-cta]');
  if(preferred)return preferred;
  for(const button of root.querySelectorAll('button,a')){
   const text=low(button.textContent);
   if((text.includes('planeraren')||text.includes('skapa plan'))&&!button.matches('[data-sl634-distance]'))return button;
  }
 }
 return null;
}

function finishDistanceToPlanner(){
 if(!pending)return true;
 if(activePlanner()){stopPending();return true}
 const cta=plannerCta();
 if(cta){
  pending=false;
  if(observer){observer.disconnect();observer=null}
  clearTimeout(timeout);
  cta.click();
  setTimeout(()=>document.documentElement.classList.remove('sl634-distance-direct'),80);
  return true;
 }
 let current='';
 try{current=sessionStorage.getItem('studielots_planner_snapshot')||''}catch(_){}
 if(current&&current!==beforeSnapshot&&typeof window.openStudyPlanner==='function'){
  pending=false;
  if(observer){observer.disconnect();observer=null}
  clearTimeout(timeout);
  window.openStudyPlanner();
  setTimeout(()=>document.documentElement.classList.remove('sl634-distance-direct'),80);
  return true;
 }
 return false;
}

function beginDistanceToPlanner(openExisting){
 beforeSnapshot='';
 try{beforeSnapshot=sessionStorage.getItem('studielots_planner_snapshot')||''}catch(_){}
 pending=true;
 document.documentElement.classList.add('sl634-distance-direct');
 if(observer){observer.disconnect();observer=null}
 const root=document.getElementById('myPathFlow')||document.getElementById('universityDetailContent');
 if(root){
  observer=new MutationObserver(()=>finishDistanceToPlanner());
  observer.observe(root,{childList:true,subtree:true});
 }
 try{openExisting()}catch(error){console.warn('StudieLots distance planner',error);stopPending();return}
 let tries=0;
 const tick=()=>{
  if(finishDistanceToPlanner())return;
  if(++tries<100)setTimeout(tick,50);
  else stopPending();
 };
 setTimeout(tick,0);
 timeout=setTimeout(stopPending,5200);
}

function smallestDistanceCard(root){
 const candidates=[...root.querySelectorAll('section,article,div')].filter(el=>{
  const text=low(el.textContent);
  if(!text.includes('på distans'))return false;
  const buttons=[...el.querySelectorAll('button,a')];
  return buttons.some(b=>low(b.textContent).includes('distansalternativ'))&&buttons.some(b=>low(b.textContent).includes('distansväg'));
 });
 return candidates.sort((a,b)=>a.querySelectorAll('*').length-b.querySelectorAll('*').length)[0]||null;
}

function unifyDistanceChoice(){
 const root=document.getElementById('degreeDetailContent');
 if(!root||document.querySelector('.screen.active')?.id!=='degreeDetail')return false;
 if(root.querySelector('[data-sl634-distance]'))return true;
 const card=smallestDistanceCard(root);
 if(!card)return false;
 const actions=[...card.querySelectorAll('button,a')];
 const pathButton=actions.find(b=>low(b.textContent).includes('distansväg'))||actions.find(b=>String(b.getAttribute('onclick')||'').includes('openDistancePathFromOpportunity'));
 if(!pathButton)return false;
 const trigger=()=>pathButton.click();
 card.classList.add('sl634-distance-card');
 card.innerHTML='';
 const row=document.createElement('button');
 row.type='button';
 row.className='uni-path sl634-distance-row';
 row.dataset.sl634Distance='1';
 row.innerHTML='<div class="sl634-distance-copy"><strong>Distans</strong><span>Studieplan med kurser som kan läsas på distans</span></div><i aria-hidden="true">›</i>';
 row.addEventListener('click',()=>beginDistanceToPlanner(trigger));
 card.appendChild(row);
 return true;
}

if(typeof previousOpenDistance==='function'){
 window.__studielotsOriginalDistancePath=previousOpenDistance;
}

function scheduleSync(){setTimeout(unifyDistanceChoice,40)}
window.addEventListener('studielots:screen-rendered',scheduleSync);
window.addEventListener('pageshow',scheduleSync);
document.addEventListener('click',scheduleSync,true);
requestAnimationFrame(unifyDistanceChoice);

if(!document.getElementById('sl634-distance-style')){
 const style=document.createElement('style');
 style.id='sl634-distance-style';
 style.textContent=`
 .sl634-distance-card{padding:0!important;overflow:hidden}
 .sl634-distance-row{width:100%;border:0!important;background:transparent!important;display:flex!important;align-items:center!important;justify-content:space-between!important;text-align:left!important;padding:26px 32px!important;min-height:116px;cursor:pointer;color:inherit}
 .sl634-distance-copy{display:grid;gap:5px}
 .sl634-distance-copy strong{font-size:24px;line-height:1.15;color:#278a76;font-weight:850}
 .sl634-distance-copy span{font-size:17px;line-height:1.35;color:#737d91;font-weight:500}
 .sl634-distance-row>i{font-size:34px;line-height:1;color:#078cff;font-style:normal;font-weight:400;margin-left:18px}
 html.sl634-distance-direct #myPath{visibility:hidden!important;pointer-events:none!important}
 @media(max-width:600px){.sl634-distance-row{padding:24px 28px!important}.sl634-distance-copy strong{font-size:22px}.sl634-distance-copy span{font-size:16px}}
 `;
 document.head.appendChild(style);
}

window.__studielotsDistancePlanner={version:VERSION,singleChoice:true,samePlanner:true,reuseExistingDistanceEngine:true,scopedObserver:true};
})();
