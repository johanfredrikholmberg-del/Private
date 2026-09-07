import fs from 'node:fs';
const loader=fs.readFileSync('studielots-runtime-v625.js','utf8');
const renderer=fs.readFileSync('studielots-planner-runtime-v716.js','utf8');
const required=['studielots-planner-controller-v721.js?v=721','studielots-planner-runtime-v716.js?v=720'];
const forbidden=['studielots-planner-ui-v647.js','studielots-planner-summary-v703.js','studielots-planner.js?v=690','studielots-planner-credit-visibility-v715.js','studielots-planner-handoff-v710.js','studielots-flow-v713.js'];
for(const f of required){if(!loader.includes(f))throw new Error(`Missing active owner: ${f}`)}
for(const f of forbidden){if(loader.includes(f))throw new Error(`Legacy planner module is active again: ${f}`)}
const controllerCount=(loader.match(/studielots-planner-controller-v721\.js\?v=721/g)||[]).length;
const rendererCount=(loader.match(/studielots-planner-runtime-v716\.js\?v=720/g)||[]).length;
if(controllerCount!==1)throw new Error(`Expected one planner controller, found ${controllerCount}`);
if(rendererCount!==1)throw new Error(`Expected one planner renderer, found ${rendererCount}`);
if(!loader.includes("plannerRenderer:'planner-runtime-720'"))throw new Error('Loader audit must identify planner runtime 720 as sole renderer');
if(!loader.includes("legacyPlannerUiLoaded:false"))throw new Error('Loader audit must explicitly mark legacy planner UI as disabled');
if(!renderer.includes("plannerPresentation:'single-owner-v720'"))throw new Error('Planner renderer must expose single-owner presentation marker');
if(!renderer.includes('const done=base.filter(credited),future=base.filter(r=>!credited(r))'))throw new Error('Credited courses must remain separated from future study terms');
if(!renderer.includes('const ordinary=buildRows(future,30)'))throw new Error('Ordinary planner must be built from future courses at 30 hp pace');
if(renderer.includes('sl719'))throw new Error('Old sl719 planner presentation must not remain active in renderer source');
console.log('Runtime ownership OK: one planner controller, one v720 renderer, no legacy planner UI.');
