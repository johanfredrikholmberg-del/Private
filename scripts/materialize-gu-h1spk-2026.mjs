#!/usr/bin/env node
// Materialize GU's current Swedish Language Consultancy programme structure.
import fs from 'node:fs';

const root='data/studielots-db/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const db=read(root+'manifest.json');
const manifest=read(db.tables.programmeStructures.storageManifest);
if(db.database!=='StudieLots DB'||manifest.count!==db.tables.programmeStructures.rows)throw Error('Canonical structure count mismatch');

const code='H1SPK',hp=180,validFrom='2026HT';
const identities=[db.tables.programmes.storage,...(db.tables.programmes.additionalStorages||[])].flatMap(read)
  .filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code&&Number(x.programHp)===hp&&x.term==='HT26');
if(identities.length!==1||identities[0].programName!=='Språkkonsultprogrammet')throw Error('GU H1SPK identity missing, ambiguous or mismatched');

const sourcePage='https://www.gu.se/studera/hitta-utbildning/sprakkonsultprogrammet-h1spk';
const sourcePlan='https://www.gu.se/sites/default/files/2024-09/Utbildningsplan%20H1SPK.pdf';
const course=(term,name,credits=30,extra={})=>({term,code:'',name,hp:credits,category:'mandatory',isSlot:false,courseCodeVerified:false,...extra});
const option=(name,credits,extra={})=>({name,hp:credits,...extra});
const rows=[
  course(1,'Språkkonsultprogrammet, kurs 1'),
  course(2,'Språkkonsultprogrammet, kurs 2'),
  course(3,'Språkkonsultprogrammet, kurs 3'),
  course(4,'Språkkonsultprogrammet, kurs 4',30,{isThesis:true,thesisHp:7.5,practicum:true}),
  {term:5,code:'',name:'Välj en av programmets tre specialiseringskurser I',hp:30,category:'choice',isSlot:true,slotType:'choice-slot',choiceSlots:1,courseCodeVerified:false,options:[
    option('Språkvård, språkrådgivning och redaktörsarbete (kurs 5R)',30,{courses:[option('Obligatoriska specialiseringskurser inom skrivteori, skrivdidaktik och projektledning',15),option('Valbara specialiseringskurser',15)]}),
    option('Språkvård och språkrådgivning i ett flerspråkigt arbetsliv (kurs 5F)',30,{courses:[option('Obligatoriska specialiseringskurser inom flerspråkighet',15),option('Valbara specialiseringskurser',15)]}),
    option('Språkvård och språkrådgivning i ett engelskspråkigt arbetsliv (kurs 5E)',30)
  ]},
  {term:6,code:'',name:'Specialiseringskurs II inom samma inriktning som termin 5',hp:30,category:'choice',isSlot:true,slotType:'choice-slot',choiceSlots:1,courseCodeVerified:false,options:[
    option('Språkvård, språkrådgivning och redaktörsarbete (kurs 6R)',30,{courses:[option('Praktik',15),option('Examensarbete',15,{isThesis:true})]}),
    option('Språkvård och språkrådgivning i ett flerspråkigt arbetsliv (kurs 6F)',30,{courses:[option('Praktik',15),option('Examensarbete',15,{isThesis:true})]}),
    option('Språkvård och språkrådgivning i ett engelskspråkigt arbetsliv (kurs E6)',30,{courses:[option('Praktik',15),option('Examensarbete',15,{isThesis:true})]})
  ],selectionRule:'Termin 6-inriktningen ska följa vald specialisering på termin 5.'}
];
for(let term=1;term<=6;term++)if(Math.abs(rows.filter(x=>x.term===term).reduce((sum,x)=>sum+x.hp,0)-30)>.001)throw Error('GU H1SPK term credits mismatch: '+term);
if(rows.length!==6||Math.abs(rows.reduce((sum,x)=>sum+x.hp,0)-hp)>.001)throw Error('GU H1SPK total or row count mismatch');

const current=manifest.parts.flatMap(part=>{const x=read(root+part);return Array.isArray(x)?x:x.programs})
  .filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
if(current.length!==1)throw Error('GU H1SPK canonical row missing or duplicated');
if(current[0].verified===true){
  if(current[0].validFrom!==validFrom||current[0].sourceEvidenceUrl!==sourcePlan||JSON.stringify(current[0].rows)!==JSON.stringify(rows))throw Error('Conflicting verified GU H1SPK plan');
  console.log('GU H1SPK HT26 already materialized');process.exit(0);
}
if(current[0].rows?.length||Number(current[0].hp)!==hp)throw Error('Refusing to replace populated or mismatched GU H1SPK plan');
const item={...current[0],id:`gu:${code}:${validFrom}`,key:current[0].key,university:'Göteborgs universitet',programCode:code,
  programName:identities[0].programName,programHp:hp,hp,validFrom,coverage:'choice-required',verified:true,courseCodesVerified:false,
  choiceRequired:true,source:'gu-official-programme-syllabus',sourceEvidenceUrl:sourcePlan,sourceUrls:[sourcePage,sourcePlan],
  rows,status:'verified',reason:null};
if(process.argv.includes('--write')){
  const shard=manifest.parts[0],file=root+shard,data=read(file),programs=Array.isArray(data)?data:data.programs;
  const index=programs.findIndex(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
  if(index<0)throw Error('GU H1SPK metadata row is outside the canonical primary shard');
  programs[index]=item;
  fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2)+'\n');
  const verify=read(file+'.tmp'),verifiedRows=Array.isArray(verify)?verify:verify.programs;
  if(verifiedRows.filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code).length!==1)throw Error('GU H1SPK write verification failed');
  fs.renameSync(file+'.tmp',file);
}
console.log(JSON.stringify({code,validFrom,rows:rows.length,termCredits:[30,30,30,30,30,30],choiceRequired:true,courseCodesVerified:false,sources:[sourcePage,sourcePlan]}));
