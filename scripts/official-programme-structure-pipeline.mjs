#!/usr/bin/env node
/** StudieLots offline official programme structure enrichment.
 * Reads data/susa/structure-queue.json and fetches official programme pages in batches.
 * Conservative: only machine-verifies semester rows when their HP sums are internally consistent.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.env.STRUCTURE_ROOT||'data/susa';
const LIMIT=Number(process.env.STRUCTURE_LIMIT||250);
const CONCURRENCY=Number(process.env.STRUCTURE_CONCURRENCY||8);
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const hp=v=>{const m=clean(v).replace(',','.').match(/(\d+(?:\.\d+)?)\s*(?:hp|högskolepoäng)/i);return m?Number(m[1]):null};
const term=v=>{const m=clean(v).match(/(?:termin|term)\s*(\d{1,2})/i);return m?Number(m[1]):null};
const official=u=>/^https?:\/\//i.test(u)&&!/(antagning\.se|studera\.nu|skolverket\.se)/i.test(u);

async function getText(url){const r=await fetch(url,{headers:{accept:'text/html,application/xhtml+xml','user-agent':'StudieLots-structure-import/1.0'},redirect:'follow',signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return {url:r.url,text:await r.text()}}
function strip(html){return html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<br\s*\/?>/gi,'\n').replace(/<\/tr>|<\/li>|<\/p>|<\/h[1-6]>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\r/g,'').replace(/[ \t]+/g,' ')}
function parseRows(text){const lines=text.split('\n').map(clean).filter(Boolean);const rows=[];let currentTerm=null;for(const line of lines){const t=term(line);if(t&&t<=20){currentTerm=t;if(/^termin\s*\d+$/i.test(line))continue}const credits=hp(line);if(!credits||credits>60)continue;if(!currentTerm)continue;let name=line.replace(/(?:obligatorisk|valbar|valfri|mandatory|elective)/ig,' ').replace(/\d+(?:[,.]\d+)?\s*(?:hp|högskolepoäng).*/i,'').replace(/\s+/g,' ').trim();if(name.length<3)continue;rows.push({term:currentTerm,name,hp:credits,type:/valbar|valfri|elective/i.test(line)?'choice':(/obligatorisk|mandatory/i.test(line)?'required':'unknown')})}return rows}
function classify(rows,programmeHp){if(!rows.length)return {coverage:'metadata-only',reason:'no-semester-rows'};const sums=new Map();for(const r of rows)sums.set(r.term,(sums.get(r.term)||0)+r.hp);const terms=[...sums].sort((a,b)=>a[0]-b[0]);const expected=programmeHp&&programmeHp%30===0?programmeHp/30:null;const exact=terms.filter(([,s])=>Math.abs(s-30)<0.01).length;const over=terms.filter(([,s])=>s>30.01).length;const hasChoice=rows.some(r=>r.type==='choice');if(over)return {coverage:'manual-review',reason:'term-over-30hp',termSums:Object.fromEntries(terms)};if(expected&&terms.length===expected&&exact===expected)return {coverage:hasChoice?'choice-required':'complete',reason:'all-terms-30hp',termSums:Object.fromEntries(terms)};if(exact>=2)return {coverage:'partial-structure',reason:'some-complete-terms',termSums:Object.fromEntries(terms)};return {coverage:'manual-review',reason:'insufficient-consistency',termSums:Object.fromEntries(terms)}}
async function enrich(item){const urls=(item.officialUrls||[]).filter(official);for(const url of urls.slice(0,4)){try{const page=await getText(url);const rows=parseRows(strip(page.text));const c=classify(rows,Number(item.hp)||null);if(rows.length)return {...item,status:'processed',sourceUrl:page.url,rows,...c,checkedAt:new Date().toISOString()}}catch(e){/* try next official URL */}}return {...item,status:'manual-review',coverage:'metadata-only',reason:'official-page-not-parsed',checkedAt:new Date().toISOString()}}
async function pool(items){const out=new Array(items.length);let i=0;async function worker(){for(;;){const n=i++;if(n>=items.length)return;out[n]=await enrich(items[n]);console.log(`${n+1}/${items.length} ${out[n].coverage} ${items[n].university} ${items[n].programCode||''}`)}}await Promise.all(Array.from({length:Math.min(CONCURRENCY,items.length)},worker));return out}

async function main(){const queue=JSON.parse(await fs.readFile(path.join(ROOT,'structure-queue.json'),'utf8'));let previous=[];try{previous=JSON.parse(await fs.readFile(path.join(ROOT,'structures.json'),'utf8'))}catch{}const done=new Map(previous.map(x=>[x.key,x]));const pending=queue.filter(x=>!done.has(x.key)).slice(0,LIMIT);const fresh=await pool(pending);for(const x of fresh)done.set(x.key,x);const all=[...done.values()];const counts=all.reduce((a,x)=>(a[x.coverage]=(a[x.coverage]||0)+1,a),{});await fs.writeFile(path.join(ROOT,'structures.json'),JSON.stringify(all,null,2)+'\n');await fs.writeFile(path.join(ROOT,'structure-meta.json'),JSON.stringify({generatedAt:new Date().toISOString(),processed:all.length,remaining:Math.max(0,queue.length-all.length),counts},null,2)+'\n');console.log({processed:all.length,remaining:queue.length-all.length,counts})}
main().catch(e=>{console.error(e);process.exitCode=1});
