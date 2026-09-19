(()=>{'use strict';
const root=window.StudieLotsV2;if(!root?.fast?.build||root.fast.__provisionalPlan)return;
const original=root.fast.build;
const hp=r=>Math.max(0,Number(r?.hp)||0);
const remaining=r=>Math.max(0,hp(r)-Math.min(hp(r),Math.max(0,Number(r?.creditedHp??(r?.credited?hp(r):0))||0)));
const code=r=>String(r?.code||r?.courseCode||'').trim().toUpperCase();
function proposal(rows,maxHp){
 const active=rows.filter(r=>remaining(r)>.01).map((row,index)=>({row,index,left:remaining(row),term:Math.max(1,Math.floor(Number(row.term)||1))}));
 const done=new Set(rows.filter(r=>remaining(r)<.01).map(code).filter(Boolean));
 const groups=new Map(),placed=new Map(),pending=[...active];
 // This is a capacity/prerequisite hypothesis, never a claim that a course is offered in a given term.
 for(let pass=0;pass<active.length&&pending.length;pass++){
  let progress=false;
  for(let i=0;i<pending.length;){
   const item=pending[i],requirements=Array.isArray(item.row.prerequisiteCodes)?item.row.prerequisiteCodes.map(x=>String(x).trim().toUpperCase()).filter(Boolean):[];
   if(requirements.some(k=>!done.has(k)&&!placed.has(k))){i++;continue}
   const earliest=Math.max(1,...requirements.map(k=>placed.has(k)?placed.get(k)+1:1));
   let target=null;
   for(let t=earliest;t<=Math.max(item.term,earliest)+active.length;t++){
    const group=groups.get(t);if((group?.hp||0)+item.left<=maxHp+.001){target=t;break}
   }
   if(target===null){i++;continue}
   if(!groups.has(target))groups.set(target,{key:target,label:'Förslag · kurstillfällen ej verifierade',rows:[],hp:0,provisional:true});
   const group=groups.get(target);
   group.rows.push({...item.row,hp:item.left,credited:false,creditedHp:0,creditTransferCountsInStudyPlan:false,creditTransfer:null,__offer:null});group.hp+=item.left;
   if(code(item.row))placed.set(code(item.row),target);
   pending.splice(i,1);progress=true;
  }
  if(!progress)break;
 }
 // Never silently drop rows with missing prerequisites, oversized credits or cyclic dependencies.
 for(const item of pending){const term=Math.max(item.term,...[...groups.keys(),0])+1;if(!groups.has(term))groups.set(term,{key:term,label:'Behöver kontrolleras · preliminär',rows:[],hp:0,provisional:true});const group=groups.get(term);group.rows.push({...item.row,hp:item.left,credited:false,creditedHp:0,creditTransferCountsInStudyPlan:false,creditTransfer:null,__offer:null});group.hp+=item.left}
 return [...groups.values()].sort((a,b)=>a.key-b.key);
}
async function build(rows=[],options={}){
 const result=await original(rows,options);
 if(result.complete||result.terms?.length)return result;
 const maxHp=[30,37.5,45,60].includes(Number(options.maxHp))?Number(options.maxHp):30;
 return {...result,terms:proposal(rows,maxHp),scheduledHp:0,complete:false,provisional:true,finishDate:null,offeringCount:0,provisionalReason:'Detta är ett kapacitets- och förkunskapsbaserat planeringsförslag, inte en verifierad snabbare väg. Kurstillfällen, behörighet och tillträde måste kontrolleras.'};
}
root.fast=Object.freeze({...root.fast,build,__provisionalPlan:true});
})();
