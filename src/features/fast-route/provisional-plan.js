(()=>{'use strict';
const root=window.StudieLotsV2;if(!root?.fast?.build||root.fast.__provisionalPlan)return;
const original=root.fast.build;
const hp=r=>Math.max(0,Number(r?.hp)||0);
const remaining=r=>Math.max(0,hp(r)-Math.min(hp(r),Math.max(0,Number(r?.creditedHp??(r?.credited?hp(r):0))||0)));
async function build(rows=[],options={}){
 const result=await original(rows,options);
 if(result.complete||result.terms?.length)return result;
 // The programme's semester order is a fallback, not a verified accelerated schedule.
 // termHtml already renders the term number: keep the label free of duplicate numbering.
 const groups=new Map();
 for(const row of rows){const left=remaining(row);if(left<.01)continue;const term=Math.max(1,Math.floor(Number(row.term)||1));if(!groups.has(term))groups.set(term,{key:term,label:'Preliminär plan',rows:[],hp:0,provisional:true});const group=groups.get(term);group.rows.push({...row,hp:left,credited:false,creditedHp:0,creditTransferCountsInStudyPlan:false,creditTransfer:null});group.hp+=left}
 return {...result,terms:[...groups.values()].sort((a,b)=>a.key-b.key),scheduledHp:0,complete:false,provisional:true,finishDate:null,offeringCount:0,provisionalReason:'Inga verifierade kurstillfällen kunde schemaläggas. Terminsordningen är endast ett preliminärt förslag; behörighet, tillträde och datum behöver bekräftas.'};
}
root.fast=Object.freeze({...root.fast,build,__provisionalPlan:true});
})();
