(function(global){'use strict';
const positive=value=>{const n=Number(value);return Number.isFinite(n)?Math.max(0,n):0};
function historicalIds(row){
 const h=row?.creditTransfer?.evidence?.historical;
 if(!h||!Number.isInteger(Number(h.verifiedApprovalCount))||Number(h.verifiedApprovalCount)<=0)return[];
 return [...new Set((Array.isArray(h.decisionIds)?h.decisionIds:[]).map(String).filter(Boolean))].slice(0,Number(h.verifiedApprovalCount));
}
function describe(row){
 const transfer=row?.creditTransfer,classification=transfer?.classification||'',direct=row?.credited===true;
 const historicalApprovalCount=positive(transfer?.evidence?.historical?.verifiedApprovalCount??transfer?.evidence?.historical?.approved); const countsTransfer=classification==='strong'||(classification==='relevant'&&historicalApprovalCount>0); const matchedHp=direct?positive(row?.creditedHp??row?.matchedHp??row?.hp):row?.creditTransferCountsInStudyPlan===true&&countsTransfer?positive(row?.creditTransferMatchedHp):0;
 const status=direct?'Direkt matchad merit':classification==='strong'?'Starkt underlag':classification==='relevant'?'Relevant underlag':classification==='limited'?'Begränsat underlag':'Ingen bedömning';
 return Object.freeze({status,classification,direct,matchedHp:Math.min(positive(row?.hp),matchedHp),sourceName:String(row?.matchedCourse||row?.creditTransferMatchedCourse||'').trim(),historicalIds:historicalIds(row),reasons:Array.isArray(transfer?.reasons)?transfer.reasons.filter(x=>typeof x==='string'&&x.trim()):[],differences:Array.isArray(transfer?.differences)?transfer.differences.filter(x=>typeof x==='string'&&x.trim()):[]});
}
function summarize(rows){
 const counts={direct:0,strong:0,relevant:0,limited:0,matched:0},history=new Set();
 for(const row of Array.isArray(rows)?rows:[]){const detail=describe(row);if(detail.direct)counts.direct++;else if(detail.classification in counts)counts[detail.classification]++;if(detail.direct||detail.classification)counts.matched++;detail.historicalIds.forEach(id=>history.add(id))}
 return Object.freeze({...counts,historicalApprovals:history.size});
}
const api=Object.freeze({describe,summarize});
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(global)global.StudieLotsEvidenceModel=api;
})(typeof globalThis!=='undefined'?globalThis:undefined);
