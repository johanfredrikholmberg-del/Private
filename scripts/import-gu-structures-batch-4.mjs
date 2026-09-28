#!/usr/bin/env node
// Four GU syllabus versions. Never treat alternatives as cumulative programme credits.
import fs from 'node:fs';
const root='data/studielots-db/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const manifest=read(root+'programme-structures-manifest.json'),db=read(root+'manifest.json');
const current=manifest.parts.flatMap(p=>read(root+p).programs);
const programmes=[db.tables.programmes.storage,...(db.tables.programmes.additionalStorages||[])].flatMap(read);
const row=(term,code,name,hp,extra={})=>({term,code,name,hp,category:extra.slot?'elective':'mandatory',...(extra.slot?{isSlot:true,slotType:'elective-slot'}:{}),...(extra.thesis?{isThesis:true}:{}),...(extra.options?{options:extra.options}:{})});
const opt=(code,name,hp)=>({code,name,hp});
const plans=[
 {code:'S2EUM',hp:120,from:'2027HT',source:'https://www.gu.se/syllabus/55f38ac5-493e-11f1-bb9f-75bddadd4925',rows:[
  row(1,'EU2105','Samarbete och konflikt i Europa',7.5),row(1,'EU2302','Analysera Europa: Forskningsdesign och utvärdering',7.5),row(1,'','Val av avancerad metod',15,{slot:true,options:[opt('EU2305','Avancerad kvalitativ forskningsmetod',15),opt('SK2305','Avancerad kvantitativ samhällsvetenskaplig metod',15)]}),
  row(2,'','Valfria kurser, praktik eller utlandsstudier',30,{slot:true,options:[opt('EU2420','Praktik (hel termin)',30),opt('','Valfria kurser i Sverige eller utomlands',30)],partialTermOptions:[opt('EU2430','Praktik (halv termin)',15)]}),
  row(3,'EU2201','Utmaningar för Europa: integration och kultur',15),row(3,'EU2230','Avancerade forskningsteman i Europastudier',15),
  row(4,'EU2500','Examensarbete i Europakunskap',30,{thesis:true})
 ]},
 {code:'S1EUR',hp:180,from:'2026HT',source:'https://www.gu.se/syllabus/ed6f4aa8-c5ed-11f0-9aa4-4a24d5f444fb',note:'Canonical programme identity is the Nationalekonomi profile; terms 2–3 vary with selected profile.',rows:[
  row(1,'EU1110','Introduktion till Europakunskap',15),row(1,'EU1130','Modern europeisk integration I',15),
  row(2,'','Kärnkurser i valt profilämne (Nationalekonomi i katalogposten)',30,{slot:true}),
  row(3,'','Fördjupningskurser i valt profilämne (Nationalekonomi i katalogposten)',30,{slot:true}),
  row(4,'EU1235','Modern europeisk integration II',15),row(4,'EU1240','Att leva i Europa',15),
  row(5,'EU1330','Forskningsmetod i Europakunskap',15),row(5,'EU1540','Kandidatuppsats i Europakunskap',15,{thesis:true}),
  row(6,'','Valbara kurser, utbytesstudier eller praktik',30,{slot:true,options:[opt('EU1410','Praktik',30),opt('','Utbytesstudier eller fristående kurser',30)]})
 ]},
 {code:'S2SPE',hp:120,from:'2026HT',source:'https://www.gu.se/studera/hitta-utbildning/mastersprogram-i-statsvetenskap-politik-och-psykologi-om-hallbar-utveckling-s2spe/utbildningsplan/99f66653-11f0-11ef-a272-18dd79e54a0c',note:'PX2116 or a listed methods course is selected in term 1 or term 3; the same course must not be counted twice.',rows:[
  row(1,'SK2121','Statsvetenskaplig analys',15),row(1,'','Politisk psykologi eller metodkurs',15,{slot:true,options:[opt('PX2116','Politisk psykologi',15),opt('SF2323','Tillämpade kvalitativa forskningsmetoder, problem och design',15),opt('SF2322','Tillämpade kvalitativa forskningsmetoder',15),opt('SF2324','Introduktion till tillämpad forskningsdesign och kvantitativa forskningsmetoder för samhällsvetare',15),opt('SF2321','Tillämpad statistisk analys',15)]}),
  row(2,'SK2223','Samhällsvetenskapliga miljöproblem: från allmänningarnas tragedi till de planetära gränserna',15),row(2,'SK2221','Miljöpolitik och institutioner',15),
  row(3,'PX2151','Masterkurs i Miljöpsykologi',15),row(3,'','Politisk psykologi eller metodkurs (ej redan avklarad kurs)',15,{slot:true,options:[opt('PX2116','Politisk psykologi',15),opt('SF2323','Tillämpade kvalitativa forskningsmetoder, problem och design',15),opt('SF2322','Tillämpade kvalitativa forskningsmetoder',15),opt('SF2324','Introduktion till tillämpad forskningsdesign och kvantitativa forskningsmetoder för samhällsvetare',15),opt('SF2321','Tillämpad statistisk analys',15)]}),
  row(4,'SK2532','Masteruppsats',30,{thesis:true})
 ]},
 {code:'S2IAG',hp:120,from:'2026HT',source:'https://www.gu.se/studera/hitta-utbildning/master-programme-in-international-administration-and-global-governance-s2iag/utbildningsplan/7f4e13b4-2b4b-11f0-be11-0d05041c4592',note:'At least one semi-elective specialisation course is required across terms 2–3; full-term practice in term 2 replaces both modules.',rows:[
  row(1,'AG2110','Theoretical and Historical Perspectives on Global Governance',15),row(1,'AG2120','International Administration and Policy',15),
  row(2,'','Specialisation or internship (first module)',15,{slot:true,options:[opt('SK2212','The Quality of Government',15),opt('AG2440','Praktik',15)]}),
  row(2,'','Elective or internship (second module)',15,{slot:true,options:[opt('AG2440','Praktik',15),opt('','Valbar kurs',15)]}),
  row(3,'','Semi-elective specialisation, elective or internship',15,{slot:true,options:[opt('SK2211','Demokratiers prestationsförmåga',15),opt('EU2210','Europeisk miljö- och energipolitik',15),opt('EU2215','Europa i världen',15),opt('AG2440','Praktik',15),opt('','Valbar kurs',15)]}),
  row(3,'','Val av metodkurs',15,{slot:true,options:[opt('SF2323','Tillämpade kvalitativa forskningsmetoder, problem och design',15),opt('SF2322','Tillämpade kvalitativa forskningsmetoder',15),opt('SF2324','Introduktion till tillämpad forskningsdesign och kvantitativa forskningsmetoder för samhällsvetare',15),opt('SF2321','Tillämpad statistisk analys',15)]}),
  row(4,'AG2500','Master’s Thesis for IAGG',30,{thesis:true})
 ]}
];
const accepted=[];
for(const p of plans){
 const identity=programmes.filter(x=>x.university==='Göteborgs universitet'&&x.programCode===p.code&&Number(x.programHp)===p.hp);
 if(identity.length!==1)throw Error('Programme identity conflict: '+p.code);
 if(current.some(x=>x.university==='Göteborgs universitet'&&x.programCode===p.code))continue;
 for(let term=1;term<=p.hp/30;term++)if(p.rows.filter(x=>x.term===term).reduce((n,x)=>n+x.hp,0)!==30)throw Error(`Term credit conflict: ${p.code}/${term}`);
 const response=await fetch(p.source,{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error(`Official source unavailable: ${p.code} ${response.status}`);
 const html=await response.text();
 if(!html.includes(p.code))throw Error('Official source code not found: '+p.code);
 for(const code of new Set([...p.rows,...p.rows.flatMap(x=>x.options||[])].map(x=>x.code).filter(Boolean)))if(!html.includes(code))throw Error(`Course code absent in GU plan: ${p.code}/${code}`);
 if(p.code==='S2EUM'&&!html.includes('Hösttermin 2027'))throw Error('S2EUM plan version changed');
 if(p.code==='S1EUR'&&!html.includes('Hösttermin 2026'))throw Error('S1EUR plan version changed');
 const id=identity[0];
  accepted.push({id:`gu:${p.code}:${p.from.slice(4)}${p.from.slice(0,4)}`,key:id.key,university:id.university,programCode:p.code,programName:id.programName,programHp:p.hp,hp:p.hp,validFrom:p.from,coverage:'choice-required',verified:true,choiceRequired:true,courseCodesVerified:true,source:'gu-official-education-plan',sourceEvidenceUrl:p.source,sourceUrls:[p.source],...(p.note?{choiceNotes:p.note}:{}),...(p.code==='S2SPE'?{choiceConstraints:[{type:'unique-course-across-terms',code:'PX2116',terms:[1,3]}]}:{}),...(p.code==='S2IAG'?{term2FullTermAlternatives:[opt('AG2450','Praktik',30),opt('','Utbytesstudier',30)],choiceConstraints:[{type:'at-least-one-specialisation',terms:[2,3]},{type:'practice-at-most-once',terms:[2,3]}]}:{}),...(p.code==='S2EUM'?{term2HalfTermPractice:opt('EU2430','Praktik',15)}:{}),rows:p.rows});
}
if(process.argv.includes('--write')&&accepted.length){
 const name='programme-structures-gu-batch-4.json',target=root+name;
 if(fs.existsSync(target)||manifest.parts.includes(name))throw Error('Batch already present');
 fs.writeFileSync(target,JSON.stringify({schemaVersion:1,programs:accepted},null,2)+'\n');
 manifest.parts.push(name);manifest.count+=accepted.length;
 manifest.universities.find(x=>x.university==='Göteborgs universitet').count+=accepted.length;
 db.tables.programmeStructures.rows=manifest.count;
 fs.writeFileSync(root+'programme-structures-manifest.json',JSON.stringify(manifest,null,2)+'\n');
 fs.writeFileSync(root+'manifest.json',JSON.stringify(db,null,2)+'\n');
}
console.log(JSON.stringify({added:accepted.map(x=>({code:x.programCode,from:x.validFrom,rows:x.rows.length})),after:manifest.count}));
