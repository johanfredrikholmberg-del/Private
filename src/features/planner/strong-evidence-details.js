(()=>{'use strict';
// Progressive enhancement of the ordinary locked study plan. Never invent course content.
const root=window.StudieLotsV2;
if(!root||root.__strongEvidenceDetails)return;
root.__strongEvidenceDetails=true;
const host=()=>document.querySelector('#ordinaryPlan');
const hp=v=>{const n=Number(v);return Number.isFinite(n)&&n>=0?n:null};
const format=v=>Number(v).toLocaleString('sv-SE',{maximumFractionDigits:2});
const text=(v)=>String(v??'').trim();
function overlap(t){
 const e=t?.evidence||{};
 // Only structured, explicitly evidenced matching topics may be presented as exact overlap.
 const values=e.matchingTopics??e.overlappingTopics??e.matchedLearningOutcomes??t?.matchingTopics;
 if(!Array.isArray(values))return [];
 return [...new Set(values.map(v=>typeof v==='string'?text(v):text(v?.label??v?.name)).filter(Boolean))].slice(0,8);
}
function bullet(list,label,value){const li=document.createElement('li'),strong=document.createElement('strong');strong.textContent=label+' ';li.append(strong,document.createTextNode(value));list.append(li)}
function enhance(){
 const el=host(),data=root.appContext?.state?.plannerData;
 if(!el||!Array.isArray(data?.rows))return;
 const groups=new Map();
 for(const row of data.rows){const term=Number(row.term)||1;if(!groups.has(term))groups.set(term,[]);groups.get(term).push(row)}
 const ordered=[...groups].sort((a,b)=>a[0]-b[0]).flatMap(([,rows])=>rows);
 el.querySelectorAll('.course').forEach((node,i)=>{
  if(node.dataset.evidenceDetails==='1')return;
  const row=ordered[i],assessment=row?.creditTransfer;
  if(!row||!assessment||assessment.classification!=='strong'||!row.creditTransferCountsInStudyPlan)return;
  node.dataset.evidenceDetails='1';
  const status=node.querySelector('.status');
  if(status){status.textContent='✓ Starkt underlag';status.classList.remove('potential','remain');status.classList.add('strong-evidence-status')}
  const details=document.createElement('details');details.className='strong-evidence-details';
  const summary=document.createElement('summary');summary.textContent='Varför starkt underlag?';details.append(summary);
  const list=document.createElement('ul');
  const topics=overlap(assessment);
  bullet(list,'Matchande kursinnehåll:',topics.length?topics.join(', '):'Exakta överlappande kursmoment kan ännu inte fastställas från tillgängliga kursplaner.');
  const sourceHp=hp(assessment.evidence?.sourceHp),targetHp=hp(assessment.evidence?.targetHp),matchedHp=hp(row.creditTransferMatchedHp);
  bullet(list,'Omfattning:',sourceHp!==null&&targetHp!==null&&matchedHp!==null?`Tidigare kurs ${format(sourceHp)} hp, aktuell kurs ${format(targetHp)} hp; preliminärt matchade ${format(matchedHp)} hp.`:'Fullständiga uppgifter om omfattning saknas.');
  const historical=assessment.evidence?.historical||{};
  const count=hp(historical.verifiedApprovalCount);
  bullet(list,'Historiska bifall:',count!==null?`${format(count)} st`:'Uppgift saknas');
  details.append(list);
  const note=document.createElement('small');note.textContent='Starkt underlag är StudieLots preliminära bedömning. Lärosätet beslutar om tillgodoräknande.';details.append(note);
  node.append(details);
 });
}
const observer=new MutationObserver(()=>enhance());
function start(){const el=host();if(!el)return false;observer.observe(el,{childList:true,subtree:true});enhance();return true}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
