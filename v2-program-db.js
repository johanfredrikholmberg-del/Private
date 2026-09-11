(()=>{'use strict';
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
let promise=null,data=null;
function key(p){return `${norm(p?.university)}|${clean(p?.programCode).toUpperCase()}|${norm(p?.programName)}`}
async function load(){if(data)return data;if(promise)return promise;promise=fetch('/data/program-db.json',{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()}).then(d=>{data=d;return d}).finally(()=>{promise=null});return promise}
function same(a,b){const ac=clean(a?.programCode).toUpperCase(),bc=clean(b?.programCode).toUpperCase();if(ac&&bc&&ac===bc&&norm(a?.university)===norm(b?.university))return true;return key(a)===key(b)}
async function find(item){const d=await load();const rows=Array.isArray(d?.programs)?d.programs:[];return rows.find(p=>same(p,item))||null}
async function catalogue(){const d=await load();return (Array.isArray(d?.programs)?d.programs:[]).map(p=>({subject:p.subject||'Övrigt',university:p.university,programName:p.programName,programCode:p.programCode,programHp:p.programHp,level:p.level,structureCoverage:p.coverage==='complete'?'complete':'partial',effectiveStructureCoverage:p.coverage==='complete'?'complete':'partial',plannerCoverage:'complete',source:'studielots-program-db',dbVersion:p.validFrom||'',verified:p.verified===true}))}
async function structure(item){const p=await find(item);if(!p||!Array.isArray(p.rows)||p.rows.length<2)return null;const rows=p.rows.map((r,i)=>({...r,__slOriginalTerm:r.term,__slOriginalIndex:i,status:'remaining',credited:false,isCredited:false,programmeSource:'studielots-program-db'}));return{found:true,structureAvailable:true,courses:rows,program:{name:p.programName,code:p.programCode,university:p.university},source:'studielots-program-db',confidence:p.verified?'local-verified-version':'local-versioned',coverage:p.coverage,totalHp:Number(p.programHp)||rows.reduce((s,r)=>s+Number(r.hp||0),0),sourceUrls:p.sourceUrls||[],validFrom:p.validFrom||null,validTo:p.validTo||null,dbId:p.id||'',verified:p.verified===true}}
window.StudieLotsV2=window.StudieLotsV2||{};window.StudieLotsV2.programDB=Object.freeze({load,find,catalogue,structure});
})();
