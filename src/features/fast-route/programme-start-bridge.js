(()=>{'use strict';
const root=window.StudieLotsV2;
if(!root?.fast?.build||root.fast.__programmeStartBridge)return;
const original=root.fast.build;
const valid=v=>{if(!v)return'';const d=new Date(v);return Number.isFinite(d.getTime())?d.toISOString():''};
function programmeStart(){const state=root.appContext?.state||{},data=state.plannerData||{},item=data.item||{};
// Never substitute today's date or the catalogue year for the selected programme's start.
return valid(item.startDate)||valid(item.programmeStartDate)||valid(item.programStartDate)||valid(item.start)||valid(data.startDate)||valid(data.programmeStartDate)||'';
}
async function build(rows,options={}){return original(rows,{...options,startDate:valid(options.startDate||options.programmeStartDate||options.programStartDate)||programmeStart()})}
root.fast=Object.freeze({...root.fast,build,__programmeStartBridge:true});
})();
