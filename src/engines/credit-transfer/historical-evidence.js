(()=>{'use strict';
const root=window.StudieLotsEngines;
const previous=root?.creditTransfer;
if(!previous?.assess||previous.__historicalEvidenceV1)return;
const norm=v=>String(v??'').trim().toUpperCase();
const codeKey=v=>norm(v).replace(/[^A-Z0-9ÅÄÖ]/g,'');
const exactName=v=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const number=v=>{const m=String(v??'').replace(',','.').match(/\d+(?:\.\d+)?/);const n=m?Number(m[0]):0;return Number.isFinite(n)&&n>0?n:0};
const code=c=>norm(c?.code??c?.courseCode);
const decision=r=>String(r?.decision??r?.status??r?.result??'').trim().toLowerCase();
function approvals(source,target,history){
 const from=code(source),to=code(target),seen=new Set(),matches=[];
 const targetName=exactName(target?.name??target?.title??target?.courseName);
 if((!to&&!targetName)||!Array.isArray(history))return matches;
 for(const r of history){
  if(!/^(approved|bifall|granted)$/.test(decision(r)))continue;
  const historyFrom=codeKey(r?.sourceCode??r?.fromCode),sourceCode=codeKey(from);
  const sourceName=exactName(r?.sourceName??r?.fromName),targetSourceName=exactName(source?.name??source?.title??source?.courseName);
  const sourceMatches=(historyFrom&&sourceCode&&historyFrom===sourceCode)||(sourceName&&targetSourceName&&sourceName===targetSourceName);
  const historyTo=codeKey(r?.targetCode??r?.toCode),targetCode=codeKey(to);
  const historyTargetName=exactName(r?.targetName??r?.toName),targetCourseName=exactName(target?.name??target?.title??target?.courseName);
  const targetMatches=(historyTo&&targetCode&&historyTo===targetCode)||(historyTargetName&&targetCourseName&&historyTargetName===targetCourseName);
  if(!sourceMatches||!targetMatches)continue;
  const sourceHp=number(r?.sourceHp),targetHp=number(r?.targetHp);
  if(!sourceHp||!targetHp||sourceHp+0.01<number(source?.hp??source?.credits??source?.ects)||targetHp+0.01<number(target?.hp??target?.credits??target?.ects))continue;
  const id=norm(r?.id??r?.decisionId??r?.caseId);
  // Without a stable decision identifier we cannot establish a unique approval count.
  if(!id||seen.has(id))continue;
  seen.add(id);matches.push(r);
 }
 return matches;
}
function assess(source,target,options={}){
 const base=previous.assess(source,target,options);
 if(!base)return base;
 const matched=approvals(source,target,options.history);
 const historical={...(base.evidence?.historical||{}),approved:matched.length,verifiedApprovalCount:matched.length,decisionIds:matched.map(r=>String(r.id??r.decisionId??r.caseId))};
 const evidence={...base.evidence,historical};
 const reasons=(base.reasons||[]).filter(r=>!/^Historiskt stöd finns/.test(r));
 if(matched.length)reasons.push(`Historiska bifall: ${matched.length} st`);
 // Historical decisions add context, but never promote relevant evidence to strong.
 const classification=matched.length&&base.classification==='limited'?'relevant':base.classification;
 return Object.freeze({...base,classification,label:classification==='relevant'?'Relevant underlag':base.label,evidence,reasons});
}
root.creditTransfer=Object.freeze({...previous,assess,__historicalEvidenceV1:true});
})();
