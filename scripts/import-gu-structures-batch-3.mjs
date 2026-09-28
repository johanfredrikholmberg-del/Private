#!/usr/bin/env node
// Source-backed GU term structures; dry-run by default, idempotent and conflict-checked.
import fs from 'node:fs';
const dir='data/studielots-db/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const structureManifest=read(dir+'programme-structures-manifest.json');
const db=read(dir+'manifest.json');
const present=structureManifest.parts.flatMap(p=>read(dir+p).programs);
const identities=[db.tables.programmes.storage,...(db.tables.programmes.additionalStorages||[])].flatMap(read);
const r=(term,code,name,hp,opts={})=>({term,code,name,hp,category:opts.slot?'elective':'mandatory',...(opts.slot?{isSlot:true,slotType:'elective-slot'}:{}),...(opts.thesis?{isThesis:true}:{}),...(opts.options?{options:opts.options}:{})});
const opt=(code,name,hp)=>({code,name,hp});
const plans=[
 {code:'N1FAR',hp:180,validFrom:'2026HT',source:'https://www.gu.se/studera/hitta-utbildning/de-har-kurserna-laser-du-inom-receptarieprogrammet',coverage:'choice-required',rows:[
  r(1,'INR100','Introduktionskurs för receptarier',7.5),r(1,'KER100','Kemi för receptarier',22.5),
  r(2,'CBR100','Cellbiologi för receptarier',10),r(2,'FYR100','Fysiologi för receptarier',13.5),r(2,'IIR100','Infektion och immunologi för receptarier',6.5),
  r(3,'FSR200','Farmakologi och sjukdomslära',16.5),r(3,'KER200','Läkemedelskemi och toxikologi',13.5),
  r(4,'TFR200','Tillämpad fysiologi och farmakologi med biostatisk',7.5),r(4,'GAR200','Galenisk farmaci',7.5),r(4,'FKR210','Klinisk farmakokinetik och farmakodynamik',4.5),r(4,'EVR200','Egenvård för receptarier',4.5),r(4,'FKR220','Applicerbar farmakokinetik och dynamik med farmakoterapi',6),
  r(5,'FLR300','Farmakognosi och läkemedels ursprung',3),r(5,'FÖR300','Författningar inom läkemedels- och apoteksområdet',4.5),r(5,'SAR300','Samhällsfarmaci',7.5),r(5,'LÄR200','Läkemedelsrådgivning och kommunikation',7.5),
  r(5,'','Valbar kurs',7.5,{slot:true,options:[opt('KER300','Dermatokemi och kontaktallergi',7.5),opt('LFD300','Läkemedel för djur',7.5),opt('VÅR300','Farmaci i vården',7.5)]}),
  r(6,'FAR300','Examenskurs i farmaci',15,{thesis:true}),r(6,'TAF300','Tillämpad apoteksfarmaci',15)
 ]},
 {code:'M2PHP',hp:120,validFrom:'2026HT',source:'https://www.gu.se/studera/hitta-utbildning/masterprogram-i-folkhalsovetenskap-m2php/utbildningsplan/a804aac3-8731-11ef-b936-3036d7c64115',coverage:'choice-required',rows:[
  r(1,'MPH211','Folkhälsovetenskapens utgpångspunkter och tillämpningsområden',15),r(1,'MPH212','Jämlik hälsa och rätten till hälsa',7.5),r(1,'MPH213','Kvalitativa metoder inom folkhälsovetenskap',7.5),
  r(2,'MPH221','Epidemiologi och biostatistik',15),r(2,'','Valbar huvudområdeskurs',15,{slot:true,options:[opt('MPH222','Hälsoekonomi: utgångspunkter, tillämpningsområden och metodik',15),opt('MPH223','Socialepidemiologi: teori, metod och praktiska implikationer',15)]}),
  r(3,'','Valfria kurser, praktik eller utlandsstudier',30,{slot:true,options:[opt('MPH231','Hälsoekonomiska utvärderingar: fördjupningskurs',15),opt('MPH232','Strategiskt arbete för jämlik hälsa: policy, interventioner och utvärdering',15),opt('MPH233','Arbete och hälsa: hälsopromotion och sjukdomsförebyggande ansatser',7.5),opt('MPH234','Migration och hälsa i ett socialt, demografiskt och politiskt sammanhang',7.5),opt('MPH235','Praktiskt folkhälsoarbete: intervention, implementering och utvärdering',30),opt('MPH303','Folkhälsoarbete: planering av intervention och utvärdering',15)]}),
  r(4,'MPH241','Examensarbete i folkhälsovetenskap',30,{thesis:true})
 ]},
 {code:'S2IAM',hp:120,validFrom:'2027HT',source:'https://www.gu.se/statsvetenskap/programoversikt-masterprogrammet-i-internationell-administration-och-global-samhallsstyrning-iagg',syllabusPublished:false,coverage:'choice-required',rows:[
  r(1,'AG2105','Globala policyprocesser',7.5),r(1,'AG2302','Forskningsdesign och policyutvärdering för samhällsvetare',7.5),r(1,'','Val av avancerad metod',15,{slot:true,options:[opt('EU2305','Avancerad kvalitativ forskningsmetod',15),opt('SK2305','Avancerad kvantitativ samhällsvetenskaplig metod',15)]}),
  r(2,'AG2210','Aktörer och politikområden inom global styrning',15),r(2,'AG2220','Global styrning i praktiken: konflikthantering och internationellt bistånd',15),
  r(3,'','Praktik, utbytesstudier eller två fördjupningsmoduler',30,{slot:true,options:[opt('AG2450','Praktik',30),opt('','Utbytesstudier',30),opt('AG2440','Praktik (modul)',15),opt('AG2201','Fördjupningsseminarier: Tematiska inriktningar',15),opt('SK2303','Metodfördjupning',15),opt('AG2202','Fördjupningsseminarier i internationell och komparativ politik',15)]}),
  r(4,'AG2500','Masteruppsats i internationell administration och global samhällsstyrning',30,{thesis:true})
 ]},
 {code:'S2PSM',hp:120,validFrom:'2027HT',source:'https://www.gu.se/statsvetenskap/programoversikt-masterprogrammet-i-statsvetenskap-maps',coverage:'choice-required',rows:[
  r(1,'SK2304','Forskningsdesign för statsvetenskap',7.5),r(1,'SK2201','Fördjupning i komparativ politik',7.5),r(1,'SK2305','Avancerad kvantitativ samhällsvetenskaplig metod',15),
  r(2,'SK2202','Fördjupning i politiskt beteende',7.5),r(2,'SK2203','Fördjupning i offentlig förvaltning',7.5),r(2,'SK2204','Fördjupningsseminarier i statsvetenskap I',15),
  r(3,'','Praktik, utbytesstudier eller två fördjupningsmoduler',30,{slot:true,options:[opt('SK2420','Praktik',30),opt('','Utbytesstudier',30),opt('SK2205','Fördjupningsseminarier i statsvetenskap II',15),opt('SK2412','Praktik (modul)',15),opt('SK2303','Metodfördjupning',15),opt('AG2202','Fördjupningsseminarier i internationell och komparativ politik',15)]}),
  r(4,'SK2532','Masteruppsats i statsvetenskap',30,{thesis:true})
 ]}
];
const additions=[];
for(const p of plans){
 const matches=identities.filter(x=>x.university==='Göteborgs universitet'&&x.programCode===p.code&&Number(x.programHp)===p.hp);
 if(matches.length!==1)throw Error(`Canonical identity conflict for ${p.code}`);
 if(present.some(x=>x.university==='Göteborgs universitet'&&x.programCode===p.code))continue;
 for(let term=1;term<=p.hp/30;term++)if(p.rows.filter(x=>x.term===term).reduce((sum,x)=>sum+x.hp,0)!==30)throw Error(`Term ${term} not 30 hp for ${p.code}`);
 const response=await fetch(p.source,{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error(`Official GU source ${response.status} for ${p.code}`);
 const html=await response.text();
 const codes=[...p.rows,...p.rows.flatMap(x=>x.options||[])].map(x=>x.code).filter(Boolean).flatMap(x=>x.includes(' + ')?x.split(' + '):[x]);
 for(const code of codes)if(!html.includes(code))throw Error(`GU source no longer lists ${code} (${p.code})`);
 if(p.code==='N1FAR'&&!html.includes('receptarieprogrammet'))throw Error('N1FAR identity changed');
 if(p.code==='M2PHP'&&!html.includes('Hösttermin 2025'))throw Error('M2PHP syllabus version changed');
 if(p.code==='S2IAM'&&!html.includes('kursplanerna ännu inte publicerats'))throw Error('S2IAM syllabus status changed; review needed');
 const identity=matches[0];
 additions.push({id:`gu:${p.code}:${p.validFrom.slice(4)}${p.validFrom.slice(0,4)}`,key:identity.key,university:identity.university,programCode:p.code,programName:identity.programName,programHp:p.hp,hp:p.hp,validFrom:p.validFrom,coverage:p.coverage,verified:true,courseCodesVerified:p.rows.every(x=>x.isSlot||Boolean(x.code)),choiceRequired:true,...(p.syllabusPublished===false?{syllabusPublished:false}:{}),source:'gu-official-programme-plan',sourceEvidenceUrl:p.source,sourceUrls:[p.source],rows:p.rows});
}
if(process.argv.includes('--write')&&additions.length){
 const filename='programme-structures-gu-batch-3.json',target=dir+filename;
 if(fs.existsSync(target)||structureManifest.parts.includes(filename))throw Error('Target already activated');
 fs.writeFileSync(target,JSON.stringify({schemaVersion:1,programs:additions},null,2)+'\n');
 structureManifest.parts.push(filename);structureManifest.count+=additions.length;
 structureManifest.universities.find(x=>x.university==='Göteborgs universitet').count+=additions.length;
 db.tables.programmeStructures.rows=structureManifest.count;
 fs.writeFileSync(dir+'programme-structures-manifest.json',JSON.stringify(structureManifest,null,2)+'\n');
 fs.writeFileSync(dir+'manifest.json',JSON.stringify(db,null,2)+'\n');
}
console.log(JSON.stringify({added:additions.map(x=>({code:x.programCode,rows:x.rows.length,from:x.validFrom})),after:structureManifest.count}));
