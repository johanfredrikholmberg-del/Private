#!/usr/bin/env node
// Materialize the current GU S1LOG study plan in the canonical StudieLots DB.
import fs from 'node:fs';

const root='data/studielots-db/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const db=read(root+'manifest.json');
const manifest=read(db.tables.programmeStructures.storageManifest);
if(db.database!=='StudieLots DB'||manifest.count!==db.tables.programmeStructures.rows)throw Error('Canonical structure count mismatch');

const code='S1LOG',hp=180,validFrom='2026HT';
const syllabusUrl='https://www.gu.se/studera/hitta-utbildning/handelshogskolans-logistikprogram-s1log/utbildningsplan/9c385ad5-a5b4-11ef-b71a-5348ec534cc8';
// The current HT26 GU syllabus lists mandatory course names and credits by term but not course codes.
const course=(term,name,credits)=>({term,code:'',name,hp:credits,category:'mandatory',isSlot:false});
const rows=[
  course(1,'Kulturgeografi: Företaget, logistikfunktionen och omvärlden',15),
  course(1,'Handels- och transporträtt',15),
  course(2,'Nationalekonomi: Grundläggande mikroekonomi',7.5),
  course(2,'Nationalekonomi: Grundläggande makroekonomi',7.5),
  course(2,'Statistik: Grundkurs 1, introduktion',7.5),
  course(2,'Statistik: Grundkurs 2, regressionsanalys',7.5),
  course(3,'Företagsekonomi 1',30),
  course(4,'Företagsekonomi 2',30),
  course(5,'Kulturgeografi: Transporter, samhälle och miljö',15),
  course(5,'Logistiska informationssystem',15),
  course(6,'Strategisk logistik',7.5),
  course(6,'Operativ styrning 2',7.5),
  course(6,'Logistik, kandidatuppsats',15)
];
for(let term=1;term<=6;term++)if(Math.abs(rows.filter(x=>x.term===term).reduce((sum,x)=>sum+x.hp,0)-30)>.001)throw Error('GU S1LOG term credits mismatch: '+term);
if(rows.length!==13||Math.abs(rows.reduce((sum,x)=>sum+x.hp,0)-hp)>.001)throw Error('GU S1LOG total or row count mismatch');

const current=manifest.parts.flatMap(part=>{const x=read(root+part);return Array.isArray(x)?x:x.programs})
  .filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
if(current.length!==1||current[0].programName!=='Handelshögskolans logistikprogram'||Number(current[0].hp)!==hp)throw Error('GU S1LOG identity missing, ambiguous or mismatched');
if(current[0].verified===true){
  if(current[0].validFrom===validFrom&&current[0].sourceEvidenceUrl===syllabusUrl&&JSON.stringify(current[0].rows)===JSON.stringify(rows)){
    console.log('GU S1LOG HT26 already materialized');
    process.exit(0);
  }
  throw Error('Conflicting verified GU S1LOG plan');
}
if(current[0].rows?.length||Number(current[0].hp)!==hp)throw Error('Refusing to replace populated or mismatched GU S1LOG plan');

const item={...current[0],id:'gu:'+code+':'+validFrom,key:current[0].key,university:'Göteborgs universitet',programCode:code,
  programName:'Handelshögskolans logistikprogram',programHp:hp,hp,validFrom,coverage:'course-codes-unverified',verified:true,courseCodesVerified:false,
  choiceRequired:false,source:'gu-official-programme-syllabus',sourceEvidenceUrl:syllabusUrl,sourceUrls:[syllabusUrl],
  rows,status:'verified',reason:null};
if(process.argv.includes('--write')){
  if(manifest.parts.length!==1||manifest.parts[0]!=='programme-structures-ht26.json')throw Error('Unexpected canonical GU storage part');
  const shard=manifest.parts[0],file=root+shard,data=read(file),programs=Array.isArray(data)?data:data.programs;
  const index=programs.findIndex(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
  if(index<0)throw Error('GU S1LOG metadata row is outside the canonical primary shard');
  programs[index]=item;
  fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2)+'\n');
  const verify=read(file+'.tmp'),verifiedRows=Array.isArray(verify)?verify:verify.programs;
  if(verifiedRows.filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code).length!==1)throw Error('GU S1LOG write verification failed');
  fs.renameSync(file+'.tmp',file);
}
console.log(JSON.stringify({code,validFrom,rows:rows.length,termCredits:[30,30,30,30,30,30],courseCodesVerified:false,source:syllabusUrl}));
