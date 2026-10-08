#!/usr/bin/env node
// Materialize GU's current Philosophy, Politics and Economics programme plan.
import fs from 'node:fs';

const root='data/studielots-db/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const db=read(root+'manifest.json');
const manifest=read(db.tables.programmeStructures.storageManifest);
if(db.database!=='StudieLots DB'||manifest.count!==db.tables.programmeStructures.rows)throw Error('Canonical structure count mismatch');

const code='H1PPE',hp=180,validFrom='2026HT';
const identities=[db.tables.programmes.storage,...(db.tables.programmes.additionalStorages||[])].flatMap(read)
  .filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code&&Number(x.programHp)===hp&&x.term==='HT26');
if(identities.length!==1||identities[0].programName!=='Filosofi, politik och ekonomi, kandidatprogram')throw Error('GU H1PPE identity missing, ambiguous or mismatched');

const sourcePage='https://studentportal.gu.se/program/filosofi-politik-och-ekonomi-kandidatprogram';
const sourcePlan='https://www.gu.se/syllabus/c3663425-d42c-11f0-b415-d312a71c4fd5';
const course=(term,courseCode,name,credits,extra={})=>({term,code:courseCode,name,hp:credits,category:'mandatory',isSlot:false,courseCodeVerified:true,...extra});
const option=(courseCode,name,credits,extra={})=>({code:courseCode,name,hp:credits,...extra});
const slot=(term,name,credits,options,extra={})=>({term,code:'',name,hp:credits,category:'choice',isSlot:true,slotType:'choice-slot',choiceSlots:1,courseCodeVerified:false,options,...extra});

const term5Further=[
  option('FP1200','Praktisk filosofi: Fortsättningskurs',30),
  option('NEK20','Nationalekonomi: Fortsättning',30),
  option('SK129','Statsvetenskap: Fördjupningskurspaket med Tematisk fördjupning',30),
  option('SK139','Statsvetenskap: Fördjupningskurspaket med Miljöpolitikens villkor',30)
];
const term5Electives=[
  option('SK1127','Konflikt och konflikthantering',7.5),
  option('SK1136','Utrikespolitisk analys',7.5),
  option('SK1138','Miljöpolitik i teori och praktik',7.5),
  option('SK1139','Svensk miljöpolitik i ett jämförande perspektiv',7.5),
  option('SK1421','Statsvetaren i yrkeslivet',15),
  option('SK1223','Tematisk fördjupning (om ej läst i SK129)',7.5),
  option('NEK203','Mikroteori',7.5),option('NEK204','Makroteori',7.5),
  option('NEK206','Ekonometri',7.5),option('NEK205','Empirisk nationalekonomi i praktiken',7.5,{prerequisites:['NEK203','NEK204']})
];
const term6Options=[
  option('FP1300','Praktisk filosofi: Fördjupningskurs',30),
  option('','Fördjupning i nationalekonomi',30,{courses:[
    {name:'Period 1: välj 1 av 2',hp:7.5,choiceSlots:1,options:[option('NEK307','Policyutvärdering',7.5),option('NEK310','Dataanalys för nationalekonomi och finans',7.5)]},
    {name:'Period 2: välj 1 av 2',hp:7.5,choiceSlots:1,options:[option('NEK302','Utvecklingsekonomi',7.5),option('NEK304','Miljöekonomi',7.5)]},
    option('NEK316','Kandidatuppsats i nationalekonomi',15,{isThesis:true})
  ]}),
  option('','Fördjupning i statsvetenskap',30,{courses:[
    option('SK1313','Metod inklusive uppsatssamordning i statsvetenskap',15),
    option('SK1523','Examensarbete i statsvetenskap',15,{isThesis:true})
  ]})
];
const rows=[
  course(1,'PPE110','Praktisk filosofi: grundkurs',30),
  course(2,'NEK10','Nationalekonomi: Grundläggande',30),
  course(3,'SK119','Statsvetenskap: Kärnkurspaket 30 hp',30),
  slot(4,'Välj fortsättningskurs i ett av programmets tre ämnen',30,[
    option('FP1200','Praktisk filosofi: Fortsättningskurs',30),
    option('NEK20','Nationalekonomi: Fortsättning',30),
    option('SK129','Statsvetenskap: Fördjupningskurspaket med Tematisk fördjupning',30),
    option('SK139','Statsvetenskap: Fördjupningskurspaket med Miljöpolitikens villkor',30)
  ]),
  slot(5,'Välj ett annat ämne än termin 4, eller statistik 15 hp och valbara kurser 15 hp',30,[
    ...term5Further,
    {code:'',name:'Statistik grundkurser 1 (ST15A) och valbara kurser',hp:30,courses:[
      option('ST15A','Statistik grundkurser 1, kurspaket',15),
      {name:'Valbara kurser inom praktisk filosofi, nationalekonomi, statistik eller statsvetenskap',hp:15,options:term5Electives}
    ]}
  ],{selectionRule:'Välj inte samma ämnesalternativ som under termin 4; statistikspåret krävs inför fördjupning i nationalekonomi.'}),
  slot(6,'Välj fördjupning i ett huvudområde, inklusive kandidatuppsats där det anges',30,term6Options,
    {selectionRule:'Valet beror på kurserna under termin 4 och 5.'})
];
for(let term=1;term<=6;term++)if(Math.abs(rows.filter(x=>x.term===term).reduce((sum,x)=>sum+x.hp,0)-30)>.001)throw Error('GU H1PPE term credits mismatch: '+term);
if(rows.length!==6||Math.abs(rows.reduce((sum,x)=>sum+x.hp,0)-hp)>.001)throw Error('GU H1PPE total or row count mismatch');

