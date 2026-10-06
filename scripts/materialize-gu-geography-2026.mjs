#!/usr/bin/env node
// Materialize GU Geography N1GEO from its official HT26 catalogue identity and programme overview.
import fs from 'node:fs';
const root='data/studielots-db/',read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const db=read(root+'manifest.json'),manifest=read(db.tables.programmeStructures.storageManifest);
if(db.database!=='StudieLots DB'||manifest.count!==db.tables.programmeStructures.rows)throw Error('Canonical structure count mismatch');
const code='N1GEO',hp=180,validFrom='2026HT';
const identities=[db.tables.programmes.storage,...(db.tables.programmes.additionalStorages||[])].flatMap(read)
 .filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code&&Number(x.programHp)===hp&&x.term==='HT26');
if(identities.length!==1)throw Error('GU N1GEO identity missing or ambiguous');
const identityUrl='https://www.gu.se/studera/hitta-utbildning/geografi-kandidatprogram-n1geo';
const overviewUrl='https://www.gu.se/studera/hitta-utbildning/detta-laser-du-pa-kandidatprogrammet-i-geografi';
const fetchOfficial=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok||new URL(r.url).host!=='www.gu.se')throw Error('Official GU page unavailable: '+url);return (await r.text()).replace(/<[^>]*>/g,' ').replaceAll('&nbsp;',' ').replaceAll(String.fromCharCode(160),' ');};
const identityText=await fetchOfficial(identityUrl),overviewText=await fetchOfficial(overviewUrl);
for(const required of ['N1GEO','180 högskolepoäng','Höst 2026'])if(!identityText.includes(required))throw Error('GU N1GEO identity page missing '+required);
for(const required of ['Geografi baskurs','GE0400','Geografi fortsättningskurs','GE2120','GE2345','NG0230','GE2450','GE2750','NG0220','GE3000','GE4200','Termin 6'])if(!overviewText.includes(required))throw Error('GU Geography overview missing '+required);
const course=(term,name,hp,courseCode='')=>({term,code:courseCode,name,hp,category:'mandatory',isSlot:false,courseCodeVerified:Boolean(courseCode)});
const slot=(term,name,hp)=>({term,code:'',name,hp,category:'elective',isSlot:true,slotType:'elective-slot',courseCodeVerified:false});
const rows=[
 course(1,'Introduktion',7.5),course(1,'Geografiska Informationssystem (GIS) 1',7.5),course(1,'Processer i naturen',7.5),course(1,'Befolkningsutveckling och urbanisering',7.5),
 course(2,'De stora systemen i naturen: regionala förutsättningar och risker',7.5),course(2,'Resurser och försörjning i det Globala Syd',7.5),course(2,'Geografi och mänsklig hälsa',7.5),course(2,'Människa och miljö',7.5),
 course(3,'Fysisk planering',15,'GE2345'),course(3,'Klimatförändringar ur ett geografiskt perspektiv',15,'NG0230'),
 course(4,'Välfärdsgeografi',7.5,'GE2450'),course(4,'Ekonomisk geografi',7.5,'GE2750'),course(4,'Klimatförändringar och samhället',15,'NG0220'),
 slot(5,'Fältkurs eller praktik',15),course(5,'Infrastruktur, transporter och kommunikation',7.5),course(5,'Fjärranalys: Geografiska informationssystem (GIS)',7.5),
 course(6,'Kulturgeografisk idéhistoria och metod',7.5),course(6,'Kunskapsöversikt',7.5),course(6,'Examensarbete',15)
];
for(let t=1;t<=6;t++)if(rows.filter(r=>r.term===t).reduce((n,r)=>n+r.hp,0)!==30)throw Error('GU Geography term credits mismatch: '+t);
if(rows.length!==19)throw Error('GU Geography row count mismatch');
const existing=manifest.parts.flatMap(p=>{const x=read(root+p);return Array.isArray(x)?x:x.programs}).filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
if(existing.length>1)throw Error('Duplicate canonical GU N1GEO rows');
if(existing[0]?.verified===true){
 if(existing[0].validFrom!==validFrom||existing[0].sourceEvidenceUrl!==overviewUrl||JSON.stringify(existing[0].rows)!==JSON.stringify(rows))throw Error('Conflicting verified GU N1GEO plan');
 console.log('GU N1GEO HT26 already materialized');process.exit(0);
}
if(existing[0]&&(existing[0].rows?.length||Number(existing[0].hp)!==hp))throw Error('Refusing to replace populated or mismatched GU N1GEO plan');
const item={...(existing[0]||{}),id:`gu:${code}:${validFrom}`,key:existing[0]?.key||identities[0].key,university:'Göteborgs universitet',programCode:code,programName:identities[0].programName,programHp:hp,hp,validFrom,coverage:'choice-required',verified:true,courseCodesVerified:false,choiceRequired:true,source:'gu-official-programme-overview',sourceEvidenceUrl:overviewUrl,sourceUrls:[identityUrl,overviewUrl],rows,status:'verified',reason:null};
if(process.argv.includes('--write')){
 const partName=manifest.parts[0],file=root+partName,data=read(file),list=Array.isArray(data)?data:data.programs;
 const idx=list.findIndex(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
 if(idx>=0)list[idx]=item;else list.push(item);
 fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2)+String.fromCharCode(10));
 const verify=read(file+'.tmp'),vrows=Array.isArray(verify)?verify:verify.programs;
 if(vrows.filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code).length!==1)throw Error('GU N1GEO write verification failed');
 fs.renameSync(file+'.tmp',file);
 if(idx<0){manifest.count++;manifest.universities.find(x=>x.university==='Göteborgs universitet').count++;db.tables.programmeStructures.rows=manifest.count;}
 fs.writeFileSync(root+'programme-structures-manifest.json',JSON.stringify(manifest,null,2)+String.fromCharCode(10));
 fs.writeFileSync(root+'manifest.json',JSON.stringify(db,null,2)+String.fromCharCode(10));
}
console.log(JSON.stringify({code,validFrom,rows:rows.length,termCredits:[30,30,30,30,30,30],choiceSlots:1,courseCodesVerified:false,sources:[identityUrl,overviewUrl]}));
