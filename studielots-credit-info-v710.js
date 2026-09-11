(()=>{
'use strict';
const DATA=[{university:'Karlstads universitet',period:'2026'}];
const low=v=>String(v||'').trim().toLocaleLowerCase('sv-SE');
function install(){
 const page=document.querySelector('.sl-credit-info-page');
 if(!page||page.querySelector('.sl-credit-data-coverage'))return;
 const inner=page.querySelector('.sl-credit-info-inner'); if(!inner)return;
 const note=inner.querySelector('.sl-credit-info-note');
 const box=document.createElement('div'); box.className='sl-credit-info-box sl-credit-data-coverage';
 box.innerHTML='<b>Data i StudieLots</b><p>Underlaget byggs ut löpande. Just nu finns data från:</p><div class="sl-credit-data-list"></div>';
 const list=box.querySelector('.sl-credit-data-list');
 DATA.forEach(x=>{const row=document.createElement('div');row.style.cssText='display:flex;justify-content:space-between;gap:16px;padding-top:8px;font-size:13px';row.innerHTML=`<strong>${x.university}</strong><span>${x.period}</span>`;list.appendChild(row)});
 inner.insertBefore(box,note||null);
}
new MutationObserver(()=>install()).observe(document.documentElement,{childList:true,subtree:true});
install();
window.StudieLotsCreditDataCoverage={version:'710',sources:DATA};
})();