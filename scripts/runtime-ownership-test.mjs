import fs from 'node:fs';
const loader=fs.readFileSync('studielots-runtime-v625.js','utf8');
const renderer=fs.readFileSync('studielots-planner-v800.js','utf8');
const fast=fs.readFileSync('studielots-fast-route-v801.js','utf8');
const overlay=fs.readFileSync('studielots-runtime-overlay-v707.js','utf8');
const required=['studielots-planner-controller-v721.js?v=721','studielots-planner-v800.js?v=800','studielots-fast-route-v801.js?v=801'];
const forbidden=['studielots-planner-runtime-v716.js','studielots-planner-ui-v647.js','studielots-planner-summary-v703.js','studielots-planner.js?v=690','studielots-planner-credit-visibility-v715.js','studielots-planner-handoff-v710.js','studielots-flow-v713.js','studielots-runtime-overlay-v706.js'];
for(const f of required){if(!loader.includes(f))throw new Error(`Missing active planner owner: ${f}`)}
for(const f of forbidden){if(loader.includes(f))throw new Error(`Legacy planner module is active again: ${f}`)}
const controllerCount=(loader.match(/studielots-planner-controller-v721\.js\?v=721/g)||[]).length;
const rendererCount=(loader.match(/studielots-planner-v800\.js\?v=800/g)||[]).length;
const fastCount=(loader.match(/studielots-fast-route-v801\.js\?v=801/g)||[]).length;
if(controllerCount!==1)throw new Error(`Expected one planner controller, found ${controllerCount}`);
if(rendererCount!==1)throw new Error(`Expected one planner v800 renderer, found ${rendererCount}`);
if(fastCount!==1)throw new Error(`Expected one fast-route engine, found ${fastCount}`);
if(!loader.includes("plannerRenderer:'planner-v800'"))throw new Error('Loader audit must identify planner v800 as sole renderer');
if(!loader.includes("fastRoute:'fast-route-v801'"))throw new Error('Loader audit must identify fast-route v801');
if(!loader.includes("partialCreditAware:true")||!loader.includes("prerequisiteAwareWhenProvided:true")||!loader.includes("verifiedAlternativeOnly:true"))throw new Error('Fast-route safety markers missing');
if(!renderer.includes("const VERSION='800'"))throw new Error('Unexpected planner renderer version');
if(!renderer.includes("root.id='plannerV2Root'"))throw new Error('Planner v800 must own a dedicated root');
if(!renderer.includes("page.style.display='none'"))throw new Error('Legacy planner page must stay hidden');
if(!fast.includes("const VERSION='801'"))throw new Error('Unexpected fast-route engine version');
if(!fast.includes('const remainingHp=r=>Math.max(0,hp(r)-creditedHp(r))'))throw new Error('Fast route must account for partial credit');
if(!fast.includes('function prereqCodes(r)'))throw new Error('Fast route prerequisite handling missing');
if(!fast.includes('a?.verified===true||a?.equivalent===true||a?.fulfillsRequirement===true||a?.accepted===true'))throw new Error('Alternatives must require explicit verification/equivalence evidence');
const legacyTokens=['studielots-planner-ui-v647.js','studielots-planner-summary-v703.js','studielots-planner.js?v=690','studielots-planner-credit-visibility-v715.js'];
for(const f of legacyTokens){if(overlay.includes(f))throw new Error(`Runtime overlay can dynamically reload legacy planner: ${f}`)}
console.log('Planner ownership OK: v800 renderer + v801 fast-route engine; legacy renderers blocked.');
