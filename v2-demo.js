(()=>{'use strict';
const DEMO_KEY='studielots_v2_demo';
const COURSE_KEY='studielots_v2_courses';
const sampleCourses=[
 {code:'FEG101',name:'Företagsekonomi: organisation och ledarskap',hp:15,subject:'Företagsekonomi',institution:'Exempeluniversitet',source:'Demo'},
 {code:'FEG102',name:'Företagsekonomi: marknadsföring',hp:15,subject:'Företagsekonomi',institution:'Exempeluniversitet',source:'Demo'},
 {code:'FEG201',name:'Redovisning och ekonomistyrning',hp:15,subject:'Företagsekonomi',institution:'Exempeluniversitet',source:'Demo'},
 {code:'FEG202',name:'Finansiering',hp:15,subject:'Företagsekonomi',institution:'Exempeluniversitet',source:'Demo'},
 {code:'FEG301',name:'Företagsekonomi, fördjupningskurs',hp:15,subject:'Företagsekonomi',institution:'Exempeluniversitet',source:'Demo'},
 {code:'STAT01',name:'Grundläggande statistik',hp:15,subject:'Statistik',institution:'Exempeluniversitet',source:'Demo'},
 {code:'NEK101',name:'Nationalekonomi: mikroekonomi',hp:15,subject:'Nationalekonomi',institution:'Exempeluniversitet',source:'Demo'},
 {code:'NEK102',name:'Nationalekonomi: makroekonomi',hp:15,subject:'Nationalekonomi',institution:'Exempeluniversitet',source:'Demo'},
 {code:'JUR101',name:'Handelsrättslig översiktskurs',hp:15,subject:'Juridik',institution:'Exempeluniversitet',source:'Demo'}
];
function startDemo(){sessionStorage.setItem(DEMO_KEY,'1');sessionStorage.setItem(COURSE_KEY,JSON.stringify(sampleCourses));const u=new URL(location.href);u.searchParams.set('demo','1');location.href=u.toString()}
function stopDemo(){sessionStorage.removeItem(DEMO_KEY);sessionStorage.removeItem(COURSE_KEY);const u=new URL(location.href);u.searchParams.delete('demo');location.href=u.pathname+u.search+u.hash}
function active(){return sessionStorage.getItem(DEMO_KEY)==='1'||new URLSearchParams(location.search).get('demo')==='1'}
function badge(){if(!active())return;const el=document.createElement('div');el.className='demo-badge';el.innerHTML='<span><i></i> Exempeldata</span><button type="button">Avsluta demo</button>';el.querySelector('button').addEventListener('click',stopDemo);document.body.appendChild(el)}
function guide(){if(!active())return;const seen=new Set();const copy={opportunities:['1 av 3','Här ser du dina närmaste examensvägar','Matchningen bygger på exempelmeriterna. Välj en väg för att se vilka lärosäten och program som passar.'],planner:['2 av 3','Här blir vägen konkret','Grönt kan räknas in, gult är en möjlig match som bör verifieras. Öppna terminerna för att se kurserna.']};
 const show=()=>{const page=document.querySelector('.page.active')?.id;if(!copy[page]||seen.has(page))return;seen.add(page);document.querySelector('.demo-guide')?.remove();const [step,title,text]=copy[page],el=document.createElement('aside');el.className='demo-guide';el.innerHTML=`<button class="demo-close" aria-label="Stäng">×</button><small>${step} · GUIDAD DEMO</small><b>${title}</b><p>${text}</p><button class="demo-ok">Fortsätt i verktyget →</button>`;el.querySelector('.demo-close').onclick=()=>el.remove();el.querySelector('.demo-ok').onclick=()=>el.remove();document.body.appendChild(el)};
 new MutationObserver(show).observe(document.querySelector('.shell'),{subtree:true,attributes:true,attributeFilter:['class']});setTimeout(show,250)}
function bind(){document.querySelectorAll('[data-demo]').forEach(b=>b.addEventListener('click',startDemo));if(active()){sessionStorage.setItem(DEMO_KEY,'1');if(!sessionStorage.getItem(COURSE_KEY))sessionStorage.setItem(COURSE_KEY,JSON.stringify(sampleCourses));badge();guide();if(new URLSearchParams(location.search).get('demo')==='1')setTimeout(()=>document.querySelector('[data-nav="opportunities"]')?.click(),180)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();