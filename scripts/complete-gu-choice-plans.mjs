#!/usr/bin/env node
// GU publishes the missing terms of these two plans explicitly. Preserve the
// existing rows and represent the stated elective credits as slots, not courses.
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const file='data/studielots-db/programme-structures-2.json',part=read(file);
const official={
  S1GSA:'https://www.gu.se/studera/hitta-utbildning/socionomprogrammet-s1gsa',
  S2SOC:'https://www.gu.se/studera/hitta-utbildning/masterprogram-i-sociologi-s2soc'
};
const course=(term,code,name,hp,extra={})=>({term,code,name,hp,category:'mandatory',isSlot:false,...extra});
const elective=(term,name,hp,extra={})=>({term,code:'',name,hp,category:'elective-slot',slotType:'programme-elective',isSlot:true,...extra});
const social=part.programs.find(x=>x.university==='Göteborgs universitet'&&x.programCode==='S1GSA');
const sociology=part.programs.find(x=>x.university==='Göteborgs universitet'&&x.programCode==='S2SOC');
if(!social||!sociology)throw Error('Canonical GU partial structures missing');
const socialRows=[...social.rows.filter(r=>Number(r.term)<=5),
  course(6,'SQ2661','Vetenskaplighet och forskningsmetodik i socialt arbete',15),
  course(6,'SQ2662','Självständigt vetenskapligt arbete',15,{isThesis:true}),
  elective(7,'Fördjupning: Lokala och globala utmaningar för det sociala arbetet',7.5,{level:'Avancerad nivå'}),
  elective(7,'Fördjupning: Perspektiv på social utsatthet',7.5,{level:'Avancerad nivå'}),
  elective(7,'Fördjupning: Handlingsstrategier i socialt arbete',7.5,{level:'Avancerad nivå'}),
  course(7,'SQ2671','Det sociala arbetets professionella aktörskap',7.5,{level:'Avancerad nivå'})];
const sociologyRows=[...sociology.rows,
  elective(2,'Valfria kurser vid GU eller annat lärosäte',30,{options:[
    {code:'SC2401',name:'Kvalificerad arbetspraktik med sociologisk inriktning',hp:15},
    {code:'SC2209',name:'Emotioner i organisationer',hp:7.5},
    {code:'SC2210',name:'Hållbarhetsvetenskap och expertis: Sociologiska perspektiv',hp:7.5},
    {code:'PV2205',name:'Konflikt och samarbete i organisationer',hp:7.5},
    {code:'PV2206',name:'HR/people analys',hp:7.5}
  ]})];
const changes=[{current:social,rows:socialRows},{current:sociology,rows:sociologyRows}];
for(const {current,rows} of changes){
  const semesters=Number(current.programHp)/30;
  for(let term=1;term<=semesters;term++){
    const total=rows.filter(r=>Number(r.term)===term).reduce((n,r)=>n+Number(r.hp),0);
    if(Math.abs(total-30)>.001)throw Error(`${current.programCode} term ${term}: ${total} hp`);
  }
  if(rows.some(r=>Number(r.term)>semesters))throw Error(`Unexpected term: ${current.programCode}`);
  if(current.sourceEvidenceUrl!==official[current.programCode])throw Error(`Source changed: ${current.programCode}`);
}
const report=changes.map(({current,rows})=>({code:current.programCode,before:current.rows.length,after:rows.length,totalHp:rows.reduce((n,r)=>n+Number(r.hp),0)}));
if(process.argv.includes('--write')){
  const updated={...part,programs:part.programs.map(x=>{
    const found=changes.find(({current})=>current===x);
    return found?{...x,coverage:'complete',choiceRequired:true,missingTerms:[],completeTerms:Array.from({length:Number(x.programHp)/30},(_,i)=>i+1),rows:found.rows,sourceEvidenceUrl:official[x.programCode],sourceUrls:[official[x.programCode]],source:'gu-official-programplan-2026'}:x;
  })};
  fs.writeFileSync(file+'.tmp',JSON.stringify(updated,null,2)+'\n');
  if(read(file+'.tmp').programs.length!==part.programs.length)throw Error('Count changed');
  fs.renameSync(file+'.tmp',file);
}
console.log(JSON.stringify(report));
