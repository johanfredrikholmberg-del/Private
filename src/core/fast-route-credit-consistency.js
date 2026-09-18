(()=>{'use strict';
// Keep informational matchedHp distinct from hp actually credited by the shared ledger.
// The planner's fast-route renderer reads creditedHp first; explicitly set zero for
// uncredited rows so a potential matchedHp cannot silently become a completed course.
const root=window.StudieLotsV2;
const consistency=root?.matchConsistency;
if(!consistency||typeof consistency.ledger!=='function'||consistency.__fastRouteCreditConsistency)return;
const original=consistency.ledger.bind(consistency);
function ledger(...args){
 const result=original(...args);
 if(!result||!Array.isArray(result.rows))return result;
 const rows=result.rows.map(row=>{
  if(row?.credited===true||row?.creditedHp!=null)return row;
  return {...row,creditedHp:0};
 });
 return Object.freeze({...result,rows});
}
root.matchConsistency=Object.freeze({...consistency,ledger,__fastRouteCreditConsistency:true});
})();
