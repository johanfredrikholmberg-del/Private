(()=>{
  'use strict';
  const VERSION='630';
  const norm=v=>String(v??'').trim();
  const low=v=>norm(v).toLocaleLowerCase('sv-SE');
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
  const hpOf=r=>num(r?.hp??r?.credits??r?.ects??r?.points);
  const courseKey=r=>norm(r?.code||r?.courseCode||r?.name||r?.courseName).toUpperCase();

  function getSnapshot(){
    try{return JSON.parse(sessionStorage.getItem('studielots_planner_snapshot')||'null')}catch(_){return null}
  }
  function programmeCandidates(snapshot){
    let rows=[];
    try{rows=typeof window.normalizedProgramCatalog==='function'?window.normalizedProgramCatalog():[]}catch(_){rows=[]}
    if(!Array.isArray(rows))return[];
    const university=low(snapshot?.program?.university||snapshot?.selection?.university);
    const subject=low(snapshot?.selection?.subject||'');
    const programmeName=low(snapshot?.program?.name||'');
    return rows.filter(p=>{
      if(!p||p.catalogOnly||!Array.isArray(p.courses)||p.courses.length<2)return false;
      if(university&&low(p.university)!==university)return false;
      return true;
    }).map(p=>{
      let score=0;
      const track=low(p.track||'');
      const name=low(p.name||'');
      if(subject&&track===subject)score+=100;
      if(subject&&name.includes(subject))score+=55;
      if(programmeName&&name===programmeName)score+=45;
      if(programmeName&&name&&programmeName.includes(name))score+=20;
      if(p.academicYear==='2026/2027')score+=20;
      if(p.engine==='v2')score+=10;
      if(p.coverage==='complete')score+=20;else if(p.coverage==='partial')score+=10;
      score+=Math.min(25,(p.courses||[]).filter(c=>num(c.hp)>0).length);
      score+=(p.courses||[]).some(c=>c.year||c.term||c.semester)?20:0;
      return {p,score};
    }).sort((a,b)=>b.score-a.score);
  }

  function matchParts(programme){
    try{
      if(typeof window.estimateProgram==='function'){
        const est=window.estimateProgram(programme);
        if(Array.isArray(est?.parts))return est.parts;
      }
    }catch(_){}
    return[];
  }
  function partForCourse(parts,c){
    const key=courseKey(c);
    return parts.find(x=>courseKey(x?.pc)===key)||parts.find(x=>low(x?.pc?.name)===low(c?.name))||null;
  }
  function explicitTerm(c){
    const t=Number(c?.term??c?.semester??c?.termNo);
    return Number.isFinite(t)&&t>0?t:0;
  }
  function buildRows(programme){
    const parts=matchParts(programme);
    const rows=[];
    const yearLoad={};
    let globalLoad=0;
    (programme.courses||[]).forEach((c,index)=>{
      const h=hpOf(c);if(h<=0)return;
      let term=explicitTerm(c);
      const y=Number(c?.year)||0;
      if(!term&&y>0){
        const used=yearLoad[y]||0;
        term=(y-1)*2+Math.floor(used/30)+1;
        yearLoad[y]=used+h;
      }
      if(!term){term=Math.floor(globalLoad/30)+1;globalLoad+=h}
      const part=partForCourse(parts,c);
      const matched=Math.min(h,num(part?.hp));
      const exact=part?.matchType==='replace'&&matched>=h-.01;
      const partial=!exact&&matched>0;
      rows.push({...c,term,semester:term,originalTerm:term,__slOriginalTerm:term,__slOriginalIndex:index,
        status:exact?'credited':partial?'partial':'remaining',credited:exact,isCredited:exact,matchedHp:matched,
        matchType:part?.matchType||'none',matchReason:part?.reason||'',programmeSource:'catalog',programmeId:programme.id});
    });
    return rows.sort((a,b)=>a.term-b.term||a.__slOriginalIndex-b.__slOriginalIndex);
  }
  function sameShape(a,b){
    if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length)return false;
    return a.every((r,i)=>courseKey(r)===courseKey(b[i])&&Number(r.term)===Number(b[i].term)&&r.status===b[i].status);
  }
  function installRealProgrammeRows(){
    const snap=getSnapshot();if(!snap)return false;
    const best=programmeCandidates(snap)[0];if(!best||best.score<45)return false;
    const rows=buildRows(best.p);if(rows.length<2)return false;
    const current=Array.isArray(snap.rows)?snap.rows:[];
    if(snap.programmeStructureSource==='catalog-v630'&&sameShape(current,rows))return true;
    const creditedHp=rows.filter(r=>r.status==='credited').reduce((s,r)=>s+hpOf(r),0)+rows.filter(r=>r.status==='partial').reduce((s,r)=>s+num(r.matchedHp),0);
    const totalHp=num(best.p.hp)||rows.reduce((s,r)=>s+hpOf(r),0);
    const next={...snap,
      program:{...(snap.program||{}),id:best.p.id,name:best.p.name,university:best.p.university,code:best.p.code||snap?.program?.code||''},
      rows,totalHp,creditedHp,remainingHp:Math.max(0,totalHp-creditedHp),
      programmeStructureSource:'catalog-v630',programmeStructureVerified:Boolean(best.p.verified),programmeStructureCoverage:best.p.coverage||'',programmeStructureVersion:VERSION};
    try{sessionStorage.setItem('studielots_planner_snapshot',JSON.stringify(next))}catch(_){}
    window.__studielotsLastProgramSchedule={...next,rows,plannerBaselineRows:rows,scheduleSource:'real-programme-courses-v630'};
    window.__studielotsPlannerProgramme={version:VERSION,programmeId:best.p.id,programmeCode:best.p.code||'',courses:rows.length,score:best.score};
    window.dispatchEvent(new CustomEvent('studielots:planner-open',{detail:{source:'v630-real-programme'}}));
    return true;
  }
  function run(){
    if(document.querySelector('.screen.active')?.id!=='plannerClean')return;
    installRealProgrammeRows();
  }
  ['studielots:screen-rendered','studielots:planner-open'].forEach(n=>window.addEventListener(n,()=>setTimeout(run,0)));
  document.addEventListener('click',e=>{if(e.target.closest('[data-screen="plannerClean"]'))setTimeout(run,80)},true);
  window.addEventListener('pageshow',()=>setTimeout(run,50));
  setTimeout(run,100);
  window.__studielotsRealProgrammePlanner={version:VERSION,install:installRealProgrammeRows};
})();
