const STUDIELOTS_PATCH='2026-09-01-g';

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
 const PATCH='2026-09-01-g';
 const VERSION='594';
 const norm=s=>String(s||'').toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9åäö]+/g,' ').trim();
 const hp=n=>Math.round((Number(n)||0)*2)/2;
 const fmt=n=>String(hp(n)).replace('.',',');
 const isCandidate=o=>!/(magister|master)/i.test(String(o?.degreeType||o?.type||o?.degree||''));
 let appOptions=null;
 let oldCanonicalRemaining=null;
 let oldOpportunityLabel=null;
 let oldOpportunityStatus=null;
 let installed=false;

 function captureFinalFunctions(){
   if(!appOptions&&typeof universityOptionsForOpportunity==='function')appOptions=universityOptionsForOpportunity;
   if(!oldCanonicalRemaining&&typeof canonicalRemaining==='function')oldCanonicalRemaining=canonicalRemaining;
   if(!oldOpportunityLabel&&typeof opportunityRemainingLabel==='function')oldOpportunityLabel=opportunityRemainingLabel;
   if(!oldOpportunityStatus&&typeof opportunityStatus==='function')oldOpportunityStatus=opportunityStatus;
 }

 function finalV21Rows(o){
   if(!o||!isCandidate(o)){return []}
   captureFinalFunctions();
   if(typeof appOptions!=='function')return [];
   try{
     const rows=appOptions(o)||[];
     const v21=rows.filter(x=>x&&Number.isFinite(Number(x.remaining))&&(String(x.engine||'').toLowerCase()==='v2.1'||x.v2));
     return (v21.length?v21:rows.filter(x=>x&&Number.isFinite(Number(x.remaining))&&x.verified)).map(x=>({...x,remaining:hp(x.remaining)}));
   }catch(e){return []}
 }

 function rowUniversity(x){return String(x?.d?.university||x?.d?.name||x?.university||x?.v2?.provider||'').trim()}
 function exactForOpportunity(o,profileId='',university=''){
   const rows=finalV21Rows(o);if(!rows.length)return null;
   let chosen=null;
   if(profileId)chosen=rows.find(x=>String(x?.d?.id||x?.profileId||x?.id||'')===String(profileId))||null;
   if(!chosen&&university)chosen=rows.find(x=>norm(rowUniversity(x))===norm(university))||null;
   if(!chosen&&rows.length===1)chosen=rows[0];
   if(!chosen)chosen=rows.find(x=>x?.verified||x?.d?.verified)||rows[0];
   if(!chosen||!Number.isFinite(Number(chosen.remaining)))return null;
   const total=Number(o?.hp||o?.degreeHp||chosen?.d?.hp||180)||180;
   const remaining=hp(chosen.remaining);
   return {remaining,credited:hp(Math.max(0,total-remaining)),row:chosen,total};
 }

 function installSingleSource(){
   if(installed)return;
   captureFinalFunctions();
   if(typeof appOptions!=='function')return;
   installed=true;
   try{
     canonicalRemaining=function(o,profileId=''){
       const exact=exactForOpportunity(o,profileId);
       if(exact)return exact.remaining;
       return oldCanonicalRemaining?oldCanonicalRemaining(o,profileId):Number(o?.remaining||0);
     };
     window.canonicalRemaining=canonicalRemaining;
   }catch(e){}
   try{
     opportunityRemainingLabel=function(o){
       const exact=exactForOpportunity(o);
       if(exact)return exact.remaining?fmt(exact.remaining)+' hp kvar':'Klar';
       return oldOpportunityLabel?oldOpportunityLabel(o):'Välj lärosäte';
     };
     window.opportunityRemainingLabel=opportunityRemainingLabel;
   }catch(e){}
   try{
     opportunityStatus=function(o){
       const exact=exactForOpportunity(o);
       if(exact){const value=Number(exact.remaining||0);return value?{label:fmt(value)+' hp kvar',kind:value<=30?'near':'normal'}:{label:'Klar',kind:'ready'}}
       return oldOpportunityStatus?oldOpportunityStatus(o):{label:'Välj lärosäte',kind:'normal'};
     };
     window.opportunityStatus=opportunityStatus;
   }catch(e){}
   window.__studielotsHpCanonical={version:VERSION,patch:PATCH,source:'final v2.1 universityOptions rows',singleSource:true};
 }

 function knownUniversity(txt){
   const names=['Göteborgs universitet','Chalmers tekniska högskola','Lunds universitet'];
   return names.find(n=>norm(txt).includes(norm(n)))||'';
 }
 function captureCurrentPath(){
   const txt=document.body?.innerText||'';
   const m=txt.match(/(\\d+(?:[,.]\\d+)?)\\s*hp kan räknas in i examen\\s*[·•]\\s*(\\d+(?:[,.]\\d+)?)\\s*hp kvar/i);
   const h=[...document.querySelectorAll('h1,h2')].find(x=>/kandidatexamen/i.test(x.textContent||''));
   if(!m||!h)return null;
   const subject=((h.textContent||'').match(/i\\s+([^\\n]+)$/i)||[])[1]?.trim()||'';if(!subject)return null;
   const data={subject,university:knownUniversity(txt),credited:hp(Number(m[1].replace(',','.'))),remaining:hp(Number(m[2].replace(',','.'))),ts:Date.now()};
   try{sessionStorage.setItem('studielots_authoritative_hp',JSON.stringify(data))}catch(e){}
   window.__studielotsAuthoritativeHp=data;
   return data;
 }
 function storedPath(){try{return window.__studielotsAuthoritativeHp||JSON.parse(sessionStorage.getItem('studielots_authoritative_hp')||'null')}catch(e){return null}}

 function opportunities(){try{return typeof safeDegreeOpportunities==='function'?(safeDegreeOpportunities()||[]):[]}catch(e){return []}}
 function syncOpportunityCards(){
   const all=opportunities();
   for(const card of document.querySelectorAll('.opportunity-discovery-card')){
     const subject=card.querySelector('h3')?.textContent?.trim();if(!subject)continue;
     const o=all.find(x=>isCandidate(x)&&norm(x.subject||x.name)===norm(subject));if(!o)continue;
     const exact=exactForOpportunity(o);if(!exact)continue;
     const label=exact.remaining?fmt(exact.remaining)+' hp kvar':'Klar';
     const status=card.querySelector('.opportunity-status');
     if(status&&status.textContent.trim()!==label)status.textContent=label;
   }
 }

 function metricElementInRow(row){
   if(!row)return null;
   const els=[...row.querySelectorAll('strong,b,span,div')].filter(el=>el.children.length===0);
   return els.find(el=>/^\\d+(?:[,.]\\d+)?\\s*hp(?:\\s+kvar)?$/i.test((el.textContent||'').trim()))||null;
 }
 function replaceMetricByLabel(labelRx,value){
   const leaves=[...document.querySelectorAll('div,li,p,span')].filter(el=>el.children.length===0&&labelRx.test((el.textContent||'').trim()));
   for(const label of leaves){
     let row=label.parentElement;
     for(let i=0;i<3&&row;i++,row=row.parentElement){
       const metric=metricElementInRow(row);
       if(metric){if((metric.textContent||'').trim()!==value)metric.textContent=value;return true}
     }
   }
   return false;
 }
 function syncAnalysis(){
   const txt=document.body?.innerText||'';
   if(!/Studielots analyserar|Tar fram din studieplan/i.test(txt))return;
   const a=storedPath();if(!a||!Number.isFinite(Number(a.remaining)))return;
   replaceMetricByLabel(/Räknar återstående väg/i,fmt(a.remaining)+' hp kvar');
   replaceMetricByLabel(/Matchar kurser mot lärosätets/i,fmt(a.credited)+' hp');
 }
 function cleanupLiteralNewlines(){
   const root=document.body||document.documentElement;if(!root)return;
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const trash=[];
   while(walker.nextNode()){const n=walker.currentNode;const t=(n.nodeValue||'').trim();if(t&&/^(?:\\\\n)+$/.test(t))trash.push(n)}
   trash.forEach(n=>n.remove());
 }
 function syncRenderedUi(){captureCurrentPath();syncOpportunityCards();syncAnalysis();cleanupLiteralNewlines()}

 function fixProgramSearch(){
   const input=document.getElementById('programSearchInput'),host=document.getElementById('programSearchResults');
   const catalog=(typeof programCatalog!=='undefined'&&Array.isArray(programCatalog))?programCatalog:(Array.isArray(window.programCatalog)?window.programCatalog:null);
   if(!input||!host||!catalog||input.dataset.slLatest)return;
   window.renderProgramSearch=function(){
     const q=norm(input.value),seen=new Set();
     const rows=catalog.filter(p=>p&&!p.superseded).filter(p=>!q||norm((p.name||'')+' '+(p.university||'')+' '+(p.code||p.officialCode||'')).includes(q)).filter(p=>{const k=norm((p.name||'')+'|'+(p.university||''));if(seen.has(k))return false;seen.add(k);return true}).slice(0,30);
     host.innerHTML=rows.length?rows.map(p=>'<button type="button" class="program-search-row sl-program-hit" data-sl-program-id="'+encodeURIComponent(String(p.id||''))+'" style="width:100%;text-align:left;border:0;background:#fff;padding:13px 12px;border-bottom:1px solid #edf0f4"><strong>'+String(p.name||'Program')+'</strong><small style="display:block;color:#667085;margin-top:3px">'+String(p.university||'')+(Number(p.hp)?' · '+Number(p.hp)+' hp':'')+'</small></button>').join(''):'<div class="empty">Inga program hittades.</div>';
   };
   input.dataset.slLatest='1';input.addEventListener('input',()=>window.renderProgramSearch(),{passive:true});
   host.addEventListener('click',e=>{const row=e.target.closest('[data-sl-program-id]');if(!row)return;const id=decodeURIComponent(row.dataset.slProgramId||'');if(typeof window.v379ActivateProgram==='function')window.v379ActivateProgram(id);else if(typeof window.openProgramSearchResultSafe==='function')window.openProgramSearchResultSafe(id);else if(typeof window.openProgramSearchResult==='function')window.openProgramSearchResult(id)},true);
   window.renderProgramSearch();
 }
 function fixPlannerTerms(){
   const root=document.getElementById('plannerClean'),shell=root?.querySelector('.v572-shell');if(!shell||shell.dataset.slTermSetup)return;
   shell.dataset.slTermSetup='1';shell.classList.add('sl-terms-collapsed');shell.querySelectorAll('.v572-term-section').forEach(sec=>sec.classList.remove('open'));
   shell.addEventListener('click',e=>{const card=e.target.closest('.v572-term[data-term]');if(!card)return;const term=card.dataset.term;shell.classList.remove('sl-terms-collapsed');shell.querySelectorAll('.v572-term-section').forEach(sec=>sec.classList.toggle('open',String(sec.dataset.termSection)===String(term)))},true);
 }

 document.addEventListener('click',e=>{
   const btn=e.target?.closest('button,a');if(!btn||!/Skapa plan i Planeraren/i.test(btn.textContent||''))return;
   captureCurrentPath();[0,50,150,300,600].forEach(ms=>setTimeout(syncAnalysis,ms));
 },true);

 function apply(){captureFinalFunctions();installSingleSource();syncRenderedUi();fixProgramSearch();fixPlannerTerms();document.documentElement.dataset.studielotsPatch=VERSION}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,0));else setTimeout(apply,0);
 let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
 window.__studielotsLatestPatch={version:VERSION,patch:PATCH,hpSource:'final-v2.1-rows',removeLiteralNewlines:true};
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