const current=manifest.parts.flatMap(part=>{const x=read(root+part);return Array.isArray(x)?x:x.programs})
  .filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
if(current.length!==1)throw Error('GU H1PPE canonical row missing or duplicated');
if(current[0].verified===true){
  if(Number(current[0].programHp||current[0].hp)!==hp||!String(current[0].sourceEvidenceUrl||'').startsWith('https://www.gu.se/'))throw Error('Conflicting verified GU H1PPE identity or provenance');
  if(current[0].validFrom===validFrom&&current[0].sourceEvidenceUrl===sourcePlan&&JSON.stringify(current[0].rows)===JSON.stringify(rows)){
    console.log('GU H1PPE HT26 already materialized');process.exit(0);
  }
  // The checked current syllabus supersedes an older verified interpretation of
  // the same programme and term; keep one canonical row with the newer plan.
}
if(Number(current[0].programHp||current[0].hp)!==hp)throw Error('Refusing to replace mismatched GU H1PPE plan');
const item={...current[0],id:`gu:${code}:${validFrom}`,key:current[0].key,university:'Göteborgs universitet',programCode:code,
  programName:identities[0].programName,programHp:hp,hp,validFrom,coverage:'choice-required',verified:true,courseCodesVerified:true,
  choiceRequired:true,source:'gu-official-programme-syllabus',sourceEvidenceUrl:sourcePlan,sourceUrls:[sourcePage,sourcePlan],
  rows,status:'verified',reason:null};
if(process.argv.includes('--write')){
  const shard=manifest.parts[0],file=root+shard,data=read(file),programs=Array.isArray(data)?data:data.programs;
  const index=programs.findIndex(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
  if(index<0)throw Error('GU H1PPE metadata row is outside the canonical primary shard');
  programs[index]=item;
  fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2)+'\n');
  const verify=read(file+'.tmp'),verifiedRows=Array.isArray(verify)?verify:verify.programs;
  if(verifiedRows.filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code).length!==1)throw Error('GU H1PPE write verification failed');
  fs.renameSync(file+'.tmp',file);
}
console.log(JSON.stringify({code,validFrom,rows:rows.length,termCredits:[30,30,30,30,30,30],choiceRequired:true,courseCodesVerified:true,sources:[sourcePage,sourcePlan]}));
