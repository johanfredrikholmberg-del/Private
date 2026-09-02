(()=>{
  'use strict';
  function loadScript(src,marker){
    if(document.querySelector(`script[${marker}]`))return;
    const script=document.createElement('script');
    script.src=src;
    script.setAttribute(marker,'1');
    script.async=false;
    document.body.appendChild(script);
  }
  loadScript('/studielots-runtime.js?v=633','data-studielots-runtime');
  loadScript('/studielots-planner.js?v=635','data-studielots-shared-planner');
})();
