#!/usr/bin/env node
// Materialize GU's official International Relations programme structure into StudieLots DB.
import fs from 'node:fs';

const root='data/studielots-db/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const db=read(root+'manifest.json');
const manifest=read(db.tables.programmeStructures.storageManifest);
if(db.database!=='StudieLots DB'||manifest.count!==db.tables.programmeStructures.rows)throw Error('Canonical structure count mismatch');

const code='S1INT',hp=180,validFrom='2026HT';
const identities=[db.tables.programmes.storage,...(db.tables.programmes.additionalStorages||[])].flatMap(read)
  .filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code&&Number(x.programHp)===hp&&x.term==='HT26');
if(identities.length!==1||identities[0].programName!=='Kandidatprogrammet i internationella relationer')throw Error('GU S1INT identity missing, ambiguous or mismatched');

const syllabusUrl='https://www.gu.se/syllabus/e72bbfcd-8e2a-11f0-b29b-713806674b84';
const programmeUrl='https://www.gu.se/studera/hitta-utbildning/kandidatprogrammet-i-internationella-relationer-s1int';
// Term placements, course titles, and credits come from the official GU syllabus.
// It does not publish course codes in the programme structure, so codes stay blank.
const course=(term,name,credits)=>({term,code:'',name,hp:credits,category:'mandatory',isSlot:false,courseCodeVerified:false});
const rows=[
  course(1,'Introduktion till Internationella relationer',15),
  course(1,'Teman och frågeställningar inom Internationella relationer',15),
  course(2,'Krig, fred och säkerhet',15),
  course(2,'Global politisk ekonomi',15),
  course(3,'Avancerade studier i säkerhet och krig',7.5),
  course(3,'Avancerade studier i global politisk ekonomi',7.5),
  course(3,'Global och regional styrning',7.5),
  course(3,'Global politisk idéhistoria',7.5),
  course(4,'Metod inom globala studier',15),
  course(4,'Projektledning och utredning',15),
  {term:5,code:'',name:'Valfria kurser på kandidatnivå',hp:30,category:'elective',isSlot:true,slotType:'elective-slot',courseCodeVerified:false},
  course(6,'Utrikespolitik och utrikesdiplomati',7.5),
  course(6,'Internationell konflikttransformation',7.5),
  course(6,'Internationella relationer: Examensarbete',15)
];
for(let term=1;term<=6;term++)if(Math.abs(rows.filter(x=>x.term===term).reduce((sum,x)=>sum+x.hp,0)-30)>.001)throw Error('GU S1INT term credits mismatch: '+term);
if(rows.length!==14||Math.abs(rows.reduce((sum,x)=>sum+x.hp,0)-hp)>.001)throw Error('GU S1INT total or row count mismatch');

const current=manifest.parts.flatMap(part=>{const x=read(root+part);return Array.isArray(x)?x:x.programs})
  .filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
if(current.length!==1)throw Error('GU S1INT canonical row missing or duplicated');
if(current[0].verified===true){
  if(current[0].validFrom!==validFrom||current[0].sourceEvidenceUrl!==syllabusUrl||JSON.stringify(current[0].rows)!==JSON.stringify(rows))throw Error('Conflicting verified GU S1INT plan');
  console.log('GU S1INT HT26 already materialized');
  process.exit(0);
}
if(current[0].rows?.length||Number(current[0].hp)!==hp)throw Error('Refusing to replace populated or mismatched GU S1INT plan');

const item={...current[0],id:`gu:${code}:${validFrom}`,key:current[0].key,university:'Göteborgs universitet',programCode:code,
  programName:identities[0].programName,programHp:hp,hp,validFrom,coverage:'course-codes-unverified',verified:true,courseCodesVerified:false,
  choiceRequired:true,source:'gu-official-programme-syllabus',sourceEvidenceUrl:syllabusUrl,sourceUrls:[syllabusUrl,programmeUrl],
  rows,status:'verified',reason:null};
if(process.argv.includes('--write')){
  const shard=manifest.parts[0],file=root+shard,data=read(file),programs=Array.isArray(data)?data:data.programs;
  const index=programs.findIndex(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
  if(index<0)throw Error('GU S1INT metadata row is outside the canonical primary shard');
  programs[index]=item;
  fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2)+'\\n');
  const verify=read(file+'.tmp'),verifiedRows=Array.isArray(verify)?verify:verify.programs;
  if(verifiedRows.filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code).length!==1)throw Error('GU S1INT write verification failed');
  fs.renameSync(file+'.tmp',file);
}
console.log(JSON.stringify({code,validFrom,rows:rows.length,termCredits:[30,30,30,30,30,30],courseCodesVerified:false,sources:[syllabusUrl,programmeUrl]}));
