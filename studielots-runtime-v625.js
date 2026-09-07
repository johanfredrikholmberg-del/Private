(()=>{
'use strict';
const BASELINE='718';
const loaded=[];const failed=[];
function script(src,attrs={}){return new Promise(resolve=>{const existing=[...document.scripts].find(s=>s.getAttribute('src')===src||s.src.endsWith(src));if(existing){loaded.push(src);resolve(true);return}const s=document.createElement('script');s.src=src;s.async=false;Object.entries(attrs).forEach(([k,v])=>s.dataset[k]=v);s.onload=()=>{loaded.push(src);resolve(true)};s.onerror=()=>{failed.push(src);console.error('StudieLots kunde inte ladda',src);resolve(false)};document.body.appendChild(s)})}
function css(href){if(document.querySelector('link[data-studielots-responsive="706"]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href=href;l.dataset.studielotsResponsive='706';document.head.appendChild(l)}
async function boot(){
 await script('/studielots-screen-repair-v712.js?v=712',{studielotsScreenRepair:'712'});
 await script('/studielots-v624.js?v=624',{studielotsCore:'624'});
 css('/studielots-responsive-v706.css?v=707');
 await script('/studielots-planner-ui-v647.js?v=700',{studielotsPlannerUi:'700'});
 await script('/studielots-master-selector-v684.js?v=684',{studielotsMasterSelector:'684'});
 await script('/studielots-planner-summary-v703.js?v=703',{studielotsPlannerSummary:'703'});
 await script('/studielots-runtime-overlay-v706.js?v=706',{studielotsOverlay:'706'});
 await script('/studielots-auto-structure.js?v=701',{studielotsAutoStructure:'701'});
 await script('/studielots-official-source-v704.js?v=704',{studielotsOfficialSource:'704'});
 await script('/studielots-studies-compact-v707.js?v=716',{studielotsStudiesCompact:'716'});
 await script('/studielots-planner.js?v=690',{studielotsPlanner:'690'});
 await script('/studielots-planner-handoff-v710.js?v=711',{studielotsPlannerHandoff:'711'});
 await script('/studielots-flow-v713.js?v=718',{studielotsFlow:'718'});
 await script('/studielots-planner-credit-visibility-v715.js?v=715',{studielotsPlannerCreditVisibility:'715'});
 await script('/studielots-planner-runtime-v716.js?v=718',{studielotsPlannerRuntime:'718'});
 window.__studielotsBaseline={version:BASELINE,screenRepair:'712',core:'624',runtime:'706',responsive:'707',plannerUi:'700',masterSelector:'684',plannerSummary:'703',autoStructure:'701',officialSource:'704',studiesCompact:'716',planner:'690',plannerHandoff:'711',flow:'718',plannerCreditVisibility:'715',plannerRuntime:'718',loaded:[...loaded],failed:[...failed]};
 window.__studielotsLoaderAudit={version:BASELINE,ok:failed.length===0,failed:[...failed],expected:['screen-repair-712','core-624','responsive-707','planner-ui-700','master-selector-684','planner-summary-703','runtime-overlay-706','auto-structure-701','official-source-704','studies-compact-716','planner-690','planner-handoff-711','flow-718','planner-credit-visibility-715','planner-runtime-718']};
 window.dispatchEvent(new CustomEvent('studielots:baseline-ready',{detail:window.__studielotsBaseline}));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();