(()=>{'use strict';
const DEMO_KEY='studielots_v2_demo';
const COURSE_KEY='studielots_v2_courses';
const sampleCourses=[
 {code:'',name:'Företagsekonomi, grundkurs',hp:30,subject:'Företagsekonomi',progression:'G1N',institution:'Exempelmerit',source:'Demo · historiskt beslut Karlstad 2026',historicalDemo:true},
 {code:'',name:'Nationalekonomi, grundkurs',hp:30,subject:'Nationalekonomi',progression:'G1N',institution:'Exempelmerit',source:'Demo · historiskt beslut Karlstad 2026',historicalDemo:true},
 {code:'',name:'Specialpedagogik för förskollärare och lärare i grundskolan F-9',hp:15,subject:'Pedagogik',progression:'G1N',institution:'Exempelmerit',source:'Demo · historiskt beslut Karlstad 2026',historicalDemo:true},
 {code:'STAT01',name:'Statistik',hp:15,subject:'Statistik',progression:'G1N',institution:'Exempeluniversitet',source:'Demo'},
 {code:'NEK101',name:'Mikroekonomi',hp:15,subject:'Nationalekonomi',progression:'G1N',institution:'Exempeluniversitet',source:'Demo'},
 {code:'JUR101',name:'Handelsrätt',hp:15,subject:'Juridik',progression:'G1N',institution:'Exempeluniversitet',source:'Demo'},
 {code:'PSY101',name:'Introduktion till psykologi',hp:15,subject:'Psykologi',progression:'G1N',institution:'Exempeluniversitet',source:'Demo'},
 {code:'FEG101',name:'Organisation och ledarskap',hp:15,subject:'Företagsekonomi',progression:'G1N',institution:'Exempeluniversitet',source:'Demo'}
];
function emitDemo(){window.dispatchEvent(new CustomEvent('studielots:v2-demo',{detail:{courses:sampleCourses}}))}
function startDemo(){sessionStorage.setItem(DEMO_KEY,'1');sessionStorage.setItem(COURSE_KEY,JSON.stringify(sampleCourses));const u=new URL(location.href);u.searchParams.set('demo','1');history.replaceState(null,'',u.toString());badge();guide();emitDemo()}
function stopDemo(){sessionStorage.removeItem(DEMO_KEY);sessionStorage.removeItem(COURSE_KEY);const u=new URL(location.href);u.searchParams.delete('demo');location.href=u.pathname+u.search+u.hash}
function active(){return sessionStorage.getItem(DEMO_KEY)==='1'||new URLSearchParams(location.search).get('demo')==='1'}
function badge(){if(!active()||document.querySelector('.demo-badge'))return;const el=document.createElement('div');el.className='demo-badge';el.innerHTML='<span><i></i> Exempeldata · 150 hp</span><button type="button">Avsluta demo</button>';el.querySelector('button').addEventListener('click',stopDemo);document.body.appendChild(el)}
function guide(){if(!active()||window.__studielotsDemoGuide)return;window.__studielotsDemoGuide=true;const seen=new Set();const copy={opportunities:['1 av 3','Här ser du flera möjliga vägar','Exempelmeriterna innehåller 150 hp. Några meriter är valda från verkliga historiska bifall hos Karlstads universitet 2026, så att du kan se skillnaden mellan potentiellt och historikstött tillgodoräknande i Planeraren.'],planner:['2 av 3','Det här är den riktiga Planeraren','Demon använder samma programplan, examensregler och matchningslogik som dina egna meriter. Om du väljer en väg där en historisk Karlstad-relation träffar ska den kunna räknas som Tillgodoräknat, medan svagare träffar ligger kvar som Potentiellt tillgodoräknande.']};
 const remove=()=>document.querySelector('.demo-guide')?.remove();
 const show=()=>{const page=document.querySelector('.page.active')?.id;remove();if(!copy[page]||seen.has(page))return;seen.add(page);const [step,title,text]=copy[page],el=document.createElement('aside');el.className='demo-guide';el.innerHTML=`<button class="demo-close" aria-label="Stäng">×</button><small>${step} · GUIDAD DEMO</small><b>${title}</b><p>${text}</p><button class="demo-ok">Fortsätt i verktyget →</button>`;el.querySelector('.demo-close').onclick=remove;el.querySelector('.demo-ok').onclick=remove;document.body.appendChild(el)};
 document.addEventListener('click',e=>{if(e.target.closest('[data-nav]'))setTimeout(show,0)},true);
 new MutationObserver(show).observe(document.querySelector('.shell'),{subtree:true,attributes:true,attributeFilter:['class']});setTimeout(show,250)}
function bind(){document.querySelectorAll('[data-demo]').forEach(b=>b.addEventListener('click',startDemo));if(active()){sessionStorage.setItem(DEMO_KEY,'1');sessionStorage.setItem(COURSE_KEY,JSON.stringify(sampleCourses));badge();guide();setTimeout(emitDemo,0)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();