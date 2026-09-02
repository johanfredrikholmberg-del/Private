(()=>{
  'use strict';
  function load627(){
    if(document.querySelector('script[data-studielots-v627]'))return;
    const script=document.createElement('script');
    script.src='/studielots-runtime-v627.js?v=627';
    script.dataset.studielotsV627='1';
    script.async=false;
    document.body.appendChild(script);
  }
  if(document.readyState==='complete')load627();else window.addEventListener('load',load627,{once:true});
})();
