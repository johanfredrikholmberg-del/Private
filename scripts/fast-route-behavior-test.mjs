import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync('studielots-fast-route-v804.js','utf8');
const storage=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};
const document={
  readyState:'complete',
  head:{appendChild:()=>{}},
  createElement:()=>({id:'',textContent:'',dataset:{},appendChild:()=>{},insertAdjacentElement:()=>{},querySelector:()=>null}),
  getElementById:()=>null,
  addEventListener:()=>{}
};
const context={window:{},document,sessionStorage:storage(),localStorage:storage(),console,URLSearchParams,fetch:async()=>({ok:true,json:async()=>({offerings:[]})}),MutationObserver:class{observe(){}},setTimeout:()=>0,clearTimeout:()=>{},CustomEvent:class{},Date};
context.window.addEventListener=()=>{};context.window.dispatchEvent=()=>{};
vm.createContext(context);vm.runInContext(source,context);
const e=context.window.__studielotsFastRoute;
assert.equal(e?.version,'804');

const row=(code,term,hp=7.5,extra={})=>({code,name:code,hp,__term:term,...extra});
const flatten=result=>result.terms.flatMap((t,ti)=>t.rows.map(r=>({r,ti,term:t})));

// 1. No verified standalone offering: a course from ordinary term 3 must never be accelerated merely because earlier terms have capacity.
{
 const rows=[row('A',1,7.5),row('B',3,7.5)];
 const result=e.build(rows,{startYear:2026},30,true);
 const placed=flatten(result).find(x=>x.r.code==='B');
 assert.ok(placed,'B scheduled');
 assert.ok(placed.ti>=1,'B was not packed into the first available term without standalone evidence');
}

// 2. A verified standalone regular-term offering may accelerate a later programme course.
{
 const rows=[row('A',1,7.5),row('B',3,7.5,{offerings:[{startDate:'2026-09-01',standaloneSearchable:true,url:'https://example.test/b'}]})];
 const result=e.build(rows,{startYear:2026},30,true);
 const placed=flatten(result).find(x=>x.r.code==='B');
 assert.ok(placed,'B scheduled');
 assert.equal(placed.ti,0,'verified standalone offering should allow earlier placement');
}

// 3. Partially credited course only schedules remaining hp.
{
 const rows=[row('A',1,15,{creditedHp:7.5})];
 const result=e.build(rows,{startYear:2026},30,true);
 assert.equal(result.remainingHp,7.5);
 assert.equal(result.terms[0].hp,7.5);
}

// 4. Fully credited course disappears from future schedule.
{
 const rows=[row('A',1,15,{credited:true})];
 const result=e.build(rows,{startYear:2026},30,true);
 assert.equal(result.remainingHp,0);
 assert.equal(result.terms.length,0);
}

// 5. Regular-term caps are respected for every supported cap.
for(const cap of [30,37.5,45,60]){
 const rows=Array.from({length:10},(_,i)=>row(`C${i+1}`,1,7.5));
 const result=e.build(rows,{startYear:2026},cap,true);
 for(const t of result.terms.filter(t=>t.kind!=='summer')) assert.ok(t.hp<=cap+0.001,`term exceeds ${cap} hp`);
}

// 6. Unverified alternative is ignored.
{
 const rows=[row('A',2,7.5,{alternatives:[{code:'ALT',name:'Alt',hp:7.5,verified:false}]})];
 assert.equal(e.explicitAlternatives(rows[0]).length,0);
}

// 7. Verified/equivalent alternative is eligible for later offering verification.
{
 const rows=[row('A',2,7.5,{alternatives:[{code:'ALT',name:'Alt',hp:7.5,equivalent:true}]})];
 assert.equal(e.explicitAlternatives(rows[0]).length,1);
}

// 8. Prerequisite metadata is parsed and preserved as a scheduling constraint.
{
 const r=row('B',2,7.5,{prerequisiteCodes:['A']});
 assert.deepEqual(Array.from(e.prereqCodes(r)),['A']);
}

console.log('PASS fast-route v804 behavior regression suite');
