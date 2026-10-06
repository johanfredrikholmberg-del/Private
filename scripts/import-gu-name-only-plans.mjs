#!/usr/bin/env node
// Store official, full-semester GU plans whose course codes are not published
// in the programme overview. These are withheld from automatic credit matching.
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const dir='data/studielots-db/',manifestPath=dir+'programme-structures-manifest.json';
const manifest=read(manifestPath),parts=manifest.parts.map(x=>read(dir+x));
const existing=parts.flatMap(x=>Array.isArray(x)?x:(x.programs||[])),programmes=read(read(dir+'manifest.json').tables.programmes.storage);
const course=(term,name,hp)=>({term,code:'',name,hp,category:'mandatory',isSlot:false,courseCodeVerified:false});
const slot=(term,name,hp,options=[])=>({term,code:'',name,hp,category:'elective-slot',slotType:'programme-elective',isSlot:true,options});
const plans=[
  {code:'M2STA',source:'https://www.gu.se/studera/hitta-utbildning/programoversikt-masterprogrammet-i-tillampad-biostatistik',rows:[
    course(1,'Introduktion till biostatistik',9),course(1,'R programmering för tillämpad biostatistik',6),course(1,'Studie- och experimentdesign',7.5),course(1,'Regressionsanalys',7.5),
    course(2,'Kausal inferens',7.5),course(2,'Hälsodata och enkäter',7.5),course(2,'Statistisk inlärning',7.5),course(2,'Statistiska metoder, fördjupning',7.5),
    course(3,'Överlevnadsanalys',7.5),course(3,'Maskininlärning och AI',7.5),slot(3,'Valbara kurser',15),
    course(4,'Examensarbete i tillämpad biostatistik',30)]},
  {code:'V2GLH',source:'https://www.gu.se/studera/hitta-utbildning/programoversikt-masterprogrammet-i-global-halsa',rows:[
    course(1,'Globala hälsoutmaningar i ett interdisciplinärt sammanhang',15),course(1,'Kvantitativa och kvalitativa metoder',15),
    course(2,'Att styra och leda folkhälsa och hälso- och sjukvård i ett globalt perspektiv',15),course(2,'Global hälsoekonomi',15),
    slot(3,'Valbara kurser eller utlandsstudier',30,[
      {name:'Tillämpad kvalitativ metod',hp:7.5},{name:'Tillämpad epidemiologi och biostatistik',hp:7.5},
      {name:'Hälsofrämjande och sjukdomsförebyggande arbete i riskgrupper: strategier och metoder',hp:15}
    ]),course(4,'Masteruppsats i global hälsa',30)]}
];
const added=[],replaced=[];
const upgrades=[];
for(const plan of plans){
  const identity=programmes.filter(x=>x.university==='Göteborgs universitet'&&x.programCode===plan.code);
  if(identity.length!==1||Number(identity[0].programHp)!==120)throw Error(`Identity conflict: ${plan.code}`);
  if(!/^https:\/\/www\.gu\.se\//.test(plan.source))throw Error('Unofficial source');
  for(let t=1;t<=4;t++)if(Math.abs(plan.rows.filter(x=>x.term===t).reduce((n,x)=>n+x.hp,0)-30)>.001)throw Error(`Unbalanced ${plan.code} term ${t}`);
  const current=existing.find(x=>x.university==='Göteborgs universitet'&&x.programCode===plan.code);
  if(current&&(current.courseCodesVerified===true||current.source==='gu-official-programme-overview'))continue;
  const structure={id:`gu:${plan.code}:2026HT`,key:identity[0].key,university:'Göteborgs universitet',programCode:plan.code,programName:identity[0].programName,programHp:120,hp:120,validFrom:'2026HT',coverage:'course-codes-unverified',verified:true,courseCodesVerified:false,choiceRequired:plan.rows.some(x=>x.isSlot),source:'gu-official-programme-overview',sourceEvidenceUrl:plan.source,sourceUrls:[plan.source],rows:plan.rows};
  if(current){
    const partIndex=parts.findIndex(p=>(Array.isArray(p)?p:(p.programs||[])).includes(current));
    const rowIndex=(Array.isArray(parts[partIndex])?parts[partIndex]:(parts[partIndex].programs||[])).indexOf(current);
    upgrades.push({partIndex,rowIndex,structure,code:plan.code});
    replaced.push({code:plan.code,rows:plan.rows.length,coverage:structure.coverage});
  }else added.push(structure);
}
const summary={before:existing.length,added:added.map(x=>({code:x.programCode,rows:x.rows.length,coverage:x.coverage})),replaced,after:existing.length+added.length};
if(process.argv.includes('--write')&&(added.length||upgrades.length)){
  if(manifest.count!==existing.length)throw Error('Manifest count conflict');
  const changedParts=new Set();
  for(const u of upgrades){
    const part=parts[u.partIndex],rows=Array.isArray(part)?part:(part.programs||[]);
    rows[u.rowIndex]=u.structure;
    changedParts.add(u.partIndex);
  }
  if(added.length){
    const lastIndex=parts.length-1,last=parts[lastIndex],rows=Array.isArray(last)?last:(last.programs||[]);
    if(Array.isArray(last))parts[lastIndex]=[...rows,...added];
    else parts[lastIndex]={...last,programs:[...rows,...added]};
    changedParts.add(lastIndex);
  }
  for(const i of changedParts){
    const original=read(dir+manifest.parts[i]),target=parts[i];
    const originalRows=Array.isArray(original)?original:(original.programs||[]);
    const targetRows=Array.isArray(target)?target:(target.programs||[]);
    if(targetRows.length!==originalRows.length+(i===parts.length-1?added.length:0))throw Error('Write verification failed');
    fs.writeFileSync(dir+manifest.parts[i]+'.tmp',JSON.stringify(target,null,2)+'\n');
    fs.renameSync(dir+manifest.parts[i]+'.tmp',dir+manifest.parts[i]);
  }
  const next={...manifest,count:summary.after,universities:manifest.universities.map(x=>x.university==='Göteborgs universitet'?{...x,count:x.count+added.length}:x)};
  fs.writeFileSync(manifestPath+'.tmp',JSON.stringify(next,null,2)+'\n');
  fs.renameSync(manifestPath+'.tmp',manifestPath);
}
console.log(JSON.stringify(summary));
