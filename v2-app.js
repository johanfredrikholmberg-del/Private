(()=>{'use strict';
const pages=[...document.querySelectorAll('.page')],nav=[...document.querySelectorAll('[data-nav]')];
const state={page:'home',route:'ordinary',source:'ladok'};
const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
function show(id){state.page=id;pages.forEach(p=>p.classList.toggle('active',p.id===id));nav.forEach(b=>b.classList.toggle('active',b.dataset.nav===id));window.scrollTo({top:0,behavior:'instant'});}
function route(kind){state.route=kind;qa('[data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route===kind));q('#ordinaryPlan').hidden=kind!=='ordinary';q('#fastPlan').hidden=kind!=='fast';}
function source(kind){state.source=kind;qa('[data-source]').forEach(b=>b.classList.toggle('active',b.dataset.source===kind));q('#sourceCopy').textContent=kind==='ladok'?'Ladda upp ett nationellt resultatintyg från Ladok.':'Ladda upp din merit-PDF från Antagning.se.';}
function toggleTerm(btn){const list=btn.closest('.term-row')?.querySelector('.course-list');if(!list)return;list.hidden=!list.hidden;const c=btn.querySelector('.chev');if(c)c.textContent=list.hidden?'⌄':'⌃';}
function fakeUpload(file){if(!file)return;const box=q('#uploadState');box.innerHTML=`<b>${file.name}</b><span>Redo för analys.</span>`;box.style.display='grid';}
nav.forEach(b=>b.addEventListener('click',()=>show(b.dataset.nav)));
qa('[data-go]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.go)));
qa('[data-route]').forEach(b=>b.addEventListener('click',()=>route(b.dataset.route)));
qa('[data-source]').forEach(b=>b.addEventListener('click',()=>source(b.dataset.source)));
qa('.term-summary').forEach(b=>b.addEventListener('click',()=>toggleTerm(b)));
q('#fileInput')?.addEventListener('change',e=>fakeUpload(e.target.files?.[0]));
q('#uploadBtn')?.addEventListener('click',()=>q('#fileInput')?.click());
q('#fastCta')?.addEventListener('click',()=>route('fast'));
show('home');route('ordinary');source('ladok');
})();