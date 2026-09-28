#!/usr/bin/env node
// Import two complete term sequences from GU. Unpublished course codes remain blank.
import fs from 'node:fs';
const base='data/studielots-db/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const index=read(base+'programme-structures-manifest.json');
const db=read(base+'manifest.json');
const all=index.parts.flatMap(p=>{const shard=read(base+p);return (Array.isArray(shard)?shard:(shard.programs||[])).filter(Boolean)});
const identities=[read(db.tables.programmes.storage),...(db.tables.programmes.additionalStorages||[]).map(read)].flat().filter(Boolean);
const row=(term,code,name,hp,extra={})=>({term,code,name,hp,category:extra.slot?'elective':'mandatory',...(extra.slot?{isSlot:true,slotType:'elective-slot'}:{}),...(extra.thesis?{isThesis:true}:{}),...(extra.options?{options:extra.options}:{})});
const source={
 N1SOF:'https://www.gu.se/studera/hitta-utbildning/n1sof-curriculum',
 S2LTM:'https://www.gu.se/studera/hitta-utbildning/masterprogram-i-logistik-och-transport-s2ltm/utbildningsplan/b663c9cc-b4a2-11f0-bd83-743a3e5145ea',
 S1STV:'https://www.gu.se/syllabus/50391253-7083-11f1-b645-10cec8c14f9f'
};
const plans=[
 {code:'N1SOF',hp:180,coverage:'choice-required',codesVerified:false,rows:[
  row(1,'DIT008','Diskret matematik',7.5),row(1,'DIT014','Grundläggande programmering',7.5),row(1,'DIT044','Objektorienterad programmering',7.5),row(1,'DIT099','Projekt: Agil projektledning',7.5),
  row(2,'DIT034','Systematisk datahantering',7.5),row(2,'DIT047','Kravhantering',7.5),row(2,'DIT962','Datastrukturer och algoritmer',7.5),row(2,'DIT114','Projekt: Systemutveckling',7.5),
  row(3,'DIT349','Grundläggande mjukvaruarkitektur',7.5),row(3,'DIT357','Distribuerade system',7.5),row(3,'DIT096','Människa-datorinteraktion',7.5),row(3,'DIT343','Projekt: Webbutveckling',7.5),
  row(4,'DIT633','Utveckling av inbyggda- och realtidssystem',7.5),row(4,'DIT636','Mjukvarukvalitet och testning',7.5),row(4,'DIT118','Avancerad programmering',7.5),row(4,'DIT637','Projekt: Datadriven programvaruteknik för cyberfysiska system',7.5),
  row(5,'','Valbara kurser eller utlandsstudier',30,{slot:true}),
  row(6,'DIT876','Management och ledarskap',7.5),row(6,'DIT832','Forskningsmetodik för programvaruteknik',7.5),row(6,'','Kandidatarbete inom Software Engineering and Management',15,{thesis:true})
 ]},
 {code:'S2LTM',hp:120,coverage:'course-codes-unverified',codesVerified:false,rows:[
  row(1,'','Integrerad logistik eller Logistiska informationssystem',7.5,{slot:true,options:[{name:'Integrerad logistik',hp:7.5},{name:'Logistiska informationssystem',hp:7.5}]}),
  row(1,'','Supply Chain Management',7.5),row(1,'','Försörjnings- och logistikhantering',7.5),row(1,'','Verksamhetsstyrning',7.5),
  row(2,'','Valbar kurs',7.5,{slot:true}),row(2,'','Retailing, Wholesaling and Logistics',7.5),row(2,'','Sjöfartens logistik',7.5),row(2,'','Valbar kurs',7.5,{slot:true}),
  row(3,'','Valbara kurser',22.5,{slot:true}),row(3,'','Forskningsmetoder',7.5),
  row(4,'','Examensarbete i logistik och transport',30,{thesis:true})
 ]},
 {code:'S1STV',hp:180,validFrom:'2027VT',coverage:'choice-required',codesVerified:false,rows:[
  row(1,'SK1124','Politisk teori',7.5),row(1,'SK1114','Svensk och jämförande politik',7.5),row(1,'SK1115','Offentlig förvaltning',7.5),row(1,'SK1125','Internationell politik',7.5),
  row(2,'SK1230','Politisk teori, fördjupningskurs',7.5),row(2,'SK1231','Jämförande politik, fördjupningskurs',7.5),
  row(2,'','Fördjupning i politiskt beteende och offentlig förvaltning eller miljöpolitik',15,{slot:true,options:[{code:'SK1232 + SK1234',name:'Politiskt beteende och opinion samt Offentlig förvaltning',hp:15},{code:'SK1224',name:'Miljöpolitikens villkor (endast vårtermin)',hp:15}]}),
  row(3,'','Kärnkurser i vald inriktning',30,{slot:true}),row(4,'','Fördjupningskurser i vald inriktning',30,{slot:true}),
  row(5,'','Valbara kurser, utbytesstudier eller praktik',30,{slot:true}),
  row(6,'SK1313','Metod inklusive uppsatssamordning',15),row(6,'SK1523','Examensarbete i statsvetenskap',15,{thesis:true})
 ]}
];
const accepted=[];
for(const plan of plans){
 const candidates=identities.filter(x=>x.university==='Göteborgs universitet'&&x.programCode===plan.code&&x.programHp===plan.hp);
 if(candidates.length!==1)throw Error(`Identity conflict: ${plan.code}`);
 if(all.some(x=>x.university==='Göteborgs universitet'&&x.programCode===plan.code))continue;
 if(Array.from({length:plan.hp/30},(_,i)=>i+1).some(term=>plan.rows.filter(x=>x.term===term).reduce((n,x)=>n+x.hp,0)!==30))throw Error(`Term credits incomplete: ${plan.code}`);
 const response=await fetch(source[plan.code],{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error(`Official GU page unavailable: ${plan.code} ${response.status}`);
 const html=await response.text();
 if(!html.includes(plan.code)||plan.rows.filter(x=>x.code).some(x=>!html.includes(x.code)))throw Error(`Official course codes changed: ${plan.code}`);
 if(plan.code==='S2LTM'&&!html.includes('Hösttermin 2026'))throw Error('S2LTM syllabus version changed');
 if(plan.code==='S1STV'&&!html.includes('Vårtermin 2027'))throw Error('S1STV syllabus version changed');
 const identity=candidates[0];
 const validFrom=plan.validFrom||'2026HT';
 accepted.push({id:`gu:${plan.code}:${validFrom.slice(4)}${validFrom.slice(0,4)}`,key:identity.key,university:identity.university,programCode:plan.code,programName:identity.programName,programHp:plan.hp,hp:plan.hp,validFrom,coverage:plan.coverage,verified:true,courseCodesVerified:plan.codesVerified,choiceRequired:plan.rows.some(x=>x.isSlot),source:'gu-official-programme-plan',sourceEvidenceUrl:source[plan.code],sourceUrls:[source[plan.code]],rows:plan.rows});
}
const target=base+'programme-structures-gu-next.json';
if(process.argv.includes('--write')){
 if(!accepted.length){console.log('No new GU structures; canonical DB already contains these verified plans');process.exit(0);}
 const already=fs.existsSync(target)?read(target):{schemaVersion:1,programs:[]};
 if(fs.existsSync(target)!==index.parts.includes('programme-structures-gu-next.json'))throw Error('Shard and manifest conflict');
 fs.writeFileSync(target,JSON.stringify({...already,programs:[...already.programs,...accepted]},null,2)+'\n');
 if(!index.parts.includes('programme-structures-gu-next.json'))index.parts.push('programme-structures-gu-next.json');
 index.count+=accepted.length;
 index.universities.find(x=>x.university==='Göteborgs universitet').count+=accepted.length;
 db.tables.programmeStructures.rows=index.count;
 fs.writeFileSync(base+'programme-structures-manifest.json',JSON.stringify(index,null,2)+'\n');
 fs.writeFileSync(base+'manifest.json',JSON.stringify(db,null,2)+'\n');
}
console.log(JSON.stringify({added:accepted.map(x=>({code:x.programCode,rows:x.rows.length,coverage:x.coverage})),after:index.count}));
