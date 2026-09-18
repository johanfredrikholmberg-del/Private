(()=>{'use strict';
const root=window.StudieLotsV2=window.StudieLotsV2||{},fast=root.fast;
if(!fast||fast.__scheduleValidated||typeof fast.build!=='function')return;
const original=fast.build.bind(fast),day=86400000;
const date=value=>{if(!value)return null;const t=Date.parse(value);return Number.isFinite(t)?t:null};
const number=value=>{const n=Number(value);return Number.isFinite(n)?Math.max(0,n):0};
const courseKey=row=>String(row?.code||row?.courseCode||'').trim().toUpperCase();
const endOf=offer=>date(offer?.endDate||offer?.end||offer?.to);
const startOf=offer=>date(offer?.startDate||offer?.start||offer?.from);
const standalone=offer=>offer?.standaloneSearchable===true||offer?.standalone===true||offer?.applicationType==='standalone';
const requiresStandalone=s=>s?.discovered===true||s?.reasons?.includes('Verifierat alternativ');
function check(s){const offer=s?.offer,start=startOf(offer),end=endOf(offer);if(!offer?.url||start===null||end===null||end<start)return 'Verifierade start- och slutdatum saknas eller är ogiltiga';if(requiresStandalone(s)&&!standalone(offer))return 'Kursen är inte verifierad som sökbar fristående';return ''}
async function build(rows,opts={}){const result=await original(rows,opts);if(!result||!Array.isArray(result.suggestions))return result;
 const rejected=new Map(),valid=[];
 for(const s of result.suggestions){const reason=check(s);if(reason)rejected.set(courseKey(s),reason);else valid.push(s)}
 const terms=(result.terms||[]).map(t=>({...t,rows:(t.rows||[]).filter(r=>!rejected.has(courseKey(r)))})).filter(t=>t.rows.length);
 const unscheduled=[...(result.unscheduled||[])];for(const s of result.suggestions){const reason=rejected.get(courseKey(s));if(reason)unscheduled.push({row:(rows||[]).find(r=>courseKey(r)===courseKey(s))||{code:s.courseCode,name:s.courseName,hp:s.requiredHp},reason})}
 // Verify that actual dated offerings do not overrun a 30/37.5/45/60 hp semester.
 const maxHp=number(opts.maxHp)||30;for(const t of terms){const load=t.rows.reduce((sum,r)=>sum+number(r.hp),0);if(load>maxHp+.01){for(const r of t.rows)unscheduled.push({row:r,reason:'Terminen överskrider vald studietakt'});t.rows=[]}}
 const safeTerms=terms.filter(t=>t.rows.length),scheduledHp=safeTerms.reduce((sum,t)=>sum+t.rows.reduce((n,r)=>n+number(r.hp),0),0);
 const complete=unscheduled.length===0&&scheduledHp+.01>=number(result.remainingHp);
 return {...result,terms:safeTerms,suggestions:valid.filter(s=>safeTerms.some(t=>t.rows.some(r=>courseKey(r)===courseKey(s)))),acceleratingSuggestions:valid.filter(s=>s.accelerates&&safeTerms.some(t=>t.rows.some(r=>courseKey(r)===courseKey(s)))),unscheduled,scheduledHp,accelerationCount:complete?valid.filter(s=>s.accelerates).length:0,provisional:!complete,datesValidated:true};
}
root.fast=Object.freeze({...fast,build,__scheduleValidated:true});
})();
