(()=>{
'use strict';
const VERSION='715',KEY='studielots_planner_snapshot';
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const low=v=>norm(v).toLocaleLowerCase('sv-SE');
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const nameOf=r=>norm(r?.name??r?.courseName??r?.title??r?.course??r?.label??'Kurs');
const isCredited=r=>Boolean(r?.credited||r?.completed||r?.done||r?.tillgodoraknad||r?.isCredited||r?.status==='credited'||r?.status==='completed');
function snapshot(){try{return JSON.parse(sessionStorage.getItem(KEY)||'null')}catch(_){return null}}
function rowsOf(s){const live=window.__studielotsLastProgramSchedule;const a=Array.isArray(live?.plannerBaselineRows)&&live.plannerBaselineRows.length?live.plannerBaselineRows:Array.isArray(s?.plannerBaselineRows)&&s.plannerBaselineRows.length?s.plannerBaselineRows:Array.isArray(s?.rows)?s.rows:Array.isArray(s?.courses)?s.courses:[];return a||[]}
function termOf(r){return Math.max(1,Math.round(num(r?.__slOriginalTerm??r?.originalTerm??r?.term??r?.semester)||1))}
function grouped(){const s=snapshot();if(!s)return new Map();const m=new Map();for(const r of rowsOf(s)){if(!isCredited(r))continue;const t=termOf(r);if(!m.has(t))m.set(t,[]);m.get(t).push(r)}return m}
function findOverviewCards(root){
 const candidates=[...root.querySelectorAll('button,article,section,div')].filter(el=>{
   if(el.closest('.sl635-terms,.sl635-fast-card'))return false;
   const t=norm(el.textContent);return /\bTermin\s+\d+\b/i.test(t)&&/(Kan räknas in|Återstår|Delvis)/i.test(t)&&t.length<260;
 });
 return candidates.filter(el=>!candidates.some(other=>other!==el&&el.contains(other)&&/\bTermin\s+\d+\b/i.test(norm(other.textContent))));
}
function decorate(){
 if(document.querySelector('.screen.active')?.id!=='plannerClean')return;
 const root=document.getElementById('plannerCleanContent');if(!root)return;
 const byTerm=grouped();if(!byTerm.size)return;
 for(const card of findOverviewCards(root)){
   const mm=norm(card.textContent).match(/\bTermin\s+(\d+)\b/i);if(!mm)continue;const term=Number(mm[1]),rows=byTerm.get(term)||[];
   const old=card.querySelector(':scope > .sl715-credit-list,.sl715-credit-list');if(old)old.remove();
   if(!rows.length)continue;
   card.classList.add('sl715-has-credit');
   const wrap=document.createElement('div');wrap.className='sl715-credit-list';wrap.setAttribute('aria-label','Kurser som kan räknas in');
   const unique=[];const seen=new Set();for(const r of rows){const n=nameOf(r);if(!n||seen.has(low(n)))continue;seen.add(low(n));unique.push(n)}
   wrap.innerHTML=`<div class="sl715-credit-label"><span>✓</span><b>Kan räknas in</b></div>${unique.map(n=>`<div class="sl715-credit-course">${n.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</div>`).join('')}`;
   const show=[...card.querySelectorAll('button,a,span,b,strong')].find(el=>/^Visa$/i.test(norm(el.textContent)));
   if(show?.parentElement&&card.contains(show.parentElement))show.parentElement.insertAdjacentElement('beforebegin',wrap);else card.appendChild(wrap);
 }
}
let timer=0;function schedule(){clearTimeout(timer);timer=setTimeout(decorate,40)}
function style(){if(document.getElementById('sl715-style'))return;const s=document.createElement('style');s.id='sl715-style';s.textContent=`
#plannerCleanContent .sl715-has-credit{height:auto!important;min-height:unset!important;align-content:start}
#plannerCleanContent .sl715-credit-list{margin:10px 8px 4px;padding:9px 10px;border-radius:12px;background:#edf7f2;border:1px solid rgba(23,107,91,.14);text-align:left;display:grid;gap:5px}
#plannerCleanContent .sl715-credit-label{display:flex;align-items:center;gap:6px;color:#176b5b;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
#plannerCleanContent .sl715-credit-label span{width:18px;height:18px;border-radius:50%;display:grid;place-items:center;background:#2fa77f;color:#fff;font-size:11px;flex:none}
#plannerCleanContent .sl715-credit-course{font-size:11px;line-height:1.25;font-weight:750;color:#153d3b;padding-left:24px;overflow-wrap:anywhere}
@media(max-width:600px){#plannerCleanContent .sl715-credit-list{margin:8px 4px 3px;padding:8px}.sl715-credit-course{font-size:10px!important}}
`;document.head.appendChild(s)}
function install(){style();schedule();const root=document.getElementById('plannerCleanContent');if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true,characterData:true});['studielots:screen-rendered','studielots:planner-open','studielots:planner-snapshot','pageshow'].forEach(e=>window.addEventListener(e,schedule));window.__studielotsBuild={...(window.__studielotsBuild||{}),plannerCreditVisibility:VERSION}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
