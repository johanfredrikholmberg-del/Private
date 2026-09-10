(()=>{'use strict';
const root=window.StudieLotsV2=window.StudieLotsV2||{};
const paths=root.paths;if(!paths||paths.__discoverGuard||typeof paths.discover!=='function')return;
const original=paths.discover.bind(paths);
function wait(ms){return new Promise(resolve=>setTimeout(()=>resolve(null),ms))}
async function discover(subject,kind='candidate'){
 const local=root.programIndex?.find?.(subject,kind)||[];
 try{
  const result=await Promise.race([original(subject,kind),wait(local.length?5500:10000)]);
  if(Array.isArray(result)&&result.length)return result;
 }catch(_){}
 if(local.length){local.meta={temporarilyUnavailable:true,source:'studielots-index-fallback',guarded:true};return local}
 const empty=[];empty.meta={temporarilyUnavailable:true,source:'timeout',guarded:true};return empty
}
root.paths=Object.freeze({...paths,__discoverGuard:true,discover});
})();