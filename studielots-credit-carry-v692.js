(()=>{
'use strict';
const VERSION='692',KEY='studielots_planner_snapshot';
const txt=v=>String(v??'').replace(/\s+/g,' ').trim();
const low=v=>txt(v).toLocaleLowerCase('sv-SE');
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const hp=r=>num(r?.hp??r?.credits??r?.ects??r?.points);
const code=r=>txt(r?.code||r?.courseCode).toUpperCase();
const name=r=>low(r?.name??r?.courseName??r?.title??r?.course??r?.label);
const term=r=>Math.max(1,num(r?.__slOriginalTerm??r?.originalTerm??r?.term??r?.semester)||1);
const category=r=>low(r?.programmeCategory||r?.category||'');
const credited=r=>Boolean(r?.credited||r?.isCredited||r?.completed||r?.done||r?.status==='credited'||r?.status==='completed');
const partial=r=>!credited(r)&&(r?.status==='partial'||num(r?.matchedHp)>0||num(r?.creditedHp)>0);
function read(){try{return JSON.parse(sessionStorage.getItem(KEY)||'null')}catch(_){return null}}
function write(s){try{sessionStorage.setItem(KEY,JSON.stringify(s));return true}catch(_){return false}}
function official(s){const v=low(s?.programmeStructureSource).replace(/-v\d+$/,'');return /^(chalmers-programplan|kth-programplan|gu-official-programplan|lund-official-programplan)$/.test(v)||s?.programmeStructureVerified===true}
function rowKey(r){const c=code(r);if(c)return'code:'+c;const cat=category(r);if(/elective-slot|thesis-slot/.test(cat))return['slot',term(r),cat,hp(r),name(r)].join('|');return''}
function indexCredits(rows){const map=new Map();for(const r of Array.isArray(rows)?rows:[]){if(!credited(r)&&!partial(r))continue;const k=rowKey(r);if(k&&!map.has(k))map.set(k,r)}return map}
function carry(previous,current){if(!previous||!current||!official(current))return current;const oldRows=Array.isArray(previous?.plannerBaselineRows)&&previous.plannerBaselineRows.length?previous.plannerBaselineRows:Array.isArray(previous?.rows)?previous.rows:[];const rows=Array.isArray(current?.rows)?current.rows:[];if(!oldRows.length||!rows.length)return current;const idx=indexCredits(oldRows);if(!idx.size)return current;let changed=false;const nextRows=rows.map(r=>{const old=idx.get(rowKey(r));if(!old)return r;if(credited(old)){changed=true;return{...r,credited:true,isCredited:true,status:'credited',matchedHp:hp(r),matchType:old?.matchType||r?.matchType||'replace',matchReason:old?.matchReason||r?.matchReason||''}}const matched=Math.min(hp(r),num(old?.matchedHp||old?.creditedHp));if(matched>0){changed=true;return{...r,credited:false,isCredited:false,status:'partial',matchedHp:matched,matchType:old?.matchType||r?.matchType||'partial',matchReason:old?.matchReason||r?.matchReason||''}}return r});if(!changed)return current;const creditedHp=nextRows.reduce((sum,r)=>sum+(credited(r)?hp(r):Math.min(hp(r),num(r?.matchedHp||r?.creditedHp))),0);const total=num(current?.totalHp)||nextRows.reduce((sum,r)=>sum+hp(r),0);return{...current,rows:nextRows,plannerBaselineRows:nextRows,creditedHp,remainingHp:Math.max(0,total-creditedHp),creditCarryVersion:VERSION}}
let previous=read(),busy=false;
function repair(){if(busy)return;const current=read();if(!current)return;const next=carry(previous,current);if(next!==current){busy=true;if(write(next)){window.__studielotsLastProgramSchedule={...(window.__studielotsLastProgramSchedule||{}),...next,rows:next.rows,plannerBaselineRows:next.rows};window.dispatchEvent(new CustomEvent('studielots:planner-baseline',{detail:{source:'credit-carry',version:VERSION}}))}busy=false;previous=next}else previous=current}
['studielots:planner-snapshot','studielots:planner-open'].forEach(e=>window.addEventListener(e,()=>queueMicrotask(repair)));
window.addEventListener('pageshow',()=>{previous=read()});
window.__studielotsBuild={...(window.__studielotsBuild||{}),officialCreditCarry:'v692'};
})();
