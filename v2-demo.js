(()=>{'use strict';
const DEMO_KEY='studielots_v2_demo';
const COURSE_KEY='studielots_v2_courses';
const sampleCourses=[
 {code:'FEG101',name:'Organisation och ledarskap',hp:15,subject:'Företagsekonomi',progression:'G1N',institution:'Exempeluniversitet',source:'Demo'},
 {code:'FEG102',name:'Marknadsföring',hp:15,subject:'Företagsekonomi',progression:'G1N',institution:'Exempeluniversitet',source:'Demo'},
 {code:'FEG201',name:'Redovisning och ekonomistyrning',hp:15,subject:'Företagsekonomi',progression:'G1F',institution:'Exempeluniversitet',source:'Demo'},
 {code:'FEG202',name:'Finansiering',hp:15,subject:'Företagsekonomi',progression:'G1F',institution:'Exempeluniversitet',source:'Demo'},
 {code:'STAT01',name:'Statistik',hp:15,subject:'Statistik',progression:'G1N',institution:'Exempeluniversitet',source:'Demo'},
 {code:'NEK101',name:'Mikroekonomi',hp:15,subject:'Nationalekonomi',progression:'G1N',institution:'Exempeluniversitet',source:'Demo'},
 {code:'NEK102',name:'Makroekonomi',hp:15,subject:'Nationalekonomi',progression:'G1N',institution:'Exempeluniversitet',source:'Demo'},
 {code:'JUR101',name:'Handelsrätt',hp:15,subject:'Juridik',progression:'G1N',institution:'Exempeluniversitet',source:'Demo'},
 {code:'PSY101',name:'Introduktion till psykologi',hp:15,subject:'Psykologi',progression:'G1N',institution:'Exempeluniversitet',source:'Demo'},
 {code:'PED101',name:'Pedagogik: grundkurs',hp:15,subject:'Pedagogik',progression:'G1N',institution:'Exempeluniversitet',source:'Demo'}
];
function startDemo(){sessionStorage.setItem(DEMO_KEY,'1');sessionStorage.setItem(COURSE_KEY,JSON.stringify(sampleCourses));const u=new URL(location.href);u.searchParams.set('demo','1');location.href=u.toString()}
function stopDemo(){sessionStorage.removeItem(DEMO_KEY);sessionStorage.removeItem(COURSE_KEY);const u=new URL(location.href);u.searchParams.delete('demo');location.href=u.pathname+u.search+u.hash}
function active(){return sessionStorage.getItem(DEMO_KEY)==='1'||new URLSearchParams(location.search).get('demo')==='1'}
function badge(){if(!active())return;const el=document.createElement('div');el.className='demo-badge';el.innerHTML='<span><i></i> Exempeldata · 150 hp</span><button type="button">Avsluta demo</button>';el.querySelector('button').addEventListener('click',stopDemo);document.body.appendChild(el)}
function guide(){if(!active())return;const seen=new Set();const copy={opportunities:['1 av 3','Här ser du flera möjliga vägar','Exempelmeriterna innehåller 150 hp från flera ämnen och saknar medvetet kandidatuppsats och kandidatfördjupning. Välj en väg för att se vad som kan räknas in och vad som återstår.'],planner:['2 av 3','Det här är den riktiga Planeraren','Demon använder samma programplan, examensregler och matchningslogik som dina egna meriter. Här ska bland annat examensarbete och fördjupning synas som kvarvarande krav när de behövs.']};
 const remove=()=>document.querySelector('.demo-guide')?.remove();
 const show=()=>{const page=document.querySelector('.page.active')?.id;remove();if(!copy[page]||seen.has(page))return;seen.add(page);const [step,title,text]=copy[page],el=document.createElement('aside');el.className='demo-guide';el.innerHTML=`<button class="demo-close" aria-label="Stäng">×</button><small>${step} · GUIDAD DEMO</small><b>${title}</b><p>${text}</p><button class="demo-ok">Fortsätt i verktyget →</button>`;el.querySelector('.demo-close').onclick=remove;el.querySelector('.demo-ok').onclick=remove;document.body.appendChild(el)};
 document.addEventListener('click',e=>{if(e.target.closest('[data-nav]'))setTimeout(show,0)},true);
 new MutationObserver(show).observe(document.querySelector('.shell'),{subtree:true,attributes:true,attributeFilter:['class']});setTimeout(show,250)}
function bind(){document.querySelectorAll('[data-demo]').forEach(b=>b.addEventListener('click',startDemo));if(active()){sessionStorage.setItem(DEMO_KEY,'1');if(!sessionStorage.getItem(COURSE_KEY))sessionStorage.setItem(COURSE_KEY,JSON.stringify(sampleCourses));badge();guide();if(new URLSearchParams(location.search).get('demo')==='1')setTimeout(()=>document.querySelector('[data-nav="opportunities"]')?.click(),180)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();