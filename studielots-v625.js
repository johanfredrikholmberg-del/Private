(()=>{
'use strict';
function load(src,marker){return new Promise((resolve,reject)=>{const old=document.querySelector(`script[${marker}]`);if(old){if(old.dataset.loaded==='1')return resolve();old.addEventListener('load',resolve,{once:true});old.addEventListener('error',reject,{once:true});return}const s=document.createElement('script');s.src=src;s.async=false;s.setAttribute(marker,'1');s.addEventListener('load',()=>{s.dataset.loaded='1';resolve()},{once:true});s.addEventListener('error',reject,{once:true});document.body.appendChild(s)})}
(async()=>{
  try{
    await load('/studielots-historical-credit-karlstad-2026-p1.js?v=709','data-sl-historical-karlstad-1');
    await load('/studielots-historical-credit-karlstad-2026-p2.js?v=709','data-sl-historical-karlstad-2');
    await load('/studielots-historical-credit-karlstad-2026-p3.js?v=709','data-sl-historical-karlstad-3');
    await load('/studielots-credit-policy-v709.js?v=709','data-sl-credit-policy');
  }catch(err){console.warn('[StudieLots] Historical credit policy could not be fully loaded',err)}
  await load('/studielots-v625-legacy.js?v=638','data-sl-v625-legacy');
})();
})();