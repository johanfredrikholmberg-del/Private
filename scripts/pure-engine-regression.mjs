import { readFile } from 'node:fs/promises';
const runtime=await readFile(new URL('../studielots-runtime-v625.js',import.meta.url),'utf8');
const engine=await readFile(new URL('../studielots-engine-v1.js',import.meta.url),'utf8');
const owner=await readFile(new URL('../studielots-engine-owner-v722.js',import.meta.url),'utf8');
function assert(ok,msg){if(!ok){console.error('FAIL:',msg);process.exitCode=1}else console.log('OK:',msg)}
const pureAt=runtime.indexOf('studielots-engine-v1.js');
const ownerAt=runtime.indexOf('studielots-engine-owner-v722.js');
assert(pureAt>=0,'pure engine is loaded');
assert(ownerAt>pureAt,'pure engine loads before engine owner');
assert(/summarizeCourses/.test(engine),'pure engine exposes shared hp summary');
assert(/degreeGaps/.test(engine),'pure engine exposes requirement gap calculation');
assert(/pureVersion/.test(owner),'engine owner exposes pure engine version');
assert(!/planner-ui-v647|planner-summary-v703|studielots-planner\.js\?v=690|planner-credit-visibility-v715/.test(runtime),'legacy planner renderers remain unloaded');
if(process.exitCode)process.exit(process.exitCode);
