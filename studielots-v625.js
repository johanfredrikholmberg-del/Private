(()=>{
  'use strict';
  function load(){
    const after627=()=>{
      if(document.querySelector('script[data-studielots-v628]'))return after628();
      const s628=document.createElement('script');
      s628.src='/studielots-runtime-v628.js?v=628';
      s628.dataset.studielotsV628='1';
      s628.async=false;
      s628.onload=after628;
      document.body.appendChild(s628);
    };
    const after628=()=>{
      if(document.querySelector('script[data-studielots-v629]'))return;
      const s629=document.createElement('script');
      s629.src='/studielots-runtime-v629.js?v=629';
      s629.dataset.studielotsV629='1';
      s629.async=false;
      document.body.appendChild(s629);
    };
    if(document.querySelector('script[data-studielots-v627]'))return after627();
    const s627=document.createElement('script');
    s627.src='/studielots-runtime-v627.js?v=627';
    s627.dataset.studielotsV627='1';
    s627.async=false;
    s627.onload=after627;
    document.body.appendChild(s627);
  }
  if(document.readyState==='complete')load();else window.addEventListener('load',load,{once:true});
})();
