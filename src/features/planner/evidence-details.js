(()=>{'use strict';
const root=window.StudieLotsV2,planner=root?.planner,state=root?.appContext?.state;
if(!planner||!state||planner.__evidenceDetails)return;
const number=v=>{const n=Number(v);return Number.isFinite(n)?Math.max(0,n):0};
const fmt=v=>number(v).toLocaleString('sv-SE',{maximumFractionDigits:2});
const text=v=>String(v??'').trim();
const unique=v=>[...new Set(v.filter(Boolean))];
function overlap(r){
 const e=r?.creditTransfer?.evidence||{};
 // Only explicitly supplied, source-backed shared course elements may be described as exact overlaps.
 const raw=e.matchingLearningOutcomes??e.sharedLearningOutcomes??e.matchingCourseContent??e.sharedCourseContent??r?.verifiedMatchingContent;
 return unique((Array.isArray(raw)?raw:[]).map(x=>typeof x==='string'?text(x):text(x?.name??x?.text)).filter(Boolean)).slice(0,8);
}
function historicalCount(r){const h=r?.creditTransfer?.evidence?.historical;if(!h)return null;const n=Number(h.approved);return Number.isInteger(n)&&n>=0?n:null}
function enhance(selector,rows){
 const host=document.querySelector(selector);if(!host)return;
 const nodes=[...host.querySelectorAll('.course')];
 rows.forEach((r,i)=>{const node=nodes[i];if(!node)return;
  const t=r?.creditTransfer,strong=!!r?.creditTransferCountsInStudyPlan&&t?.classification==='strong';
  const status=node.querySelector('.status');
  if(strong&&status){status.textContent='✓ Starkt underlag';status.classList.add('strong-evidence')}
  if(!strong||node.querySelector('.evidence-details'))return;
  const details=document.createElement('details');details.className='evidence-details';
  const heading=document.createElement('summary');heading.textContent='Varför starkt underlag?';details.appendChild(heading);
  const list=document.createElement('ul');
  const add=s=>{const li=document.createElement('li');li.textContent=s;list.appendChild(li)};
  const shared=overlap(r);
  add(shared.length?'Matchande kursinnehåll: '+shared.join('; ')+'.':'Matchande kursinnehåll: Exakta gemensamma kursmoment kan inte fastställas från tillgängligt underlag.');
  const sourceHp=number(t?.evidence?.sourceHp),targetHp=number(t?.evidence?.targetHp??r?.hp),matchedHp=Math.min(targetHp,number(r?.creditTransferMatchedHp));
  add('Omfattning: tidigare kurs '+fmt(sourceHp)+' hp, aktuell kurs '+fmt(targetHp)+' hp; preliminärt matchade '+fmt(matchedHp)+' hp.');
  const count=historicalCount(r);add(count===null?'Historiska bifall: uppgift saknas.':count===0?'Historiska bifall: inga verifierade bifall i underlaget.':'Historiska bifall: '+count+' st.');
  details.appendChild(list);const disclaimer=document.createElement('small');disclaimer.textContent='Starkt underlag är StudieLots preliminära bedömning. Lärosätet beslutar om tillgodoräknande.';details.appendChild(disclaimer);node.appendChild(details);
 });
}
function enhanceOrdinary(){const rows=state.plannerData?.rows||[];enhance('#ordinaryPlan',[...rows].sort((a,b)=>(Number(a.term)||1)-(Number(b.term)||1)));const progress=document.querySelector('#planner .planner-progress');if(progress){progress.querySelectorAll('.info-note b').forEach(el=>{if(el.textContent.includes('Preliminärt tillgodoräknat'))el.textContent=el.textContent.replace('Preliminärt tillgodoräknat','Starkt underlag · preliminärt matchat')})}}
const render=planner.render.bind(planner);planner.render=function(...args){const result=render(...args);enhanceOrdinary();return result};
const renderFast=planner.renderFast.bind(planner);planner.renderFast=async function(...args){const result=await renderFast(...args);const rows=state.plannerData?.rows||[];const byCode=new Map(rows.map(r=>[text(r.code).toUpperCase(),r]));const host=document.querySelector('#fastPlan');if(host){host.querySelectorAll('.course').forEach(node=>{const code=text(node.querySelector('.course-main small')?.textContent).toUpperCase();const row=byCode.get(code);if(!row)return;const wrapper=document.createElement('div');wrapper.appendChild(node.cloneNode(true));enhance('#fastPlan',[]); // Fast-route course cards are rebuilt by the planner; use the same source row evidence below.
const t=row.creditTransfer;if(!(row.creditTransferCountsInStudyPlan&&t?.classification==='strong')||node.querySelector('.evidence-details'))return;const details=document.createElement('details');details.className='evidence-details';const summary=document.createElement('summary');summary.textContent='Varför starkt underlag?';details.appendChild(summary);const ul=document.createElement('ul');const lines=[overlap(row).length?'Matchande kursinnehåll: '+overlap(row).join('; ')+'.':'Matchande kursinnehåll: Exakta gemensamma kursmoment kan inte fastställas från tillgängligt underlag.','Omfattning: tidigare kurs '+fmt(t.evidence?.sourceHp)+' hp, aktuell kurs '+fmt(t.evidence?.targetHp??row.hp)+' hp; preliminärt matchade '+fmt(row.creditTransferMatchedHp)+' hp.',historicalCount(row)===null?'Historiska bifall: uppgift saknas.':historicalCount(row)===0?'Historiska bifall: inga verifierade bifall i underlaget.':'Historiska bifall: '+historicalCount(row)+' st.'];lines.forEach(line=>{const li=document.createElement('li');li.textContent=line;ul.appendChild(li)});details.appendChild(ul);const small=document.createElement('small');small.textContent='Starkt underlag är StudieLots preliminära bedömning. Lärosätet beslutar om tillgodoräknande.';details.appendChild(small);node.appendChild(details);const status=node.querySelector('.status');if(status){status.textContent='✓ Starkt underlag';status.classList.add('strong-evidence')}});host.querySelectorAll('.fast-win small').forEach(el=>{el.textContent='Möjlig tidsvinst utifrån preliminär matchning och tillgängliga kurstillfällen'})}return result};
planner.__evidenceDetails=true;
})();