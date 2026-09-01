const STUDIELOTS_PATCH='2026-09-01-f';

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

const latestPatch=`
<style id="studielots-latest-patch">
.lotsen-bottomnav,.v341-bottomnav,.v444-bottomnav{bottom:max(5px,env(safe-area-inset-bottom,0px))!important;width:min(680px,calc(100% - 18px))!important;min-height:0!important;height:auto!important;gap:1px!important;padding:4px 5px!important;border-radius:27px!important;background:rgba(249,249,246,.70)!important;-webkit-backdrop-filter:blur(20px) saturate(145%)!important;backdrop-filter:blur(20px) saturate(145%)!important;border:1px solid rgba(255,255,255,.72)!important;box-shadow:0 7px 24px rgba(16,24,40,.12)!important}
.lotsen-bottomnav button,.v341-bottomnav button,.v444-bottomnav button{padding:5px 2px 4px!important;min-height:48px!important;height:auto!important;gap:1px!important;border-radius:21px!important}
.lotsen-bottomnav .bottom-icon,.v341-bottomnav .bottom-icon,.v444-bottomnav .bottom-icon{height:22px!important;font-size:23px!important;line-height:1!important}.lotsen-bottomnav b,.v341-bottomnav b,.v444-bottomnav b{font-size:10px!important;line-height:1.05!important}.main{padding-bottom:calc(78px + env(safe-area-inset-bottom,0px))!important}
@media(max-width:700px){.v21-detail{overflow:hidden!important}.v21-detail-top{display:block!important;grid-template-columns:none!important;position:relative!important}.v21-back,.v21-score{display:none!important}.v21-detail-title{min-width:0!important;width:100%!important;padding:0!important}.v21-detail-title h1{max-width:100%!important;overflow-wrap:anywhere!important}}
#plannerClean .v572-shell.sl-terms-collapsed .v572-studyplan{display:none!important}#plannerClean .v572-term-section[data-term-section="0"],#plannerClean .v572-term[data-term="0"]{display:none!important}
</style>
<script id="studielots-latest-patch-js">
(()=>{
 const PATCH='2026-09-01-f';
 const norm=s=>String(s||'').toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9åäö]+/g,' ').trim();
 const hp=n=>Math.round((Number(n)||0)*2)/2;
 const fmt=n=>String(hp(n)).replace('.',',');
 const activeUniversities=()=>{try{if(Array.isArray(V2_ACTIVE_UNIVERSITIES))return V2_ACTIVE_UNIVERSITIES}catch(e){}return ['Göteborgs universitet','Chalmers tekniska högskola','Lunds universitet']};
 const isCandidate=o=>!String(o?.degreeType||o?.type||o?.degree||'').toLowerCase().match(/magister|master/);

 function v21Rows(o){
   if(!o||!o.subject||!isCandidate(o)||typeof v21PathFor!=='function')return [];
   const rows=[];
   for(const university of activeUniversities()){
     try{
       const p=v21PathFor(university,o.subject,o);
       if(!p||!Number.isFinite(Number(p.remaining)))continue;
       rows.push({university,remaining:hp(p.remaining),path:p});
     }catch(e){}
   }
   return rows;
 }
 function v21Remaining(o,profileId=''){
   const rows=v21Rows(o);if(!rows.length)return null;
   let uni='';
   if(profileId&&typeof profileUniversity==='function'){try{uni=profileUniversity(profileId)||''}catch(e){}}
   const chosen=(uni&&rows.find(r=>r.university===uni))||rows[0];
   return chosen?chosen.remaining:null;
 }

 function installSingleHpSource(){
   if(window.__studielotsHpCanonical?.version===PATCH)return;
   try{
     const oldOptions=typeof universityOptionsForOpportunity==='function'?universityOptionsForOpportunity:null;
     if(oldOptions){
       universityOptionsForOpportunity=function(o){
         const rows=oldOptions(o)||[];
         if(!isCandidate(o)||typeof v21PathFor!=='function')return rows;
         return rows.map(x=>{
           const university=String(x?.d?.university||x?.university||'');
           try{
             const p=v21PathFor(university,o.subject,o);
             if(p&&Number.isFinite(Number(p.remaining))){
               const remaining=hp(p.remaining),total=Number(o?.hp||o?.degreeHp||180)||180;
               return {...x,remaining,v2:p,engine:'v2.1',score:Math.max(0,Math.min(100,Math.round(100*(total-remaining)/total)))};
             }
           }catch(e){}
           return x;
         });
       };
       window.universityOptionsForOpportunity=universityOptionsForOpportunity;
     }

     const oldCanonicalPath=typeof canonicalPathResult==='function'?canonicalPathResult:null;
     canonicalPathResult=function(o,profileId=''){
       const base=oldCanonicalPath?oldCanonicalPath(o,profileId)||{}:{};
       const remaining=v21Remaining(o,profileId);
       if(!Number.isFinite(Number(remaining)))return base;
       const total=Number(o?.hp||o?.degreeHp||180)||180;
       try{o.remaining=remaining}catch(e){}
       return {...base,remaining,score:Math.max(0,Math.min(100,Math.round(100*(total-remaining)/total)))};
     };
     window.canonicalPathResult=canonicalPathResult;

     canonicalRemaining=function(o,profileId=''){
       const remaining=v21Remaining(o,profileId);
       if(Number.isFinite(Number(remaining)))return remaining;
       const r=canonicalPathResult(o,profileId);return Number(r?.remaining||o?.remaining||0);
     };
     window.canonicalRemaining=canonicalRemaining;

     opportunityUniversityRange=function(o){
       const vals=v21Rows(o).map(r=>r.remaining).sort((a,b)=>a-b);
       if(!vals.length){try{const fallback=(universityOptionsForOpportunity(o)||[]).map(x=>Number(x.remaining)).filter(Number.isFinite).sort((a,b)=>a-b);if(!fallback.length)return null;return {min:hp(fallback[0]),max:hp(fallback[fallback.length-1]),same:hp(fallback[0])===hp(fallback[fallback.length-1])}}catch(e){return null}}
       return {min:vals[0],max:vals[vals.length-1],same:vals[0]===vals[vals.length-1]};
     };
     window.opportunityUniversityRange=opportunityUniversityRange;

     opportunityRemainingLabel=function(o){const r=opportunityUniversityRange(o);if(!r)return 'Välj lärosäte';if(r.same)return r.min?fmt(r.min)+' hp kvar':'Klar';return 'från '+fmt(r.min)+' hp kvar'};
     window.opportunityRemainingLabel=opportunityRemainingLabel;
     opportunityStatus=function(o){const r=opportunityUniversityRange(o),value=r?Number(r.min||0):Number(canonicalRemaining(o)||0);if(!value)return {label:'Klar',kind:'ready'};return {label:opportunityRemainingLabel(o),kind:value<=30?'near':'normal'}};
     window.opportunityStatus=opportunityStatus;
     window.__studielotsHpCanonical={version:PATCH,source:'direct v21PathFor',singleSource:true};
     if(typeof renderDegrees==='function')requestAnimationFrame(()=>{try{renderDegrees()}catch(e){}});
   }catch(e){console.warn('StudieLots v593 hp source',e)}
 }

 function captureCurrentPath(){
   const txt=document.body?.innerText||'';
   const m=txt.match(/(\\d+(?:[,.]\\d+)?)\\s*hp kan räknas in i examen\\s*[·•]\\s*(\\d+(?:[,.]\\d+)?)\\s*hp kvar/i);
   const h=[...document.querySelectorAll('h1,h2')].find(x=>/kandidatexamen/i.test(x.textContent||''));
   if(!m||!h)return;
   const subject=((h.textContent||'').match(/i\\s+([^\\n]+)$/i)||[])[1]?.trim()||'';if(!subject)return;
   const data={subject,credited:hp(Number(m[1].replace(',','.'))),remaining:hp(Number(m[2].replace(',','.'))),ts:Date.now()};
   try{sessionStorage.setItem('studielots_authoritative_hp',JSON.stringify(data))}catch(e){}
   window.__studielotsAuthoritativeHp=data;
 }
 function storedPath(){try{return window.__studielotsAuthoritativeHp||JSON.parse(sessionStorage.getItem('studielots_authoritative_hp')||'null')}catch(e){return null}}

 function syncRenderedUi(){
   captureCurrentPath();
   const all=typeof safeDegreeOpportunities==='function'?(()=>{try{return safeDegreeOpportunities()}catch(e){return []}})():[];
   for(const card of document.querySelectorAll('.opportunity-discovery-card')){
     const subject=card.querySelector('h3')?.textContent?.trim();if(!subject)continue;
     const o=all.find(x=>isCandidate(x)&&norm(x.subject||x.name)===norm(subject));if(!o)continue;
     const label=opportunityRemainingLabel(o),status=card.querySelector('.opportunity-status');if(status&&status.textContent.trim()!==label)status.textContent=label;
   }

   const a=storedPath();
   if(a&&Number.isFinite(Number(a.remaining))&&(/Tar fram din studieplan/i.test(document.body?.innerText||'')||/Studielots analyserar/i.test(document.body?.innerText||''))){
     const remain=fmt(a.remaining)+' hp kvar',credited=fmt(a.credited)+' hp';
     for(const el of document.querySelectorAll('div,span,strong,b')){
       const t=(el.textContent||'').trim();
       if(/^\\d+(?:[,.]\\d+)?\\s*hp kvar$/i.test(t))el.textContent=remain;
       if(/^\\d+(?:[,.]\\d+)?\\s*hp$/i.test(t)&&el.parentElement&&/Matchar kurser mot lärosätets/i.test(el.parentElement.textContent||''))el.textContent=credited;
     }
   }

   const walker=document.createTreeWalker(document.body||document.documentElement,NodeFilter.SHOW_TEXT);
   const trash=[];while(walker.nextNode()){const n=walker.currentNode;if(/^(?:\\\\n)+$/.test((n.nodeValue||'').trim()))trash.push(n)}trash.forEach(n=>n.remove());
 }

 document.addEventListener('click',e=>{if(/Skapa plan i Planeraren/i.test(e.target?.closest('button,a')?.textContent||''))captureCurrentPath()},true);
 function apply(){installSingleHpSource();syncRenderedUi();fixProgramSearch();fixPlannerTerms()}
 function fixProgramSearch(){const input=document.getElementById('programSearchInput'),host=document.getElementById('programSearchResults');const catalog=(typeof programCatalog!=='undefined'&&Array.isArray(programCatalog))?programCatalog:(Array.isArray(window.programCatalog)?window.programCatalog:null);if(!input||!host||!catalog||input.dataset.slLatest)return;window.renderProgramSearch=function(){const q=norm(input.value),seen=new Set();const rows=catalog.filter(p=>p&&!p.superseded).filter(p=>!q||norm((p.name||'')+' '+(p.university||'')+' '+(p.code||p.officialCode||'')).includes(q)).filter(p=>{const k=norm((p.name||'')+'|'+(p.university||''));if(seen.has(k))return false;seen.add(k);return true}).slice(0,30);host.innerHTML=rows.length?rows.map(p=>'<button type="button" class="program-search-row sl-program-hit" data-sl-program-id="'+encodeURIComponent(String(p.id||''))+'" style="width:100%;text-align:left;border:0;background:#fff;padding:13px 12px;border-bottom:1px solid #edf0f4"><strong>'+String(p.name||'Program')+'</strong><small style="display:block;color:#667085;margin-top:3px">'+String(p.university||'')+(Number(p.hp)?' · '+Number(p.hp)+' hp':'')+'</small></button>').join(''):'<div class="empty">Inga program hittades.</div>'};input.dataset.slLatest='1';input.addEventListener('input',()=>window.renderProgramSearch(),{passive:true});host.addEventListener('click',e=>{const row=e.target.closest('[data-sl-program-id]');if(!row)return;const id=decodeURIComponent(row.dataset.slProgramId||'');if(typeof window.v379ActivateProgram==='function')window.v379ActivateProgram(id);else if(typeof window.openProgramSearchResultSafe==='function')window.openProgramSearchResultSafe(id);else if(typeof window.openProgramSearchResult==='function')window.openProgramSearchResult(id)},true);window.renderProgramSearch()}
 function fixPlannerTerms(){const root=document.getElementById('plannerClean'),shell=root?.querySelector('.v572-shell');if(!shell||shell.dataset.slTermSetup)return;shell.dataset.slTermSetup='1';shell.classList.add('sl-terms-collapsed');shell.querySelectorAll('.v572-term-section').forEach(sec=>sec.classList.remove('open'));shell.addEventListener('click',e=>{const card=e.target.closest('.v572-term[data-term]');if(!card)return;const term=card.dataset.term;shell.classList.remove('sl-terms-collapsed');shell.querySelectorAll('.v572-term-section').forEach(sec=>sec.classList.toggle('open',String(sec.dataset.termSection)===String(term)))},true)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,0));else setTimeout(apply,0);
 let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
 window.__studielotsLatestPatch={version:PATCH,hpSource:'direct-v2.1',removeLiteralNewlines:true};
})();
<\/script>`;

