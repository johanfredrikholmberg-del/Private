import fs from 'node:fs';
const loader=fs.readFileSync('studielots-runtime-v625.js','utf8');
const renderer=fs.readFileSync('studielots-planner-v800.js','utf8');
const overlay=fs.readFileSync('studielots-runtime-overlay-v707.js','utf8');
const required=['studielots-planner-controller-v721.js?v=721','studielots-planner-v800.js?v=800'];
const forbidden=['studielots-planner-runtime-v716.js','studielots-planner-ui-v647.js','studielots-planner-summary-v703.js','studielots-planner.js?v=690','studielots-planner-credit-visibility-v715.js','studielots-planner-handoff-v710.js','studielots-flow-v713.js','studielots-runtime-overlay-v706.js'];
for(const f of required){if(!loader.includes(f))throw new Error(`Missing active planner owner: ${f}`)}
for(const f of forbidden){if(loader.includes(f))throw new Error(`Legacy planner module is active again: ${f}`)}
const controllerCount=(loader.match(/studielots-planner-controller-v721\.js\?v=721/g)||[]).length;
const rendererCount=(loader.match(/studielots-planner-v800\.js\?v=800/g)||[]).length;
if(controllerCount!==1)throw new Error(`Expected one planner controller, found ${controllerCount}`);
if(rendererCount!==1)throw new Error(`Expected one planner v800 renderer, found ${rendererCount}`);
if(!loader.includes("plannerRenderer:'planner-v800'"))throw new Error('Loader audit must identify planner v800 as sole renderer');
if(!loader.includes("isolatedRoot:true"))throw new Error('Planner audit must require isolated root');
if(!loader.includes("legacyPlannerVisible:false"))throw new Error('Planner audit must mark legacy planner as invisible');
if(!loader.includes("legacyPlannerUiLoaded:false")||!loader.includes("legacyPlannerSummaryLoaded:false"))throw new Error('Legacy planner UI/summary must be disabled');
if(!renderer.includes("const VERSION='800'"))throw new Error('Unexpected planner renderer version');
if(!renderer.includes("root.id='plannerV2Root'"))throw new Error('Planner v800 must own a dedicated root');
if(!renderer.includes("page.style.display='none'"))throw new Error('Legacy planner page must stay hidden');
if(!renderer.includes("const MAX_OPTIONS=[30,37.5,45,60]"))throw new Error('Fast route hp limits changed unexpectedly');
if(!renderer.includes("Number(localStorage.getItem(MAX_HP_KEY)||30)"))throw new Error('Fast route must default to 30 hp');
if(!renderer.includes("localStorage.getItem(SUMMER_KEY)!=='0'"))throw new Error('Summer courses must default to allowed');
const legacyTokens=['studielots-planner-ui-v647.js','studielots-planner-summary-v703.js','studielots-planner.js?v=690','studielots-planner-credit-visibility-v715.js'];
for(const f of legacyTokens){if(overlay.includes(f))throw new Error(`Runtime overlay can dynamically reload legacy planner: ${f}`)}
console.log('Planner ownership OK: v800 isolated renderer only; legacy planner renderers blocked.');
