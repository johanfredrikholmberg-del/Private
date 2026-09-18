(()=>{'use strict';
const root=window.StudieLotsV2,op=root?.opportunities,ctx=root?.appContext;
if(!op||!ctx||op.__subjectProgramScores)return;
const original=op.render.bind(op);
let generation=0;
const signature=()=>JSON.stringify(ctx.state.courses.map(c=>[c.code||c.courseCode||'',c.name||c.title||'',c.hp??c.credits??0,c.progression||c.level||'']));
const cache=new Map();
async function score(program,courses){
  if(program.structureCoverage!=='complete')return null;
  try{
    const data=await root.paths.structure(program,courses);
    const ledger=data?.creditLedger||root.matchConsistency?.ledger?.(data,courses);
    return ledger&&Number.isFinite(ledger.pct)&&Number.isFinite(ledger.credited)&&Number.isFinite(ledger.total)&&ledger.total>0
      ?Math.max(0,Math.min(100,Math.round(100*ledger.credited/ledger.total))):null;
  }catch(error){console.warn('[StudieLots subject programme score]',error);return null}
}
async function update(button,subject,kind,courses,key,run){
  const output=button.querySelector('[data-subject-score]');
  if(!output)return;
  const current=()=>run===generation&&signature()===key&&button.isConnected;
  try{
    const cacheKey=JSON.stringify([key,subject,kind]);
    let values=cache.get(cacheKey);
    if(!values){
      const programmes=await root.paths.discover(subject,kind);
      if(!current())return;
      values=(await Promise.all((Array.isArray(programmes)?programmes:[]).filter(p=>p.structureCoverage==='complete').map(p=>score(p,courses)))).filter(Number.isFinite);
      if(!current())return;
      cache.set(cacheKey,values);
    }
    if(!current())return;
    if(!values.length){output.textContent='';return}
    const low=Math.min(...values),high=Math.max(...values);
    output.textContent=low===high?`${low} %`:`${low}–${high} %`;
    output.setAttribute('aria-label',low===high?`${low} procent av programmet`:`Mellan ${low} och ${high} procent beroende på program`);
  }catch(error){console.warn('[StudieLots subject programme discovery]',error);if(current())output.textContent=''}
}
function render(){
  generation++;
  original();
  const run=generation,host=ctx.q('#opportunities .opportunity-list');
  if(!host||!ctx.state.courses.length)return;
  const buttons=[...host.querySelectorAll('[data-op]')],key=signature(),courses=ctx.state.courses.slice(),kind=op.levelKind();
  const subjects=buttons.map(button=>{
    const name=button.querySelector('.op-copy b')?.textContent||'';
    const subject=kind==='advanced'?name.replace(/, master\/magister$/,''):name;
    const scoreNode=document.createElement('strong');
    scoreNode.className='subject-program-score';scoreNode.dataset.subjectScore='';scoreNode.setAttribute('aria-live','polite');
    button.querySelector('.op-copy')?.appendChild(scoreNode);
    return{button,subject};
  });
  let next=0;
  async function worker(){while(next<subjects.length&&run===generation){const {button,subject}=subjects[next++];await update(button,subject,kind,courses,key,run)}}
  Promise.all(Array.from({length:Math.min(3,subjects.length)},worker)).catch(error=>console.warn('[StudieLots subject score workers]',error));
}
root.opportunities={...op,__subjectProgramScores:true,render};
if(ctx.q('#opportunities')?.classList.contains('active'))render();
})();