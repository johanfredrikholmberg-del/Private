(()=>{
const VERSION='606';
const norm=v=>String(v??'').trim();
const low=v=>norm(v).toLowerCase();
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const hp=v=>{const n=num(v);return n===null?0:Math.round(n*2)/2};
const fmt=v=>String(hp(v)).replace('.',',');
const esc=s=>norm(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={key:'',loading:false,loaded:false,error:false,source:'',updated:'',courses:[]};
function opportunity(){return window.__studielotsLastOpportunity||null}
function subjectOf(o){return norm(o?.subject||o?.name||o?.degreeName||o?.title)}
function kindOf(o){return norm(o?.kind||o?.degreeType||o?.level||'candidate')}
function courseKey(c){return [low(c?.code||c?.courseCode),low(c?.name),low(c?.university)].filter(Boolean).join('|')}
function normalize(c){return{name:norm(c?.name),code:norm(c?.code||c?.courseCode),university:norm(c?.university),subject:norm(c?.subject),hp:hp(c?.hp),pace:num(c?.pace),term:norm(c?.term),period:num(c?.period),startDate:norm(c?.startDate),applicationDeadline:norm(c?.applicationDeadline),distance:true,currentOffering:c?.currentOffering===true,verified:c?.verified===true,noPhysicalMeetings:c?.noPhysicalMeetings===true?true:c?.noPhysicalMeetings===false?false:null,url:norm(c?.url)}}
function route(){
 const base=window.__studielotsLastDistanceRoute;
 if(!base||base.mode!=='distance-route')return null;
 const existing=Array.isArray(base.rows)?base.rows:[];
 const seen=new Set(existing.map(courseKey));
 const offerings=state.courses.filter(c=>c.currentOffering&&c.verified&&!seen.has(courseKey(c)));
 return{...base,offeringVersion:VERSION,offeringSource:state.source,offeringUpdated:state.updated,currentOfferings:offerings,offeringDataLoaded:state.loaded,offeringDataError:state.error};
}
async function load(){
 const o=opportunity(),subject=subjectOf(o);if(!subject)return;
 const key=subject+'|'+kindOf(o);if(state.key===key&&(state.loading||state.loaded))return;
 Object.assign(state,{key,loading:true,loaded:false,error:false,source:'',updated:'',courses:[]});render();
 try{
   const url='/api/distance-courses?subject='+encodeURIComponent(subject)+'&kind='+encodeURIComponent(kindOf(o));
   const r=await fetch(url,{headers:{accept:'application/json'},cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);
   const data=await r.json(),raw=Array.isArray(data?.courses)?data.courses:[];
   state.courses=raw.map(normalize).filter(c=>c.name&&c.hp>0&&c.currentOffering&&c.verified);
   state.source=norm(data?.source);state.updated=norm(data?.updated);state.loaded=true;
 }catch(e){state.error=true}finally{state.loading=false;window.__studielotsDistanceOfferingState=state;render()}
}
function style(){if(document.getElementById('studielots-v606-style'))return;const s=document.createElement('style');s.id='studielots-v606-style';s.textContent=`#sl-distance-offerings{margin-top:12px;padding-top:12px;border-top:1px solid #edf0ef}.sl-do-title{font-size:12px;font-weight:850;color:#50615f;margin-bottom:7px}.sl-do-row{padding:9px 10px;margin-top:6px;border-radius:12px;background:#f4f8f7}.sl-do-top{display:flex;justify-content:space-between;gap:10px;font-size:13px}.sl-do-name{font-weight:750;color:#183d39}.sl-do-meta{font-size:11px;color:#74807f;margin-top:3px}.sl-do-link{display:inline-block;margin-top:5px;font-size:11px;font-weight:750;color:#155f57;text-decoration:none}.sl-do-state{font-size:11px;line-height:1.4;color:#74807f;padding:7px 0}.sl-do-verified{display:inline-flex;padding:3px 7px;border-radius:999px;background:#eaf6f1;color:#155f57;font-size:10px;font-weight:850;margin-top:5px}`;document.head.appendChild(s)}
function render(){
 style();const box=document.getElementById('sl-distance-route');if(!box)return;
 let host=document.getElementById('sl-distance-offerings');if(!host){host=document.createElement('div');host.id='sl-distance-offerings';box.appendChild(host)}
 const r=route();if(!r){host.remove();return}
 let body='';
 if(state.loading)body='<div class="sl-do-state">Hämtar aktuella kurstillfällen…</div>';
 else if(state.error)body='<div class="sl-do-state">Aktuella kurstillfällen kunde inte hämtas just nu.</div>';
 else if(state.loaded&&state.courses.length)body=state.courses.map(c=>`<div class="sl-do-row"><div class="sl-do-top"><span class="sl-do-name">${esc(c.name)}</span><strong>${fmt(c.hp)} hp</strong></div><div class="sl-do-meta">${[c.university,c.term,c.period!==null?'Period '+c.period:'',c.pace!==null?c.pace+' %':'',c.startDate?'Start '+c.startDate:''].filter(Boolean).map(esc).join(' · ')}</div><span class="sl-do-verified">Verifierat kurstillfälle</span>${c.url?`<br><a class="sl-do-link" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">Se kurs och ansökan ↗</a>`:''}</div>`).join('');
 else if(state.loaded&&state.source==='not-configured')body='<div class="sl-do-state">Källan för aktuella kurstillfällen är ännu inte ansluten. Distansplanen visar därför bara verifierade uppgifter som redan finns i programunderlaget.</div>';
 else if(state.loaded)body='<div class="sl-do-state">Inga verifierade aktuella distansstarter hittades för den här inriktningen.</div>';
 const html='<div class="sl-do-title">Aktuella kurstillfällen</div>'+body;if(host.innerHTML!==html)host.innerHTML=html;
 window.__studielotsLastDistanceRoute=r;
}
function isVisible(){return Boolean(document.getElementById('sl-distance-route'))}
let queued=false;function sync(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;if(isVisible())load();render()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync);else sync();
document.addEventListener('click',()=>setTimeout(sync,0),true);
['studielots:screen-rendered','studielots:planner-open','studielots:planner-policy-change'].forEach(n=>window.addEventListener(n,sync));
new MutationObserver(sync).observe(document.documentElement,{subtree:true,childList:true});
document.documentElement.dataset.studielotsOfferingPatch=VERSION;
window.__studielotsLatestPatch={...(window.__studielotsLatestPatch||{}),distanceOfferingVersion:VERSION,verifiedCurrentOfferings:true};
})();
