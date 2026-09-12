(()=>{'use strict';
const root=window.StudieLotsV2=window.StudieLotsV2||{},ctx=root.appContext;if(!ctx)throw new Error('StudieLots app context saknas');
const {state,qa}=ctx;
const pages=[...document.querySelectorAll('.page')],nav=[...document.querySelectorAll('[data-nav]')];
function show(id){state.page=id;pages.forEach(p=>p.classList.toggle('active',p.id===id));nav.forEach(b=>b.classList.toggle('active',b.dataset.nav===id));if(id==='opportunities')root.opportunities?.render?.();if(id==='programs')root.programs?.load?.();window.scrollTo(0,0)}
root.navigation={show};
qa('[data-go],[data-nav]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.go||b.dataset.nav)));
root.studies?.bind?.();
root.planner?.bind?.();
})();