const STUDIELOTS_PATCH='2026-09-01-a';

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

const latestPatch=`
<style id="studielots-latest-patch">
/* 2026-09-01 — thinner frosted bottom navigation + iPhone safe area */
.lotsen-bottomnav{
  bottom:max(6px,env(safe-area-inset-bottom))!important;
  width:min(680px,calc(100% - 20px))!important;
  gap:1px!important;
  padding:4px 5px!important;
  border-radius:20px!important;
  background:rgba(255,255,255,.58)!important;
  -webkit-backdrop-filter:blur(24px) saturate(175%)!important;
  backdrop-filter:blur(24px) saturate(175%)!important;
  border:1px solid rgba(255,255,255,.62)!important;
  box-shadow:0 8px 28px rgba(16,24,40,.14)!important;
}
.lotsen-bottomnav button{
  padding:5px 2px 4px!important;
  min-height:45px!important;
  gap:1px!important;
  border-radius:15px!important;
}
.lotsen-bottomnav .bottom-icon{height:19px!important;font-size:20px!important}
.lotsen-bottomnav b{font-size:9px!important}
.main{padding-bottom:calc(88px + env(safe-area-inset-bottom))!important}

/* Planner: lower term details stay hidden until a term in the upper strip is chosen. */
#plannerClean .v572-shell.sl-terms-collapsed .v572-studyplan{display:none!important}
#plannerClean .v572-term-section[data-term-section="0"],
#plannerClean .v572-term[data-term="0"]{display:none!important}
</style>
<script id="studielots-latest-patch-js">
(()=>{
  const norm=s=>String(s||'').toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9åäö]+/g,' ').trim();

  function fixProgramSearch(){
    const input=document.getElementById('programSearchInput');
    const host=document.getElementById('programSearchResults');
    if(!input||!host||!Array.isArray(window.programCatalog))return;

    window.renderProgramSearch=function(){
      const q=norm(input.value);
      const seen=new Set();
      let rows=window.programCatalog.filter(p=>p&&!p.superseded).filter(p=>{
        if(!q)return true;
        return norm((p.name||'')+' '+(p.university||'')+' '+(p.code||p.officialCode||'')).includes(q);
      }).filter(p=>{
        const k=norm((p.name||'')+'|'+(p.university||''));
        if(seen.has(k))return false;seen.add(k);return true;
      }).slice(0,30);

      host.innerHTML=rows.length?rows.map(p=>{
        const id=encodeURIComponent(String(p.id||''));
        const hp=Number(p.hp)||'';
        return '<button type="button" class="program-search-row sl-program-hit" data-sl-program-id="'+id+'" style="width:100%;text-align:left;border:0;background:#fff;padding:13px 12px;border-bottom:1px solid #edf0f4;cursor:pointer"><strong>'+String(p.name||'Program')+'</strong><small style="display:block;color:#667085;margin-top:3px">'+String(p.university||'')+(hp?' · '+hp+' hp':'')+'</small></button>';
      }).join(''):'<div class="empty">Inga program hittades.</div>';
    };

    if(!input.dataset.slLatest){
      input.dataset.slLatest='1';
      input.addEventListener('input',()=>window.renderProgramSearch(),{passive:true});
      host.addEventListener('click',e=>{
        const row=e.target.closest('[data-sl-program-id]');if(!row)return;
        e.preventDefault();e.stopPropagation();
        const id=decodeURIComponent(row.dataset.slProgramId||'');
        if(typeof window.v379ActivateProgram==='function'){window.v379ActivateProgram(id);return;}
        if(typeof window.openProgramSearchResultSafe==='function'){window.openProgramSearchResultSafe(id);return;}
        if(typeof window.openProgramSearchResult==='function')window.openProgramSearchResult(id);
      },true);
    }
    window.renderProgramSearch();
  }

  function fixPlannerTerms(){
    const root=document.getElementById('plannerClean');
    const shell=root?.querySelector('.v572-shell');
    if(!shell)return;
    if(!shell.dataset.slTermSetup){
      shell.dataset.slTermSetup='1';
      shell.classList.add('sl-terms-collapsed');
      shell.querySelectorAll('.v572-term-section').forEach(sec=>sec.classList.remove('open'));
      shell.addEventListener('click',e=>{
        const card=e.target.closest('.v572-term[data-term]');
        if(!card)return;
        const term=card.dataset.term;
        shell.classList.remove('sl-terms-collapsed');
        shell.querySelectorAll('.v572-term-section').forEach(sec=>{
          const open=String(sec.dataset.termSection)===String(term);
          sec.classList.toggle('open',open);
          const i=sec.querySelector('.v572-term-head i');if(i)i.textContent=open?'⌃':'⌄';
        });
        requestAnimationFrame(()=>shell.querySelector('.v572-studyplan')?.scrollIntoView({behavior:'smooth',block:'start'}));
      },true);
    }
  }

  function apply(){fixProgramSearch();fixPlannerTerms();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,0));else setTimeout(apply,0);
  new MutationObserver(()=>requestAnimationFrame(apply)).observe(document.documentElement,{childList:true,subtree:true});
  window.__studielotsLatestPatch={version:'2026-09-01-a',programSearchAllCatalog:true,termDetailsOnDemand:true,thinBlurNav:true};
})();
<\/script>`;

self.addEventListener('fetch',event=>{
  const u=new URL(event.request.url);

  if(u.pathname==='/share-ladok'&&event.request.method==='POST'){
    event.respondWith((async()=>{
      try{
        const form=await event.request.formData(),file=form.get('ladokPdf');
        if(!file)return Response.redirect('/?studielots-share-error=1',303);
        const c=await caches.open('studielots-share-v1');
        await c.put('/__studielots_shared_pdf__',new Response(file,{headers:{'content-type':file.type||'application/pdf','x-studielots-filename':file.name||'Ladok-resultatintyg.pdf'}}));
        return Response.redirect('/?studielots-share=1',303);
      }catch(e){return Response.redirect('/?studielots-share-error=1',303)}
    })());
    return;
  }

  if(event.request.mode==='navigate'&&event.request.method==='GET'&&u.origin===self.location.origin){
    event.respondWith((async()=>{
      try{
        const response=await fetch(event.request);
        const type=response.headers.get('content-type')||'';
        if(!type.includes('text/html'))return response;
        let html=await response.text();
        if(!html.includes('studielots-latest-patch'))html=html.replace('</body>',latestPatch+'\n</body>');
        const headers=new Headers(response.headers);headers.delete('content-length');
        headers.set('x-studielots-patch',STUDIELOTS_PATCH);
        return new Response(html,{status:response.status,statusText:response.statusText,headers});
      }catch(e){return fetch(event.request)}
    })());
  }
});
