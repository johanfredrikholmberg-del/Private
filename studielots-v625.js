(()=>{
  'use strict';
  function loadScript(src,marker,done){
    if(document.querySelector(`script[${marker}]`)){if(done)done();return;}
    const script=document.createElement('script');
    script.src=src;
    script.setAttribute(marker,'1');
    script.async=false;
    if(done)script.addEventListener('load',done,{once:true});
    document.body.appendChild(script);
  }
  function load(){
    loadScript('/studielots-runtime.js?v=633','data-studielots-runtime',()=>{
      loadScript('/studielots-planner.js?v=635','data-studielots-shared-planner');
    });
  }
  if(document.readyState==='complete')load();else window.addEventListener('load',load,{once:true});
})();
