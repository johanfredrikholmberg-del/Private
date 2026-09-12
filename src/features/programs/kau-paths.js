(()=>{'use strict';
const root=window.StudieLotsV2=window.StudieLotsV2||{},old=root.paths;if(!old?.structure)return;
const norm=v=>String(v??'').toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
const isKarlstad=u=>/karlstads universitet|(^|\s)kau(\s|$)/.test(norm(u));
async function getJson(url,timeout=15000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{const r=await fetch(url,{signal:controller.signal,headers:{accept:'application/json'}});if(!r.ok)throw Error(`HTTP ${r.status}`);return await r.json()}finally{clearTimeout(timer)}}
async function structure(item,merits=[]){
 if(!isKarlstad(item?.university))return old.structure(item,merits);
 const qs=new URLSearchParams({name:item.programName||'',university:item.university||''});if(item.programCode)qs.set('code',item.programCode);if(item.programHp)qs.set('hp',String(item.programHp));if(item.subject)qs.set('subject',item.subject);
 try{const data=await getJson('/api/kau-program-structure?'+qs,15000);if(data?.found&&data?.structureAvailable&&Array.isArray(data.courses)&&data.courses.length>=2){const rows=old.allocateProgrammeMatches(data.courses,merits,item.subject||'');return{item,source:data.source||'kau-official-program-page',verified:true,rows,totalHp:Number(data.totalHp)||Number(item.programHp)||rows.reduce((s,x)=>s+Number(x.hp||0),0),creditedHp:rows.filter(x=>x.credited).reduce((s,x)=>s+Number(x.matchedHp||x.hp||0),0),potentialHp:rows.filter(x=>x.creditMatch==='potential'||x.creditMatch==='partial').reduce((s,x)=>s+Number(x.matchedHp||0),0),coverage:data.coverage||'',choiceRequired:data.choiceRequired===true,sourceUrls:data.sourceUrls||[]}}
 }catch(_){}
 return old.structure(item,merits)
}
root.paths=Object.freeze({...old,structure,__karlstadOfficial:true});
})();
