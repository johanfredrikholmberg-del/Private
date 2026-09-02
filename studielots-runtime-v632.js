(()=>{
  'use strict';
  const VERSION='632';
  const FAST_PACE_KEY='studielots_fast_pace_hp';
  const PACES=[30,37.5,45];
  const norm=v=>String(v??'').trim();
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
  const fmt=v=>String(Math.round(num(v)*10)/10).replace('.',',');
  const esc=s=>norm(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const termOf=r=>Number(r?.__slOriginalTerm??r?.originalTerm??r?.term??r?.semester??r?.termNo)||1;
  const hpOf=r=>num(r?.hp??r?.credits??r?.credit??r?.ects??r?.points);
  const nameOf=r=>norm(r?.name??r?.courseName??r?.title??r?.course??'Kurs');
  const keyOf=r=>norm(r?.code||r?.courseCode||r?.name||r?.courseName).toUpperCase();
  const isCredited=r=>Boolean(r?.credited||r?.completed||r?.done||r?.tillgodoraknad||r?.isCredited||r?.matched===true||r?.status==='credited'||r?.status==='completed');
  const isPartial=r=>r?.status==='partial'||(num(r?.matchedHp)>0&&num(r?.matchedHp)<hpOf(r));
  let lastSignature='';

  function baselineRows(){
    const live=window.__studielotsLastProgramSchedule;
    let rows=Array.isArray(live?.plannerBaselineRows)?live.plannerBaselineRows:null;
    if(!rows?.length){
      try{const snap=JSON.parse(sessionStorage.getItem('studielots_planner_snapshot')||'null');rows=Array.isArray(snap?.rows)?snap.rows:null}catch(_){}
    }
    if(!rows?.length&&Array.isArray(live?.rows))rows=live.rows;
    return (rows||[]).map((r,i)=>({...r,__slOriginalIndex:r?.__slOriginalIndex??i,__slOriginalTerm:termOf(r)}))
      .sort((a,b)=>termOf(a)-termOf(b)||(a.__slOriginalIndex-b.__slOriginalIndex));
  }

  function signature(rows){return rows.map(r=>[keyOf(r),termOf(r),r?.status||'',num(r?.matchedHp)].join(':')).join('|')}
  function grouped(rows){
    const map=new Map();
    rows.forEach(r=>{const t=termOf(r);if(!map.has(t))map.set(t,[]);map.get(t).push(r)});
    return [...map.entries()].sort((a,b)=>a[0]-b[0]).map(([term,items])=>({term,rows:items,hp:items.reduce((s,r)=>s+hpOf(r),0),creditedHp:items.filter(isCredited).reduce((s,r)=>s+hpOf(r),0)}));
  }
  function courseRow(r){
    const credited=isCredited(r),partial=isPartial(r),state=credited?'credited':partial?'partial':'remaining';
    const matched=Math.min(hpOf(r),num(r?.matchedHp||r?.creditedHp||0));
    const sub=credited?'Kan hoppas över – tillgodoräknad':partial?`${fmt(matched)} av ${fmt(hpOf(r))} hp kan räknas in`:'Ordinarie programkurs';
    return `<div class="v572-course sl632-course ${credited?'sl632-skip':''}" data-status="${state}"><span class="v572-status ${state}">${credited?'✓':partial?'◐':'○'}</span><div class="v572-course-copy"><strong>${esc(nameOf(r))}</strong><small class="${state}">${esc(sub)}</small></div><b>${fmt(hpOf(r))} hp</b></div>`;
  }

  function renderOrdinaryPlan(force=false){
    const root=document.getElementById('plannerClean');
    if(!root||document.querySelector('.screen.active')?.id!=='plannerClean')return false;
    root.querySelector('#sl-pace-picker')?.remove();
    const rows=baselineRows();if(!rows.length)return false;
    const sig=signature(rows);
    if(!force&&sig===lastSignature&&root.querySelector('.sl632-course'))return true;
    lastSignature=sig;
    const terms=grouped(rows);
    const accordion=root.querySelector('.v572-accordion');
    if(accordion){
      accordion.innerHTML=terms.map((t,idx)=>`<section class="v572-term-section ${idx===0?'open':''}" data-term-section="${t.term}"><button type="button" class="v572-term-head"><span>Termin ${t.term}</span><b>${fmt(t.hp)} hp</b><i>${idx===0?'⌃':'⌄'}</i></button><div class="v572-term-body">${t.rows.map(courseRow).join('')}</div></section>`).join('');
      accordion.querySelectorAll('.v572-term-head').forEach(btn=>btn.onclick=()=>{const s=btn.closest('.v572-term-section');const open=s.classList.toggle('open');btn.querySelector('i').textContent=open?'⌃':'⌄'});
    }
    const strip=root.querySelector('.v572-term-strip');
    if(strip){
      strip.innerHTML=terms.map(t=>`<button type="button" class="v572-term ${t.creditedHp>=t.hp-.01?'done':t.creditedHp>0?'part':''}" data-term="${t.term}"><b>T${t.term}</b><small>Termin ${t.term}</small><span class="sl632-circle"></span><strong>${fmt(t.hp)} hp</strong><em>${t.creditedHp>0?`${fmt(t.creditedHp)} hp kan hoppas över`:'Ordinarie'}</em><i>Visa</i></button>`).join('');
      strip.querySelectorAll('[data-term]').forEach(btn=>btn.onclick=()=>{const sec=root.querySelector(`[data-term-section="${btn.dataset.term}"]`);if(!sec)return;sec.classList.add('open');sec.querySelector('.v572-term-head i').textContent='⌃';sec.scrollIntoView({behavior:'smooth',block:'start'})});
    }
    const fast=root.querySelector('.v572-fast-inline');
    if(fast){
      fast.classList.remove('quiet');
      fast.innerHTML='<span>⚡</span><div><div><b>SNABBARE VÄG TILL EXAMEN</b></div><p>Se om tillgodoräknanden och högre studietakt kan korta vägen till examen.</p></div><button type="button" data-sl632-fast="1">Räkna ut snabbare väg →</button>';
      fast.querySelector('[data-sl632-fast]')?.addEventListener('click',openFastRoute,{once:true});
    }
    return true;
  }

  function calculate(pace){
    const base=baselineRows(),remaining=base.filter(r=>!isCredited(r));
    const ordinaryTerms=Math.max(0,...base.map(termOf));
    let term=1,used=0;const planned=[];
    remaining.forEach(r=>{const h=hpOf(r);if(used>0&&used+h>pace+.001){term++;used=0}planned.push({...r,__fastTerm:term});used+=h});
    const byTerm=new Map();planned.forEach(r=>{if(!byTerm.has(r.__fastTerm))byTerm.set(r.__fastTerm,[]);byTerm.get(r.__fastTerm).push(r)});
    const fastTerms=Math.max(0,...planned.map(r=>r.__fastTerm));
    return{pace,ordinaryTerms,fastTerms,saved:Math.max(0,ordinaryTerms-fastTerms),remainingHp:remaining.reduce((s,r)=>s+hpOf(r),0),terms:[...byTerm.entries()].map(([t,rs])=>({term:t,rows:rs,hp:rs.reduce((s,r)=>s+hpOf(r),0)}))};
  }
  function fastPanel(){
    const selected=Number(localStorage.getItem(FAST_PACE_KEY))||37.5,results=PACES.map(calculate),active=results.find(r=>r.pace===selected)||results[1];
    return `<div class="sl632-fast-sheet" role="dialog" aria-modal="true" aria-label="Snabbare väg"><div class="sl632-fast-head"><div><span>SNABBARE VÄG</span><h2>Hur snabbt kan du bli klar?</h2><p>Motorn behåller programkursernas ordning, tar bort belastningen för tillgodoräknade kurser och fyller terminer upp till vald takt.</p></div><button type="button" data-sl632-close>×</button></div><div class="sl632-results">${results.map(r=>`<button type="button" data-sl632-pace="${r.pace}" class="${r.pace===active.pace?'active':''}"><strong>${fmt(r.pace)} hp</strong><span>${r.fastTerms} terminer</span><small>${r.saved?`${r.saved} termin${r.saved===1?'':'er'} snabbare`:'Ingen tidsvinst'}</small></button>`).join('')}</div><div class="sl632-fast-summary"><strong>${fmt(active.remainingHp)} hp kvar att läsa</strong><span>Ordinarie program: ${active.ordinaryTerms} terminer · Snabbare väg: ${active.fastTerms} terminer</span></div><div class="sl632-fast-terms">${active.terms.map(t=>`<section><div><strong>Termin ${t.term}</strong><b>${fmt(t.hp)} hp</b></div>${t.rows.map(r=>`<p><span>${esc(nameOf(r))}</span><b>${fmt(hpOf(r))} hp</b></p>`).join('')}</section>`).join('')}</div><p class="sl632-caution">Preliminär plan. Förkunskapskrav, kursutbud och överlapp kan göra att en kurs inte går att tidigarelägga i praktiken.</p></div>`;
  }
  function openFastRoute(){let modal=document.getElementById('sl632-fast-modal');if(!modal){modal=document.createElement('div');modal.id='sl632-fast-modal';modal.className='sl632-fast-modal';document.body.appendChild(modal)}modal.innerHTML=fastPanel();modal.classList.add('open');document.body.classList.add('sl632-modal-open');modal.onclick=e=>{if(e.target===modal||e.target.closest('[data-sl632-close]'))closeFastRoute();const p=e.target.closest('[data-sl632-pace]');if(p){try{localStorage.setItem(FAST_PACE_KEY,p.dataset.sl632Pace)}catch(_){}modal.innerHTML=fastPanel()}}}
  function closeFastRoute(){document.getElementById('sl632-fast-modal')?.classList.remove('open');document.body.classList.remove('sl632-modal-open')}

  function schedule(force=false){requestAnimationFrame(()=>renderOrdinaryPlan(force))}
  ['studielots:screen-rendered','studielots:planner-open','studielots:pacechange'].forEach(n=>window.addEventListener(n,()=>schedule(false)));
  window.addEventListener('pageshow',()=>schedule(false));
  document.addEventListener('click',e=>{if(e.target.closest('[data-screen="plannerClean"]'))setTimeout(()=>renderOrdinaryPlan(false),50)},true);

  if(!document.getElementById('sl632-style')){
    const style=document.createElement('style');style.id='sl632-style';style.textContent=`#sl-pace-picker{display:none!important}.sl632-course.sl632-skip{background:#f0f8f4!important;opacity:.82}.sl632-course.sl632-skip .v572-course-copy strong{text-decoration:line-through;text-decoration-thickness:1px;text-decoration-color:#4d8c79}.sl632-course .v572-course-copy small.credited{color:#17745f!important;font-weight:800}.sl632-circle{width:30px;height:30px;border:3px solid #b7c1bd;border-radius:50%;display:block;margin:9px auto}.v572-term.done .sl632-circle{border-color:#2b9c77;background:#dff3eb}.v572-term.part .sl632-circle{border-color:#e9b020}.v572-term>strong{display:block;font-size:18px}.v572-term>em{display:block;font-style:normal;font-size:10px;color:#74807f;margin-top:2px}.v572-term>i{display:block;font-style:normal;color:#17745f;font-weight:800;font-size:11px;margin-top:6px}.v572-fast-inline [data-sl632-fast]{display:inline-flex!important;margin-top:10px;border:0;border-radius:999px;background:#176b5b;color:#fff;padding:10px 14px;font-weight:850}.sl632-fast-modal{display:none;position:fixed;inset:0;z-index:5000;background:rgba(8,32,35,.42);padding:18px;align-items:flex-end;justify-content:center}.sl632-fast-modal.open{display:flex}.sl632-modal-open{overflow:hidden!important}.sl632-fast-sheet{width:min(720px,100%);max-height:88dvh;overflow:auto;background:#fbfaf6;border-radius:28px 28px 20px 20px;padding:20px 18px calc(22px + env(safe-area-inset-bottom));box-shadow:0 24px 60px rgba(8,32,35,.28)}.sl632-fast-head{display:flex;align-items:flex-start;gap:14px;justify-content:space-between}.sl632-fast-head span{font-size:10px;letter-spacing:.12em;font-weight:900;color:#17745f}.sl632-fast-head h2{margin:4px 0 6px;font-size:26px;letter-spacing:-.035em}.sl632-fast-head p{margin:0;color:#69757d;font-size:12px;line-height:1.45}.sl632-fast-head button{border:0;background:#eef2ef;border-radius:50%;width:34px;height:34px;font-size:22px;color:#49615b}.sl632-results{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:18px 0}.sl632-results button{border:1px solid rgba(21,88,79,.14);border-radius:17px;background:#fff;padding:12px 6px;color:#15584f}.sl632-results button.active{background:#176b5b;color:#fff}.sl632-results strong,.sl632-results span,.sl632-results small{display:block}.sl632-results strong{font-size:17px}.sl632-results span{font-size:11px;margin-top:3px}.sl632-results small{font-size:9px;margin-top:4px;opacity:.82}.sl632-fast-summary{padding:13px 14px;border-radius:16px;background:#eef6f2;display:grid;gap:3px}.sl632-fast-summary strong{font-size:14px}.sl632-fast-summary span{font-size:11px;color:#60736e}.sl632-fast-terms{display:grid;gap:10px;margin-top:14px}.sl632-fast-terms section{background:#fff;border:1px solid rgba(21,88,79,.1);border-radius:17px;padding:12px}.sl632-fast-terms section>div,.sl632-fast-terms p{display:flex;justify-content:space-between;gap:12px}.sl632-fast-terms section>div{padding-bottom:8px;border-bottom:1px solid #edf0ee}.sl632-fast-terms p{margin:8px 0 0;font-size:11px}.sl632-fast-terms p span{min-width:0}.sl632-fast-terms p b{white-space:nowrap}.sl632-caution{font-size:10px;line-height:1.45;color:#7c8582;margin:14px 2px 0}`;document.head.appendChild(style)
  }
  schedule(true);
  window.__studielotsFasterRoute={version:VERSION,ordinaryPlanAlwaysBaseline:true,fastPaces:PACES.slice(),optIn:true,calculate,eventDriven:true,noMutationObserver:true};
})();
