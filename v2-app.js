(()=>{'use strict';
const pages=[...document.querySelectorAll('.page')],nav=[...document.querySelectorAll('[data-nav]')];
const state={page:'home',route:'ordinary',source:'ladok',courses:[]};
const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
const fmt=n=>Number(n||0).toLocaleString('sv-SE',{maximumFractionDigits:1});
function show(id){state.page=id;pages.forEach(p=>p.classList.toggle('active',p.id===id));nav.forEach(b=>b.classList.toggle('active',b.dataset.nav===id));window.scrollTo({top:0,behavior:'instant'});}
function route(kind){state.route=kind;qa('[data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route===kind));q('#ordinaryPlan').hidden=kind!=='ordinary';q('#fastPlan').hidden=kind!=='fast';}
function source(kind){state.source=kind;qa('[data-source]').forEach(b=>b.classList.toggle('active',b.dataset.source===kind));q('#sourceCopy').textContent=kind==='ladok'?'Ladda upp ett nationellt resultatintyg från Ladok.':'Antagning.se-import kopplas in i nästa steg.';q('#uploadBtn').disabled=kind!=='ladok';q('#uploadBtn').style.opacity=kind==='ladok'?'1':'.55';}
function toggleTerm(btn){const list=btn.closest('.term-row')?.querySelector('.course-list');if(!list)return;list.hidden=!list.hidden;const c=btn.querySelector('.chev');if(c)c.textContent=list.hidden?'⌄':'⌃';}
function renderImported(courses){const summary=window.StudieLotsV2?.engine?.summarizeCourses(courses)||{courseCount:courses.length,totalHp:courses.reduce((s,c)=>s+Number(c.hp||0),0),institutionCount:new Set(courses.map(c=>c.institution)).size};const box=q('#uploadState');box.innerHTML=`<b>${summary.courseCount} kurser · ${fmt(summary.totalHp)} hp</b><span>${summary.institutionCount} lärosäten hittades. Meriterna är redo för matchning.</span><button class="btn-primary" id="continueMatch">Se möjligheter <span>→</span></button>`;box.style.display='grid';q('#continueMatch')?.addEventListener('click',()=>show('opportunities'));}
async function importFile(file){if(!file)return;const box=q('#uploadState');box.innerHTML=`<b>Läser ${file.name}</b><span>Hämtar kurser från intyget…</span>`;box.style.display='grid';try{if(state.source!=='ladok')throw new Error('Välj Ladok för den här importen.');const result=await window.StudieLotsV2?.ladok?.parseFile(file);if(!result)throw new Error('Ladok-läsaren kunde inte starta.');state.courses=result.courses;sessionStorage.setItem('studielots_v2_courses',JSON.stringify(state.courses));renderImported(state.courses)}catch(err){box.innerHTML=`<b>Importen kunde inte slutföras</b><span>${String(err?.message||err)}</span>`}}
nav.forEach(b=>b.addEventListener('click',()=>show(b.dataset.nav)));
qa('[data-go]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.go)));
qa('[data-route]').forEach(b=>b.addEventListener('click',()=>route(b.dataset.route)));
qa('[data-source]').forEach(b=>b.addEventListener('click',()=>source(b.dataset.source)));
qa('.term-summary').forEach(b=>b.addEventListener('click',()=>toggleTerm(b)));
q('#fileInput')?.addEventListener('change',e=>importFile(e.target.files?.[0]));
q('#uploadBtn')?.addEventListener('click',()=>q('#fileInput')?.click());
q('#fastCta')?.addEventListener('click',()=>route('fast'));
try{state.courses=JSON.parse(sessionStorage.getItem('studielots_v2_courses')||'[]')}catch(e){}
show('home');route('ordinary');source('ladok');
})();