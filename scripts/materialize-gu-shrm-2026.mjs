#!/usr/bin/env node
// Materialize the official GU S2HRM study plan valid from HT26.
import fs from 'node:fs';
const root='data/studielots-db/',read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const db=read(root+'manifest.json'),manifest=read(db.tables.programmeStructures.storageManifest);
if(db.database!=='StudieLots DB'||manifest.count!==db.tables.programmeStructures.rows)throw Error('Canonical structure count mismatch');
const code='S2HRM',hp=120,validFrom='2026HT';
const identities=[db.tables.programmes.storage,...(db.tables.programmes.additionalStorages||[])].flatMap(read)
 .filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code&&Number(x.programHp)===hp&&x.term==='HT26');
if(identities.length!==1)throw Error('GU S2HRM identity missing or ambiguous');
const url='https://www.gu.se/studera/hitta-utbildning/master-programme-in-strategic-human-resource-management-and-labour-relations-s2hrm/utbildningsplan/890e28f9-8e36-11f0-b29b-713806674b84';
const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
if(!response.ok||new URL(response.url).host!=='www.gu.se')throw Error('Official GU S2HRM syllabus unavailable');
const html=await response.text();
const plain=html.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;|\\u00a0|\\u202f/g,' ').replace(/\\s+/g,' ');
for(const required of ['S2HRM','Hösttermin 2026','120 högskolepoäng','PV2104','PV2101','PV2301','PV2400','PV2205','PV2206','PV2102','PV2203','PV2500'])if(!plain.includes(required))throw Error('GU S2HRM syllabus missing '+required);
const course=(term,c,name,credits)=>({term,code:c,name,hp:credits,category:'mandatory',isSlot:false,courseCodeVerified:true});
const slot=(term,name,options)=>({term,code:'',name,hp:15,category:'elective',isSlot:true,slotType:'elective-slot',courseCodeVerified:false,options});
const rows=[
 course(1,'PV2104','Personalarbete i ett samhällsperspektiv',15),
 course(1,'PV2101','Strategiskt personalarbete',15),
 course(2,'PV2301','Forskningsmetoder',15),
 slot(2,'Val mellan praktik eller två valbara kurser',[
  {name:'PV2400 Praktik i personal- och ledningsarbete',hp:15},
  {name:'PV2205 Konflikt och samarbete i organisationer + PV2206 HR-analys',hp:15}
 ]),
 slot(3,'Val mellan hållbart ledarskap eller praktik',[
  {name:'PV2102 Hållbart ledarskap',hp:15},
  {name:'PV2400 Praktik i personal- och ledningsarbete',hp:15}
 ]),
 course(3,'PV2203','Utmaningar inom strategiskt personalarbete',15),
 course(4,'PV2500','Examensarbete för Masterprogram i strategiskt personalarbete och arbetsmarknadsrelationer',30)
];
for(let t=1;t<=4;t++)if(rows.filter(r=>r.term===t).reduce((n,r)=>n+r.hp,0)!==30)throw Error('GU S2HRM term credits mismatch: '+t);
if(rows.length!==7)throw Error('GU S2HRM row count mismatch');
const existing=manifest.parts.flatMap(p=>{const x=read(root+p);return Array.isArray(x)?x:x.programs}).filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
if(existing.length>1)throw Error('Duplicate canonical GU S2HRM rows');
if(existing[0]?.verified===true){
 if(existing[0].validFrom!==validFrom||existing[0].sourceEvidenceUrl!==url||JSON.stringify(existing[0].rows)!==JSON.stringify(rows))throw Error('Conflicting verified GU S2HRM plan');
 console.log('GU S2HRM HT26 already materialized');
 process.exit(0);
}
if(existing[0]&&(existing[0].rows?.length||Number(existing[0].hp)!==hp))throw Error('Refusing to replace populated or mismatched GU S2HRM plan');
const item={...(existing[0]||{}),id:`gu:${code}:${validFrom}`,key:existing[0]?.key||identities[0].key,university:'Göteborgs universitet',programCode:code,programName:identities[0].programName,programHp:hp,hp,validFrom,coverage:'choice-required',verified:true,courseCodesVerified:false,choiceRequired:true,source:'gu-official-programme-syllabus',sourceEvidenceUrl:url,sourceUrls:[url],rows,status:'verified',reason:null};
if(process.argv.includes('--write')){
 const partName=manifest.parts[0],file=root+partName,data=read(file),list=Array.isArray(data)?data:data.programs;
 const idx=list.findIndex(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
 if(idx>=0)list[idx]=item;else list.push(item);
 fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2)+'\\n');
 const verify=read(file+'.tmp'),vrows=Array.isArray(verify)?verify:verify.programs;
 if(vrows.filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code).length!==1)throw Error('GU S2HRM write verification failed');
 fs.renameSync(file+'.tmp',file);
 if(idx<0){manifest.count++;manifest.universities.find(x=>x.university==='Göteborgs universitet').count++;db.tables.programmeStructures.rows=manifest.count;}
 fs.writeFileSync(root+'programme-structures-manifest.json',JSON.stringify(manifest,null,2)+'\\n');
 fs.writeFileSync(root+'manifest.json',JSON.stringify(db,null,2)+'\\n');
}
console.log(JSON.stringify({code,validFrom,rows:rows.length,termCredits:[30,30,30,30],choiceSlots:2,source:url}));
