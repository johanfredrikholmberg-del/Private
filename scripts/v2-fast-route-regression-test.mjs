import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const code=fs.readFileSync(new URL('../v2-fast-route.js',import.meta.url),'utf8');
const offerings=[];
const fetch=async url=>({json:async()=>({offerings:offerings.filter(o=>String(url).includes(o.code))})});
class URLSearchParams { constructor(obj){this.obj=obj} toString(){return Object.entries(this.obj).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join('&')} }
const window={StudieLotsV2:{}};
vm.runInNewContext(code,{window,fetch,URLSearchParams,Date,console});
const fast=window.StudieLotsV2.fast;

assert.equal(fast.remaining({hp:7.5,credited:true}),0);
assert.equal(fast.remaining({hp:7.5,credited:false}),7.5);
assert.equal(fast.remaining({hp:15,creditedHp:7.5}),7.5);

const rows=[
 {code:'A',name:'A',hp:30,term:1,credited:true},
 {code:'B',name:'B',hp:15,term:2,prerequisiteCodes:['A']},
 {code:'C',name:'C',hp:15,term:2}
];
const base=await fast.build(rows,{maxHp:30,summer:false});
assert.equal(base.remainingHp,30);
assert.equal(base.terms.reduce((s,t)=>s+t.hp,0),30);
assert.ok(base.terms.every(t=>t.hp<=30));

const high=await fast.build(rows,{maxHp:60,summer:false});
assert.equal(high.maxHp,60);
assert.equal(high.remainingHp,30);
assert.ok(high.terms.every(t=>t.hp<=60));

// Unverified alternatives must never replace the required course.
const unsafe=[{code:'REQ',name:'Required',hp:7.5,term:1,alternatives:[{code:'ALT',name:'Alt',verified:false}]}];
offerings.push({code:'ALT',standaloneSearchable:true,url:'https://example.test/alt',startDate:'2030-01-15'});
const unsafeResult=await fast.build(unsafe,{maxHp:30,summer:false});
assert.equal(unsafeResult.terms[0].rows[0].code,'REQ');

// A summer offering is only placed in summer when summer optimization is enabled.
offerings.push({code:'SUM',standaloneSearchable:true,url:'https://example.test/sum',startDate:'2030-07-01'});
const summerRow=[{code:'SUM',name:'Summer',hp:7.5,term:1}];
const withSummer=await fast.build(summerRow,{maxHp:30,summer:true});
assert.ok(withSummer.terms.some(t=>t.kind==='summer'));
const withoutSummer=await fast.build(summerRow,{maxHp:30,summer:false});
assert.ok(withoutSummer.terms.every(t=>t.kind!=='summer'));

console.log('v2 fast-route regression: PASS');
