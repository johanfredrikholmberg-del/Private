import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../src/features/fast-route/fast-route.js',import.meta.url),'utf8');
const window={StudieLotsV2:{}};
const now=new Date('2026-09-01T12:00:00Z');
const DateMock=class extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now.getTime()}};
const offerings=[
 {code:'A101',name:'Ordinarie kurs',hp:7.5,startDate:'2026-09-15',url:'https://example.se/a',distance:true,standaloneSearchable:true,university:'Distansuniversitetet'},
 {code:'B101',name:'Sommarkurs',hp:7.5,startDate:'2027-06-15',url:'https://example.se/b',distance:true,standaloneSearchable:true,university:'Distansuniversitetet'}
];
const fetch=async url=>{const u=String(url);if(u.includes('/api/susa-offerings'))return{json:async()=>({offerings})};if(u.includes('/api/distance-courses'))return{json:async()=>({courses:[]})};throw new Error('unexpected fetch '+u)};
const context=vm.createContext({window,console,fetch,URLSearchParams,AbortController,setTimeout,clearTimeout,Date:DateMock});
vm.runInContext(source,context,{filename:'fast-route.js'});
const fast=window.StudieLotsV2.fast;
const rows=[{code:'A101',name:'Ordinarie kurs',hp:7.5,term:1},{code:'B101',name:'Sommarkurs',hp:7.5,term:2}];
const withSummer=await fast.build(rows,{summer:true,maxHp:30,university:'Göteborgs universitet'});
assert.equal(withSummer.scheduledHp,15);
assert.ok(withSummer.terms.some(t=>t.kind==='summer'));
const withoutSummer=await fast.build(rows,{summer:false,maxHp:30,university:'Göteborgs universitet'});
assert.equal(withoutSummer.scheduledHp,7.5);
assert.ok(!withoutSummer.terms.some(t=>t.kind==='summer'));
assert.equal(withoutSummer.unscheduled.length,1);
console.log('v2 fast-route regression: PASS');
