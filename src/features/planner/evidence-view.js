(()=>{'use strict';
const root=window.StudieLotsV2,model=window.StudieLotsEvidenceModel,planner=document.querySelector('#planner');
const entry=planner?.querySelector('#evidenceEntry'),panel=planner?.querySelector('#evidencePanel');
if(!root||!model||!entry||!panel)return;
const fmt=n=>Number(n||0).toLocaleString('sv-SE',{maximumFractionDigits:1});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sourceLink=url=>{try{const u=new URL(url);return u.protocol==='https:'?u.href:''}catch{return''}};
const rows=()=>root.appContext?.state?.plannerData?.rows||[];
const ordered=()=>[...rows()].sort((a,b)=>(Number(a.term)||1)-(Number(b.term)||1));
const historicSource=id=>{const record=(window.StudieLotsEngines?.creditTransferHistory?.decisions||[]).find(d=>String(d.id)===id);return record?.university||record?.source||''};
function rowCard(row,index){
 const d=model.describe(row),label=d.direct?'Direkt matchad':d.classification==='strong'?'Starkt underlag':d.classification==='relevant'?'Relevant underlag':'Begränsat underlag';
 const sources=[...new Set(d.historicalIds.map(historicSource).filter(Boolean))];
 const historical=d.historicalIds.length===1?'1 verifierat historiskt bifall':d.historicalIds.length?`${d.historicalIds.length} verifierade historiska bifall`:'Inga verifierade historiska bifall i vårt underlag';
 const programmeUrl=sourceLink(root.appContext?.state?.plannerData?.sourceEvidenceUrl||root.appContext?.state?.plannerData?.item?.sourceEvidenceUrl);
 const courseUrl=sourceLink(row?.sourceUrl||row?.syllabusUrl);
 const evidence=d.reasons.length||d.differences.length
  ?`<ul>${[...d.reasons,...d.differences].slice(0,6).map(reason=>`<li>${esc(reason)}</li>`).join('')}</ul>`
  :'<p>En detaljerad jämförelse av kursinnehållet finns ännu inte i underlaget.</p>';
 return `<details class="evidence-item" data-evidence-item="${index}"><summary><span><small>Termin ${esc(row.term||1)} · ${esc(label)}</small><b>${esc(row.name||'Kurs')}</b></span><strong>${fmt(d.matchedHp)} / ${fmt(row.hp)} hp</strong></summary><div class="evidence-item-body"><p><b>Din tidigare kurs:</b> ${esc(d.sourceName||'Uppgift saknas')}</p><p><b>Bedömning:</b> ${esc(d.status)}${d.classification==='relevant'||d.classification==='limited'?' · inga extra hp avräknade':''}</p>${evidence}<p><b>Historiska bifall:</b> ${esc(historical)}${sources.length?` · ${esc(sources.join(', '))}`:''}</p>${courseUrl?`<a href="${esc(courseUrl)}" target="_blank" rel="noopener noreferrer">Se kurskälla ↗</a>`:''}${programmeUrl?`<a href="${esc(programmeUrl)}" target="_blank" rel="noopener noreferrer">Se programkälla ↗</a>`:''}</div></details>`;
}
function panelHtml(data){
 const list=ordered().map((row,index)=>({row,index,detail:model.describe(row)})).filter(x=>x.detail.direct||x.detail.classification);
 return `<div class="evidence-panel-head"><button type="button" data-evidence-close>← Planeraren</button><h2>Underlag för programmatchningen</h2><p>${esc(data.item?.programName||'Valt program')} · ${esc(data.item?.university||'')}</p></div><div class="evidence-explainer"><b>Så har vi bedömt dina kurser</b><span>Se jämförelser och eventuella verifierade historiska bifall. Bedömningen är vägledande; lärosätet beslutar om tillgodoräknande.</span></div><div class="evidence-item-list">${list.length?list.map(x=>rowCard(x.row,x.index)).join(''):'<p>Det finns ännu inga kursmatchningar att visa för programmet.</p>'}</div><section class="evidence-checklist"><h3>Vad du kan behöva styrka</h3><ul><li>Ladok-intyg som visar avklarade kurser.</li><li>Kursplan från när du läste den tidigare kursen.</li><li>Uppgifter om kursinnehåll och lärandemål om de saknas i intyget.</li></ul><small>Kontrollera med lärosätet vilka handlingar som krävs för din ansökan.</small></section><div class="evidence-package"><b>Samlat underlagspaket</b><p>Kursjämförelser, källor och checklista i en nedladdningsbar fil.</p><button type="button" data-evidence-export data-premium-feature="evidence-package" aria-disabled="true">Hämta underlagspaket <small>Kommer senare</small></button><span class="evidence-export-message" role="status" aria-live="polite"></span></div>`;
}
let open=false;
function sync(data=root.appContext?.state?.plannerData){
 if(!Array.isArray(data?.rows)||!data.rows.length){entry.hidden=true;panel.hidden=true;return}
 const counts=model.summarize(data.rows),parts=[`${counts.strong} starka`,`${counts.relevant} relevanta`];
 if(counts.historicalApprovals)parts.push(`${counts.historicalApprovals} historiska bifall`);
 entry.innerHTML=`<div><b>Underlag för programmatchningen</b><span>${parts.join(' · ')}</span></div><button type="button" data-evidence-open>Visa underlag →</button>`;
 entry.hidden=open;
 panel.innerHTML=panelHtml(data);
 panel.hidden=!open;
 const cards=[...planner.querySelectorAll('#ordinaryPlan .course')];
 const courseRows=[...data.rows].sort((a,b)=>(Number(a.term)||1)-(Number(b.term)||1));
 cards.forEach((card,index)=>{
  card.querySelector('.evidence-course-link')?.remove();
  const detail=model.describe(courseRows[index]);
  if(!detail.direct&&!detail.classification)return;
  const button=document.createElement('button');button.type='button';button.className='evidence-course-link';button.dataset.evidenceCourse=String(index);button.textContent='Visa underlag →';card.append(button);
 });
}
function show(index){
 const data=root.appContext?.state?.plannerData;if(!data?.rows?.length)return;
 open=true;sync(data);planner.querySelector('.route-switch').hidden=true;
 planner.querySelector('#ordinaryPlan').hidden=true;planner.querySelector('#fastPlan').hidden=true;
 const item=Number.isInteger(index)?panel.querySelector(`[data-evidence-item="${index}"]`):null;
 if(item)item.open=true;
 (item||panel).scrollIntoView({behavior:'smooth',block:'start'});
}
function close(){open=false;panel.hidden=true;entry.hidden=false;planner.querySelector('.route-switch').hidden=false;root.planner?.route?.(root.appContext?.state?.route||'ordinary');entry.scrollIntoView({behavior:'smooth',block:'start'})}
planner.addEventListener('click',event=>{
 const target=event.target instanceof Element?event.target.closest('[data-evidence-open],[data-evidence-close],[data-evidence-course],[data-evidence-export]'):null;if(!target)return;
 if(target.hasAttribute('data-evidence-close'))close();
 else if(target.hasAttribute('data-evidence-open'))show();
 else if(target.hasAttribute('data-evidence-course'))show(Number(target.dataset.evidenceCourse));
 else if(target.hasAttribute('data-evidence-export'))panel.querySelector('.evidence-export-message').textContent='Underlagspaketet går ännu inte att hämta. Du kan se bedömningen ovan.';
});
window.addEventListener('studielots:credit-ledger',()=>sync());
root.evidenceView=Object.freeze({render(data){open=false;planner.querySelector('.route-switch').hidden=false;sync(data)},show,close,features:Object.freeze({fastRoute:'fast-route',evidencePackage:'evidence-package'})});
})();