self.addEventListener('fetch',event=>{
 const u=new URL(event.request.url);
 if(u.pathname==='/share-ladok'&&event.request.method==='POST'){
   event.respondWith((async()=>{try{const form=await event.request.formData(),file=form.get('ladokPdf');if(!file)return Response.redirect('/?studielots-share-error=1',303);const c=await caches.open('studielots-share-v1');await c.put('/__studielots_shared_pdf__',new Response(file,{headers:{'content-type':file.type||'application/pdf','x-studielots-filename':file.name||'Ladok-resultatintyg.pdf'}}));return Response.redirect('/?studielots-share=1',303)}catch(e){return Response.redirect('/?studielots-share-error=1',303)}})());return;
 }
 if(event.request.mode==='navigate'&&event.request.method==='GET'&&u.origin===self.location.origin){
   event.respondWith((async()=>{try{const response=await fetch(event.request,{cache:'no-store'});const type=response.headers.get('content-type')||'';if(!type.includes('text/html'))return response;let html=await response.text();html=html.replace(/<style id="studielots-latest-patch">[\\s\\S]*?<\\/script>/g,'');html=html.replace('</body>',latestPatch+'\n</body>');const headers=new Headers(response.headers);headers.delete('content-length');headers.set('cache-control','no-store, max-age=0');headers.set('x-studielots-patch',STUDIELOTS_PATCH);return new Response(html,{status:response.status,statusText:response.statusText,headers})}catch(e){return fetch(event.request)}})());
 }
});
