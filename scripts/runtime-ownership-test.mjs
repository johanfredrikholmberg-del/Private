import fs from 'node:fs';
const loader=fs.readFileSync('studielots-runtime-v625.js','utf8');
const renderer=fs.readFileSync('studielots-planner-v800.js','utf8');
const fast=fs.readFileSync('studielots-fast-route-v802.js','utf8');
const overlay=fs.readFileSync('studielots-runtime-overlay-v707.js','utf8');
const required=['studielots-planner-controller-v721.js?v=721','studielots-planner-v800.js?v=800','studielots-fast-route-v802.js?v=802'];
const forbidden=['studielots-fast-route-v801.js','studielots-planner-runtime-v716.js','studielots-planner-ui-v647.js','studielots-planner-summary-v703.js','studielots-planner.js?v=690','studielots-planner-credit-visibility-v715.js','studielots-planner-handoff-v710.js','studielots-flow-v713.js','studielots-runtime-overlay-v706.js'];
for(const f of required){if(!loader.includes(f))throw new Error(`Missing active planner owner: ${f}`)}
for(const f of forbidden){if(loader.includes(f))throw new Error(`Legacy planner module is active again: ${f}`)}
if((loader.match(/studielots-planner-controller-v721\.js\?v=721/g)||[]).length!==1)throw new Error('Expected one planner controller');
if((loader.match(/studielots-planner-v800\.js\?v=800/g)||[]).length!==1)throw new Error('Expected one planner renderer');
if((loader.match(/studielots-fast-route-v802\.js\?v=802/g)||[]).length!==1)throw new Error('Expected one fast-route v802 engine');
if(!loader.includes("fastRoute:'fast-route-v802'"))throw new Error('Loader audit must identify fast-route v802');
if(!loader.includes("standaloneOfferingGate:true")||!loader.includes("standaloneRequiresApplicationUrl:true"))throw new Error('Standalone course safety markers missing');
if(!renderer.includes("const VERSION='800'"))throw new Error('Unexpected planner renderer version');
if(!renderer.includes("root.id='plannerV2Root'"))throw new Error('Planner v800 must own a dedicated root');
if(!fast.includes("const VERSION='802'"))throw new Error('Unexpected fast-route engine version');
if(!fast.includes("standaloneOnly:'true'"))throw new Error('Fast route must request standalone-only SUSA offerings');
if(!fast.includes('function standaloneFlag(o)'))throw new Error('Standalone offering gate missing');
if(!fast.includes('if(!standaloneFlag(o)||!o?.url)continue'))throw new Error('Remote offerings must have standalone evidence and application URL');
if(!fast.includes('a?.verified===true||a?.equivalent===true||a?.fulfillsRequirement===true||a?.accepted===true'))throw new Error('Alternatives must require verification/equivalence evidence');
const legacyTokens=['studielots-planner-ui-v647.js','studielots-planner-summary-v703.js','studielots-planner.js?v=690','studielots-planner-credit-visibility-v715.js'];
for(const f of legacyTokens){if(overlay.includes(f))throw new Error(`Runtime overlay can dynamically reload legacy planner: ${f}`)}
console.log('Planner ownership OK: v800 + fast-route v802; only separately searchable verified course offerings may accelerate the route.');
