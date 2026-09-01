(()=>{
const VERSION='607';
const norm=v=>String(v??'').trim();
const low=v=>norm(v).toLocaleLowerCase('sv-SE');
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const hp=v=>{const n=num(v);return n===null?null:Math.round(n*2)/2};
const fmt=v=>String(hp(v)??0).replace('.',',');
const esc=s=>norm(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function options(o){try{const r=window.universityOptionsForOpportunity?.(o);return Array.isArray(r)?r:[]}catch(e){return[]}}
function storedProfile(){try{return sessionStorage.getItem('lotsen_preferred_profile')||''}catch(e){return''}}
function optionProfile(x){return norm(x?.d?.id||x?.profileId)}
function optionRemaining(x){return hp(x?.v2?.remaining??x?.remaining)}
function authority(o,profileId=''){
 const rows=options(o).filter(x=>optionRemaining(x)!==null);
 const wanted=norm(profileId||storedProfile());
 let row=wanted?rows.find(x=>optionProfile(x)===wanted):null;
 if(!row&&rows.length===1)row=rows[0];
 if(!row&&rows.length)row=rows.slice().sort((a,b)=>optionRemaining(a)-optionRemaining(b))[0];
 const total=hp(o?.total??o?.totalHp??o?.hp??(o?.source==='advanced'?(low(o?.degreeType).includes('magister')?60:120):180))??180;
 const remaining=row?optionRemaining(row):(hp(o?.remaining)??total);
 return{version:VERSION,remaining,credited:Math.max(0,total-remaining),total,profileId:row?optionProfile(row):wanted,university:norm(row?.d?.university||row?.university),row,options:rows};
}
window.__studielotsHpAuthority=authority;
function wrap(name,maker){const cur=window[name];if(typeof cur!=='function'||cur.__sl607)return;const fn=maker(cur.__slBase607||cur);fn.__sl607=true;fn.__slBase607=cur.__slBase607||cur;window[name]=fn}
function installAuthority(){
 wrap('safeDegreeOpportunities',base=>function(){const out=base.apply(this,arguments);return Array.isArray(out)?out.map(o=>{const a=authority(o);return{...o,remaining:a.remaining,credited:a.credited,score:Math.max(0,Math.min(100,Math.round(100*a.credited/Math.max(1,a.total)))),canonicalProfileId:a.profileId,canonicalUniversity:a.university,hpAuthorityVersion:VERSION}}):out});
 wrap('canonicalRemaining',base=>function(o,profileId=''){const a=authority(o,profileId);return a.remaining??base.apply(this,arguments)});
 wrap('opportunityRemainingLabel',base=>function(o){const a=authority(o);return a.remaining?fmt(a.remaining)+' hp kvar':'Klar'});
 wrap('opportunityStatus',base=>function(o){const a=authority(o);return{label:a.remaining?fmt(a.remaining)+' hp kvar':'Klar',kind:a.remaining===0?'ready':a.remaining<=30?'near':'normal'}});
 ['openUniversityPath','renderUniversityDetail'].forEach(name=>wrap(name,base=>function(profileId){if(profileId)try{sessionStorage.setItem('lotsen_preferred_profile',String(profileId))}catch(e){}const out=base.apply(this,arguments);queue();return out}));
}
function opportunityForDetail(){try{const k=sessionStorage.getItem('lotsen_detail_key');return window.opportunityByKey?.(k)||null}catch(e){return null}}
function distanceButton(o){const href='/?studielots-distance='+encodeURIComponent(o.key)+'&verify=610';return `<a class="sl-distance-entry-v607 sl-distance-link-v610" href="${esc(href)}"><div><strong>Visa distansväg</strong><small>Bygg en plan av kurser som kan läsas helt på distans</small></div><span>›</span></a>`}
let lastDistanceOpen=0;
function openDistanceDirect(o){
 const now=Date.now();if(now-lastDistanceOpen<700)return;lastDistanceOpen=now;
 try{sessionStorage.setItem('lotsen_mypath_mode','distance');sessionStorage.setItem('studielots_mode','distance');sessionStorage.setItem('lotsen_detail_key',o.key)}catch(e){}
 window.__studielotsLastOpportunity=o;window.__studielotsLastUniversityOptions=options(o);
 const root=document.getElementById('degreeDetailContent');if(!root)return;
 let plan='';try{if(typeof myPathDistancePlanHtml==='function')plan=myPathDistancePlanHtml(o)}catch(e){}
 if(!plan)plan='<section class="mypath-distance-plan"><div class="mypath-distance-plan-head"><div><span>Distans</span><h3>Förslag att läsa</h3></div></div><p class="mypath-distance-intro">Distansplanen byggs av de delar som återstår till examen. Aktuella kurstillfällen visas först när de har verifierats som helt på distans.</p></section>';
 root.innerHTML=`<div class="detail-hero"><div><div class="eyebrow">På distans</div><h1>${esc(o.subject||o.name)}</h1></div></div>${plan}<button class="secondary sl-distance-back-v609" type="button">‹ Välj annat lärosäte</button>`;
 root.querySelector('.sl-distance-back-v609')?.addEventListener('click',()=>{if(typeof window.renderDegreeDetail==='function')window.renderDegreeDetail(o.key)});
 window.scrollTo(0,0);window.dispatchEvent(new CustomEvent('studielots:distance-open',{detail:{key:o.key,version:'609'}}));queue();
}
function repairDistance(){
 const root=document.getElementById('degreeDetailContent');if(!root)return;
 const sections=[...root.querySelectorAll('.detail-block')];
 const section=sections.find(s=>low(s.querySelector('h2')?.textContent)==='på distans');if(!section)return;
 const o=opportunityForDetail();if(!o)return;
 const empty=[...section.querySelectorAll('.muted,.small,.tiny-help')].find(el=>/inga tydliga distansalternativ finns i databasen ännu/i.test(el.textContent||''));
 if(!document.getElementById('sl-distance-link-v610-style')){const s=document.createElement('style');s.id='sl-distance-link-v610-style';s.textContent='.sl-distance-link-v610{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;box-sizing:border-box;margin-top:14px;padding:12px 0;color:#187566;text-decoration:none;touch-action:manipulation}.sl-distance-link-v610 div{display:flex;flex-direction:column;gap:3px}.sl-distance-link-v610 strong{font-size:1.05rem}.sl-distance-link-v610 small{font-size:.86rem;line-height:1.35;color:#707b83;font-weight:400}.sl-distance-link-v610>span{font-size:1.5rem;color:#1685df}';document.head.appendChild(s)}
 let button=section.querySelector('.sl-distance-entry-v607');
 if(!button||button.tagName!=='A'){const holder=document.createElement('div');holder.innerHTML=distanceButton(o);const link=holder.firstElementChild;if(button)button.replaceWith(link);else if(empty)empty.replaceWith(link);else section.appendChild(link);button=link}
 section.dataset.distanceEntry=VERSION;
}
function repairOpportunityCards(){
 let rows=[];try{rows=typeof window.safeDegreeOpportunities==='function'?window.safeDegreeOpportunities().filter(o=>o?.source!=='advanced').slice(0,8):[]}catch(e){return}
 const cards=[...document.querySelectorAll('#degreeResults .opportunity-discovery-card')];
 cards.forEach((card,i)=>{const o=rows[i];if(!o)return;const a=authority(o);const badge=card.querySelector('.opportunity-status');if(badge){const text=a.remaining?fmt(a.remaining)+' hp kvar':'Klar';if(badge.textContent!==text)badge.textContent=text;badge.classList.toggle('ready',a.remaining===0);badge.classList.toggle('near',a.remaining>0&&a.remaining<=30);badge.classList.toggle('normal',a.remaining>30);badge.dataset.hpAuthority=VERSION}const meta=card.querySelector('.opportunity-meta');if(meta&&!meta.querySelector('.distance-available'))meta.insertAdjacentHTML('beforeend','<span class="distance-available">Distansväg finns</span>')});
}
function repairHome(){
 let rows=[];try{rows=window.safeDegreeOpportunities?.()||[]}catch(e){}
 if(!Array.isArray(rows)||!rows.length)return;
 const sorted=xs=>xs.slice().filter(x=>hp(x?.remaining)!==null).sort((a,b)=>hp(a.remaining)-hp(b.remaining));
 const candidate=sorted(rows.filter(x=>x?.source!=='advanced'))[0];
 const advanced=sorted(rows.filter(x=>x?.source==='advanced'))[0];
 const shortest=sorted(rows)[0];
 const set=(id,value)=>{const el=document.getElementById(id);if(el&&el.textContent!==value)el.textContent=value};
 if(candidate){const a=authority(candidate);set('homeFastestCandidateName',candidate.name||candidate.subject||'Kandidatexamen');set('homeFastestCandidateMeta',fmt(a.credited)+' hp kan räknas · '+fmt(a.remaining)+' hp kvar')}
 if(advanced){const a=authority(advanced);set('homeFastestAdvancedName',advanced.name||advanced.subject||'Examen på avancerad nivå');set('homeFastestAdvancedMeta',fmt(a.credited)+' hp kan räknas · '+fmt(a.remaining)+' hp kvar')}
 if(shortest)set('shortest',fmt(authority(shortest).remaining)+' hp');
}
function repairDetailNumbers(){
 const root=document.querySelector('#universityDetailContent .v21-detail')||document.getElementById('universityDetailContent');if(!root)return;
 const o=opportunityForDetail();if(!o)return;let profile='';try{profile=sessionStorage.getItem('lotsen_preferred_profile')||''}catch(e){}
 const a=authority(o,profile);if(!a.row)return;
 const banner=[...root.querySelectorAll('.v21-summary,.detail-summary,.canonical-summary,div')].find(el=>/hp kan räknas in i examen[\s\S]*hp kvar/i.test(el.textContent||'')&&!el.querySelector('div div div'));
 if(banner){const strong=banner.querySelector('strong');const html=`<strong>${fmt(a.credited)} hp kan räknas in i examen · ${fmt(a.remaining)} hp kvar</strong>`;if(strong?.parentElement===banner){if(banner.innerHTML!==html)banner.innerHTML=html}}
 root.dataset.hpAuthority=VERSION;
}
function removeEscapedNewlines(){[...document.body?.childNodes||[]].filter(n=>n.nodeType===3&&/^\s*(?:\\n)+\s*$/.test(n.nodeValue||'')).forEach(n=>n.remove())}
let queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;installAuthority();repairDistance();repairOpportunityCards();repairHome();repairDetailNumbers();removeEscapedNewlines();document.documentElement.dataset.studielotsConsistencyPatch=VERSION})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue);else queue();
document.addEventListener('click',()=>setTimeout(queue,0),true);
function captureDistance(e){const b=e.target?.closest?.('button.sl-distance-entry-v607');if(!b)return;const o=opportunityForDetail();if(!o)return;e.preventDefault();e.stopImmediatePropagation();openDistanceDirect(o)}
document.addEventListener('pointerdown',captureDistance,true);
document.addEventListener('touchstart',captureDistance,{capture:true,passive:false});
document.addEventListener('click',captureDistance,true);
let distanceParamOpened=false;function openDistanceParam(){if(distanceParamOpened)return;let key='';try{key=new URL(location.href).searchParams.get('studielots-distance')||''}catch(e){}if(!key)return;let o=null;try{o=window.opportunityByKey?.(key)||null}catch(e){}if(!o)return;distanceParamOpened=true;try{sessionStorage.setItem('lotsen_detail_key',key)}catch(e){}try{if(typeof go==='function')go('degreeDetail')}catch(e){}try{if(typeof window.renderDegreeDetail==='function')window.renderDegreeDetail(key)}catch(e){}setTimeout(()=>openDistanceDirect(o),60)}
let distanceParamTries=0;const distanceParamTimer=setInterval(()=>{openDistanceParam();if(distanceParamOpened||++distanceParamTries>40)clearInterval(distanceParamTimer)},250);
['studielots:screen-rendered','studielots:planner-open','studielots:pacechange'].forEach(n=>window.addEventListener(n,queue));
new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true});
window.__studielotsLatestPatch={...(window.__studielotsLatestPatch||{}),consistencyVersion:VERSION,distanceEntryAlwaysVisible:true,singleHpAuthority:true};
})();
