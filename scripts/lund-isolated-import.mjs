#!/usr/bin/env node
// Lund-only staging import. Never writes shared SUSA or canonical HT26 files.
import fs from 'node:fs/promises';
const dir='data/lund';
const read=async(p,fallback)=>{try{return JSON.parse(await fs.readFile(p,'utf8'))}catch(e){if(e.code==='ENOENT')return fallback;throw e}};
const norm=x=>String(x||'').toLocaleLowerCase('sv-SE');
const queue=(await read('data/susa/structure-queue.json',[])).filter(x=>norm(x.university).includes('lunds universitet'));
if(!queue.length)throw Error('No Lund programmes in SUSA queue');
await fs.mkdir(dir,{recursive:true});
const previous=await read(`${dir}/structures.json`,[]);
const done=new Map(previous.map(x=>[x.key,x]));
const pending=queue.filter(x=>!done.has(x.key)||['metadata-only','manual-review'].includes(done.get(x.key)?.coverage));
const limit=Math.max(1,Number(process.env.LUND_LIMIT||100));
const concurrency=Math.max(1,Math.min(12,Number(process.env.LUND_CONCURRENCY||6)));
const selected=pending.slice(0,limit);
const results=new Array(selected.length);let next=0;
async function worker(){for(;;){const i=next++;if(i>=selected.length)return;const x=selected[i];let result={...x,status:'manual-review',coverage:'metadata-only',reason:'not-verified',checkedAt:new Date().toISOString()};try{const u=new URL('/api/program-structure-resolved',process.env.STRUCTURE_API_BASE||'https://private-two-gamma.vercel.app');u.searchParams.set('code',x.programCode||'');u.searchParams.set('name',x.programName||'');u.searchParams.set('university',x.university||'');if(x.subject)u.searchParams.set('subject',x.subject);const response=await fetch(u,{signal:AbortSignal.timeout(12000),headers:{accept:'application/json'}});if(!response.ok)throw Error(`HTTP ${response.status}`);const data=await response.json();const rows=(Array.isArray(data.courses)?data.courses:[]).map(r=>({term:Number(r.term??r.__slOriginalTerm)||null,code:String(r.code||''),name:String(r.name||''),hp:Number(r.hp)||0,type:/elective|choice/i.test(String(r.category||r.type||r.slotType||''))?'choice':'required',isSlot:Boolean(r.isSlot)})).filter(r=>r.name&&r.hp>0&&Number.isInteger(r.term)&&r.term>0);if(data.found===true&&data.structureAvailable===true&&rows.length>=2){const sums=new Map();for(const r of rows)sums.set(r.term,(sums.get(r.term)||0)+r.hp);const expected=Number(x.hp||data.totalHp)/30;const complete=Number.isInteger(expected)&&sums.size===expected&&Array.from({length:expected},(_,i)=>Math.abs((sums.get(i+1)||0)-30)<.01).every(Boolean);const over=[...sums.values()].some(v=>v>30.01);const choice=rows.some(r=>r.type==='choice'||r.isSlot);result={...x,status:'processed',coverage:over?'manual-review':complete?(choice?'choice-required':'complete'):'partial-structure',reason:over?'term-over-30hp':complete?'all-terms-30hp':'incomplete-term-coverage',rows,source:data.source||'studielots-program-structure-resolved',sourceUrls:data.sourceUrls||[],checkedAt:new Date().toISOString()}}else result.reason='api-no-verified-structure'}catch(e){result.reason='api-unavailable';result.error=String(e.message||e)}results[i]=result;console.log(`${i+1}/${selected.length} ${result.coverage} ${x.programCode||''}`)}}
await Promise.all(Array.from({length:Math.min(concurrency,selected.length)},worker));
for(const x of results)done.set(x.key,x);
const all=[...done.values()];const counts=all.reduce((a,x)=>(a[x.coverage]=(a[x.coverage]||0)+1,a),{});
const meta={university:'Lunds universitet',queue:queue.length,attempted:selected.length,processed:all.length,remaining:queue.filter(x=>!done.has(x.key)).length,counts,generatedAt:new Date().toISOString(),policy:'Staging only; no shared database writes; incomplete structures never promoted to complete.'};
await fs.writeFile(`${dir}/structures.json`,JSON.stringify(all,null,2)+'\n');await fs.writeFile(`${dir}/meta.json`,JSON.stringify(meta,null,2)+'\n');console.log(JSON.stringify(meta,null,2));