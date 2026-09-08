(()=>{'use strict';
const rows=[
['Företagsekonomi','Göteborgs universitet','Ekonomie kandidatprogram'],
['Företagsekonomi','Lunds universitet','Ekonomie kandidatprogram'],
['Företagsekonomi','Stockholms universitet','Kandidatprogram i företagsekonomi'],
['Företagsekonomi','Uppsala universitet','Ekonomie kandidatprogram'],
['Företagsekonomi','Umeå universitet','Ekonomie kandidatprogram'],
['Företagsekonomi','Linköpings universitet','Civilekonomprogrammet'],
['Psykologi','Göteborgs universitet','Kandidatprogram i psykologi'],
['Psykologi','Lunds universitet','Kandidatprogram i psykologi'],
['Psykologi','Stockholms universitet','Kandidatprogram i psykologi'],
['Psykologi','Umeå universitet','Kandidatprogram i psykologi'],
['Idrottsvetenskap','Göteborgs universitet','Idrottsvetenskapligt program'],
['Idrottsvetenskap','Malmö universitet','Idrottsvetenskapligt program'],
['Idrottsvetenskap','Mittuniversitetet','Idrottsvetenskapligt program'],
['Nationalekonomi','Göteborgs universitet','Ekonomie kandidatprogram'],
['Nationalekonomi','Lunds universitet','Ekonomie kandidatprogram'],
['Nationalekonomi','Stockholms universitet','Kandidatprogram i nationalekonomi och statistik'],
['Statsvetenskap','Göteborgs universitet','Statsvetarprogrammet'],
['Statsvetenskap','Lunds universitet','Politices kandidatprogrammet'],
['Statsvetenskap','Uppsala universitet','Politices kandidatprogram'],
['Folkhälsovetenskap','Göteborgs universitet','Kandidatprogram i folkhälsovetenskap'],
['Folkhälsovetenskap','Mälardalens universitet','Folkhälsovetenskapliga programmet']
].map(([subject,university,programName])=>({subject,university,programName,source:'studielots-index',verifiedDegreeRule:false}));
const norm=v=>String(v??'').toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
function find(subject,kind='candidate'){if(norm(kind)!=='candidate')return[];const s=norm(subject);return rows.filter(x=>norm(x.subject)===s).map(x=>({...x}))}
function all(){return rows.map(x=>({...x}))}
window.StudieLotsV2=window.StudieLotsV2||{};window.StudieLotsV2.programIndex=Object.freeze({find,all});
})();