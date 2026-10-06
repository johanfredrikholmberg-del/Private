#!/usr/bin/env node
// Materialize the current GU Global Studies programme plan into the canonical StudieLots DB.
import fs from 'node:fs';

const root='data/studielots-db/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const db=read(root+'manifest.json');
const manifest=read(db.tables.programmeStructures.storageManifest);
if(db.database!=='StudieLots DB'||manifest.count!==db.tables.programmeStructures.rows)throw Error('Canonical structure count mismatch');

const code='S1GLS',hp=180,validFrom='2026HT';
const identities=[db.tables.programmes.storage,...(db.tables.programmes.additionalStorages||[])].flatMap(read)
  .filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code&&Number(x.programHp)===hp&&x.term==='HT26');
if(identities.length!==1)throw Error('GU S1GLS identity missing or ambiguous');

const syllabusUrl='https://www.gu.se/syllabus/fcacb75c-17ab-11f1-9ed1-51bcbc0e4a82';
const overviewUrl='https://www.gu.se/studera/hitta-utbildning/kandidatprogrammet-i-globala-studier-s1gls';
const fetchOfficial=async url=>{
  const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
  if(!response.ok||new URL(response.url).host!=='www.gu.se')throw Error('Official GU page unavailable: '+url);
  return (await response.text()).replace(/<[^>]*>/g,' ').replaceAll('&nbsp;',' ').replaceAll(String.fromCharCode(160),' ').replace(/\s+/g,' ');
};
const syllabus=await fetchOfficial(syllabusUrl),overview=await fetchOfficial(overviewUrl);
for(const marker of ['S1GLS','180 högskolepoäng','Vårtermin 2026','Höstterminen 2026','2:1-2:4 Valbara kurser, totalt 60 hp',
  'GS1111','Globala utmaningar, 15 hp','GS1112','Ekonomi, makt och kultur, 15 hp',
  'GS1211','Perspektiv på rättvisa, makt och hållbar global utveckling','GS1212','Svar på de globala utmaningarna',
  'GS1311','Metod inom Globala studier, 15 hp','GS1422','Projektledning och utredning, 15 hp',
  'GS1423','GS1424','GS1426','GS1511','Examensarbete inom Globala studier, 15 hp'])
  if(!syllabus.includes(marker))throw Error('GU S1GLS official syllabus missing '+marker);
for(const marker of ['Kandidatprogrammet i globala studier','S1GLS','Programstruktur'])
  if(!overview.includes(marker))throw Error('GU S1GLS official overview missing '+marker);

const course=(term,courseCode,name,credits)=>({term,code:courseCode,name,hp:credits,category:'mandatory',isSlot:false,courseCodeVerified:true});
const elective=(term,name,credits)=>({term,code:'',name,hp:credits,category:'elective',isSlot:true,slotType:'elective-slot',courseCodeVerified:false});
const rows=[
  course(1,'GS1111','Globala utmaningar',15),
  course(1,'GS1112','Ekonomi, makt och kultur',15),
  course(2,'GS1211','Perspektiv på rättvisa, makt och hållbar global utveckling',15),
  course(2,'GS1212','Svar på de globala utmaningarna',15),
  elective(3,'Valbara kurser inom Institutionen för globala studier',30),
  elective(4,'Valbara kurser inom Institutionen för globala studier',30),
  course(5,'GS1311','Metod inom Globala studier',15),
  course(5,'GS1422','Projektledning och utredning',15),
  elective(6,'Valbar praktik, fältkurs eller färdighetskurs',15),
  course(6,'GS1511','Examensarbete inom Globala studier',15)
];
for(let term=1;term<=6;term++)if(rows.filter(x=>x.term===term).reduce((sum,x)=>sum+x.hp,0)!==30)throw Error('GU S1GLS term credits mismatch: '+term);
if(rows.length!==10||rows.reduce((sum,x)=>sum+x.hp,0)!==hp)throw Error('GU S1GLS total or row count mismatch');

const current=manifest.parts.flatMap(part=>{const x=read(root+part);return Array.isArray(x)?x:x.programs})
  .filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
if(current.length!==1)throw Error('GU S1GLS canonical row missing or duplicated');
if(current[0].verified===true){
  const sameRows=JSON.stringify(current[0].rows)===JSON.stringify(rows);
  if(current[0].validFrom!==validFrom||current[0].sourceEvidenceUrl!==syllabusUrl||!sameRows)throw Error('Conflicting verified GU S1GLS plan');
  console.log('GU S1GLS HT26 already materialized');
  process.exit(0);
}
if(current[0].rows?.length||Number(current[0].hp)!==hp)throw Error('Refusing to replace populated or mismatched GU S1GLS plan');

const item={...current[0],id:`gu:${code}:${validFrom}`,key:current[0].key,university:'Göteborgs universitet',programCode:code,
  programName:identities[0].programName,programHp:hp,hp,validFrom,coverage:'choice-required',verified:true,courseCodesVerified:true,
  choiceRequired:true,source:'gu-official-programme-syllabus',sourceEvidenceUrl:syllabusUrl,sourceUrls:[syllabusUrl,overviewUrl],
  rows,status:'verified',reason:null};
if(process.argv.includes('--write')){
  const shard=manifest.parts[0],file=root+shard,data=read(file),programs=Array.isArray(data)?data:data.programs;
  const index=programs.findIndex(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
  if(index<0)throw Error('GU S1GLS metadata row is outside the canonical primary shard');
  programs[index]=item;
  fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2)+'\n');
  const verify=read(file+'.tmp'),verifiedRows=Array.isArray(verify)?verify:verify.programs;
  if(verifiedRows.filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code).length!==1)throw Error('GU S1GLS write verification failed');
  fs.renameSync(file+'.tmp',file);
}
console.log(JSON.stringify({code,validFrom,rows:rows.length,termCredits:[30,30,30,30,30,30],choiceSlots:3,courseCodesVerified:true,sources:[syllabusUrl,overviewUrl]}));
