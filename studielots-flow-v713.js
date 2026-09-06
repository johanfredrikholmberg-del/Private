(()=>{
'use strict';
const VERSION='713';
let forwarding=false;
function activeId(){return document.querySelector('.screen.active')?.id||''}
function universityCta(){
 const root=document.getElementById('universityDetailContent');if(!root)return null;
 return [...root.querySelectorAll('button,a')].find(el=>/Skapa plan i Planeraren/i.test(el.textContent||''))||null;
}
function forwardUniversityToPlanner(){
 if(forwarding||activeId()!=='universityDetail')return false;
 const cta=universityCta();if(!cta)return false;
 forwarding=true;
 try{cta.click()}finally{setTimeout(()=>{forwarding=false},500)}
 return true;
}
function scheduleForward(){[0,30,80,160,320,650].forEach(ms=>setTimeout(forwardUniversityToPlanner,ms))}
function enhanceFastCard(){
 if(activeId()!=='plannerClean')return;
 const card=document.querySelector('#plannerCleanContent .sl635-fast-card');if(!card)return;
 const head=card.querySelector('.sl635-fast-head');if(!head||head.dataset.sl713==='1')return;
 head.dataset.sl713='1';head.setAttribute('role','button');head.setAttribute('tabindex','0');head.setAttribute('aria-expanded','false');
 const toggle=()=>{const open=card.classList.toggle('sl713-open');head.setAttribute('aria-expanded',String(open));if(open)setTimeout(()=>card.querySelector('.sl635-pace button')?.focus({preventScroll:true}),30)};
 head.addEventListener('click',e=>{if(!e.target.closest('button'))toggle()});
 head.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}});
 const active=card.querySelector('.sl635-pace button.active');if(active&&Number(active.dataset.sl635Pace)>30){card.classList.add('sl713-open');head.setAttribute('aria-expanded','true')}
}
function scheduleFast(){[0,40,120,260].forEach(ms=>setTimeout(enhanceFastCard,ms))}
function installStyle(){if(document.getElementById('sl713-style'))return;const s=document.createElement('style');s.id='sl713-style';s.textContent=`
#plannerCleanContent .sl635-fast-head{cursor:pointer;position:relative;padding-right:28px;touch-action:manipulation}
#plannerCleanContent .sl635-fast-head:after{content:'›';position:absolute;right:2px;top:50%;transform:translateY(-50%) rotate(90deg);font-size:24px;color:#6b7174;transition:transform .18s ease}
#plannerCleanContent .sl635-fast-card:not(.sl713-open) .sl635-pace,#plannerCleanContent .sl635-fast-card:not(.sl713-open)>small{display:none}
#plannerCleanContent .sl635-fast-card.sl713-open .sl635-fast-head:after{transform:translateY(-50%) rotate(-90deg)}
#plannerCleanContent .sl635-fast-head:focus-visible{outline:2px solid #176b5b;outline-offset:4px;border-radius:12px}
`;document.head.appendChild(s)}
function install(){installStyle();scheduleForward();scheduleFast();const u=document.getElementById('universityDetailContent');if(u)new MutationObserver(scheduleForward).observe(u,{childList:true,subtree:true});const p=document.getElementById('plannerCleanContent');if(p)new MutationObserver(scheduleFast).observe(p,{childList:true,subtree:true});window.__studielotsBuild={...(window.__studielotsBuild||{}),flow:VERSION,skipUniversityDetail:true,fastRouteClickable:true}}
['studielots:screen-rendered','studielots:planner-open','studielots:planner-snapshot','pageshow'].forEach(e=>window.addEventListener(e,()=>{scheduleForward();scheduleFast()}));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
