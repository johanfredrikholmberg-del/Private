(()=>{
  'use strict';
  function load628(){
    if(document.querySelector('script[data-studielots-v628]'))return;
    const script627=document.createElement('script');
    script627.src='/studielots-runtime-v627.js?v=627';
    script627.dataset.studielotsV627='1';
    script627.async=false;
    script627.onload=()=>{
      if(document.querySelector('script[data-studielots-v628]'))return;
      const script628=document.createElement('script');
      script628.src='/studielots-runtime-v628.js?v=628';
      script628.dataset.studielotsV628='1';
      script628.async=false;
      document.body.appendChild(script628);
    };
    if(!document.querySelector('script[data-studielots-v627]'))document.body.appendChild(script627);
    else script627.onload();
  }
  if(document.readyState==='complete')load628();else window.addEventListener('load',load628,{once:true});
})();
