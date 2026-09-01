const STUDIELOTS_PATCH='2026-09-01-b';

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

const latestPatch=`
<style id="studielots-latest-patch">
/* 2026-09-01 b — compact frosted bottom navigation + iPhone safe area */
.lotsen-bottomnav,
.v341-bottomnav,
.v444-bottomnav{
  bottom:max(5px,env(safe-area-inset-bottom,0px))!important;
  width:min(680px,calc(100% - 18px))!important;
  min-height:0!important;
  height:auto!important;
  gap:1px!important;
  padding:4px 5px!important;
  border-radius:27px!important;
  background:rgba(249,249,246,.70)!important;
  -webkit-backdrop-filter:blur(20px) saturate(145%)!important;
  backdrop-filter:blur(20px) saturate(145%)!important;
  border:1px solid rgba(255,255,255,.72)!important;
  box-shadow:0 7px 24px rgba(16,24,40,.12)!important;
}
.lotsen-bottomnav button,
.v341-bottomnav button,
.v444-bottomnav button{
  padding:5px 2px 4px!important;
  min-height:48px!important;
  height:auto!important;
  gap:1px!important;
  border-radius:21px!important;
}
.lotsen-bottomnav button.active,
.v341-bottomnav button.active,
.v444-bottomnav button.active,
.lotsen-bottomnav [aria-current="page"],
.v341-bottomnav [aria-current="page"],
.v444-bottomnav [aria-current="page"]{
  box-shadow:none!important;
}
.lotsen-bottomnav .bottom-icon,
.v341-bottomnav .bottom-icon,
.v444-bottomnav .bottom-icon{height:22px!important;font-size:23px!important;line-height:1!important}
.lotsen-bottomnav b,
.v341-bottomnav b,
.v444-bottomnav b{font-size:10px!important;line-height:1.05!important}
.main{padding-bottom:calc(78px + env(safe-area-inset-bottom,0px))!important}

/* Psychology / university path detail: prevent decorative controls from taking mobile width. */
@media(max-width:700px){
  .v21-detail{overflow:hidden!important}
  .v21-detail-top{display:block!important;grid-template-columns:none!important;position:relative!important}
  .v21-back,.v21-score{display:none!important}
  .v21-detail-title{min-width:0!important;width:100%!important;padding:0!important}
  .v21-detail-title h1{max-width:100%!important;overflow-wrap:anywhere!important}
}

/* Planner: lower term details stay hidden until a term in the upper strip is chosen. */
#plannerClean .v572-shell.sl-terms-collapsed .v572-studyplan{display:none!important}
#plannerClean .v572-term-section[data-term-section="0"],
#plannerClean .v572-term[data-term="0"]{display:none!important}
</style>
<script id="studielots-latest-patch-js">
(()=>{
  const PATCH='2026-09-01-b';
  const norm=s=>String(s||'').toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9åäö]+/g,' ').trim();
  const hp=n=>Math.round((Number(n)||0)*2)/2;
  const exactFromBreakdown=b=>b?hp(Math.max(0,Number(b.missingMain||0)+Number(b.missingReq||0)+Number(b.missingElective||0))):null;

  /* One source of truth for candidate remaining HP.
     The university-detail view already uses missingMain + missingReq + missingElective.
     Feed that exact same number back into every university option and all overview labels. */
  function installHpCanonical(){
    if(window.__studielotsHpCanonical?.version===PATCH)return;
    try{
      if(typeof universityOptionsForOpportunity==='function'){
        const originalUniversityOptions=universityOptionsForOpportunity;
        universityOptionsForOpportunity=function(o){
          const rows=originalUniversityOptions(o)||[];
          return rows.map(x=>{
            try{
              const b=x?.breakdown||(typeof localRuleBreakdown==='function'?localRuleBreakdown(x?.rule,typeof passedCourses!=='undefined'?passedCourses:[]):null);
              const exact=exactFromBreakdown(b);
              if(!Number.isFinite(exact))return x;
              const degreeHp=Number(x?.degreeHp||o?.hp||o?.degreeHp||180)||180;
              const score=Math.max(0,Math.min(100,Math.round(((degreeHp-exact)/degreeHp)*100)));
              return {...x,remaining:exact,score,breakdown:b};
            }catch(e){return x;}
          });
        };
      }

      const exactCandidateRemaining=o=>{
        try{
          if(typeof universityOptionsForOpportunity!=='function')return null;
          const rows=universityOptionsForOpportunity(o)||[];
          if(!rows.length)return null;
          let chosen=null;
          if(typeof canonicalPathResult==='function'){
            try{
              const r=canonicalPathResult(o,{__slNoCanonical:true});
              const pid=r?.option?.profileId||r?.profileId;
              if(pid!=null)chosen=rows.find(x=>String(x?.profileId)===String(pid));
            }catch(e){}
          }
          if(!chosen)chosen=rows.find(x=>x?.verified)||rows[0];
          return Number.isFinite(Number(chosen?.remaining))?hp(chosen.remaining):null;
        }catch(e){return null;}
      };

      if(typeof canonicalRemaining==='function'){
        const originalCanonicalRemaining=canonicalRemaining;
        canonicalRemaining=function(o){
          const t=String(o?.degreeType||o?.type||'').toLowerCase();
          if(!t.includes('magister')&&!t.includes('master')){
            const exact=exactCandidateRemaining(o);
            if(Number.isFinite(exact))return exact;
          }
          return originalCanonicalRemaining(o);
        };
      }

      if(typeof opportunityRemainingLabel==='function'){
        opportunityRemainingLabel=function(o){
          const r=typeof canonicalRemaining==='function'?canonicalRemaining(o):exactCandidateRemaining(o);
          if(!Number.isFinite(Number(r)))return 'Välj lärosäte';
          const f=typeof fmtHp==='function'?fmtHp(r):String(hp(r)).replace('.',',');
          return f+' hp kvar';
        };
      }

      window.__studielotsHpCanonical={version:PATCH,formula:'missingMain + missingReq + missingElective'};
      if(typeof renderDegrees==='function')requestAnimationFrame(()=>{try{renderDegrees()}catch(e){}});
    }catch(e){console.warn('StudieLots hp canonical patch',e)}
  }

  function fixProgramSearch(){
    const input=document.getElementById('programSearchInput');
    const host=document.getElementById('programSearchResults');
    const catalog=(typeof programCatalog!=='undefined'&&Array.isArray(programCatalog))?programCatalog:(Array.isArray(window.programCatalog)?window.programCatalog:null);
    if(!input||!host||!catalog)return;

    window.renderProgramSearch=function(){
      const q=norm(input.value);
      const seen=new Set();
      let rows=catalog.filter(p=>p&&!p.superseded).filter(p=>{
        if(!q)return true;
        return norm((p.name||'')+' '+(p.university||'')+' '+(p.code||p.officialCode||'')).includes(q);
      }).filter(p=>{
        const k=norm((p.name||'')+'|'+(p.university||''));
        if(seen.has(k))return false;seen.add(k);return true;
      }).slice(0,30);

      host.innerHTML=rows.length?rows.map(p=>{
        const id=encodeURIComponent(String(p.id||''));
        const credits=Number(p.hp)||'';
        return '<button type="button" class="program-search-row sl-program-hit" data-sl-program-id="'+id+'" style="width:100%;text-align:left;border:0;background:#fff;padding:13px 12px;border-bottom:1px solid #edf0f4;cursor:pointer"><strong>'+String(p.name||'Program')+'</strong><small style="display:block;color:#667085;margin-top:3px">'+String(p.university||'')+(credits?' · '+credits+' hp':'')+'</small></button>';
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

  function apply(){installHpCanonical();fixProgramSearch();fixPlannerTerms();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,0));else setTimeout(apply,0);
  let queued=false;
  new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}).observe(document.documentElement,{childList:true,subtree:true});
  window.__studielotsLatestPatch={version:PATCH,programSearchAllCatalog:true,termDetailsOnDemand:true,thinBlurNav:true,hpSingleSource:true};
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
        const response=await fetch(event.request,{cache:'no-store'});
        const type=response.headers.get('content-type')||'';
        if(!type.includes('text/html'))return response;
        let html=await response.text();
        html=html.replace(/<style id="studielots-latest-patch">[\\s\\S]*?<\\/script>/g,'');
        html=html.replace('</body>',latestPatch+'\n</body>');
        const headers=new Headers(response.headers);headers.delete('content-length');
        headers.set('cache-control','no-store, max-age=0');
        headers.set('x-studielots-patch',STUDIELOTS_PATCH);
        return new Response(html,{status:response.status,statusText:response.statusText,headers});
      }catch(e){return fetch(event.request)}
    })());
  }
});
