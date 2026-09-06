(()=>{
'use strict';
function load(src,done){const s=document.createElement('script');s.src=src;s.async=false;s.onload=()=>done&&done();s.onerror=()=>{console.error('StudieLots kunde inte ladda',src);done&&done()};document.body.appendChild(s)}
load('/studielots-v624.js?v=624',()=>
  load('/studielots-runtime-overlay-v706.js?v=706',()=>
    load('/studielots-auto-structure.js?v=701',()=>
      load('/studielots-official-source-v704.js?v=704',()=>
        load('/studielots-studies-compact-v707.js?v=707',()=>
          load('/studielots-planner-bridge-v708.js?v=708'))))));
})();
