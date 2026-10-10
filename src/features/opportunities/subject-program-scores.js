(()=>{'use strict';
const root=window.StudieLotsV2,op=root?.opportunities,ctx=root?.appContext;
if(!op||!ctx||op.__subjectProgramScores)return;
const original=op.render.bind(op);
let generation=0;
const signature=()=>JSON.stringify([ctx.state.startTerm,ctx.state.courses.map(c=>[c.code||c.courseCode||'',c.name||c.title||'',c.hp??c.credits??0,c.progression||c.level||''])]);
const cache=new Map();
async function score(program,courses){
  try{
    const data=await root.paths.structure(program,courses);
    const ledger=data?.creditLedger||root.matchConsistency?.ledger?.(data,courses);
    return ledger&&Number.isFinite(ledger.pct)&&Number.isFinite(ledger.credited)&&Number.isFinite(ledger.total)&&ledger.total>0
      ?{pct:Math.max(0,Math.min(100,Math.round(100*ledger.credited/ledger.total))),bestBranch:data?.branch?.name||data?.item?.selectedBranch?.name||''}:null;
  }catch(error){console.warn('[StudieLots subject programme score]',error);return null}
}
async function update(button,subject,kind,courses,key,run){
  const output=button.querySelector('[data-subject-score]');
  if(!output)return;
  const current=()=>run===generation&&signature()===key&&button.isConnected;
  try{
    const cacheKey=JSON.stringify([key,subject,kind]);
    let result=cache.get(cacheKey);
    if(!result){
      const programmes=await root.paths.discover(subject,kind);
      if(!current())return;
      const values=(await Promise.all((Array.isArray(programmes)?programmes:[]).map(p=>score(p,courses)))).filter(x=>x&&Number.isFinite(x.pct));
      if(!current())return;
      result={values,count:programmes.length};cache.set(cacheKey,result);
    }
    if(!current())return;
    const {values,count}=result;
    if(!values.length){output.textContent='—';const detail=button.querySelector('.op-copy span');if(detail)detail.textContent=count?'Program finns, men verifierad plan saknas för vald termin':kind==='advanced'?'Inga avancerade program i vald termin':'Inga grundnivåprogram i vald termin';return}
    const low=Math.min(...values.map(x=>x.pct)),high=Math.max(...values.map(x=>x.pct));
    output.textContent=low===high?`${low} %`:`${low}–${high} %`;
    output.setAttribute('aria-label',low===high?`${low} procent av programmet`:`Mellan ${low} och ${high} procent beroende på program`);
  }catch(error){console.warn('[StudieLots subject programme discovery]',error);if(current())output.textContent=''}
}
function render(){
  generation++;
  original();
  const run=generation,host=ctx.q('#opportunities .opportunity-list');
  if(!host||!ctx.state.courses.length)return;
  const note=host.querySelector('.program-section-note');
  if(note)note.textContent='Se hur långt dina meriter räcker i olika program.';
  const buttons=[...host.querySelectorAll('[data-op]')],key=signature(),courses=ctx.state.courses.slice(),kind=op.levelKind();
  const subjects=buttons.map(button=>{
    const name=button.querySelector('.op-copy b')?.textContent||'';
    const subject=kind==='advanced'?name.replace(/, master\/magister$/,''):name;
    const scoreNode=document.createElement('strong');
    scoreNode.className='subject-program-score';scoreNode.dataset.subjectScore='';scoreNode.setAttribute('aria-live','polite');
    scoreNode.style.cssText='position:absolute;right:38px;top:17px;font-size:15px;font-weight:850;color:var(--teal);white-space:nowrap;font-variant-numeric:tabular-nums';
    button.style.paddingRight='112px';
    button.appendChild(scoreNode);
    return{button,subject};
  });
  let next=0;
  async function worker(){while(next<subjects.length&&run===generation){const {button,subject}=subjects[next++];await update(button,subject,kind,courses,key,run)}}
  Promise.all(Array.from({length:Math.min(3,subjects.length)},worker)).catch(error=>console.warn('[StudieLots subject score workers]',error));
}
op.render=render;op.__subjectProgramScores=true;root.opportunities=op;
if(ctx.q('#opportunities')?.classList.contains('active'))render();
})();
