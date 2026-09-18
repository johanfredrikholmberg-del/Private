(()=>{'use strict';
// GU S1EKA recovery is a fallback, not a second programme catalogue.
const root=window.StudieLotsV2;
if(!root?.paths?.structure||!root.paths.discover)return;
const originalStructure=root.paths.structure.bind(root.paths);
const originalDiscover=root.paths.discover.bind(root.paths);
const norm=v=>String(v??'').trim().toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const isGuEconomics=p=>String(p?.programCode||p?.code||'').trim().toUpperCase()==='S1EKA'&&/goteborgs universitet/.test(norm(p?.university));
const evidence='https://www.gu.se/studera/hitta-utbildning/ekonomie-kandidatprogram-s1eka/utbildningsplan/44344fc0-834b-11f0-9c7b-35519b7c45bb';
let recoveryPromise;
function fetchRecovery(){
 if(!recoveryPromise)recoveryPromise=(async()=>{
  try{
   const params=new URLSearchParams({university:'Göteborgs universitet',code:'S1EKA',name:'Ekonomie kandidatprogram',subject:'Företagsekonomi'});
   const response=await fetch('/api/program-structure-resolved?'+params,{headers:{accept:'application/json'},signal:AbortSignal.timeout(15000)});
   if(!response.ok)return null;
   const plan=await response.json();
   return plan?.source==='gu-official-programplan'&&plan.structureAvailable===true&&Array.isArray(plan.courses)&&plan.courses.length>=2&&Number(plan.totalHp)===180&&Array.isArray(plan.sourceUrls)&&plan.sourceUrls.some(url=>/^https:\/\//i.test(String(url)))?plan:null;
  }catch(error){console.warn('[StudieLots GU plan recovery]',error);return null}
 })().then(plan=>{if(!plan)recoveryPromise=null;return plan});
 return recoveryPromise;
}
async function discover(subject,kind='candidate'){
 const programs=await originalDiscover(subject,kind);
 if(!Array.isArray(programs)||!programs.some(p=>isGuEconomics(p)&&p.structureCoverage!=='complete'))return programs;
 const plan=await fetchRecovery();
 if(!plan)return programs;
 const updated=programs.map(p=>isGuEconomics(p)&&p.structureCoverage!=='complete'?{...p,structureCoverage:'complete',effectiveStructureCoverage:'complete',plannerCoverage:'complete',verified:true,sourceEvidenceUrl:plan.sourceUrls[0]||evidence,recoverySource:plan.source}:p);
 if(programs.meta)updated.meta=programs.meta;
 return updated;
}
async function structure(item,merits=[]){
 let canonical=null;
 try{canonical=await originalStructure(item,merits)}catch(error){if(!isGuEconomics(item))throw error;console.warn('[StudieLots GU canonical structure]',error)}
 if(canonical||!isGuEconomics(item))return canonical;
 const plan=await fetchRecovery();
 if(!plan)return canonical;
 const rows=root.paths.allocateProgrammeMatches(plan.courses,Array.isArray(merits)?merits:[],item.subject||'');
 return {item:{...item,structureCoverage:'complete',sourceEvidenceUrl:plan.sourceUrls[0]||evidence},source:plan.source,verified:true,sourceEvidenceUrl:plan.sourceUrls[0]||evidence,rows,totalHp:180,creditedHp:rows.filter(r=>r.credited).reduce((sum,r)=>sum+Number(r.matchedHp||0),0),potentialHp:rows.filter(r=>r.creditMatch==='potential'||r.creditMatch==='partial').reduce((sum,r)=>sum+Number(r.matchedHp||0),0)};
}
root.paths=Object.freeze({...root.paths,discover,structure});
})();
