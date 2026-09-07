(()=>{
'use strict';
const BASELINE='730';
const loaded=[];const failed=[];
function script(src,attrs={}){return new Promise(resolve=>{const existing=[...document.scripts].find(s=>s.getAttribute('src')===src||s.src.endsWith(src));if(existing){loaded.push(src);resolve(true);return}const s=document.createElement('script');s.src=src;s.async=false;Object.entries(attrs).forEach(([k,v])=>s.dataset[k]=v);s.onload=()=>{loaded.push(src);resolve(true)};s.onerror=()=>{failed.push(src);console.error('StudieLots kunde inte ladda',src);resolve(false)};document.body.appendChild(s)})}
function css(href){if(document.querySelector('link[data-studielots-responsive="706"]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href=href;l.dataset.studielotsResponsive='706';document.head.appendChild(l)}
async function boot(){
 await script('/studielots-screen-repair-v712.js?v=712',{studielotsScreenRepair:'712'});
 await script('/studielots-v624.js?v=624',{studielotsCore:'624'});
 css('/studielots-responsive-v706.css?v=707');
 await script('/studielots-master-selector-v684.js?v=684',{studielotsMasterSelector:'684'});
 await script('/studielots-runtime-overlay-v706.js?v=706',{studielotsOverlay:'706'});
 await script('/studielots-auto-structure.js?v=701',{studielotsAutoStructure:'701'});
 await script('/studielots-official-source-v704.js?v=704',{studielotsOfficialSource:'704'});
 await script('/studielots-university-paths-v720.js?v=720',{studielotsUniversityPaths:'720'});
 await script('/studielots-engine-v1.js?v=730',{studielotsPureEngine:'730'});
 await script('/studielots-engine-owner-v722.js?v=727',{studielotsEngineOwner:'727'});
 await script('/studielots-studies-compact-v707.js?v=716',{studielotsStudiesCompact:'716'});
 await script('/studielots-planner-controller-v721.js?v=721',{studielotsPlannerController:'721'});
 await script('/studielots-planner-runtime-v716.js?v=719',{studielotsPlannerRuntime:'719'});
 window.__studielotsBaseline={version:BASELINE,screenRepair:'712',core:'624',runtime:'706',responsive:'707',masterSelector:'684',autoStructure:'701',officialSource:'704',universityPaths:'720',pureEngine:'730',engineOwner:'727',studiesCompact:'716',plannerController:'721',plannerRuntime:'719',loaded:[...loaded],failed:[...failed]};
 window.__studielotsLoaderAudit={version:BASELINE,ok:failed.length===0,failed:[...failed],singleOwners:{degreeEngine:'engine-owner-727',pureEngine:'engine-v1-730',plannerRenderer:'planner-runtime-719',plannerHandoff:'planner-controller-721'},shadowMode:{degreeEngine:true,diagnostics:true,classified:true},engineFixes:{emptySubjectFalsePositive:true,progressionClassification:true,levelFieldProgression:true},removedLegacyPlannerModules:['planner-ui-700','planner-summary-703','planner-690','planner-credit-visibility-715','planner-handoff-720','flow-720']};
 window.dispatchEvent(new CustomEvent('studielots:baseline-ready',{detail:window.__studielotsBaseline}));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();