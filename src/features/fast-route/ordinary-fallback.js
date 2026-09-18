(()=>{'use strict';
const fast=document.querySelector('#fastPlan'),ordinary=document.querySelector('#ordinaryPlan');if(!fast||!ordinary||fast.dataset.ordinaryFallback)return;fast.dataset.ordinaryFallback='1';
let applying=false;
function show(){
 if(applying||fast.hidden||fast.querySelector('.fast-win')||fast.querySelector('.fast-fallback-original'))return;
 const controls=fast.querySelector('.fast-controls'),originalTerms=ordinary.querySelector('.term-list');
 if(!controls||!originalTerms?.querySelector('.term-row'))return;
 applying=true;
 fast.querySelectorAll('.term-list,.fast-visible-fallback').forEach(node=>node.remove());
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
 section.append(list);fast.append(section);applying=false;
}
new MutationObserver(show).observe(fast,{childList:true,subtree:false,attributes:true,attributeFilter:['hidden']});show();
})();