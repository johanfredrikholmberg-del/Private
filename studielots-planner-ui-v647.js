(()=>{
'use strict';
const VERSION='647';
let queued=false;
function plannerRoot(){return document.getElementById('plannerCleanContent')}
function activePlanner(){return document.querySelector('.screen.active')?.id==='plannerClean'}
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
 const all=[...root.querySelectorAll('section,div,article,button')];
 const hits=all.filter(el=>{const t=(el.textContent||'').replace(/\s+/g,' ').trim();return /SNABBARE VÄG TILL EXAMEN/i.test(t)&&t.length<700});
 if(!hits.length)return null;
 hits.sort((a,b)=>(a.textContent||'').length-(b.textContent||'').length);
 let el=hits[0];
 while(el.parentElement&&el.parentElement!==root){
  const p=el.parentElement,t=(p.textContent||'').replace(/\s+/g,' ').trim();
  if(!/SNABBARE VÄG TILL EXAMEN/i.test(t)||t.length>700)break;
  if(p.matches('section,article')||/card|fast|shortcut|route/i.test(p.className||''))el=p;
  else break;
 }
 return el;
}
function enableFastRoute(root){
 const card=fastCandidate(root);
 if(!card||card.classList.contains('sl635-fast-card'))return;
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
function run(){queued=false;if(!activePlanner())return;const root=plannerRoot();if(!root)return;cleanTermLabels(root);enableFastRoute(root)}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(run)}
function install(){
 ['studielots:screen-rendered','studielots:planner-open','studielots:planner-snapshot','studielots:planner-baseline','pageshow'].forEach(e=>window.addEventListener(e,schedule));
 document.addEventListener('click',schedule,true);
 const root=plannerRoot();if(root){new MutationObserver(schedule).observe(root,{childList:true,subtree:true,characterData:true})}
 if(!document.getElementById('sl647-style')){const s=document.createElement('style');s.id='sl647-style';s.textContent='.sl647-fast-adapter{cursor:pointer;touch-action:manipulation}.sl647-fast-adapter:focus-visible{outline:2px solid currentColor;outline-offset:3px}';document.head.appendChild(s)}
 window.__studielotsBuild={...(window.__studielotsBuild||{}),plannerUiFix:'647',cleanTermLabels:true,legacyFastRouteClickable:true};
 schedule();setTimeout(schedule,120);setTimeout(schedule,350);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();