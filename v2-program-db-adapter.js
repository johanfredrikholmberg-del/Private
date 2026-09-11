(()=>{'use strict';
const root=window.StudieLotsV2=window.StudieLotsV2||{},base=root.paths,db=root.programDB;if(!base||!db)return;
const norm=v=>String(v??'').toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
async function discover(subject,kind='candidate'){
 let remote=[];try{remote=await base.discover(subject,kind)}catch(_){remote=[]}
 try{const local=(await db.catalogue()).filter(p=>!subject||norm(p.subject)===norm(subject));if(!local.length)return remote;const seen=new Set(),out=[];for(const p of [...local,...remote]){const k=`${norm(p.university)}|${String(p.programCode||'').toUpperCase()}|${norm(p.programName)}`;if(seen.has(k))continue;seen.add(k);out.push(p)}out.meta={...(remote?.meta||{}),localDatabase:true};return out}catch(_){return remote}
}
async function structure(item,merits=[]){
 try{const local=await db.structure(item);if(local){const rows=base.allocateProgrammeMatches(local.courses,merits,item.subject||'');return{item,source:'studielots-program-db',verified:local.verified===true,rows,totalHp:Number(local.totalHp)||rows.reduce((s,x)=>s+Number(x.hp||0),0),creditedHp:rows.filter(x=>x.credited).reduce((s,x)=>s+Number(x.matchedHp||x.hp||0),0),potentialHp:rows.filter(x=>x.creditMatch==='potential'||x.creditMatch==='partial').reduce((s,x)=>s+Number(x.matchedHp||0),0),dbId:local.dbId,validFrom:local.validFrom,validTo:local.validTo,sourceUrls:local.sourceUrls||[]}}
 }catch(_){}
 return base.structure(item,merits)
}
root.paths=Object.freeze({...base,discover,structure,__localProgrammeDB:true});
})();
