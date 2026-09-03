(()=>{
'use strict';
const VERSION='649';
let queued=false,degreeQueued=false;
function plannerRoot(){return document.getElementById('plannerCleanContent')}
function activePlanner(){return document.querySelector('.screen.active')?.id==='plannerClean'}
function norm(el){return (el?.textContent||'').replace(/\s+/g,' ').trim()}
function cleanTermLabels(root){
 if(!root)return;
 const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 const nodes=[];let n;
 while((n=w.nextNode()))nodes.push(n);
 for(const node of nodes){
  const raw=node.nodeValue||'';
  const next=raw.replace(/Termin\s+(\d+)\s*[–—-]\s*\1\b/gi,'Termin $1');
  if(next!==raw)node.nodeValue=next;
 }
}
function fastCandidate(root){
 if(!root)return null;
 const existing=root.querySelector('.sl635-fast-card');
 if(existing)return existing;
 const all=[...root.querySelectorAll('section,div,article,button')];
 const hits=all.filter(el=>{const t=norm(el);return /SNABBARE VÄG TILL EXAMEN/i.test(t)&&t.length<700});
 if(!hits.length)return null;
 hits.sort((a,b)=>norm(a).length-norm(b).length);
 let el=hits[0];
 while(el.parentElement&&el.parentElement!==root){
  const p=el.parentElement,t=norm(p);
  if(!/SNABBARE VÄG TILL EXAMEN/i.test(t)||t.length>700)break;
  if(p.matches('section,article')||/card|fast|shortcut|route/i.test(p.className||''))el=p;
  else break;
 }
 return el;
}
function hasPlannerData(){try{const s=JSON.parse(sessionStorage.getItem('studielots_planner_snapshot')||'null');return!!(s&&((Array.isArray(s.rows)&&s.rows.length)||(Array.isArray(s.courses)&&s.courses.length)))}catch(_){return false}}
function ensureFastRouteHost(root){
 if(!root||root.querySelector('.sl635-fast-card')||/STUDIEUPPLÄGG SAKNAS/i.test(norm(root))||!hasPlannerData())return root?.querySelector('.sl635-fast-card')||null;
 const host=document.createElement('section');
 host.className='sl635-fast-card sl649-fast-universal';
 host.dataset.v641='0';
 host.innerHTML='<button type="button" class="sl649-fast-placeholder"><span>⚡</span><div><b>Kan du bli klar snabbare?</b><p>Se om högre studietakt kan korta tiden till examen.</p></div><i>›</i></button>';
 const heading=[...root.querySelectorAll('h2,h3')].find(el=>/^Studieplan$/i.test(norm(el)));
 if(heading){let anchor=heading;while(anchor.parentElement&&anchor.parentElement!==root)anchor=anchor.parentElement;if(anchor.parentElement===root)root.insertBefore(host,anchor);else root.appendChild(host)}else root.appendChild(host);
 window.dispatchEvent(new CustomEvent('studielots:planner-open',{detail:{source:'universal-fast-route',version:VERSION}}));
 return host;
}
function enableFastRoute(root){
 let card=fastCandidate(root);
 if(!card)card=ensureFastRouteHost(root);
 if(!card)return;
 if(card.classList.contains('sl635-fast-card')){
  if(card.dataset.v641!=='1')window.dispatchEvent(new CustomEvent('studielots:planner-open',{detail:{source:'fast-route-ready',version:VERSION}}));
  return;
 }
 card.classList.add('sl635-fast-card','sl647-fast-adapter');
 card.dataset.v641='0';
 card.setAttribute('role','button');
 card.setAttribute('tabindex','0');
 card.setAttribute('aria-label','Öppna snabbare väg till examen');
 const open=()=>{
  try{sessionStorage.setItem('studielots_fast_panel_open','1')}catch(_){}
  card.dataset.v641='0';
  window.dispatchEvent(new CustomEvent('studielots:planner-open',{detail:{source:'legacy-fast-card',version:VERSION}}));
  requestAnimationFrame(()=>card.querySelector('.sl638-fast-toggle')?.click());
 };
 card.addEventListener('click',open,{once:true});
 card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}},{once:true});
 window.dispatchEvent(new CustomEvent('studielots:planner-open',{detail:{source:'legacy-fast-adapter',version:VERSION}}));
}
function run(){queued=false;if(!activePlanner())return;const root=plannerRoot();if(!root)return;cleanTermLabels(root);ensureFastRouteHost(root);enableFastRoute(root)}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(run)}
function degreeCard(el,root){let p=el;while(p&&p.parentElement!==root)p=p.parentElement;return p&&p.parentElement===root?p:null}
function correctFastestBadge(){
 degreeQueued=false;
 if(document.querySelector('.screen.active')?.id!=='degrees')return;
 const root=document.getElementById('degreeResults');if(!root)return;
 const cards=[...root.children].filter(c=>/\b\d+(?:[,.]\d+)?\s*hp\s*kvar\b/i.test(norm(c))&&/Visa väg/i.test(norm(c)));
 if(cards.length<2)return;
 const ranked=cards.map(c=>{const m=norm(c).match(/(\d+(?:[,.]\d+)?)\s*hp\s*kvar\b/i);return{card:c,hp:m?Number(m[1].replace(',','.')):Infinity}}).filter(x=>Number.isFinite(x.hp));
 if(!ranked.length)return;
 const min=Math.min(...ranked.map(x=>x.hp));
 const winner=ranked.find(x=>Math.abs(x.hp-min)<.001)?.card;if(!winner)return;
 const badgeEls=[...root.querySelectorAll('*')].filter(el=>/^⚡?\s*Snabbaste väg$/i.test(norm(el)));
 if(!badgeEls.length)return;
 badgeEls.sort((a,b)=>norm(a).length-norm(b).length);
 const badge=badgeEls[0];
 const current=degreeCard(badge,root);
 if(current===winner)return;
 let target=null;
 const chip=[...winner.querySelectorAll('span,div')].find(el=>/^(?:\d+\s+lärosäten?|Distans finns)$/i.test(norm(el)));
 if(chip)target=chip.parentElement;
 if(!target||target===winner)target=[...winner.querySelectorAll('div')].find(el=>{const t=norm(el);return /lärosäte/i.test(t)&&/Distans finns/i.test(t)&&t.length<120})||null;
 if(target&&target!==badge.parentElement){target.appendChild(badge)}else if(current!==winner){badge.remove()}
}
function degreeSchedule(){if(degreeQueued)return;degreeQueued=true;requestAnimationFrame(correctFastestBadge)}
function install(){
 ['studielots:screen-rendered','studielots:planner-open','studielots:planner-snapshot','studielots:planner-baseline','pageshow'].forEach(e=>window.addEventListener(e,schedule));
 ['studielots:screen-rendered','pageshow'].forEach(e=>window.addEventListener(e,degreeSchedule));
 document.addEventListener('click',()=>{schedule();degreeSchedule()},true);
 const root=plannerRoot();if(root){new MutationObserver(schedule).observe(root,{childList:true,subtree:true,characterData:true})}
 const degrees=document.getElementById('degreeResults');if(degrees){new MutationObserver(degreeSchedule).observe(degrees,{childList:true,subtree:true,characterData:true})}
 if(!document.getElementById('sl649-style')){const s=document.createElement('style');s.id='sl649-style';s.textContent='.sl647-fast-adapter,.sl649-fast-universal{cursor:pointer;touch-action:manipulation}.sl647-fast-adapter:focus-visible{outline:2px solid currentColor;outline-offset:3px}.sl649-fast-placeholder{width:100%;border:0;background:transparent;padding:0;display:grid;grid-template-columns:42px 1fr auto;gap:12px;align-items:center;text-align:left;color:inherit}.sl649-fast-placeholder>span{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:#fff0bf;font-size:22px}.sl649-fast-placeholder b{display:block}.sl649-fast-placeholder p{margin:4px 0 0;color:#747d78}.sl649-fast-placeholder i{font-style:normal;font-size:24px}';document.head.appendChild(s)}
 window.__studielotsBuild={...(window.__studielotsBuild||{}),plannerUiFix:VERSION,cleanTermLabels:true,legacyFastRouteClickable:true,fastestOpportunityByRemainingHp:true,fastRouteForAllPlannerSubjects:true};
 schedule();degreeSchedule();setTimeout(schedule,120);setTimeout(schedule,350);setTimeout(schedule,700);setTimeout(degreeSchedule,120);setTimeout(degreeSchedule,350);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();