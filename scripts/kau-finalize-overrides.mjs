#!/usr/bin/env node
import fs from 'node:fs/promises';
const FILE='data/susa/structures.json';
const rows=JSON.parse(await fs.readFile(FILE,'utf8'));
const map=new Map(rows.filter(x=>/karlstads universitet/i.test(String(x.university||''))).map(x=>[String(x.programCode||'').toUpperCase(),x]));
const now=new Date().toISOString();
const course=(term,name,hp,extra={})=>({term,name,code:'',hp,category:'mandatory',type:'required',...extra});
const slot=(term,name,hp,options=[],extra={})=>({term,name,code:'',hp,category:'elective-slot',type:'choice',slotType:'elective-slot',isSlot:true,options,...extra});
const finish=(code,patch)=>{const old=map.get(code);if(!old)throw new Error(`Missing KAU programme ${code}`);map.set(code,{...old,...patch,audited:true,auditedAt:now})};

// KPU 60: Karlstad publishes one common 60 hp curriculum for the subject variants.
const kpuRows=[
 course(1,'Skola som system och idé - KPU 60',6),
 course(1,'Lärarens pedagogiska förhållningssätt och VFU I - KPU 60',16.5),
 course(1,'Ämnesstudier och ämnesdidaktik - KPU 60',7.5),
 course(2,'Bedömning och betygsättning - KPU 60',4.5),
 course(2,'Lärarens professionella ledarskap och VFU II - KPU 60',18),
 course(2,'Ämnesdidaktiskt utvecklingsarbete på forskningsmässig grund - KPU 60',7.5)
];
for(const code of ['LAKG4','LAKGB','LAKGK','LAKGM','LAKGT','LAKHM'])finish(code,{coverage:'complete',reason:'verified-common-kpu60-curriculum',status:'processed',hp:60,expectedTerms:2,termTargetHp:30,completeTerms:[1,2],rows:kpuRows,rawRows:kpuRows.length,source:'karlstad-official-kpu60-common-structure',sourceUrl:'https://www.kau.se/utbildning/program-och-kurser/program/LAKGE',officialUrls:['https://www.kau.se/utbildning/program-och-kurser/program/LAKGE'],structureKind:'shared-curriculum'});

// English master: official education plan has one mandatory/choice-led master route.
finish('HAENG',{coverage:'choice-required',reason:'verified-flexible-master-education-plan',status:'processed',hp:120,expectedTerms:4,termTargetHp:30,completeTerms:[1,2,3,4],rows:[
 course(1,'Text, kultur och samhälle: Engelska i samtiden',15),
 slot(1,'Obligatoriskt valbara engelskkurser enligt utbildningsplan',15,[] ,{requiredChoice:true}),
 slot(2,'Valbara kurser enligt utbildningsplan',30),
 slot(3,'Valbara kurser eller utlandsstudier',30),
 slot(4,'Självständigt arbete inom engelsk lingvistik eller engelskspråkig litteratur (Master)',30,[{name:'Självständigt arbete inom engelsk lingvistik (Master)',hp:30},{name:'Självständigt arbete inom engelskspråkig litteratur (Master)',hp:30}],{requiredChoice:true,isThesis:true})
],rawRows:5,source:'karlstad-official-education-plan',sourceUrl:'https://www3.kau.se/utbildningsplaner/sv/HAENG_20262-sv.pdf',officialUrls:['https://www.kau.se/utbildning/program-och-kurser/program/HAENG','https://www3.kau.se/utbildningsplaner/sv/HAENG_20262-sv.pdf'],structureKind:'flexible-choice-plan'});

// Project management: same 60 hp contents, campus full-time or distance half-time.
finish('SAFPL',{coverage:'choice-required',reason:'verified-campus-distance-variant-plan',status:'processed',hp:60,expectedTerms:2,termTargetHp:30,completeTerms:[1,2],rows:[
 slot(1,'Projekt som arbetsform / distansalternativ',15,[{name:'Projekt som arbetsform',hp:15},{name:'Perspektiv på projektledningsmetodik',hp:7.5},{name:'Teamutveckling i projektmiljöer',hp:7.5}],{requiredChoice:true}),
 course(1,'Den projektorienterade organisationen',7.5),course(1,'Ledarrollen i projektmiljöer',7.5),
 course(2,'Vetenskapsteori och forskning i projektmiljöer',7.5),course(2,'Perspektiv på projektledning',7.5),course(2,'Projektledning – Magisteruppsats',15,{isThesis:true})
],rawRows:6,source:'karlstad-official-education-plan',sourceUrl:'https://www3.kau.se/utbildningsplaner/sv/SAFPL_20231.pdf',officialUrls:['https://www.kau.se/utbildning/program-och-kurser/program/SAFPL','https://www3.kau.se/utbildningsplaner/sv/SAFPL_20231.pdf'],structureKind:'pace-variant',alternativePaceTerms:4});

// VAL is intentionally individual: previous education/reell kompetens determines the actual route.
for(const code of ['LGFLV','LGVAL'])finish(code,{coverage:'partial-structure',reason:'verified-individual-study-plan-based-on-prior-learning',status:'processed',rows:[],rawRows:0,structureKind:'individualized',structureAvailable:false,source:'karlstad-official-individualized-val',officialUrls:[map.get(code)?.sourceUrl].filter(Boolean)});

// SAUTS has multiple official 15 hp pathways/entry routes over 8 half-time terms.
finish('SAUTS',{coverage:'partial-structure',reason:'verified-multiple-alternative-half-time-pathways',status:'processed',expectedTerms:8,termTargetHp:15,structureKind:'multi-pathway',structureAvailable:false,source:'karlstad-official-multi-path-plan',officialUrls:['https://www.kau.se/utbildning/program-och-kurser/program/SAUTS','https://www3.kau.se/utbildningsplaner/sv/SAUTS_20212.pdf']});

// Current IT-design page is an inactive/closing offering and publishes only term 1; keep official row, but no invented later current terms.
finish('SGITD',{coverage:'partial-structure',reason:'verified-current-page-publishes-only-first-term',status:'processed',structureKind:'current-offering-partial',structureAvailable:false,source:'karlstad-official-current-partial',officialUrls:['https://www.kau.se/utbildning/program-och-kurser/program/SGITD']});

const kau=[...map.values()];
const out=[...rows.filter(x=>!/karlstads universitet/i.test(String(x.university||''))),...kau];
await fs.writeFile(FILE,JSON.stringify(out,null,2)+'\n');
const critical=kau.filter(x=>['metadata-only','manual-review'].includes(x.coverage));
if(critical.length)throw new Error(`Karlstad still has ${critical.length} unaudited critical structures: ${critical.map(x=>x.programCode).join(', ')}`);
console.log(JSON.stringify({karlstad:kau.length,critical:critical.length,counts:kau.reduce((a,x)=>(a[x.coverage]=(a[x.coverage]||0)+1,a),{})},null,2));
