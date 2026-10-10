(()=>{'use strict';
const root=window.StudieLotsV2,model=window.StudieLotsEvidenceModel,planner=document.querySelector('#planner');
const entry=planner?.querySelector('#evidenceEntry'),panel=planner?.querySelector('#evidencePanel');
if(!root||!model||!entry||!panel)return;
const fmt=n=>Number(n||0).toLocaleString('sv-SE',{maximumFractionDigits:1});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sourceLink=url=>{try{const u=new URL(url);return u.protocol==='https:'?u.href:''}catch{return''}};
const ordered=data=>[...data.rows].sort((a,b)=>(Number(a.term)||1)-(Number(b.term)||1));
const isStrong=row=>model.describe(row).classification==='strong'&&row.creditTransferCountsInStudyPlan===true;
const decisionId=d=>String(d.id??d.decisionId??d.caseId??'');
function decisions(data){
 const records=new Map((window.StudieLotsEngines?.creditTransferHistory?.decisions||[]).filter(d=>decisionId(d)).map(d=>[decisionId(d),d]));
 const unique=new Map();
 for(const row of data.rows)for(const id of model.describe(row).historicalIds){
  const baseId=id.replace(/#\d+$/,'');
  const decision=records.get(id)||records.get(baseId);
  if(decision&&!unique.has(baseId))unique.set(baseId,decision);
 }
 return [...unique.values()];
}
function strongCard(row,index,data){
 const d=model.describe(row),courseUrl=sourceLink(row.sourceUrl||row.syllabusUrl),programmeUrl=sourceLink(data.sourceEvidenceUrl||data.item?.sourceEvidenceUrl);
 const reasons=[...d.reasons,...d.differences].filter(reason=>!/^Historiska bifall:/.test(reason)).slice(0,3);
 return `<details class="evidence-item" data-evidence-item="${index}"><summary><span><small>Termin ${esc(row.term||1)} · starkt underlag</small><b>${esc(row.name||'Kurs')}</b></span><strong>${fmt(d.matchedHp)} av ${fmt(row.hp)} hp</strong></summary><div class="evidence-item-body"><p><b>Matchas mot:</b> ${esc(d.sourceName||'Tidigare kurs')}</p>${reasons.length?`<ul>${reasons.map(reason=>`<li>${esc(reason)}</li>`).join('')}</ul>`:''}${courseUrl?`<a href="${esc(courseUrl)}" target="_blank" rel="noopener noreferrer">Kurskälla ↗</a>`:''}${programmeUrl?`<a href="${esc(programmeUrl)}" target="_blank" rel="noopener noreferrer">Programkälla ↗</a>`:''}</div></details>`;
}
function panelHtml(data){
 const strong=ordered(data).map((row,index)=>({row,index})).filter(x=>isStrong(x.row));
 const historical=decisions(data);
 const approvalCount=historical.reduce((sum,d)=>sum+Math.max(1,Number(d.approvalCount)||1),0);
 const decisionList=historical.length?`<ul class="evidence-history-list">${historical.map(d=>{const details=[d.sourceInstitution?`från ${d.sourceInstitution}`:'',d.decisionDate?`beslut ${d.decisionDate}`:'beslutsdatum saknas i datan',`${Math.max(1,Number(d.approvalCount)||1)} bifall`,decisionId(d)].filter(Boolean).join(' · ');return`<li><b>${esc(d.sourceName||d.fromName||'Tidigare kurs')} → ${esc(d.targetName||d.toName||'Programkurs')}</b><small>${esc(d.university||d.source||'Lärosäte saknas')} · ${esc(details)}</small></li>`}).join('')}</ul>`:'<p>Inga verifierade bifall matchar de här kursparen i vår beslutsdata.</p>';
 return `<section class="evidence-group"><h3>Starkt underlag <span>${strong.length}</span></h3>${strong.length?`<div class="evidence-item-list">${strong.map(x=>strongCard(x.row,x.index,data)).join('')}</div>`:'<p>Ingen kurs har starkt underlag här.</p>'}</section><section class="evidence-group"><h3>Historiska bifall <span>${approvalCount}</span></h3>${decisionList}</section><p class="evidence-disclaimer">Bedömningen är preliminär. Lärosätet fattar beslut.</p><details class="evidence-prep"><summary>Handlingar och underlagspaket</summary><div><p>Du kan behöva Ladok-intyg och kursplaner. Kontrollera lärosätets krav.</p><button type="button" data-evidence-export data-premium-feature="evidence-package" aria-disabled="true">Hämta underlagspaket <small>Kommer senare</small></button><span class="evidence-export-message" role="status" aria-live="polite"></span></div></details>`;
}
let open=false;
function sync(data=root.appContext?.state?.plannerData){
 if(!Array.isArray(data?.rows)||!data.rows.length){entry.hidden=true;panel.hidden=true;return}
 const strong=data.rows.filter(isStrong).length,historical=decisions(data).reduce((sum,d)=>sum+Math.max(1,Number(d.approvalCount)||1),0);
 entry.innerHTML=`<div><b>Underlag</b><span>${strong} ${strong===1?'stark kursmatchning':'starka kursmatchningar'} · ${historical} tidigare bifall</span></div><button type="button" data-evidence-open aria-expanded="${open}" aria-controls="evidencePanel">${open?'Dölj ↑':'Visa →'}</button>`;
 entry.hidden=false;
 panel.innerHTML=panelHtml(data);
 panel.hidden=!open;
 const courseRows=ordered(data);
 planner.querySelectorAll('#ordinaryPlan .course').forEach((card,index)=>{
  card.querySelector('.evidence-course-link')?.remove();
  if(!isStrong(courseRows[index]))return;
  const button=document.createElement('button');button.type='button';button.className='evidence-course-link';button.dataset.evidenceCourse=String(index);button.textContent='Visa underlag →';card.append(button);
 });
}
function show(index){
 const data=root.appContext?.state?.plannerData;if(!data?.rows?.length)return;
 open=true;sync(data);
 const item=Number.isInteger(index)?panel.querySelector(`[data-evidence-item="${index}"]`):null;
 if(item)item.open=true;
 (item||panel).scrollIntoView({behavior:'smooth',block:'start'});
}
function close(){open=false;sync();entry.scrollIntoView({behavior:'smooth',block:'start'})}
planner.addEventListener('click',event=>{
 if(!(event.target instanceof Element))return;
 if(open&&event.target.closest('[data-route]')){open=false;sync();return}
 const target=event.target.closest('[data-evidence-open],[data-evidence-course],[data-evidence-export]');if(!target)return;
 if(target.hasAttribute('data-evidence-open'))open?close():show();
 else if(target.hasAttribute('data-evidence-course'))show(Number(target.dataset.evidenceCourse));
 else if(target.hasAttribute('data-evidence-export'))panel.querySelector('.evidence-export-message').textContent='Underlagspaketet är ännu inte tillgängligt.';
});
window.addEventListener('studielots:credit-ledger',()=>sync());
root.evidenceView=Object.freeze({render(data){open=false;sync(data)},show,close,features:Object.freeze({fastRoute:'fast-route',evidencePackage:'evidence-package'})});
})();
