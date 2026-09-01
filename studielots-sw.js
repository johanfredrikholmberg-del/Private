const STUDIELOTS_PATCH='2026-09-01-d';

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

const latestPatch=`
<style id="studielots-latest-patch">
.lotsen-bottomnav,.v341-bottomnav,.v444-bottomnav{bottom:max(5px,env(safe-area-inset-bottom,0px))!important;width:min(680px,calc(100% - 18px))!important;min-height:0!important;height:auto!important;gap:1px!important;padding:4px 5px!important;border-radius:27px!important;background:rgba(249,249,246,.70)!important;-webkit-backdrop-filter:blur(20px) saturate(145%)!important;backdrop-filter:blur(20px) saturate(145%)!important;border:1px solid rgba(255,255,255,.72)!important;box-shadow:0 7px 24px rgba(16,24,40,.12)!important}
.lotsen-bottomnav button,.v341-bottomnav button,.v444-bottomnav button{padding:5px 2px 4px!important;min-height:48px!important;height:auto!important;gap:1px!important;border-radius:21px!important}
.lotsen-bottomnav button.active,.v341-bottomnav button.active,.v444-bottomnav button.active,.lotsen-bottomnav [aria-current="page"],.v341-bottomnav [aria-current="page"],.v444-bottomnav [aria-current="page"]{box-shadow:none!important}
.lotsen-bottomnav .bottom-icon,.v341-bottomnav .bottom-icon,.v444-bottomnav .bottom-icon{height:22px!important;font-size:23px!important;line-height:1!important}.lotsen-bottomnav b,.v341-bottomnav b,.v444-bottomnav b{font-size:10px!important;line-height:1.05!important}.main{padding-bottom:calc(78px + env(safe-area-inset-bottom,0px))!important}
@media(max-width:700px){.v21-detail{overflow:hidden!important}.v21-detail-top{display:block!important;grid-template-columns:none!important;position:relative!important}.v21-back,.v21-score{display:none!important}.v21-detail-title{min-width:0!important;width:100%!important;padding:0!important}.v21-detail-title h1{max-width:100%!important;overflow-wrap:anywhere!important}}
#plannerClean .v572-shell.sl-terms-collapsed .v572-studyplan{display:none!important}#plannerClean .v572-term-section[data-term-section="0"],#plannerClean .v572-term[data-term="0"]{display:none!important}
</style>
<script id="studielots-latest-patch-js">
(()=>{
 const PATCH='2026-09-01-d';
 const norm=s=>String(s||'').toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9åäö]+/g,' ').trim();
 const hp=n=>Math.round((Number(n)||0)*2)/2;
 const fmt=n=>String(hp(n)).replace('.',',');
 const parseHp=s=>{const m=String(s||'').match(/(\\d+(?:[,.]\\d+)?)\\s*hp/i);return m?Number(m[1].replace(',','.')):null};
 const exactFromBreakdown=b=>b?hp(Math.max(0,Number(b.missingMain||0)+Number(b.missingReq||0)+Number(b.missingElective||0))):null;
 const degreeType=o=>String(o?.degreeType||o?.type||o?.degree||'').toLowerCase();
 const isCandidate=o=>!degreeType(o).includes('magister')&&!degreeType(o).includes('master');

 function installHpCanonical(){
  if(window.__studielotsHpCanonical?.version===PATCH)return;
  try{
   const oldOptions=typeof universityOptionsForOpportunity==='function'?universityOptionsForOpportunity:null;if(!oldOptions)return;
   const buildRows=o=>(oldOptions(o)||[]).map(x=>{try{let b=x?.breakdown||null;if(!b&&typeof localRuleBreakdown==='function'&&x?.rule)b=localRuleBreakdown(x.rule,typeof passedCourses!=='undefined'?passedCourses:[]);const exact=exactFromBreakdown(b);if(!Number.isFinite(exact))return x;const total=Number(x?.degreeHp||o?.hp||o?.degreeHp||180)||180;return {...x,remaining:exact,score:Math.max(0,Math.min(100,Math.round(((total-exact)/total)*100))),breakdown:b,__slExactRemaining:true}}catch(e){return x}});
   universityOptionsForOpportunity=function(o){return buildRows(o)};window.universityOptionsForOpportunity=universityOptionsForOpportunity;
   const rowId=x=>String(x?.d?.id||x?.profileId||x?.id||'');
   const chooseRow=(o,profileId='')=>{const rows=universityOptionsForOpportunity(o)||[];if(!rows.length)return null;if(profileId){const hit=rows.find(x=>rowId(x)===String(profileId));if(hit)return hit}return rows.find(x=>x?.verified||x?.d?.verified)||rows[0]};
   const exactRemaining=(o,profileId='')=>{if(!isCandidate(o))return null;const row=chooseRow(o,profileId);return row&&Number.isFinite(Number(row.remaining))?hp(row.remaining):null};
   const oldCanonicalRemaining=typeof canonicalRemaining==='function'?canonicalRemaining:null;
   canonicalRemaining=function(o,profileId=''){const exact=exactRemaining(o,profileId);if(Number.isFinite(exact))return exact;return oldCanonicalRemaining?oldCanonicalRemaining(o,profileId):Number(o?.remaining||0)};window.canonicalRemaining=canonicalRemaining;
   opportunityUniversityRange=function(o){try{const vals=(universityOptionsForOpportunity(o)||[]).map(x=>Number(x.remaining)).filter(Number.isFinite).sort((a,b)=>a-b);if(!vals.length)return null;return {min:hp(vals[0]),max:hp(vals[vals.length-1]),same:hp(vals[0])===hp(vals[vals.length-1])}}catch(e){return null}};window.opportunityUniversityRange=opportunityUniversityRange;
   opportunityRemainingLabel=function(o){const r=opportunityUniversityRange(o);if(r){if(r.same)return r.min?fmt(r.min)+' hp kvar':'Klar';return 'från '+fmt(r.min)+' hp kvar'}const v=canonicalRemaining(o);return Number.isFinite(Number(v))?(Number(v)?fmt(v)+' hp kvar':'Klar'):'Välj lärosäte'};window.opportunityRemainingLabel=opportunityRemainingLabel;
   opportunityStatus=function(o){const r=opportunityUniversityRange(o),value=r?Number(r.min||0):Number(canonicalRemaining(o)||0);if(!value)return {label:'Klar',kind:'ready'};return {label:opportunityRemainingLabel(o),kind:value<=30?'near':'normal'}};window.opportunityStatus=opportunityStatus;
   window.__studielotsHpCanonical={version:PATCH,formula:'missingMain + missingReq + missingElective',singleSource:true};
   if(typeof renderDegrees==='function')requestAnimationFrame(()=>{try{renderDegrees()}catch(e){}});
  }catch(e){console.warn('StudieLots hp canonical patch',e)}
 }

 function captureAuthoritativeDetail(){
  const bodyText=document.body?.innerText||'';
  if(!/Tillgodoräknat/i.test(bodyText)||!/Kvar/i.test(bodyText))return;
  const h1=[...document.querySelectorAll('h1,h2')].find(x=>/kandidatexamen/i.test(x.textContent||''));
  if(!h1)return;
  const title=h1.textContent||'';
  const subject=(title.match(/i\\s+([^\\n]+)$/i)||[])[1]?.trim()||'';
  if(!subject)return;
  let remaining=null,credited=null;
  for(const el of document.querySelectorAll('div,section,article')){
   const t=(el.textContent||'').trim();
   if(remaining==null&&/^Kvar\\s*\\d+(?:[,.]\\d+)?\\s*hp$/i.test(t.replace(/\\s+/g,' ')))remaining=parseHp(t);
   if(credited==null&&/^Tillgodoräknat\\s*\\d+(?:[,.]\\d+)?\\s*hp/i.test(t.replace(/\\s+/g,' ')))credited=parseHp(t);
  }
  if(remaining==null){const m=bodyText.match(/(\\d+(?:[,.]\\d+)?)\\s*hp kan räknas in i examen\\s*[·•]\\s*(\\d+(?:[,.]\\d+)?)\\s*hp kvar/i);if(m){credited=Number(m[1].replace(',','.'));remaining=Number(m[2].replace(',','.'))}}
  if(!Number.isFinite(remaining))return;
  const data={subject,remaining:hp(remaining),credited:Number.isFinite(credited)?hp(credited):hp(180-remaining),total:180,ts:Date.now()};
  try{sessionStorage.setItem('studielots_authoritative_hp',JSON.stringify(data))}catch(e){}
  window.__studielotsAuthoritativeHp=data;
 }

 function authoritative(){try{return window.__studielotsAuthoritativeHp||JSON.parse(sessionStorage.getItem('studielots_authoritative_hp')||'null')}catch(e){return null}}
 function syncAuthoritativeUi(){
  captureAuthoritativeDetail();const a=authoritative();if(!a||!a.subject||!Number.isFinite(a.remaining))return;
  const subjectNorm=norm(a.subject),remainingLabel=fmt(a.remaining)+' hp kvar';
  for(const card of document.querySelectorAll('article,.card,[class*="opportunity"],[class*="degree-card"]')){
   const text=card.textContent||'';if(!norm(text).includes(subjectNorm))continue;
   for(const el of card.querySelectorAll('span,div,strong,b')){const t=(el.textContent||'').trim();if(/^\\d+(?:[,.]\\d+)?\\s*hp kvar$/i.test(t)&&t!==remainingLabel)el.textContent=remainingLabel}
  }
  const bodyText=document.body?.innerText||'';
  if(/Tar fram din studieplan/i.test(bodyText)||/Studielots analyserar/i.test(bodyText)){
   for(const el of document.querySelectorAll('div,span,strong,b')){
    const t=(el.textContent||'').trim();
    if(/^\\d+(?:[,.]\\d+)?\\s*hp kvar$/i.test(t)&&t!==remainingLabel)el.textContent=remainingLabel;
    if(/^\\d+(?:[,.]\\d+)?\\s*hp$/i.test(t)&&el.parentElement&&/Matchar kurser mot lärosätets/i.test(el.parentElement.textContent||'')){const credited=fmt(a.credited)+' hp';if(t!==credited)el.textContent=credited}
   }
  }
 }

 function fixProgramSearch(){
  const input=document.getElementById('programSearchInput'),host=document.getElementById('programSearchResults');const catalog=(typeof programCatalog!=='undefined'&&Array.isArray(programCatalog))?programCatalog:(Array.isArray(window.programCatalog)?window.programCatalog:null);if(!input||!host||!catalog)return;
  if(!input.dataset.slLatest){
   window.renderProgramSearch=function(){const q=norm(input.value),seen=new Set();const rows=catalog.filter(p=>p&&!p.superseded).filter(p=>!q||norm((p.name||'')+' '+(p.university||'')+' '+(p.code||p.officialCode||'')).includes(q)).filter(p=>{const k=norm((p.name||'')+'|'+(p.university||''));if(seen.has(k))return false;seen.add(k);return true}).slice(0,30);host.innerHTML=rows.length?rows.map(p=>{const id=encodeURIComponent(String(p.id||'')),credits=Number(p.hp)||'';return '<button type="button" class="program-search-row sl-program-hit" data-sl-program-id="'+id+'" style="width:100%;text-align:left;border:0;background:#fff;padding:13px 12px;border-bottom:1px solid #edf0f4;cursor:pointer"><strong>'+String(p.name||'Program')+'</strong><small style="display:block;color:#667085;margin-top:3px">'+String(p.university||'')+(credits?' · '+credits+' hp':'')+'</small></button>'}).join(''):'<div class="empty">Inga program hittades.</div>'};
   input.dataset.slLatest='1';input.addEventListener('input',()=>window.renderProgramSearch(),{passive:true});host.addEventListener('click',e=>{const row=e.target.closest('[data-sl-program-id]');if(!row)return;e.preventDefault();e.stopPropagation();const id=decodeURIComponent(row.dataset.slProgramId||'');if(typeof window.v379ActivateProgram==='function'){window.v379ActivateProgram(id);return}if(typeof window.openProgramSearchResultSafe==='function'){window.openProgramSearchResultSafe(id);return}if(typeof window.openProgramSearchResult==='function')window.openProgramSearchResult(id)},true);window.renderProgramSearch();
  }
 }

 function fixPlannerTerms(){const root=document.getElementById('plannerClean'),shell=root?.querySelector('.v572-shell');if(!shell)return;if(!shell.dataset.slTermSetup){shell.dataset.slTermSetup='1';shell.classList.add('sl-terms-collapsed');shell.querySelectorAll('.v572-term-section').forEach(sec=>sec.classList.remove('open'));shell.addEventListener('click',e=>{const card=e.target.closest('.v572-term[data-term]');if(!card)return;const term=card.dataset.term;shell.classList.remove('sl-terms-collapsed');shell.querySelectorAll('.v572-term-section').forEach(sec=>{const open=String(sec.dataset.termSection)===String(term);sec.classList.toggle('open',open);const i=sec.querySelector('.v572-term-head i');if(i)i.textContent=open?'⌃':'⌄'});requestAnimationFrame(()=>shell.querySelector('.v572-studyplan')?.scrollIntoView({behavior:'smooth',block:'start'}))},true)}}

 function apply(){installHpCanonical();fixProgramSearch();fixPlannerTerms();syncAuthoritativeUi()}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,0));else setTimeout(apply,0);
 let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
 window.__studielotsLatestPatch={version:PATCH,programSearchAllCatalog:true,termDetailsOnDemand:true,thinBlurNav:true,hpSingleSource:true,authoritativeUiSync:true};
})();
<\/script>`;

