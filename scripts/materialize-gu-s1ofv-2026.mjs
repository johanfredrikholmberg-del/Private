#!/usr/bin/env node
// Materialize GU's official Public Administration programme structure into StudieLots DB.
import fs from 'node:fs';

const root='data/studielots-db/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const db=read(root+'manifest.json');
const manifest=read(db.tables.programmeStructures.storageManifest);
if(db.database!=='StudieLots DB'||manifest.count!==db.tables.programmeStructures.rows)throw Error('Canonical structure count mismatch');

const code='S1OFV',hp=180,validFrom='2026HT';
const identities=[db.tables.programmes.storage,...(db.tables.programmes.additionalStorages||[])].flatMap(read)
  .filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code&&Number(x.programHp)===hp&&x.term==='HT26');
if(identities.length!==1||identities[0].programName!=='Kandidatprogrammet i offentlig förvaltning')throw Error('GU S1OFV identity missing, ambiguous or mismatched');

const syllabusUrl='https://www.gu.se/studera/hitta-utbildning/kandidatprogrammet-i-offentlig-forvaltning-s1ofv/utbildningsplan/7231bd8a-dfbd-11ef-b4a4-d64d95174dcd';
const programmeMapUrl='https://studentportal.gu.se/sites/default/files/2025-03/Programo%CC%88versikt_S1OFV_0.pdf';
// Official GU sources give term placement, course codes, credits and the two T5 specializations.
const course=(term,courseCode,name,credits)=>({term,code:courseCode,name,hp:credits,category:'mandatory',isSlot:false,courseCodeVerified:true});
const option=(courseCode,name)=>({code:courseCode,name,hp:7.5});
const rows=[
  course(1,'OF1000','Introduktion till offentlig förvaltning',7.5),
  course(1,'OF1010','Det svenska politiska systemet',7.5),
  course(1,'OF1020','Redovisning och budgetering',7.5),
  course(1,'OF1030,'+'Förvaltningens organisering',7.5),
  course(2,'OF1040','Samhällsekonomi',15),
  course(2,'OF1050','Juridik i offentlig förvaltning',15),
  course(3,'OF1060','Demokrati och välfärd i ett flernivåsystem',15),
  course(3,'OF1070','Ekonomistyrning i offentlig förvaltning',15),
  course(4,'OF1080','Organisatoriska förutsättningar och relationer',7.5),
  course(4,'OF1090','Digital förvaltning och artificiell intelligens',7.5),
  course(4,'OF1100','Offentlig granskning',7.5),
  course(4,'OF1110','Statistik för arbete i offentlig förvaltning',7.5),
  {term:5,code:'',name:'Välj en av programmets två fördjupningar',hp:22.5,category:'choice',isSlot:true,slotType:'choice-slot',choiceSlots:1,courseCodeVerified:true,options:[
    {name:'Ekonomistyrning och redovisning i offentlig förvaltning',hp:22.5,courses:[
      option('OF1120','Bokföring och externredovisning'),
      option('OF1130','Finansiell analys'),
      option('OF1140','Teoretiska perspektiv på ekonomistyrning')
    ]},
    {name:'Politisk styrning och organisering',hp:22.5,courses:[
      option('OF1150','Policy och reform'),
      option('OF1160','Styrningens organisering'),
      option('OF1170','Förändring och implementering')
    ]}
  ]},
  course(5,'OF1180','Kommunikation i det offentliga arbetslivet',7.5),
  course(6,'OF1190','Metod och vetenskapsteori',15),
  course(6,'OF1200','Examensarbete i offentlig förvaltning',15)
];
for(let term=1;term<=6;term++)if(Math.abs(rows.filter(x=>x.term===term).reduce((sum,x)=>sum+x.hp,0)-30)>.001)throw Error('GU S1OFV term credits mismatch: '+term);
for(const row of rows.filter(x=>x.isSlot))for(const choice of row.options||[])if(Math.abs((choice.courses||[]).reduce((sum,x)=>sum+x.hp,0)-choice.hp)>.001)throw Error('GU S1OFV choice credits mismatch');
if(rows.length!==16||Math.abs(rows.reduce((sum,x)=>sum+x.hp,0)-hp)>.001)throw Error('GU S1OFV total or row count mismatch');

const current=manifest.parts.flatMap(part=>{const x=read(root+part);return Array.isArray(x)?x:x.programs})
  .filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
if(current.length!==1)throw Error('GU S1OFV canonical row missing or duplicated');
if(current[0].verified===true){
  if(current[0].validFrom!==validFrom||current[0].sourceEvidenceUrl!==syllabusUrl||JSON.stringify(current[0].rows)!==JSON.stringify(rows))throw Error('Conflicting verified GU S1OFV plan');
  console.log('GU S1OFV HT26 already materialized');
  process.exit(0);
}
if(current[0].rows?.length||Number(current[0].hp)!==hp)throw Error('Refusing to replace populated or mismatched GU S1OFV plan');

const item={...current[0],id:`gu:${code}:${validFrom}`,key:current[0].key,university:'Göteborgs universitet',programCode:code,
  programName:identities[0].programName,programHp:hp,hp,validFrom,coverage:'choice-required',verified:true,courseCodesVerified:true,
  choiceRequired:true,source:'gu-official-programme-syllabus',sourceEvidenceUrl:syllabusUrl,sourceUrls:[syllabusUrl,programmeMapUrl],
  rows,status:'verified',reason:null};
if(process.argv.includes('--write')){
  const shard=manifest.parts[0],file=root+shard,data=read(file),programs=Array.isArray(data)?data:data.programs;
  const index=programs.findIndex(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
  if(index<0)throw Error('GU S1OFV metadata row is outside the canonical primary shard');
  programs[index]=item;
  fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2)+'\n');
  const verify=read(file+'.tmp'),verifiedRows=Array.isArray(verify)?verify:verify.programs;
  if(verifiedRows.filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code).length!==1)throw Error('GU S1OFV write verification failed');
  fs.renameSync(file+'.tmp',file);
}
console.log(JSON.stringify({code,validFrom,rows:rows.length,termCredits:[30,30,30,30,30,30],choiceSlots:1,courseCodesVerified:true,sources:[syllabusUrl,programmeMapUrl]}));
