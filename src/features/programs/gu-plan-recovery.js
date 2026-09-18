(()=>{'use strict';
// Narrow recovery for GU's existing, source-backed S1EKA plan. The canonical
// HT26 structure remains authoritative whenever it is available.
const root=window.StudieLotsV2;
if(!root?.paths?.structure)return;
const original=root.paths.structure.bind(root.paths);
const norm=v=>String(v??'').trim().toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const isGuEconomics=p=>String(p?.programCode||p?.code||'').trim().toUpperCase()==='S1EKA'&&/goteborgs universitet/.test(norm(p?.university));
async function structure(item,merits=[]){
 const canonical=await original(item,merits);
 if(canonical||!isGuEconomics(item))return canonical;
 const params=new URLSearchParams({university:'Göteborgs universitet',code:'S1EKA',name:item.programName||item.name||'Ekonomie kandidatprogram',subject:item.subject||'Företagsekonomi'});
 try{
  const response=await fetch('/api/program-structure-resolved?'+params,{headers:{accept:'application/json'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)return canonical;
  const plan=await response.json();
  if(plan?.source!=='gu-official-programplan'||plan.structureAvailable!==true||!Array.isArray(plan.courses)||plan.courses.length<2||Number(plan.totalHp)!==180||!Array.isArray(plan.sourceUrls)||!plan.sourceUrls.some(url=>/^https:\/\//i.test(String(url))))return canonical;
  const rows=root.paths.allocateProgrammeMatches(plan.courses,Array.isArray(merits)?merits:[],item.subject||'');
  return {item:{...item,structureCoverage:'complete',sourceEvidenceUrl:plan.sourceUrls[0]},source:plan.source,verified:true,sourceEvidenceUrl:plan.sourceUrls[0],rows,totalHp:180,creditedHp:rows.filter(r=>r.credited).reduce((sum,r)=>sum+Number(r.matchedHp||0),0),potentialHp:rows.filter(r=>r.creditMatch==='potential'||r.creditMatch==='partial').reduce((sum,r)=>sum+Number(r.matchedHp||0),0)};
 }catch(error){console.warn('[StudieLots GU plan recovery]',error);return canonical}
}
root.paths=Object.freeze({...root.paths,structure});
})();
