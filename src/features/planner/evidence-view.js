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
  const decision=records.get(id);
  if(decision&&!unique.has(id))unique.set(id,decision);
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
 const decisionList=historical.length?`<ul class="evidence-history-list">${historical.map(d=>`<li><b>${esc(d.sourceName||d.fromName||'Tidigare kurs')} → ${esc(d.targetName||d.toName||'Programkurs')}</b><small>${esc(d.university||d.source||'Lärosäte saknas')} · beslut ${esc(decisionId(d))}</small></li>`).join('')}</ul>`:'<p>0 verifierade bifall matchar de här kursparen i vår beslutsdata. Det betyder inte att lärosätet kommer att avslå en ansökan.</p>';
 return `<div class="evidence-panel-head"><button type="button" data-evidence-close>← Planeraren</button><h2>Underlag</h2><p>${esc(data.item?.programName||'Valt program')} · ${esc(data.item?.university||'')}</p></div><section class="evidence-group"><h3>Starkt underlag <span>${strong.length}</span></h3>${strong.length?`<div class="evidence-item-list">${strong.map(x=>strongCard(x.row,x.index,data)).join('')}</div>`:'<p>Ingen kurs har starkt underlag i den här matchningen.</p>'}</section><section class="evidence-group"><h3>Historiska bifall <span>${historical.length}</span></h3>${decisionList}</section><p class="evidence-disclaimer">Matchningarna är preliminära. Lärosätet beslutar om tillgodoräknande.</p><details class="evidence-prep"><summary>Handlingar och underlagspaket</summary><div><p>Inför en ansökan kan du behöva Ladok-intyg och kursplaner från när du läste kurserna. Kontrollera kraven med lärosätet.</p><button type="button" data-evidence-export data-premium-feature="evidence-package" aria-disabled="true">Hämta underlagspaket <small>Kommer senare</small></button><span class="evidence-export-message" role="status" aria-live="polite"></span></div></details>`;
}
let open=false;
function sync(data=root.appContext?.state?.plannerData){
 if(!Array.isArray(data?.rows)||!data.rows.length){entry.hidden=true;panel.hidden=true;return}
 const strong=data.rows.filter(isStrong).length,historical=decisions(data).length;
 entry.innerHTML=`<div><b>Underlag</b><span>${strong} ${strong===1?'kurs':'kurser'} med starkt underlag · ${historical} historiska bifall</span></div><button type="button" data-evidence-open>Visa →</button>`;
 entry.hidden=open;
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
 else if(target.hasAttribute('data-evidence-export'))panel.querySelector('.evidence-export-message').textContent='Underlagspaketet är ännu inte tillgängligt.';
});
window.addEventListener('studielots:credit-ledger',()=>sync());
root.evidenceView=Object.freeze({render(data){open=false;planner.querySelector('.route-switch').hidden=false;sync(data)},show,close,features:Object.freeze({fastRoute:'fast-route',evidencePackage:'evidence-package'})});
})();
