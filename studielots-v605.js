(()=>{
const VERSION='605';
const norm=v=>String(v??'').trim();
const low=v=>norm(v).toLowerCase();
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const hp=v=>{const n=num(v);return n===null?0:Math.round(n*2)/2};
const fmt=v=>String(hp(v)).replace('.',',');
const distanceWords=['distans','distance','remote','online','ortsoberoende','webbaserad','web-based'];
const concreteUniversityWords=['universitet','högskola','university','chalmers','gu','lund','uppsala','umeå','linköping','linne','karlstad','örebro','södertörn','malmö','mittuniversitet'];
const textOfCourse=r=>[r?.studyMode,r?.delivery,r?.form,r?.format,r?.teachingForm,r?.studieform,r?.location,r?.campus,r?.mode,r?.deliveryMode,r?.attendance,r?.type].map(low).join(' ');
const isDistanceCourse=r=>Boolean(r?.distance===true||r?.remote===true||r?.isDistance===true||r?.distans===true||distanceWords.some(w=>textOfCourse(r).includes(w)));
const courseName=r=>norm(r?.name??r?.courseName??r?.title??r?.course??r?.label??r?.courseCode??'Kurs');
const courseCode=r=>norm(r?.code??r?.courseCode??r?.kod??'');
const institution=r=>norm(r?.institution??r?.university??r?.universityName??r?.provider??r?.school??r?.lärosäte??r?.larosate??'');
const courseHp=r=>hp(r?.hp??r?.credits??r?.credit??r?.ects??r?.points);
const termOf=r=>num(r?.term??r?.semester??r?.termNo??r?.plannedTerm??r?.originalTerm);
const periodOf=r=>num(r?.period??r?.studyPeriod??r?.periodNo);
const isDone=r=>Boolean(r?.credited||r?.completed||r?.done||r?.tillgodoraknad||r?.isCredited||r?.matched===true||r?.status==='credited'||r?.status==='completed');
const isMissing=r=>r?.missing===true||r?.remaining===true||r?.needed===true||r?.required===true||['missing','remaining','needed','required'].includes(low(r?.status));
function flatten(value,out=[],seen=new WeakSet(),depth=0){
 if(depth>5||value==null)return out;
 if(Array.isArray(value)){value.forEach(v=>flatten(v,out,seen,depth+1));return out}
 if(typeof value!=='object')return out;
 if(seen.has(value))return out;seen.add(value);
 const looksLikeCourse=Boolean(courseName(value)!=='Kurs'&&(courseHp(value)>0||courseCode(value)||textOfCourse(value)));
 if(looksLikeCourse)out.push(value);
 ['rows','courses','requiredCourses','missingCourses','remainingCourses','courseRows','plan','items','requirements','terms','semesters','options'].forEach(k=>{if(value[k]!=null)flatten(value[k],out,seen,depth+1)});
 return out;
}
function key(r){return [low(courseCode(r)),low(courseName(r)),low(institution(r))].filter(Boolean).join('|')}
function dedupe(rows){const seen=new Set();return rows.filter(r=>{const k=key(r);if(!k||seen.has(k))return false;seen.add(k);return true})}
function activeSelectionText(){
 const root=document.querySelector('#plannerClean,.screen.active,#opportunityAnalysisModal,.v21-detail')||document;
 const sels=['button.active','[aria-selected="true"]','.selected','.active[data-university]','.active[data-mode]'];
 const texts=[];sels.forEach(s=>root.querySelectorAll(s).forEach(el=>{const t=norm(el.textContent);if(t)texts.push(t)}));
 return texts.join(' · ');
}
function explicitMode(){
 const globals=['selectedUniversity','selectedInstitution','selectedStudyMode','studyMode','plannerUniversity','plannerMode','selectedProvider'];
 for(const k of globals){const v=window[k];if(typeof v==='string'&&v.trim())return v.trim()}
 const storageKeys=['studielots_selected_university','studielots_university','studielots_study_mode','studielots_mode','selectedUniversity','selectedStudyMode'];
 for(const k of storageKeys){try{const v=localStorage.getItem(k);if(v)return v}catch(e){}}
 return activeSelectionText();
}
function isDistanceSelection(){
 const text=low(explicitMode());
 if(!text)return false;
 const hasDistance=distanceWords.some(w=>text.includes(w));
 if(!hasDistance)return false;
 const parts=text.split(/[·|,/]/).map(s=>s.trim()).filter(Boolean);
 const concrete=parts.some(p=>!distanceWords.some(w=>p===w)&&concreteUniversityWords.some(w=>p.includes(w)));
 return !concrete;
}
function authoritativeRemaining(o,options){
 try{if(typeof window.canonicalRemaining==='function'){const n=num(window.canonicalRemaining(o));if(n!==null)return hp(n)}}catch(e){}
 const values=(Array.isArray(options)?options:[]).map(x=>num(x?.v2?.remaining??x?.remaining)).filter(v=>v!==null);
 return values.length?hp(Math.min(...values)):null;
}
function normalizeCourse(r){return{raw:r,name:courseName(r),code:courseCode(r),hp:courseHp(r),institution:institution(r),term:termOf(r),period:periodOf(r),distance:true,completed:isDone(r),needed:isMissing(r),studyMode:norm(r?.studyMode??r?.delivery??r?.form??r?.format??r?.studieform??'Distans')}}
function buildDistanceRoute(opportunity,options){
 const source=[];flatten(options,source);flatten(opportunity,source);
 let rows=dedupe(source.filter(isDistanceCourse)).map(normalizeCourse);
 const hasNeedSignals=rows.some(r=>r.needed||r.completed);
 if(hasNeedSignals)rows=rows.filter(r=>r.needed&&!r.completed);
 else rows=rows.filter(r=>!r.completed);
 rows.sort((a,b)=>(a.term??999)-(b.term??999)||(a.period??999)-(b.period??999)||a.name.localeCompare(b.name,'sv'));
 const remainingHp=authoritativeRemaining(opportunity,options);
 const identifiedHp=hp(rows.reduce((s,r)=>s+r.hp,0));
 const verifiedTermRows=rows.filter(r=>r.term!==null);
 const unverifiedTermRows=rows.filter(r=>r.term===null);
 return{version:VERSION,mode:'distance-route',distanceOnly:true,opportunity,rows,remainingHp,identifiedHp,verifiedTermRows,unverifiedTermRows,termPlacementVerified:rows.length>0&&unverifiedTermRows.length===0,source:'existing-university-options',changesRemainingHp:false};
}
window.__studielotsBuildDistanceRoute=buildDistanceRoute;
window.__studielotsDistancePolicy={version:VERSION,mode:'distance-route',distanceOnly:true,specificUniversityDisablesCrossUniversityRoute:true,changesRemainingHp:false,claimTermFeasibilityOnlyWhenMetadataExists:true};
function captureOptions(){
 const cur=window.universityOptionsForOpportunity;
 if(typeof cur!=='function'||cur.__sl605)return;
 const base=cur.__slBase||cur;
 const fn=function(o){const result=base.apply(this,arguments);window.__studielotsLastOpportunity=o;window.__studielotsLastUniversityOptions=result;queueRender();return result};
 fn.__sl605=true;fn.__slBase=base;window.universityOptionsForOpportunity=fn;
}
function esc(s){return norm(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function ensureStyle(){if(document.getElementById('studielots-v605-style'))return;const s=document.createElement('style');s.id='studielots-v605-style';s.textContent=`#sl-distance-route{margin:12px 0 16px;padding:14px;border:1px solid rgba(15,76,67,.11);border-radius:18px;background:#fff;box-shadow:0 4px 16px rgba(15,76,67,.05)}#sl-distance-route .sl-dr-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}#sl-distance-route h3{margin:0;color:#113d3a;font-size:16px}#sl-distance-route .sl-dr-sub{font-size:12px;color:#74807f;margin-top:3px;line-height:1.4}#sl-distance-route .sl-dr-badge{white-space:nowrap;font-size:11px;font-weight:800;color:#155f57;background:#eef6f4;padding:5px 8px;border-radius:999px}#sl-distance-route .sl-dr-term{margin-top:12px}#sl-distance-route .sl-dr-term-title{font-size:12px;font-weight:850;color:#50615f;margin:0 0 6px}#sl-distance-route .sl-dr-course{padding:9px 0;border-top:1px solid #edf0ef}#sl-distance-route .sl-dr-course:first-child{border-top:0}#sl-distance-route .sl-dr-course-top{display:flex;justify-content:space-between;gap:10px;font-size:13px}#sl-distance-route .sl-dr-course-name{font-weight:750;color:#183d39}#sl-distance-route .sl-dr-meta{font-size:11px;color:#74807f;margin-top:2px}#sl-distance-route .sl-dr-note{margin-top:10px;padding:9px 10px;border-radius:12px;background:#f7f8f7;color:#63706f;font-size:11px;line-height:1.4}#sl-distance-route .sl-dr-empty{font-size:12px;color:#74807f;padding:4px 0}@media(max-width:700px){#sl-distance-route{padding:12px}#sl-distance-route .sl-dr-head{display:block}#sl-distance-route .sl-dr-badge{display:inline-flex;margin-top:8px}}`;document.head.appendChild(s)}
function host(){return document.querySelector('#plannerCleanContent')||document.querySelector('#plannerClean .v572-shell')||document.querySelector('.v21-detail')||document.querySelector('#opportunityAnalysisModal .modal-content')||document.querySelector('#opportunityAnalysisModal')}
function render(){
 ensureStyle();const old=document.getElementById('sl-distance-route');
 if(!isDistanceSelection()){if(old)old.remove();return}
 const o=window.__studielotsLastOpportunity,opts=window.__studielotsLastUniversityOptions;
 if(!o&&!opts){if(old)old.remove();return}
 const route=buildDistanceRoute(o,opts);window.__studielotsLastDistanceRoute=route;
 const h=host();if(!h)return;
 const box=old||document.createElement('section');box.id='sl-distance-route';
 const groups=new Map();route.rows.forEach(r=>{const k=r.term===null?'unverified':String(r.term);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)});
 let body='';
 for(const [k,rows] of groups){const title=k==='unverified'?'Kurser att planera':'Termin '+esc(k);body+=`<div class="sl-dr-term"><div class="sl-dr-term-title">${title}</div>`+rows.map(r=>`<div class="sl-dr-course"><div class="sl-dr-course-top"><span class="sl-dr-course-name">${esc(r.name)}</span><strong>${fmt(r.hp)} hp</strong></div><div class="sl-dr-meta">${[r.institution,r.period!==null?'Period '+r.period:'',r.studyMode].filter(Boolean).map(esc).join(' · ')}</div></div>`).join('')+'</div>'}
 const badge=route.remainingHp===null?(route.identifiedHp?fmt(route.identifiedHp)+' hp hittat':'Distans'):(fmt(route.remainingHp)+' hp kvar');
 const note=!route.rows.length?'Jag hittar ännu inga kursrader som uttryckligen är markerade som distans i det aktuella underlaget.':route.termPlacementVerified?'Terminsplaceringen bygger på terminsuppgifter som finns i underlaget.':'Kurserna är markerade som distans, men termin och aktuellt kursutbud behöver verifieras mot respektive lärosäte innan StudieLots kallar planen genomförbar.';
 box.innerHTML=`<div class="sl-dr-head"><div><h3>Distansväg</h3><div class="sl-dr-sub">En sammanhängande väg byggd enbart av kurser som är markerade som distans i underlaget.</div></div><span class="sl-dr-badge">${esc(badge)}</span></div>${body||'<div class="sl-dr-empty">Ingen verifierad distanskurs hittades ännu.</div>'}<div class="sl-dr-note">${esc(note)}</div>`;
 if(!old){const anchor=document.getElementById('sl-pace-picker');if(anchor&&anchor.parentNode===h)anchor.insertAdjacentElement('afterend',box);else h.insertBefore(box,h.firstChild)}
}
let queued=false;function queueRender(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render()})}
function sync(){captureOptions();ensureStyle();queueRender();document.documentElement.dataset.studielotsDistancePatch=VERSION;window.__studielotsLatestPatch={...(window.__studielotsLatestPatch||{}),distanceVersion:VERSION,distanceRoute:true,distanceSpecificUniversityIsolation:true}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync);else sync();
let tries=0;const timer=setInterval(()=>{sync();if(++tries>60)clearInterval(timer)},250);
document.addEventListener('click',e=>{const t=low(e.target?.closest?.('button,[role="button"],a,.chip')?.textContent);if(t&&([...distanceWords,...concreteUniversityWords].some(w=>t.includes(w))))setTimeout(queueRender,0)},true);
['studielots:screen-rendered','studielots:planner-open','studielots:planner-policy-change','studielots:pacechange'].forEach(n=>window.addEventListener(n,queueRender));
new MutationObserver(queueRender).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-selected']});
})();