#!/usr/bin/env node
// Materialize GU's current Culture Bachelor's programme structure from its official programme pages.
import fs from 'node:fs';

const root='data/studielots-db/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const db=read(root+'manifest.json');
const manifest=read(db.tables.programmeStructures.storageManifest);
if(db.database!=='StudieLots DB'||manifest.count!==db.tables.programmeStructures.rows)throw Error('Canonical structure count mismatch');

const code='H1KLT',hp=180,validFrom='2026HT';
const identities=[db.tables.programmes.storage,...(db.tables.programmes.additionalStorages||[])].flatMap(read)
  .filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code&&Number(x.programHp)===hp&&x.term==='HT26');
if(identities.length!==1||identities[0].programName!=='Kultur, kandidatprogram')throw Error('GU H1KLT identity missing, ambiguous or mismatched');

const sourcePage='https://www.gu.se/studera/hitta-utbildning/kultur-kandidatprogram-h1klt';
const sourcePlan='https://studentportal.gu.se/program/kultur-kandidatprogram';
const course=(term,courseCode,name,credits,extra={})=>({term,code:courseCode,name,hp:credits,category:'mandatory',isSlot:false,courseCodeVerified:true,...extra});
const slot=(term,name,credits,options,extra={})=>({term,code:'',name,hp:credits,category:'choice',isSlot:true,slotType:'choice-slot',choiceSlots:1,courseCodeVerified:false,options,...extra});
const rows=[
  course(1,'KP1150','Kulturvetenskaper, grundkurs',30),
  course(2,'KP1250','Kulturvetenskap, fortsättningskurs',30),
  slot(3,'Breddningstermin: välj ämnesprofil eller utbytesstudier',30,[
    {name:'Filmvetenskap',hp:30},{name:'Genusvetenskap',hp:30},{name:'Idé- och lärdomshistoria',hp:30},
    {name:'Konst- och bildvetenskap',hp:30},{name:'Litteraturvetenskap',hp:30},{name:'Musikvetenskap',hp:30},
    {name:'Religionsvetenskap',hp:30},{name:'Teaterstudier',hp:30},{name:'Annat relevant ämne i samråd med programkoordinator',hp:30},
    {name:'Utbytesstudier',hp:30}
  ]),
  course(4,'KP1410','Kultur och demokrati: brytningstider',7.5),
  course(4,'KP1420','Kultur och demokrati: staden',7.5),
  course(4,'KP1430','Museets praktik',7.5),
  course(4,'KP1440','Kulturoffensiv – vision, kommunikation och projektledning',7.5),
  course(5,'KP1530','Förvaltningskulturer',7.5),
  course(5,'KP1500','Kultur och samhälle',7.5),
  course(5,'KP1510','Praktik',15),
  course(6,'KP1650','Kulturvetenskap, fördjupningskurs',30,{isThesis:true,components:['Kulturvetenskaplig metod, fördjupning','Kandidatuppsats','Outro']})
];
for(let term=1;term<=6;term++)if(Math.abs(rows.filter(x=>x.term===term).reduce((sum,x)=>sum+x.hp,0)-30)>.001)throw Error('GU H1KLT term credits mismatch: '+term);
if(rows.length!==11||Math.abs(rows.reduce((sum,x)=>sum+x.hp,0)-hp)>.001)throw Error('GU H1KLT total or row count mismatch');

const current=manifest.parts.flatMap(part=>{const x=read(root+part);return Array.isArray(x)?x:x.programs})
  .filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
if(current.length!==1)throw Error('GU H1KLT canonical row missing or duplicated');
if(current[0].verified===true){
  if(current[0].validFrom!==validFrom||current[0].sourceEvidenceUrl!==sourcePlan||JSON.stringify(current[0].rows)!==JSON.stringify(rows))throw Error('Conflicting verified GU H1KLT plan');
  console.log('GU H1KLT HT26 already materialized');process.exit(0);
}
if(current[0].rows?.length||Number(current[0].hp)!==hp)throw Error('Refusing to replace populated or mismatched GU H1KLT plan');
const item={...current[0],id:`gu:${code}:${validFrom}`,key:current[0].key,university:'Göteborgs universitet',programCode:code,
  programName:identities[0].programName,programHp:hp,hp,validFrom,coverage:'choice-required',verified:true,courseCodesVerified:true,
  choiceRequired:true,source:'gu-official-student-programme-structure',sourceEvidenceUrl:sourcePlan,sourceUrls:[sourcePage,sourcePlan],
  rows,status:'verified',reason:null};
if(process.argv.includes('--write')){
  const shard=manifest.parts[0],file=root+shard,data=read(file),programs=Array.isArray(data)?data:data.programs;
  const index=programs.findIndex(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
  if(index<0)throw Error('GU H1KLT metadata row is outside the canonical primary shard');
  programs[index]=item;
  fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2)+'\n');
  const verify=read(file+'.tmp'),verifiedRows=Array.isArray(verify)?verify:verify.programs;
  if(verifiedRows.filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code).length!==1)throw Error('GU H1KLT write verification failed');
  fs.renameSync(file+'.tmp',file);
}
console.log(JSON.stringify({code,validFrom,rows:rows.length,termCredits:[30,30,30,30,30,30],choiceRequired:true,courseCodesVerified:true,sources:[sourcePage,sourcePlan]}));
