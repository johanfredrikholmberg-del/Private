import fs from 'node:fs';
const loader=fs.readFileSync('studielots-runtime-v625.js','utf8');
const renderer=fs.readFileSync('studielots-planner-v800.js','utf8');
const fast=fs.readFileSync('studielots-fast-route-v804.js','utf8');
const access=fs.readFileSync('studielots-fast-access-v805.js','utf8');
const overlay=fs.readFileSync('studielots-runtime-overlay-v707.js','utf8');
const required=['studielots-planner-controller-v721.js?v=721','studielots-planner-v800.js?v=800','studielots-fast-route-v804.js?v=804','studielots-fast-access-v805.js?v=805'];
const forbidden=['studielots-fast-route-v801.js','studielots-fast-route-v802.js?v=802','studielots-fast-access-v803.js?v=803','studielots-planner-runtime-v716.js','studielots-planner-ui-v647.js','studielots-planner-summary-v703.js','studielots-planner.js?v=690','studielots-planner-credit-visibility-v715.js','studielots-planner-handoff-v710.js','studielots-flow-v713.js','studielots-runtime-overlay-v706.js'];
for(const f of required){if(!loader.includes(f))throw new Error(`Missing active planner owner: ${f}`)}
for(const f of forbidden){if(loader.includes(f))throw new Error(`Legacy planner module is active again: ${f}`)}
if((loader.match(/studielots-planner-controller-v721\.js\?v=721/g)||[]).length!==1)throw new Error('Expected one planner controller');
if((loader.match(/studielots-planner-v800\.js\?v=800/g)||[]).length!==1)throw new Error('Expected one planner renderer');
if((loader.match(/studielots-fast-route-v804\.js\?v=804/g)||[]).length!==1)throw new Error('Expected one fast-route v804 engine');
if((loader.match(/studielots-fast-access-v805\.js\?v=805/g)||[]).length!==1)throw new Error('Expected one fast-access v805 gate');
if(!loader.includes("fastRoute:'fast-route-v804'"))throw new Error('Loader audit must identify fast-route v804');
if(!loader.includes("fastRouteAccess:'fast-access-v805'"))throw new Error('Loader audit must identify fast-access v805');
if(!loader.includes('standaloneOfferingGate:true')||!loader.includes('standaloneRequiresApplicationUrl:true')||!loader.includes('verifiedStandaloneCanAccelerate:true'))throw new Error('Standalone course safety/acceleration markers missing');
if(!loader.includes('fastHiddenUntilClick:true')||!loader.includes('fastResetOnPlannerEntry:true')||!loader.includes('paywallBoundaryApi:true'))throw new Error('Fast route click/paywall boundary markers missing');
if(!renderer.includes("const VERSION='800'"))throw new Error('Unexpected planner renderer version');
if(!renderer.includes("root.id='plannerV2Root'"))throw new Error('Planner v800 must own a dedicated root');
if(!fast.includes("const VERSION='804'"))throw new Error('Unexpected fast-route engine version');
if(!fast.includes("standaloneOnly:'true'"))throw new Error('Fast route must request standalone-only SUSA offerings');
if(!fast.includes('function standaloneFlag(o)'))throw new Error('Standalone offering gate missing');
if(!fast.includes('if(!standaloneFlag(o)||!o?.url)continue'))throw new Error('Remote offerings must have standalone evidence and application URL');
if(!fast.includes('a?.verified===true||a?.equivalent===true||a?.fulfillsRequirement===true||a?.accepted===true'))throw new Error('Alternatives must require verification/equivalence evidence');
if(!fast.includes('min=Math.max(prereqMin,idx)'))throw new Error('Verified standalone offering must be able to lower the ordinary-term minimum while respecting prerequisites');
if(!access.includes("const VERSION='805'"))throw new Error('Unexpected fast access version');
if(!access.includes('window.__studielotsRequestFastRouteAccess=requestFastRouteAccess'))throw new Error('Fast-route access boundary API missing');
if(!access.includes("sessionStorage.removeItem(VIEW_KEY)"))throw new Error('Fast route must reset on planner entry');
if(!access.includes("e.stopImmediatePropagation()"))throw new Error('Denied fast-route click must be stopped before planner renderer handles it');
const legacyTokens=['studielots-planner-ui-v647.js','studielots-planner-summary-v703.js','studielots-planner.js?v=690','studielots-planner-credit-visibility-v715.js'];
for(const f of legacyTokens){if(overlay.includes(f))throw new Error(`Runtime overlay can dynamically reload legacy planner: ${f}`)}
console.log('Planner ownership OK: v800 + fast-route v804 + fast-access v805; premium-capable click boundary is isolated and guarded.');
