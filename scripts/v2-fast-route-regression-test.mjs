import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../src/features/fast-route/fast-route.js',import.meta.url),'utf8');
let now=Date.now();
const sandbox={window:{},console,Date,class extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}},URLSearchParams,AbortController,setTimeout,clearTimeout};
sandbox.fetch=async url=>{
 const u=String(url);
 if(u.includes('/api/susa-offerings'))return{json:async()=>({offerings:[
  {code:'FEK101',name:'Ordinarie kurs',hp:7.5,startDate:'2027-01-15',url:'https://example.org/spring',distance:true,standaloneSearchable:true},
  {code:'FEK102',name:'Sommarkurs',hp:7.5,startDate:'2027-06-15',url:'https://example.org/summer',distance:true,standaloneSearchable:true}
 ]})};
 if(u.includes('/api/distance-courses'))return{json:async()=>({courses:[]})};
 throw new Error('unexpected fetch '+u);
};
vm.createContext(sandbox);vm.runInContext(source,sandbox,{filename:'fast-route.js'});const fast=sandbox.window.StudieLotsV2.fast;
const rows=[{code:'FEK101',name:'Ordinarie kurs',hp:7.5,term:1},{code:'FEK102',name:'Sommarkurs',hp:7.5,term:2}];
const withSummer=await fast.build(rows,{summer:true,maxHp:30,university:'GU'});
assert.ok(withSummer.terms.some(t=>t.kind==='summer'));
const withoutSummer=await fast.build(rows,{summer:false,maxHp:30,university:'GU'});
assert.ok(!withoutSummer.terms.some(t=>t.kind==='summer'));
console.log('v2 fast-route regression: PASS');
