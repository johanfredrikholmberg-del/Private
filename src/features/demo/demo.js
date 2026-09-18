(()=>{'use strict';
const DEMO_KEY='studielots_v2_demo';
const COURSE_KEY='studielots_v2_courses';
// Synthetic course records for testing, NOT GU transcripts or historical decisions.
// Historical approvals must only be displayed when backed by a sourced decision record.
const sampleCourses=[
 {code:'',name:'Företagsekonomi, grundkurs',hp:30,subject:'Företagsekonomi',progression:'G1N',institution:'Exempelmerit',source:'Syntetisk testmerit · ej GU-beslut'},
 {code:'',name:'Nationalekonomi, grundkurs',hp:30,subject:'Nationalekonomi',progression:'G1N',institution:'Exempelmerit',source:'Syntetisk testmerit · ej GU-beslut'},
 {code:'',name:'Specialpedagogik för förskollärare och lärare i grundskolan F-9',hp:15,subject:'Pedagogik',progression:'G1N',institution:'Exempelmerit',source:'Syntetisk testmerit · ej GU-beslut'},
 {code:'STAT01',name:'Statistik',hp:15,subject:'Statistik',progression:'G1N',institution:'Exempeluniversitet',source:'Syntetisk testmerit'},
 {code:'NEK101',name:'Mikroekonomi',hp:15,subject:'Nationalekonomi',progression:'G1N',institution:'Exempeluniversitet',source:'Syntetisk testmerit'},
 {code:'JUR101',name:'Handelsrätt',hp:15,subject:'Juridik',progression:'G1N',institution:'Exempeluniversitet',source:'Syntetisk testmerit'},
 {code:'PSY101',name:'Introduktion till psykologi',hp:15,subject:'Psykologi',progression:'G1N',institution:'Exempeluniversitet',source:'Syntetisk testmerit'},
 {code:'FEG101',name:'Organisation och ledarskap',hp:15,subject:'Företagsekonomi',progression:'G1N',institution:'Exempeluniversitet',source:'Syntetisk testmerit'},
 {code:'DEMOFE201',name:'Marknadsföring, fortsättningskurs',hp:15,subject:'Företagsekonomi',progression:'G1F',institution:'Exempeluniversitet',source:'Syntetisk testmerit · GU-testfall'},
 {code:'DEMOFE202',name:'Externredovisning, fortsättningskurs',hp:15,subject:'Företagsekonomi',progression:'G1F',institution:'Exempeluniversitet',source:'Syntetisk testmerit · GU-testfall'},
 {code:'DEMONE201',name:'Makroekonomi',hp:15,subject:'Nationalekonomi',progression:'G1F',institution:'Exempeluniversitet',source:'Syntetisk testmerit · GU-testfall'},
 {code:'DEMOST201',name:'Statistisk inferens',hp:15,subject:'Statistik',progression:'G1F',institution:'Exempeluniversitet',source:'Syntetisk testmerit · GU-testfall'},
 {code:'DEMOFE301',name:'Företagsekonomisk metod',hp:15,subject:'Företagsekonomi',progression:'G2F',institution:'Exempeluniversitet',source:'Syntetisk testmerit · GU-testfall'},
 {code:'DEMOPS201',name:'Socialpsykologi',hp:15,subject:'Psykologi',progression:'G1F',institution:'Exempeluniversitet',source:'Syntetisk testmerit · kontroll av valbara kurser'},
 {code:'DEMOAN101',name:'Anatomi och fysiologi',hp:7.5,subject:'Medicin',progression:'G1N',institution:'Exempeluniversitet',source:'Syntetisk testmerit · negativ matchningskontroll'}
];
const totalHp=sampleCourses.reduce((sum,c)=>sum+c.hp,0);
function emitDemo(){window.dispatchEvent(new CustomEvent('studielots:v2-demo',{detail:{courses:sampleCourses}}))}
function startDemo(){sessionStorage.setItem(DEMO_KEY,'1');sessionStorage.setItem(COURSE_KEY,JSON.stringify(sampleCourses));const u=new URL(location.href);u.searchParams.set('demo','1');history.replaceState(null,'',u.toString());badge();guide();emitDemo()}
function stopDemo(){sessionStorage.removeItem(DEMO_KEY);sessionStorage.removeItem(COURSE_KEY);const u=new URL(location.href);u.searchParams.delete('demo');location.href=u.pathname+u.search+u.hash}
function active(){return sessionStorage.getItem(DEMO_KEY)==='1'||new URLSearchParams(location.search).get('demo')==='1'}
function badge(){if(!active()||document.querySelector('.demo-badge'))return;const el=document.createElement('div');el.className='demo-badge';const label=document.createElement('span');label.textContent=`● Exempeldata · ${totalHp} hp · syntetiska meriter`;const button=document.createElement('button');button.type='button';button.textContent='Avsluta demo';button.addEventListener('click',stopDemo);el.append(label,button);document.body.appendChild(el)}
function guide(){if(!active()||window.__studielotsDemoGuide)return;window.__studielotsDemoGuide=true;const seen=new Set();const copy={opportunities:['1 av 3','Här ser du flera möjliga vägar',`Exempelmeriterna omfattar ${totalHp} hp och är syntetiska. Procentsatserna visar preliminär matchning mot generella examenskrav, inte hur många hp som kan räknas av från ett visst program. Välj lärosäte och program för programmets kursbaserade beräkning. Inga historiska GU-bifall ingår.`],planner:['2 av 3','Det här är Planeraren','Här visas preliminär avräkning mot det valda programmets kurser. Endast redan direkt matchade kurser och tillgodoräknanden med Starkt underlag räknas av. Gott eller begränsat underlag och historiska bifall ger ingen ytterligare avräkning. Lärosätet beslutar om tillgodoräknande. Testmeriterna är syntetiska; inga historiska GU-bifall ingår.']};
 const remove=()=>document.querySelector('.demo-guide')?.remove();
 const show=()=>{const page=document.querySelector('.page.active')?.id;remove();if(!copy[page]||seen.has(page))return;seen.add(page);const [step,title,text]=copy[page],el=document.createElement('aside');el.className='demo-guide';el.innerHTML=`<button class="demo-close" aria-label="Stäng">×</button><small>${step} · GUIDAD DEMO</small><b>${title}</b><p>${text}</p><button class="demo-ok">Fortsätt i verktyget →</button>`;el.querySelector('.demo-close').onclick=remove;el.querySelector('.demo-ok').onclick=remove;document.body.appendChild(el)};
 document.addEventListener('click',e=>{if(e.target.closest('[data-nav]'))setTimeout(show,0)},true);
 new MutationObserver(show).observe(document.querySelector('.shell'),{subtree:true,attributes:true,attributeFilter:['class']});setTimeout(show,250)}
function bind(){document.querySelectorAll('[data-demo]').forEach(b=>b.addEventListener('click',startDemo));if(active()){sessionStorage.setItem(DEMO_KEY,'1');sessionStorage.setItem(COURSE_KEY,JSON.stringify(sampleCourses));badge();guide();setTimeout(emitDemo,0)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();