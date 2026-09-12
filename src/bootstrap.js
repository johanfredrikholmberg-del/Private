(()=>{'use strict';
const groups=[
  {name:'pages',scripts:['/src/pages/registry.js?v=1','/src/pages/home/page.js?v=1','/src/pages/studies/page.js?v=1','/src/pages/opportunities/page.js?v=1','/src/pages/planner/page.js?v=1','/src/pages/programs/page.js?v=1','/src/pages/more/page.js?v=1','/src/pages/method/page.js?v=1']},
  {name:'app-context',scripts:['/src/app/context.js?v=1']},
  {name:'core',scripts:['/src/core/engine.js?v=3']},
  {name:'merit-import',scripts:['/src/features/merit-import/ladok-import.js?v=1']},
  {name:'degree-rules',scripts:['/src/core/degree-rules.js?v=2']},
  {name:'programs',scripts:['/src/features/programs/program-index.js?v=4','/src/features/programs/program-canonicalization.js?v=1','/src/features/programs/program-paths.js?v=9','/src/features/programs/kau-paths.js?v=1','/src/features/programs/discover-guard.js?v=1']},
  {name:'credit-transfer',scripts:['/src/features/credit-transfer/historical-credit.js?v=1','/src/features/credit-transfer/credit-allocation.js?v=2']},
  {name:'planner-view',scripts:['/src/features/planner/render.js?v=1']},
  {name:'fast-route',scripts:['/src/features/fast-route/fast-route.js?v=6','/src/features/fast-route/fast-guard.js?v=2','/src/features/fast-route/fast-preload.js?v=3']},
  {name:'program-ui',scripts:['/src/features/programs/programs.js?v=7']},
  {name:'app-shell',scripts:['/src/ui/app.js?v=17']},
  {name:'post-processing',scripts:['/src/core/match-consistency.js?v=2','/src/features/planner/planner-summary.js?v=4','/src/ui/loading-overlay.js?v=5','/src/features/credit-transfer/credit-labels.js?v=1','/src/ui/demo.js?v=4']}
];
function load(src){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=false;script.dataset.studielotsModule=src;script.onload=resolve;script.onerror=()=>reject(new Error(`Kunde inte ladda ${src}`));document.body.appendChild(script)})}
(async()=>{for(const group of groups){for(const src of group.scripts)await load(src);if(group.name==='pages')window.StudieLotsPages.mount(document.querySelector('.shell'))}document.documentElement.dataset.studielotsBoot='ready';window.dispatchEvent(new CustomEvent('studielots:ready'))})().catch(error=>{console.error('[StudieLots bootstrap]',error);document.documentElement.dataset.studielotsBoot='error';window.dispatchEvent(new CustomEvent('studielots:error',{detail:{message:error?.message||String(error)}}))});
})();
