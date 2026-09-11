(()=>{
'use strict';
const SNAPSHOT_KEY='studielots_planner_snapshot';
const txt=v=>String(v??'').replace(/\s+/g,' ').trim();
const low=v=>txt(v).toLocaleLowerCase('sv-SE');
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const norm=v=>low(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9åäö]+/g,' ').trim();
const hp=r=>num(r?.hp??r?.credits??r?.ects??r?.points);
const name=r=>txt(r?.name??r?.courseName??r?.title??r?.course??r?.label??'');
const institution=r=>txt(r?.university??r?.institution??r?.school??r?.provider??r?.institutionName??'');
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
  const st=low(r.status||r.matchStatus),mt=low(r.matchType);
  return !!(r.potentialCredit===true||r.historicalEvidence===true||r.historicalApproval===true||r.credited===true||r.isCredited===true||r.creditApproved===true||num(r.matchedHp)>0||num(r.creditedHp)>0||mt.includes('replace')||st.includes('tillgodo')||st==='credited');
}
function potentialHp(r){return num(r?.potentialHp)||num(r?.matchedHp)||num(r?.creditedHp)||0}
function sanitizeRow(r){
  if(!r||typeof r!=='object'||official(r)||!inferred(r))return r;
  const out={...r};
  out.potentialCredit=true;
  out.potentialHp=potentialHp(r);
  out.potentialReason=out.potentialReason||'StudieLots bedömer att tidigare studier kan motsvara kursen.';
  if(r.historicalApproval===true||r.historicalEvidence===true)out.historicalEvidence=true;
  out.__slOriginalCreditState=out.__slOriginalCreditState||{credited:r.credited,isCredited:r.isCredited,creditApproved:r.creditApproved,matchedHp:r.matchedHp,creditedHp:r.creditedHp,matchType:r.matchType,status:r.status,historicalApproval:r.historicalApproval};
  out.credited=false;out.isCredited=false;out.creditApproved=false;out.matchedHp=0;out.creditedHp=0;out.historicalApproval=false;out.matchType='potential';
  if(low(out.status).includes('tillgodo')||low(out.status)==='credited'||low(out.status)==='partial')out.status='remaining';
  return out;
}
function sanitizeRows(rows){return Array.isArray(rows)?rows.map(sanitizeRow):rows}
function normalizeHistorical(row){return {...row,sourceCourseNorm:norm(row.sourceCourse),sourceInstitutionNorm:norm(row.sourceInstitution),targetCourseNorm:norm(row.targetCourse),targetCodeNorm:code({code:row.targetCode})}}
function historicalRows(){const sets=window.StudieLotsHistoricalCredit||{};return Object.values(sets).flatMap(s=>Array.isArray(s?.rows)?s.rows:[]).map(normalizeHistorical)}
function sourceMatchesHistorical(merit,h){
  const mn=norm(name(merit)),mi=norm(institution(merit)),mh=hp(merit);
  if(!mn||h.sourceCourseNorm!==mn)return false;
  if(mh&&num(h.sourceHp)&&Math.abs(num(h.sourceHp)-mh)>=0.01)return false;
  if(mi&&h.sourceInstitutionNorm&&h.sourceInstitutionNorm!==mi&&!h.sourceInstitutionNorm.includes(mi)&&!mi.includes(h.sourceInstitutionNorm))return false;
  return true;
}
function targetMatchesHistorical(target,h){
  const tc=code(target),tn=norm(name(target));
  if(tc&&h.targetCodeNorm)return tc===h.targetCodeNorm;
  if(!tn)return false;
  const parts=txt(h.targetCourse).split(';').map(norm).filter(Boolean);
  return parts.some(p=>p===tn||(tn.length>=8&&p.length>=8&&(p.includes(tn)||tn.includes(p))));
}
function exactHistoricalMatches(merit,target){
  return historicalRows().filter(h=>low(h.outcome)==='bifall'&&sourceMatchesHistorical(merit,h)&&(!target||targetMatchesHistorical(target,h)));
}
function importedMerits(s){
  const out=[];const seen=new Set();
  const add=a=>{if(!Array.isArray(a))return;for(const r of a){if(!r||typeof r!=='object')continue;if(r.selected===false||r.duplicate===true)continue;const key=[norm(name(r)),hp(r),norm(institution(r))].join('|');if(!key||seen.has(key))continue;seen.add(key);out.push(r)}};
  ['merits','importedMerits','importedCourses','priorCourses','previousCourses','completedCourses','userCourses','studies','sourceCourses'].forEach(k=>add(s?.[k]));
  add(s?.import?.courses);add(s?.profile?.courses);add(s?.student?.courses);
  try{if(typeof importedCandidates!=='undefined')add(importedCandidates)}catch(_){ }
  add(window.importedCandidates);add(window.__studielotsImportedCourses);add(window.__studielotsMerits);
  return out;
}
function attachHistoricalEvidence(row,merits){
  if(!row||official(row))return row;
  const hits=[];
  for(const merit of Array.isArray(merits)?merits:[])hits.push(...exactHistoricalMatches(merit,row));
  if(!hits.length)return row;
  const unique=[...new Map(hits.map(h=>[h.decisionId,h])).values()];
  return sanitizeRow({...row,potentialCredit:true,potentialHp:num(row.potentialHp)||Math.min(hp(row),Math.max(...unique.map(h=>num(h.targetHp))))||0,historicalEvidence:true,potentialReason:'Liknande tillgodoräknande har tidigare beviljats. Detta är inte ett beslut för dig.',historicalDecisionIds:unique.map(h=>h.decisionId),historicalSources:['Karlstads universitet']});
}
function enrichRows(rows,merits){return Array.isArray(rows)?rows.map(r=>attachHistoricalEvidence(sanitizeRow(r),merits)):rows}
function sanitizeSnapshot(s){
  if(!s||typeof s!=='object')return s;
  const out={...s},merits=importedMerits(s);
  ['rows','courses','plannerBaselineRows'].forEach(k=>{if(Array.isArray(out[k]))out[k]=enrichRows(out[k],merits)});
  if(out.schedule&&typeof out.schedule==='object'){out.schedule={...out.schedule};['rows','courses','plannerBaselineRows'].forEach(k=>{if(Array.isArray(out.schedule[k]))out.schedule[k]=enrichRows(out.schedule[k],merits)})}
  const rows=Array.isArray(out.plannerBaselineRows)?out.plannerBaselineRows:Array.isArray(out.rows)?out.rows:Array.isArray(out.courses)?out.courses:[];
  if(rows.length){const total=num(out.totalHp)||rows.reduce((z,r)=>z+hp(r),0),officialHp=rows.filter(official).reduce((z,r)=>z+(num(r.officialCreditHp)||hp(r)),0);out.creditedHp=officialHp;out.remainingHp=Math.max(0,total-officialHp)}
  return out;
}
function applyToLive(){
  try{
    const raw=sessionStorage.getItem(SNAPSHOT_KEY),parsed=raw?JSON.parse(raw):null,merits=importedMerits(parsed||{});
    const live=window.__studielotsLastProgramSchedule;
    if(live&&typeof live==='object'){['rows','courses','plannerBaselineRows'].forEach(k=>{if(Array.isArray(live[k]))live[k]=enrichRows(live[k],merits)});const lr=Array.isArray(live.plannerBaselineRows)?live.plannerBaselineRows:Array.isArray(live.rows)?live.rows:[];if(lr.length){const total=num(live.totalHp)||lr.reduce((z,r)=>z+hp(r),0),officialHp=lr.filter(official).reduce((z,r)=>z+(num(r.officialCreditHp)||hp(r)),0);live.creditedHp=officialHp;live.remainingHp=Math.max(0,total-officialHp)}}
    if(raw){const clean=sanitizeSnapshot(parsed),next=JSON.stringify(clean);if(next!==raw)sessionStorage.setItem(SNAPSHOT_KEY,next)}
  }catch(_){ }
}
function badgeText(r){if(!r?.potentialCredit)return'';return r.historicalEvidence?'Potentiellt tillgodoräknande · tidigare bifall finns':'Potentiellt tillgodoräknande'}
function installStyle(){if(document.getElementById('sl-credit-policy-style'))return;const s=document.createElement('style');s.id='sl-credit-policy-style';s.textContent='.sl-potential-credit-note{display:inline-flex;align-items:center;gap:4px;margin-top:4px;padding:3px 7px;border-radius:999px;background:#eef7f3;color:#176b5b;font-size:10px;font-weight:750}.sl-potential-credit-copy{margin-top:3px;font-size:10px;line-height:1.35;color:#69736e}';document.head.appendChild(s)}
function annotateDom(){
  installStyle();let s=null;try{s=JSON.parse(sessionStorage.getItem(SNAPSHOT_KEY)||'null')}catch(_){}
  const rows=(Array.isArray(s?.plannerBaselineRows)?s.plannerBaselineRows:Array.isArray(s?.rows)?s.rows:Array.isArray(s?.courses)?s.courses:[]).filter(r=>r?.potentialCredit);if(!rows.length)return;
  const nodes=document.querySelectorAll('.sl635-course,.sl-planner-course,.planner-course,.course-row');
  nodes.forEach(node=>{const text=norm(node.textContent),row=rows.find(r=>{const n=norm(name(r));return n&&text.includes(n)});if(!row)return;node.classList.remove('credited');const host=node.querySelector('.sl635-course-copy')||node;let note=node.querySelector('.sl-potential-credit-note');if(!note){note=document.createElement('div');note.className='sl-potential-credit-note';host.appendChild(note)}note.textContent=badgeText(row);let copy=node.querySelector('.sl-potential-credit-copy');if(!copy){copy=document.createElement('div');copy.className='sl-potential-credit-copy';host.appendChild(copy)}copy.textContent=row.historicalEvidence?'Kursen ligger kvar att läsa tills du har ett eget beslut om tillgodoräknande.':'Kursen ligger kvar att läsa och räknas inte av från återstående hp.'});
}
function installStorageGuard(){if(window.__slCreditPolicyStorageGuard)return;window.__slCreditPolicyStorageGuard=true;const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(this===sessionStorage&&k===SNAPSHOT_KEY){try{v=JSON.stringify(sanitizeSnapshot(JSON.parse(v)))}catch(_){ }}return original.call(this,k,v)}}
window.StudieLotsCreditPolicy={version:'707',official,inferred,sanitizeRow,sanitizeRows,sanitizeSnapshot,importedMerits,exactHistoricalMatches,attachHistoricalEvidence,enrichRows,badgeText,countOfficial:rows=>sanitizeRows(rows).filter(official).reduce((s,r)=>s+(num(r.officialCreditHp)||hp(r)),0),countPotential:rows=>sanitizeRows(rows).filter(r=>r?.potentialCredit).reduce((s,r)=>s+(num(r.potentialHp)||0),0)};
installStorageGuard();applyToLive();
['studielots:planner-snapshot','studielots:planner-baseline','studielots:screen-rendered','studielots:planner-open','studielots:historical-credit-loaded'].forEach(e=>window.addEventListener(e,()=>{applyToLive();setTimeout(annotateDom,0)}));
new MutationObserver(()=>requestAnimationFrame(annotateDom)).observe(document.documentElement,{childList:true,subtree:true});
window.dispatchEvent(new CustomEvent('studielots:credit-policy-ready',{detail:{version:'707'}}));
})();