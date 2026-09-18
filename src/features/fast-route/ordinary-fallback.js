(()=>{'use strict';
const root=window.StudieLotsV2;if(!root?.planner||root.planner.__ordinaryFallback)return;
const planner=root.planner,original=planner.renderFast.bind(planner);
async function renderFast(...args){
  await original(...args);
  const fast=document.querySelector('#fastPlan'),ordinary=document.querySelector('#ordinaryPlan');
  if(!fast||!ordinary||fast.hidden||fast.querySelector('.fast-win'))return;
  const originalTerms=ordinary.querySelector('.term-list');
  if(!originalTerms?.querySelector('.term-row'))return;
  // An incomplete or unverified accelerated schedule must never replace the actual programme path.
  fast.querySelectorAll('.term-list,.fast-visible-fallback,.fast-fallback-original').forEach(node=>node.remove());
  const section=document.createElement('section');section.className='fast-fallback-original';
  const note=document.createElement('div');note.className='info-note';
  const heading=document.createElement('b');heading.textContent='Vi kunde inte verifiera en kortare väg till examen';
  const detail=document.createElement('span');detail.textContent='Här visas därför den ordinarie studiegången med kursunderlag och preliminära tillgodoräknanden. Det betyder inte att en snabbare väg är omöjlig; kurstillfällen, behörighet och tillträde behöver bekräftas.';
  note.append(heading,detail);section.append(note);
  const list=originalTerms.cloneNode(true);
  list.querySelectorAll('.term-summary').forEach(button=>button.addEventListener('click',()=>{
    const courses=button.closest('.term-row')?.querySelector('.course-list');if(!courses)return;
    courses.hidden=!courses.hidden;const arrow=button.querySelector('.chev');if(arrow)arrow.textContent=courses.hidden?'⌄':'⌃';
  }));
  section.append(list);fast.append(section);
}
planner.renderFast=renderFast;
// The route handler closes over its own renderFast; wrap the public route to apply fallback after it finishes.
const route=planner.route.bind(planner);
planner.route=async function(kind,...args){await route(kind,...args);if(kind==='fast')await renderFast()};
})();