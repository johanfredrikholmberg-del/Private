import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync('studielots-fast-access-v805.js','utf8');
const store=new Map();
const sessionStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
let clickHandler=null;
let active=true;
const planner={id:'plannerClean'};
const fastButton={dataset:{view:'fast'}};
const document={
  readyState:'complete',
  querySelector:q=>q==='.screen.active'&&active?planner:null,
  querySelectorAll:q=>q==='.screen'?[planner]:[],
  addEventListener:(name,fn,capture)=>{if(name==='click'&&capture)clickHandler=fn}
};
const events=[];
const context={window:{},document,sessionStorage,console,CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},MutationObserver:class{observe(){}},setTimeout:fn=>{fn();return 0},clearTimeout:()=>{}};
context.window.addEventListener=()=>{};
context.window.dispatchEvent=e=>{events.push(e);return true};
context.window.__studielotsRenderSharedPlanner=()=>{};
vm.createContext(context); vm.runInContext(source,context);

assert.equal(context.window.__studielotsFastAccess?.version,'805');
assert.equal(typeof context.window.__studielotsRequestFastRouteAccess,'function');

// Initial planner entry must force ordinary view.
sessionStorage.setItem('studielots_planner_view_v800','fast');
context.window.__studielotsFastAccess.reset();
assert.equal(sessionStorage.getItem('studielots_planner_view_v800'),null);
assert.equal(context.window.__studielotsFastAccess.isRevealed(),false);

// Direct API request opens when no paywall gate blocks it.
assert.equal(context.window.__studielotsRequestFastRouteAccess({source:'test'}),true);
assert.equal(context.window.__studielotsFastAccess.isRevealed(),true);
assert.ok(events.some(e=>e.type==='studielots:fast-route-opened'));

// Reset and deny through future paywall hook.
context.window.__studielotsFastAccess.reset();
context.window.__studielotsFastRouteAccessGate=()=>false;
assert.equal(context.window.__studielotsRequestFastRouteAccess({source:'paywall-test'}),false);
assert.equal(context.window.__studielotsFastAccess.isRevealed(),false);
assert.ok(events.some(e=>e.type==='studielots:fast-route-locked'));

// A denied UI click must be prevented before planner's own click handler can switch view.
let prevented=false,stopped=false;
const evt={target:{closest:sel=>sel==='[data-view="fast"]'?fastButton:null},preventDefault:()=>{prevented=true},stopImmediatePropagation:()=>{stopped=true}};
clickHandler(evt);
assert.equal(prevented,true);
assert.equal(stopped,true);
assert.equal(context.window.__studielotsFastAccess.isRevealed(),false);

// Allowing the gate should reveal via click.
context.window.__studielotsFastRouteAccessGate=()=>true;
prevented=false;stopped=false;
clickHandler(evt);
assert.equal(prevented,false);
assert.equal(stopped,false);
assert.equal(context.window.__studielotsFastAccess.isRevealed(),true);

// Leaving and re-entering planner resets premium visibility.
active=false;
context.window.__studielotsFastAccess.reset();
assert.equal(context.window.__studielotsFastAccess.isRevealed(),false);

console.log('PASS fast-access v805 regression suite');
