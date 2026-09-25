(()=>{'use strict';
// Historical credit-transfer decisions are evidence only. This module never decides
// whether a course counts and deliberately exposes no countable/credited flag.
const root=window.StudieLotsEngines=window.StudieLotsEngines||{};
const decisions=[
 ['RE515669','Insekter: inventering och bestämning',5,'Insekter: inventering och bestämning',5,'BL7036','approved'],
 ['RE514563','Engelska A / Muntlig tentamen, uttal',1.5,'ENGA30-3400 :',2,'ENGA30-3400','approved'],
 ['RE513795','Engelska A för ämneslärare / Muntlig tentamen, uttal',1.5,'ENGL30-3400 :',2,'ENGL30-3400','approved'],
 ['RE513787','Engelsk språkfärdighet / Muntlig tentamen, uttal',1.5,'ENGA36-3400 :',2,'ENGA36-3400','approved'],
 ['RE513069','Omvårdnadsvetenskap, Förbättringskunskap och vetenskaplig metod',7.5,'OMG121-0051 :',3,'OMG121-0051','approved'],
 ['RE513062','Anatomi och fysiologi',15,'OMG121-0023 :',3,'OMG121-0023','approved'],
 ['RE510270','Sociologi GR (B)',30,'SOGB01 :',30,'SOGB01','approved'],
 ['RE510177','Företagsekonomi, grundkurs',30,'FEGB01 :',30,'FEGB01','approved'],
 ['RE508998','Lärarprofessionen och vetenskapligt förhållningssätt för lärare F-3',7.5,'LPAG13 :',7.5,'LPAG13','approved'],
 ['RE508305','Specialpedagogik som forsknings- och verksamhetsområde',15,'LPAS11 :',15,'LPAS11','approved'],
 ['RE507675','Lärarens didaktiska verktyg',6,'LPGG00 :',6,'LPGG00','approved'],
 ['RE506988','Engelska för grundlärare åk 4-6 (1-34,5)',34.5,'LPGG15 :',30,'LPGG15','approved'],
 ['RE505795','Separations- och apparatteknik',6,'CKGB55 :',7.5,'CKGB55','approved'],
 ['RE505788','Analys och linjär algebra',22.5,'MAGA54 :',7.5,'MAGA54','approved'],
 ['RE505749','Kemi med biokemi',22.5,'KEGA31 :',7.5,'KEGA31','approved'],
 ['RE504450','Samhällsorienterande ämnen för lärare årskurs F-3',15,'LPGG08 :',15,'LPGG08','approved'],
 ['RE504447','Engelska för lärare F-3',15,'LPGG07 :',15,'LPGG07','approved'],
 ['RE503729','Skola som system och idé - KPU / Skolans styrning',5,'LPGK23 :',6,'LPGK23','approved'],
 ['RE502514','Undersökningsmetodik / Tentamen Undersökningsmetodik',6,'NEGC47-2010 :',6,'NEGC47-2010','approved'],
 ['RE502444','Utvidgad juridisk introduktionskurs',15,'RVGA02 :',15,'RVGA02','approved'],
 ['RE500068','Portabla format / Praktisk uppgift - Webbläsares kompatibilitet',1,'ISGB13-1322 :',1,'ISGB13-1322','approved'],
 ['RE498691','Introduktion till innovationsteknik och design för högskoleingenjörer',7.5,'MSGA24 :',7.5,'MSGA24','approved']
].map(([id,sourceName,sourceHp,targetName,targetHp,targetCode,decision])=>Object.freeze({id,university:'Karlstads universitet',sourceName,sourceHp,targetName,targetHp,targetCode,decision}));
const kthReady=fetch('/data/kth/history/specific-1to1.json').then(r=>r.ok?r.json():[]).then(rows=>{for(const r of rows){decisions.push(Object.freeze({...r,source:'KTH'}))}return rows.length}).catch(()=>0);\nfunction forAssessment(){return decisions.map(d=>({id:d.id,sourceName:d.sourceName,sourceHp:d.sourceHp,targetName:d.targetName,targetHp:d.targetHp,targetCode:d.targetCode,decision:d.decision,status:d.decision,source:'Karlstads universitet'}))}
root.creditTransferHistory=Object.freeze({source:'historical decisions',decisions,forAssessment,ready:kthReady});
})();