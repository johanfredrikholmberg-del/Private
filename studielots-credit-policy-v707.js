(()=>{
'use strict';
const SNAPSHOT_KEY='studielots_planner_snapshot';
const txt=v=>String(v??'').replace(/\s+/g,' ').trim();
const low=v=>txt(v).toLocaleLowerCase('sv-SE');
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const norm=v=>low(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9åäö]+/g,' ').trim();
const hp=r=>num(r?.hp??r?.credits??r?.ects??r?.points);
const name=r=>txt(r?.name??r?.courseName??r?.title??r?.course??'');
const institution=r=>txt(r?.university??r?.institution??r?.school??r?.provider??'');
const code=r=>txt(r?.code??r?.courseCode??r?.kod??'').toUpperCase();

function official(r){
  return !!(r && (
    r.completed===true || r.done===true ||
    r.officialCredit===true || r.officialDecisionApproved===true ||
    low(r.creditSource)==='official' || r.officialCreditHp>0 ||
    (r.creditDecision && r.creditDecision.approved===true)
  ));
}
function inferred(r){
  if(!r || official(r)) return false;
  const st=low(r.status||r.matchStatus), mt=low(r.matchType);
  return !!(
    r.potentialCredit===true || r.historicalEvidence===true || r.historicalApproval===true ||
    r.credited===true || r.isCredited===true || r.creditApproved===true ||
    num(r.matchedHp)>0 || num(r.creditedHp)>0 ||
    mt.includes('replace') || st.includes('tillgodo') || st==='credited'
  );
}
function potentialHp(r){return num(r?.potentialHp)||num(r?.matchedHp)||num(r?.creditedHp)||0}
function sanitizeRow(r){
  if(!r || typeof r!=='object' || official(r) || !inferred(r)) return r;
  const out={...r};
  out.potentialCredit=true;
  out.potentialHp=potentialHp(r);
  out.potentialReason=out.potentialReason||'StudieLots bedömer att tidigare studier kan motsvara kursen.';
  if(r.historicalApproval===true || r.historicalEvidence===true) out.historicalEvidence=true;
  out.__slOriginalCreditState=out.__slOriginalCreditState||{
    credited:r.credited,isCredited:r.isCredited,creditApproved:r.creditApproved,
    matchedHp:r.matchedHp,creditedHp:r.creditedHp,matchType:r.matchType,status:r.status,
    historicalApproval:r.historicalApproval
  };
  out.credited=false;
  out.isCredited=false;
  out.creditApproved=false;
  out.matchedHp=0;
  out.creditedHp=0;
  out.historicalApproval=false;
  out.matchType='potential';
  if(low(out.status).includes('tillgodo') || low(out.status)==='credited') out.status='remaining';
  return out;
}
function sanitizeRows(rows){return Array.isArray(rows)?rows.map(sanitizeRow):rows}
function sanitizeSnapshot(s){
  if(!s || typeof s!=='object') return s;
  const out={...s};
  ['rows','courses','plannerBaselineRows'].forEach(k=>{if(Array.isArray(out[k]))out[k]=sanitizeRows(out[k])});
  if(out.schedule && typeof out.schedule==='object'){
    out.schedule={...out.schedule};
    ['rows','courses','plannerBaselineRows'].forEach(k=>{if(Array.isArray(out.schedule[k]))out.schedule[k]=sanitizeRows(out.schedule[k])});
  }
  return out;
}
function normalizeHistorical(row){return {...row,sourceCourseNorm:norm(row.sourceCourse),sourceInstitutionNorm:norm(row.sourceInstitution),targetCourseNorm:norm(row.targetCourse),targetCodeNorm:code({code:row.targetCode})}}
function historicalRows(){const sets=window.StudieLotsHistoricalCredit||{};return Object.values(sets).flatMap(s=>Array.isArray(s?.rows)?s.rows:[]).map(normalizeHistorical)}
function exactHistoricalMatches(merit){
  const mn=norm(name(merit)),mi=norm(institution(merit)),mh=hp(merit),mc=code(merit);
  if(!mn&&!mc)return[];
  return historicalRows().filter(h=>{
    if(low(h.outcome)!=='bifall')return false;
    const titleOk=mn&&h.sourceCourseNorm===mn;
    const hpOk=!mh||!num(h.sourceHp)||Math.abs(num(h.sourceHp)-mh)<0.01;
    const instOk=!mi||!h.sourceInstitutionNorm||h.sourceInstitutionNorm===mi||h.sourceInstitutionNorm.includes(mi)||mi.includes(h.sourceInstitutionNorm);
    const codeOk=mc&&(h.targetCodeNorm===mc||h.sourceCourseNorm===norm(mc));
    return(titleOk&&hpOk&&instOk)||codeOk;
  });
}
function attachHistoricalEvidence(row,merits){
  if(!row||official(row))return row;
  const list=Array.isArray(merits)?merits:[];let hits=[];
  for(const merit of list){hits=exactHistoricalMatches(merit);if(hits.length)break}
  if(!hits.length)return row;
  return sanitizeRow({...row,potentialCredit:true,historicalEvidence:true,potentialReason:'Liknande tillgodoräknande har tidigare beviljats. Detta är inte ett beslut för dig.',historicalDecisionIds:hits.map(h=>h.decisionId),historicalSources:['Karlstads universitet']});
}
function applyToLive(){
  try{
    const live=window.__studielotsLastProgramSchedule;
    if(live&&typeof live==='object')['rows','courses','plannerBaselineRows'].forEach(k=>{if(Array.isArray(live[k]))live[k]=sanitizeRows(live[k])});
    const raw=sessionStorage.getItem(SNAPSHOT_KEY);
    if(raw){const parsed=JSON.parse(raw),clean=sanitizeSnapshot(parsed),next=JSON.stringify(clean);if(next!==raw)sessionStorage.setItem(SNAPSHOT_KEY,next)}
  }catch(_){ }
}
function badgeText(r){if(!r?.potentialCredit)return'';return r.historicalEvidence?'Potentiellt tillgodoräknande · tidigare bifall finns':'Potentiellt tillgodoräknande'}
function installStyle(){
  if(document.getElementById('sl-credit-policy-style'))return;
  const s=document.createElement('style');s.id='sl-credit-policy-style';
  s.textContent='.sl-potential-credit-note{display:inline-flex;align-items:center;gap:4px;margin-top:4px;padding:3px 7px;border-radius:999px;background:#eef7f3;color:#176b5b;font-size:10px;font-weight:750}.sl-potential-credit-copy{margin-top:3px;font-size:10px;line-height:1.35;color:#69736e}';document.head.appendChild(s);
}
function annotateDom(){
  installStyle();let s=null;try{s=JSON.parse(sessionStorage.getItem(SNAPSHOT_KEY)||'null')}catch(_){}
  const rows=sanitizeRows(Array.isArray(s?.rows)?s.rows:Array.isArray(s?.courses)?s.courses:[]).filter(r=>r?.potentialCredit);if(!rows.length)return;
  const nodes=document.querySelectorAll('.sl635-course,.sl-planner-course,.planner-course,.course-row');
  nodes.forEach(node=>{
    if(node.querySelector('.sl-potential-credit-note'))return;
    const text=norm(node.textContent);const row=rows.find(r=>{const n=norm(name(r));return n&&text.includes(n)});if(!row)return;
    node.classList.remove('credited');const host=node.querySelector('.sl635-course-copy')||node;
    const note=document.createElement('div');note.className='sl-potential-credit-note';note.textContent=badgeText(row);host.appendChild(note);
    const copy=document.createElement('div');copy.className='sl-potential-credit-copy';copy.textContent=row.historicalEvidence?'Kursen ligger kvar att läsa tills du har ett eget beslut om tillgodoräknande.':'Kursen ligger kvar att läsa och räknas inte av från återstående hp.';host.appendChild(copy);
  });
}
function installStorageGuard(){
  if(window.__slCreditPolicyStorageGuard)return;window.__slCreditPolicyStorageGuard=true;
  const original=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){if(this===sessionStorage&&k===SNAPSHOT_KEY){try{v=JSON.stringify(sanitizeSnapshot(JSON.parse(v)))}catch(_){ }}return original.call(this,k,v)};
}
window.StudieLotsCreditPolicy={version:'707',official,inferred,sanitizeRow,sanitizeRows,sanitizeSnapshot,exactHistoricalMatches,attachHistoricalEvidence,badgeText,countOfficial:rows=>sanitizeRows(rows).filter(official).reduce((s,r)=>s+(num(r.officialCreditHp)||hp(r)),0),countPotential:rows=>sanitizeRows(rows).filter(r=>r?.potentialCredit).reduce((s,r)=>s+(num(r.potentialHp)||0),0)};
installStorageGuard();applyToLive();
['studielots:planner-snapshot','studielots:planner-baseline','studielots:screen-rendered','studielots:planner-open','studielots:historical-credit-loaded'].forEach(e=>window.addEventListener(e,()=>{applyToLive();setTimeout(annotateDom,0)}));
new MutationObserver(()=>requestAnimationFrame(annotateDom)).observe(document.documentElement,{childList:true,subtree:true});
window.dispatchEvent(new CustomEvent('studielots:credit-policy-ready',{detail:{version:'707'}}));
})();