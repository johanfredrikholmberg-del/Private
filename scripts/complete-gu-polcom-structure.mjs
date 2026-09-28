#!/usr/bin/env node
// Complete POLCOM only with the fixed course and 15 hp method-choice slot
// explicitly described by GU. Alternative courses never add to programme hp.
import fs from 'node:fs';
const path='data/studielots-db/programme-structures-2.json';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const part=read(path),current=part.programs.find(x=>x.university==='Göteborgs universitet'&&x.programCode==='S2MKG');
if(!current||Number(current.programHp)!==120||!['partial-structure','complete'].includes(current.coverage))throw Error('POLCOM identity or status conflict');
const evidence='https://www.gu.se/studera/hitta-utbildning/programstruktur-och-innehall-for-masterprogrammet-i-politisk-kommunikation-polcom';
if(!current.sourceUrls?.includes(evidence))throw Error('Official GU evidence missing');
const methods=[
  {code:'SF2321',name:'Tillämpad statistisk analys',hp:15},
  {code:'SF2322',name:'Tillämpade kvalitativa forskningsmetoder',hp:15},
  {code:'SF2323',name:'Tillämpade forskningsmetoder, problem och design',hp:15},
  {code:'MK2302',name:'Kvantitativa metoder för journalistik, medier och kommunikationsvetenskap',hp:15}
];
const rows=[...current.rows.filter(x=>Number(x.term)!==3),
  {term:3,code:'MK2100',name:'Avancerade analyser inom medie- och kommunikationsvetenskap',hp:15,category:'mandatory',isSlot:false},
  {term:3,code:'',name:'En metodkurs enligt programplan',hp:15,category:'method-choice-slot',slotType:'method-choice',isSlot:true,options:methods}
].sort((a,b)=>Number(a.term)-Number(b.term));
for(let term=1;term<=4;term++){
  const hp=rows.filter(r=>Number(r.term)===term).reduce((sum,r)=>sum+Number(r.hp),0);
  if(Math.abs(hp-30)>.001)throw Error(`Term ${term}: ${hp} hp`);
}
if(rows.reduce((sum,r)=>sum+Number(r.hp),0)!==120)throw Error('Programme credits mismatch');
if(process.argv.includes('--write')){
  const programs=part.programs.map(x=>x===current?{...x,coverage:'complete',choiceRequired:true,missingTerms:[],completeTerms:[1,2,3,4],rows,sourceEvidenceUrl:evidence,source:'gu-official-programplan-2026'}:x);
  fs.writeFileSync(path+'.tmp',JSON.stringify({...part,programs},null,2)+'\n');
  if(read(path+'.tmp').programs.length!==part.programs.length)throw Error('Record loss');
  fs.renameSync(path+'.tmp',path);
}
console.log(JSON.stringify({code:'S2MKG',rows:rows.length,termHp:[1,2,3,4].map(t=>rows.filter(r=>r.term===t).reduce((n,r)=>n+r.hp,0)),choiceOptions:methods.length}));
