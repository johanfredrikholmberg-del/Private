import { readFile, writeFile } from "node:fs/promises";
const root = process.cwd();
const stamp = new Date().toISOString();
const mainPath = `${root}/data/studielots-db/programme-structures-ht26.json`;
const main = JSON.parse(await readFile(mainPath, "utf8"));
const rows = {
  H1LIB: [
    {term:1,code:"LIB210",name:"Trivium",hp:30,category:"mandatory",isSlot:false,courseCodeVerified:true},
    {term:2,code:"LIB220",name:"Quadrivium 1",hp:30,category:"mandatory",isSlot:false,courseCodeVerified:true},
    {term:3,code:"LIB230",name:"Quadrivium 2",hp:30,category:"mandatory",isSlot:false,courseCodeVerified:true},
    {term:4,code:"LIB240",name:"Idéer om ideal",hp:30,category:"mandatory",isSlot:false,courseCodeVerified:true},
    {term:5,code:"",name:"Praktikprojekt eller andra kurser",hp:30,category:"choice",isSlot:true,slotType:"choice-slot",choiceSlots:1,courseCodeVerified:false,options:[{code:"LIB250",name:"Praktikprojekt",hp:30},{name:"Andra kurser",hp:30}]},
    {term:6,code:"LIB260",name:"Uppsatstermin",hp:30,category:"mandatory",isSlot:false,courseCodeVerified:true},
  ],
  S1MKG: [
    {term:1,code:"MK1104",name:"Medie- och kommunikationsvetenskap, introduktionskurs",hp:30,category:"mandatory",isSlot:false,courseCodeVerified:true},
    {term:2,code:"MK1207",name:"Medie- och kommunikationsvetenskap, fortsättningskurs",hp:30,category:"mandatory",isSlot:false,courseCodeVerified:true},
    {term:3,code:"MK1501",name:"Medie- och kommunikationsvetenskap, fördjupningskurs",hp:30,category:"mandatory",isSlot:false,courseCodeVerified:true,thesisHp:15},
    {term:4,code:"MK1403",name:"Analys av medier, opinioner och kommunikation",hp:30,category:"mandatory",isSlot:false,courseCodeVerified:true},
    {term:5,code:"MK1404",name:"Samhälle, organisation och kommunikation",hp:30,category:"mandatory",isSlot:false,courseCodeVerified:true},
    {term:6,code:"",name:"Valfri(a) kurs(er)",hp:30,category:"elective",isSlot:true,slotType:"elective-slot",courseCodeVerified:false,choiceScope:"Fristående kurs i valfritt ämne, utlandsstudier eller verksamhetsförlagd utbildning."},
  ],
  N1BIO: [
    {term:1,code:"BIO900",name:"Cellbiologi, baskurs",hp:15,category:"mandatory",isSlot:false,courseCodeVerified:true},
    {term:1,code:"BIO906",name:"Molekylär genetik och evolution, baskurs",hp:15,category:"mandatory",isSlot:false,courseCodeVerified:true},
    {term:2,code:"BIO911",name:"Botanisk och zoologisk fysiologi, baskurs",hp:12,category:"mandatory",isSlot:false,courseCodeVerified:true},
    {term:2,code:"BIO916",name:"Biodiversitet och ekologi, baskurs",hp:18,category:"mandatory",isSlot:false,courseCodeVerified:true},
    {term:3,code:"",name:"Valbar fördjupningskurs inom biologi",hp:15,category:"elective",isSlot:true,slotType:"elective-slot",courseCodeVerified:false,options:[
      {code:"BIO214",name:"Dynamik i naturliga populationer - från individ till ekosystem",hp:15},
      {code:"BIO232",name:"Humanfysiologi",hp:15},{code:"BIO281",name:"Naturvård i landmiljöer",hp:15},
      {code:"BIO210",name:"Bioinformatik och funktionsgenomik",hp:15},{code:"MAR267",name:"Marin biodiversitet",hp:15},
    ]},
    {term:3,code:"BIO172",name:"Biostatistik och experimentdesign, enfaktorsanalyser",hp:7.5,category:"mandatory",isSlot:false,courseCodeVerified:true},
    {term:3,code:"NTH001",name:"Teoretiska och historiska perspektiv på naturvetenskap",hp:7.5,category:"mandatory",isSlot:false,courseCodeVerified:true},
  ],
};
const urls = {
 H1LIB:["https://www.gu.se/studera/hitta-utbildning/liberal-arts-kandidatprogram-h1lib","https://www.gu.se/sites/default/files/2021-03/H1LIB-Liberal-arts-%20kandidatprogram-%20utbildningsplan.pdf","https://www.gu.se/syllabus/3ace1356-4a32-11f1-be3c-4a792d2f4605"],
 S1MKG:["https://www.gu.se/studera/hitta-utbildning/medie-och-kommunikationsvetarprogrammet-s1mkg","https://www.gu.se/sites/default/files/2020-06/S1MKG-sv.pdf","https://www.gu.se/studera/hitta-utbildning/medie-och-kommunikationsvetenskap-introduktionskurs-mk1104/kursplan/8ff615c7-3d51-11f0-b454-10049b20482b"],
 N1BIO:["https://www.gu.se/studera/hitta-utbildning/biologi-kandidatprogram-n1bio","https://www.gu.se/syllabus/c552e9e7-117f-11f1-a595-2099b7b04bbf","https://www.gu.se/studera/hitta-utbildning/mer-om-kandidatprogrammet-i-biologi","https://studentportal.gu.se/program/kandidatprogrammet-i-biologi"],
};
const config={H1LIB:["choice-required",null,"verified"],S1MKG:["choice-required",null,"verified"],N1BIO:["partial-structure","official-gu-partial-term-sequence","processed"]};
function quality(rs,total,sourcePages){const termHp={},completeTerms=[];for(let t=1;t<=6;t++){const a=rs.filter(x=>x.term===t),mandatoryHp=a.filter(x=>x.category==="mandatory").reduce((s,x)=>s+x.hp,0),electiveListedHp=a.filter(x=>x.category==="elective"||x.category==="choice").reduce((s,x)=>s+x.hp,0),listedHp=a.reduce((s,x)=>s+x.hp,0),covered=listedHp===30;if(covered)completeTerms.push(t);termHp[t]={mandatoryHp,listedHp,electiveListedHp,explicitElectiveRequiredHp:0,unknownHp:0,covered,fixedUnlabelled:false};}return{complete:false,expectedTerms:6,completeTerms,termHp,slotCount:rs.filter(x=>x.isSlot).length,totalHp:total,sourcePages,parsedRows:rs.length};}
for(const code of Object.keys(rows)){const e=main.find(x=>x.university==="Göteborgs universitet"&&x.programCode===code);if(!e)throw new Error("Missing "+code);const [coverage,reason,status]=config[code];Object.assign(e,{status,coverage,reason,rows:rows[code],source:"gu-official-programme-syllabus",sourceUrl:urls[code][0],sourceUrls:urls[code],checkedAt:stamp,verified:true,courseCodesVerified:true,choiceRequired:true,sourceEvidenceUrl:code==="N1BIO"?urls[code][2]:urls[code][1],term:"HT26",apiCoverage:"partial-or-choice-dependent",apiConfidence:"official-partial",quality:quality(rows[code],e.hp,urls[code].length)});}
await writeFile(mainPath,JSON.stringify(main,null,2)+"\n");
const gu=main.filter(x=>x.university==="Göteborgs universitet"),catMap={complete:"complete","choice-required":"choiceRequired","course-codes-unverified":"courseCodesUnverified","partial-structure":"partial","metadata-only":"metadataOnly","manual-review":"manualReview"},counts={};
for(const e of gu){const c=catMap[e.coverage];if(c)counts[c]=(counts[c]||0)+1;}
const coveragePath=`${root}/data/import-reviews/gu-coverage.json`,coverage=JSON.parse(await readFile(coveragePath,"utf8"));
coverage.generatedAt=stamp;coverage.structures={materialized:gu.length,verified:gu.filter(x=>x.verified===true).length,rows:gu.reduce((n,x)=>n+(x.rows?.length||0),0),coverage:counts};
await writeFile(coveragePath,JSON.stringify(coverage,null,2)+"\n");
for(const path of [`${root}/data/studielots-db/programme-structures-manifest.json`,`${root}/data/studielots-db/manifest.json`]){const data=JSON.parse(await readFile(path,"utf8"));data.generatedAt=stamp;await writeFile(path,JSON.stringify(data,null,2)+"\n");}
console.log("Materialized GU H1LIB, S1MKG and partial N1BIO");
