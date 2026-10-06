#!/usr/bin/env node
// Materialize GU's current English Bachelor's programme structure from official pages.
import fs from 'node:fs';

const root='data/studielots-db/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const db=read(root+'manifest.json');
const manifest=read(db.tables.programmeStructures.storageManifest);
if(db.database!=='StudieLots DB'||manifest.count!==db.tables.programmeStructures.rows)throw Error('Canonical structure count mismatch');

const code='H1KEN',hp=180,validFrom='2026HT';
const identities=[db.tables.programmes.storage,...(db.tables.programmes.additionalStorages||[])].flatMap(read)
  .filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code&&Number(x.programHp)===hp&&x.term==='HT26');
if(identities.length!==1||identities[0].programName!=='Kandidatprogram i engelska med arbetslivsanknytning')throw Error('GU H1KEN identity missing, ambiguous or mismatched');

const sourcePage='https://www.gu.se/studera/hitta-utbildning/kandidatprogram-i-engelska-med-arbetslivsanknytning-h1ken';
const sourceOverview='https://www.gu.se/studera/hitta-utbildning/programoversikt-for-kandidatprogram-i-engelska-med-arbetslivsanknytning';
const sourcePlan='https://www.gu.se/studera/hitta-utbildning/kandidatprogram-i-engelska-med-arbetslivsanknytning-h1ken/utbildningsplan/e0e66e50-95e2-11ef-a92e-7cfbf4f6409a';
const course=(term,name,credits,extra={})=>({term,code:'',name,hp:credits,category:'mandatory',isSlot:false,courseCodeVerified:false,...extra});
const option=(name,credits,extra={})=>({name,hp:credits,...extra});
const rows=[
  course(1,'Engelska grundkurs',30),
  course(2,'Engelska fortsättningskurs (Brighton eller Göteborg)',30),
  course(3,'Stilistik och stil i litteratur: Från korpusanalys till litteraturteori',7.5),
  course(3,'Litterära landskap över tid och rum',7.5),
  course(3,'Kommunikation i professionella sammanhang',7.5),
  course(3,'Karriärplanering för humanister',7.5),
  {term:4,code:'',name:'Valfria kurser i engelska eller andra ämnen, eller utbytesstudier',hp:30,category:'elective',isSlot:true,slotType:'elective-slot',courseCodeVerified:false},
  course(5,'Engelska på den globala arenan: Grunder i språkkonsultsarbete',7.5),
  course(5,'Engelska i den digitala eran: AI och andra framväxande teknologier i språkvetenskap',7.5),
  {term:5,code:'',name:'Välj praktik 15 hp eller två kurser om 7,5 hp',hp:15,category:'choice',isSlot:true,slotType:'choice-slot',choiceSlots:1,courseCodeVerified:false,options:[
    option('Språk i praktiken',15),
    option('Genus i litteratur: Dåtida och nutida perspektiv samt Akademisk kommunikation',15,{courses:[
      option('Genus i litteratur: Dåtida och nutida perspektiv',7.5),option('Akademisk kommunikation',7.5)
    ]})
  ]},
  {term:6,code:'',name:'Fördjupningskurs 15 hp och kandidatuppsats 15 hp; välj ämnesinriktning',hp:30,category:'choice',isSlot:true,slotType:'choice-slot',choiceSlots:1,courseCodeVerified:false,options:[
    option('Litteraturvetenskaplig inriktning',30,{courses:[option('Fördjupningskurs i litteraturvetenskap',15),option('Kandidatuppsats i litteraturvetenskap',15,{isThesis:true})]}),
    option('Språkvetenskaplig inriktning',30,{courses:[option('Fördjupningskurs i språkvetenskap',15),option('Kandidatuppsats i språkvetenskap',15,{isThesis:true})]})
  ]}
];
for(let term=1;term<=6;term++)if(Math.abs(rows.filter(x=>x.term===term).reduce((sum,x)=>sum+x.hp,0)-30)>.001)throw Error('GU H1KEN term credits mismatch: '+term);
if(rows.length!==11||Math.abs(rows.reduce((sum,x)=>sum+x.hp,0)-hp)>.001)throw Error('GU H1KEN total or row count mismatch');

const current=manifest.parts.flatMap(part=>{const x=read(root+part);return Array.isArray(x)?x:x.programs})
  .filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
if(current.length!==1)throw Error('GU H1KEN canonical row missing or duplicated');
if(current[0].verified===true){
  if(current[0].validFrom!==validFrom||current[0].sourceEvidenceUrl!==sourceOverview||JSON.stringify(current[0].rows)!==JSON.stringify(rows))throw Error('Conflicting verified GU H1KEN plan');
  console.log('GU H1KEN HT26 already materialized');process.exit(0);
}
if(current[0].rows?.length||Number(current[0].hp)!==hp)throw Error('Refusing to replace populated or mismatched GU H1KEN plan');
const item={...current[0],id:`gu:${code}:${validFrom}`,key:current[0].key,university:'Göteborgs universitet',programCode:code,
  programName:identities[0].programName,programHp:hp,hp,validFrom,coverage:'choice-required',verified:true,courseCodesVerified:false,
  choiceRequired:true,source:'gu-official-programme-overview',sourceEvidenceUrl:sourceOverview,sourceUrls:[sourcePage,sourceOverview,sourcePlan],
  rows,status:'verified',reason:null};
if(process.argv.includes('--write')){
  const shard=manifest.parts[0],file=root+shard,data=read(file),programs=Array.isArray(data)?data:data.programs;
  const index=programs.findIndex(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
  if(index<0)throw Error('GU H1KEN metadata row is outside the canonical primary shard');
  programs[index]=item;
  fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2)+'\n');
  const verify=read(file+'.tmp'),verifiedRows=Array.isArray(verify)?verify:verify.programs;
  if(verifiedRows.filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code).length!==1)throw Error('GU H1KEN write verification failed');
  fs.renameSync(file+'.tmp',file);
}
console.log(JSON.stringify({code,validFrom,rows:rows.length,termCredits:[30,30,30,30,30,30],choiceRequired:true,courseCodesVerified:false,sources:[sourcePage,sourceOverview,sourcePlan]}));
