(()=>{'use strict';
const root=window.StudieLotsV2;if(!root?.fast?.build||root.fast.__provisionalPlan)return;
const original=root.fast.build;
const hp=r=>Math.max(0,Number(r?.hp)||0);
const remaining=r=>Math.max(0,hp(r)-Math.min(hp(r),Math.max(0,Number(r?.creditedHp??(r?.credited?hp(r):0))||0)));
async function build(rows=[],options={}){
 const result=await original(rows,options);
 if(result.complete||result.terms?.length)return result;
 // A programme's existing semester order is a planning baseline, not a verified accelerated schedule.
 // Never assign real dates, assert earlier graduation or count these rows as scheduled credits.
 const groups=new Map();
 for(const row of rows){const left=remaining(row);if(left<.01)continue;const term=Math.max(1,Math.floor(Number(row.term)||1));if(!groups.has(term))groups.set(term,{key:term,label:`Termin ${term} · preliminär plan`,rows:[],hp:0,provisional:true});const group=groups.get(term);group.rows.push({...row,hp:left,credited:false,creditedHp:0,creditTransferCountsInStudyPlan:false,creditTransfer:null});group.hp+=left}
 return {...result,terms:[...groups.values()].sort((a,b)=>a.key-b.key),scheduledHp:0,complete:false,provisional:true,finishDate:null,provisionalReason:'Terminsordningen är ett preliminärt förslag utifrån programmets struktur. Kurstillfällen, behörighet och tillträde behöver bekräftas.'};
}
root.fast=Object.freeze({...root.fast,build,__provisionalPlan:true});
})();
