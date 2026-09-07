import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync('studielots-fast-route-v802.js','utf8');
const storage=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};
const context={window:{},document:{readyState:'loading',addEventListener:()=>{}},sessionStorage:storage(),localStorage:storage(),console,URLSearchParams,fetch:async()=>({ok:true,json:async()=>({offerings:[]})}),MutationObserver:class{observe(){}},setTimeout:()=>0,clearTimeout:()=>{},CustomEvent:class{},Date};
context.window.addEventListener=()=>{};context.window.dispatchEvent=()=>{};
vm.createContext(context);vm.runInContext(source,context);
const e=context.window.__studielotsFastRoute;
assert.equal(e?.version,'802');
const row=(code,term,hp=7.5,extra={})=>({code,name:code,hp,__term:term,...extra});
const flat=r=>r.terms.flatMap((t,termIndex)=>t.rows.map(x=>({x,t,termIndex})));
const scheduledHp=r=>flat(r).reduce((s,v)=>s+Number(v.x.hp||0),0);
const assertCaps=(r,cap)=>r.terms.filter(t=>t.kind!=='summer').forEach(t=>assert.ok(t.hp<=cap+.001,`${t.label} exceeds ${cap} hp`));
const assertNoDuplicates=r=>{const codes=flat(r).map(v=>v.x.code).filter(Boolean);assert.equal(new Set(codes).size,codes.length,'course scheduled more than once')};

const scenarios=[];
scenarios.push(['empty',[],30,true]);
scenarios.push(['all credited',[row('A',1,30,{credited:true}),row('B',2,30,{completed:true})],30,true]);
scenarios.push(['partial credit',[row('A',1,15,{creditedHp:7.5}),row('B',1,15)],30,true]);
scenarios.push(['six ordinary terms',Array.from({length:24},(_,i)=>row(`O${i+1}`,Math.floor(i/4)+1,7.5)),30,true]);
scenarios.push(['late sparse course',[row('A',1),row('B',6)],30,true]);
scenarios.push(['prerequisite chain',[row('A',1),row('B',2,7.5,{prerequisiteCodes:['A']}),row('C',3,7.5,{prerequisiteCodes:['B']})],30,true]);
scenarios.push(['unverified alternatives',[row('A',3,7.5,{alternatives:[{code:'ALT',hp:7.5,verified:false}]})],30,true]);
scenarios.push(['advanced-looking metadata',[row('A1N',1,7.5,{level:'A1N'}),row('G2E',2,15,{level:'G2E'})],30,true]);
scenarios.push(['mixed institutions',[row('GU1',1,15,{institution:'GU'}),row('LU1',2,15,{institution:'LU'}),row('CTH1',3,15,{institution:'Chalmers'})],30,true]);
scenarios.push(['large 30hp',Array.from({length:16},(_,i)=>row(`L${i}`,1,7.5)),30,true]);
scenarios.push(['large 37.5hp',Array.from({length:16},(_,i)=>row(`M${i}`,1,7.5)),37.5,true]);
scenarios.push(['large 45hp',Array.from({length:16},(_,i)=>row(`N${i}`,1,7.5)),45,true]);
scenarios.push(['large 60hp',Array.from({length:16},(_,i)=>row(`P${i}`,1,7.5)),60,true]);
scenarios.push(['summer disabled',[row('A',1),row('B',2)],30,false]);
scenarios.push(['fractional hp',[row('A',1,6),row('B',1,9),row('C',2,12)],30,true]);
scenarios.push(['almost complete',[row('DONE1',1,30,{credited:true}),row('DONE2',2,30,{credited:true}),row('LAST',3,7.5)],30,true]);
scenarios.push(['zero hp ignored effectively',[row('ZERO',1,0),row('A',1,7.5)],30,true]);
scenarios.push(['duplicate prerequisite references',[row('A',1),row('B',2,7.5,{prerequisiteCodes:['A','A']})],30,true]);

for(const [name,rows,cap,summer] of scenarios){
 const before=JSON.stringify(rows);
 const result=e.build(rows,{startYear:2026},cap,summer);
 assert.equal(JSON.stringify(rows),before,`${name}: optimizer mutated ordinary rows`);
 assertCaps(result,cap);
 assertNoDuplicates(result);
 assert.ok(result.remainingHp>=0,`${name}: negative remaining hp`);
 assert.ok(result.savedHp>=0,`${name}: negative saved hp`);
 assert.ok(scheduledHp(result)<=result.remainingHp+.001,`${name}: scheduled more hp than remaining`);
 if(!summer)assert.equal(result.terms.some(t=>t.kind==='summer'),false,`${name}: summer term created while disabled`);
}

// Critical invariant: without a standalone offering, a late program course cannot jump into an earlier ordinary slot.
{
 const rows=[row('T1',1,7.5),row('T4',4,7.5)];
 const result=e.build(rows,{startYear:2026},60,true);
 const p=flat(result).find(v=>v.x.code==='T4');
 assert.ok(p,'late course scheduled');
 assert.ok(p.termIndex>=1,'late course illegally accelerated without standalone evidence');
}

console.log(`PASS planner scenario stress suite (${scenarios.length+1} scenarios)`);
