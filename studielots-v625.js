(()=>{
  'use strict';
  function load(){
    if(document.querySelector('script[data-studielots-runtime]'))return;
    const script=document.createElement('script');
    script.src='/studielots-runtime.js?v=633';
    script.dataset.studielotsRuntime='633';
    script.async=false;
    document.body.appendChild(script);
  }
  if(document.readyState==='complete')load();else window.addEventListener('load',load,{once:true});
})();