self.addEventListener('fetch',event=>{
 const u=new URL(event.request.url);
 if(u.pathname==='/share-ladok'&&event.request.method==='POST'){event.respondWith((async()=>{try{const form=await event.request.formData(),file=form.get('ladokPdf');if(!file)return Response.redirect('/?studielots-share-error=1',303);const c=await caches.open('studielots-share-v1');await c.put('/__studielots_shared_pdf__',new Response(file,{headers:{'content-type':file.type||'application/pdf','x-studielots-filename':file.name||'Ladok-resultatintyg.pdf'}}));return Response.redirect('/?studielots-share=1',303)}catch(e){return Response.redirect('/?studielots-share-error=1',303)}})());return}
 if(event.request.mode==='navigate'&&event.request.method==='GET'&&u.origin===self.location.origin){event.respondWith((async()=>{try{const response=await fetch(event.request,{cache:'no-store'});const type=response.headers.get('content-type')||'';if(!type.includes('text/html'))return response;let html=await response.text();html=html.replace(/<style id="studielots-latest-patch">[\\s\\S]*?<\\/script>/g,'');html=html.replace('</body>',latestPatch+'\n</body>');const headers=new Headers(response.headers);headers.delete('content-length');headers.set('cache-control','no-store, max-age=0');headers.set('x-studielots-patch',STUDIELOTS_PATCH);return new Response(html,{status:response.status,statusText:response.statusText,headers})}catch(e){return fetch(event.request)}})())}
});
