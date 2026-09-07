import fs from 'node:fs';
const loader=fs.readFileSync('studielots-runtime-v625.js','utf8');
const required=['studielots-planner-controller-v721.js','studielots-planner-runtime-v716.js'];
const forbidden=['studielots-planner-ui-v647.js','studielots-planner-summary-v703.js','studielots-planner.js?v=690','studielots-planner-credit-visibility-v715.js','studielots-planner-handoff-v710.js','studielots-flow-v713.js'];
for(const f of required){if(!loader.includes(f))throw new Error(`Missing active owner: ${f}`)}
for(const f of forbidden){if(loader.includes(f))throw new Error(`Legacy planner module is active again: ${f}`)}
const controllerCount=(loader.match(/studielots-planner-controller-v721\.js/g)||[]).length;
const rendererCount=(loader.match(/studielots-planner-runtime-v716\.js/g)||[]).length;
if(controllerCount!==1)throw new Error(`Expected one planner controller, found ${controllerCount}`);
if(rendererCount!==1)throw new Error(`Expected one planner renderer, found ${rendererCount}`);
console.log('Runtime ownership OK: one planner controller and one planner renderer.');
