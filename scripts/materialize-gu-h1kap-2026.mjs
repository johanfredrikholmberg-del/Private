#!/usr/bin/env node
// Materialize the current GU Cultural Heritage programme plan into the canonical StudieLots DB.
import fs from 'node:fs';

const root='data/studielots-db/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const db=read(root+'manifest.json');
const manifest=read(db.tables.programmeStructures.storageManifest);
if(db.database!=='StudieLots DB'||manifest.count!==db.tables.programmeStructures.rows)throw Error('Canonical structure count mismatch');

const code='H1KAP',hp=180,validFrom='2026HT';
const identities=[db.tables.programmes.storage,...(db.tables.programmes.additionalStorages||[])].flatMap(read)
  .filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code&&Number(x.programHp)===hp&&x.term==='HT26');
if(identities.length!==1||identities[0].programName!=='Kulturarvsprogrammet')throw Error('GU H1KAP identity missing, ambiguous or mismatched');

const sourcePage='https://www.gu.se/studera/hitta-utbildning/kulturarvsprogrammet-h1kap';
const sourcePlan='https://www.gu.se/sites/default/files/2024-03/Utbildningsplan_Kulturarvsprogrammet_H1KAP.pdf';
const course=(term,courseCode,name,credits)=>({term,code:courseCode,name,hp:credits,category:'mandatory',isSlot:false,courseCodeVerified:true});
const elective=(term,name,credits)=>({term,code:'',name,hp:credits,category:'elective',isSlot:true,slotType:'elective-slot',courseCodeVerified:false});
const rows=[
  course(1,'KA1110','Kulturarvets former',20),
  course(1,'KA1120','Kulturarvets politik och ideologi',10),
  course(2,'KA1210','Kulturarvets förvaltning och regelverk',10),
  course(2,'KA1220','Kulturarvets kommunikation',10),
  course(2,'KA1230','Kulturarvspedagogik',10),
  elective(3,'Grundkurs inom valt profilämne',30),
  elective(4,'Fortsättningskurs inom valt profilämne',30),
  course(5,'KA1360','Fördjupningskurs inom huvudområdet Kulturarv',30),
  elective(6,'Valbara kurser och/eller praktik inom kulturarvsområdet',30)
];
for(let term=1;term<=6;term++)if(rows.filter(x=>x.term===term).reduce((sum,x)=>sum+x.hp,0)!==30)throw Error('GU H1KAP term credits mismatch: '+term);
if(rows.length!==9||rows.reduce((sum,x)=>sum+x.hp,0)!==hp)throw Error('GU H1KAP total or row count mismatch');

const current=manifest.parts.flatMap(part=>{const x=read(root+part);return Array.isArray(x)?x:x.programs})
  .filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
if(current.length!==1)throw Error('GU H1KAP canonical row missing or duplicated');
if(current[0].verified===true){
  if(current[0].validFrom!==validFrom||current[0].sourceEvidenceUrl!==sourcePlan||JSON.stringify(current[0].rows)!==JSON.stringify(rows))
    throw Error('Conflicting verified GU H1KAP plan');
  console.log('GU H1KAP HT26 already materialized');
  process.exit(0);
}
if(current[0].rows?.length||Number(current[0].hp)!==hp)throw Error('Refusing to replace populated or mismatched GU H1KAP plan');

const item={...current[0],id:`gu:${code}:${validFrom}`,key:current[0].key,university:'Göteborgs universitet',programCode:code,
  programName:identities[0].programName,programHp:hp,hp,validFrom,coverage:'choice-required',verified:true,courseCodesVerified:true,
  choiceRequired:true,source:'gu-official-programme-syllabus',sourceEvidenceUrl:sourcePlan,sourceUrls:[sourcePage,sourcePlan],
  rows,status:'verified',reason:null};
if(process.argv.includes('--write')){
  const shard=manifest.parts[0],file=root+shard,data=read(file),programs=Array.isArray(data)?data:data.programs;
  const index=programs.findIndex(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
  if(index<0)throw Error('GU H1KAP metadata row is outside the canonical primary shard');
  programs[index]=item;
  fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2)+'\n');
  const verify=read(file+'.tmp'),verifiedRows=Array.isArray(verify)?verify:verify.programs;
  if(verifiedRows.filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code).length!==1)throw Error('GU H1KAP write verification failed');
  fs.renameSync(file+'.tmp',file);
}
console.log(JSON.stringify({code,validFrom,rows:rows.length,termCredits:[30,30,30,30,30,30],choiceSlots:3,courseCodesVerified:true,sources:[sourcePage,sourcePlan]}));
