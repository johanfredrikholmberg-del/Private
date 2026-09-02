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
      if(document.querySelector('script[data-studielots-v632]'))return after632();
      const s632=document.createElement('script');
      s632.src='/studielots-runtime-v632.js?v=632';
      s632.dataset.studielotsV632='1';
      s632.async=false;
      s632.onload=after632;
      document.body.appendChild(s632);
    };
    const after632=()=>{
      if(document.querySelector('script[data-studielots-v630]'))return after630();
      const s630=document.createElement('script');
      s630.src='/studielots-runtime-v630.js?v=630';
      s630.dataset.studielotsV630='1';
      s630.async=false;
      s630.onload=after630;
      document.body.appendChild(s630);
    };
    const after630=()=>{
      if(document.querySelector('script[data-studielots-v631]'))return;
      const s631=document.createElement('script');
      s631.src='/studielots-runtime-v631.js?v=631';
      s631.dataset.studielotsV631='1';
      s631.async=false;
      document.body.appendChild(s631);
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
