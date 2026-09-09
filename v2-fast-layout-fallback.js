(()=>{'use strict';
function sync(){
  const fast=document.querySelector('#fastPlan');
  const ordinary=document.querySelector('#ordinaryPlan .term-list');
  if(!fast||fast.hidden||!ordinary)return;
  const old=fast.querySelector('.fast-layout-fallback');
  if(fast.querySelector('.term-list:not(.fast-layout-fallback .term-list)')){old?.remove();return}
  if(old)return;
  const wrap=document.createElement('section');
  wrap.className='fast-layout-fallback';
  wrap.innerHTML='<div class="info-note"><b>Terminsupplägg medan snabbvägen verifieras</b><span>Det här är den ordinarie terminsföljden för de återstående programkraven. StudieLots flyttar bara en kurs till en tidigare termin när ett faktiskt framtida kurstillfälle kan verifieras.</span></div>';
  const clone=ordinary.cloneNode(true);
  clone.querySelectorAll('.course').forEach(c=>{
    const status=c.querySelector('.status');
    if(status&&!/kan räknas in/i.test(status.textContent||'')){
      status.textContent='Kurstillfälle ej verifierat';
      status.classList.remove('potential');
      status.classList.add('remain');
    }
    c.querySelectorAll('.offer-link').forEach(x=>x.remove());
  });
  wrap.appendChild(clone);
  fast.appendChild(wrap);
  clone.querySelectorAll('.term-summary').forEach((b,i)=>{
    const list=b.closest('.term-row')?.querySelector('.course-list');
    const chev=b.querySelector('.chev');
    if(!list)return;
    list.hidden=i!==0;
    if(chev)chev.textContent=list.hidden?'⌄':'⌃';
    b.addEventListener('click',()=>{list.hidden=!list.hidden;if(chev)chev.textContent=list.hidden?'⌄':'⌃'})
  });
}
function install(){
  const root=document.querySelector('#fastPlan');
  if(!root)return;
  new MutationObserver(()=>requestAnimationFrame(sync)).observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
  document.addEventListener('click',()=>setTimeout(sync,40),true);
  setTimeout(sync,300);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();