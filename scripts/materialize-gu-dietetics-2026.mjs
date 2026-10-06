#!/usr/bin/env node
// Materialize GU Dietetics M1DIP from its official HT26 programme syllabus.
import fs from 'node:fs';
const root='data/studielots-db/',read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const db=read(root+'manifest.json'),manifest=read(db.tables.programmeStructures.storageManifest);
if(db.database!=='StudieLots DB'||manifest.count!==db.tables.programmeStructures.rows)throw Error('Canonical structure count mismatch');
const code='M1DIP',hp=240,validFrom='2026HT';
const identities=[db.tables.programmes.storage,...(db.tables.programmes.additionalStorages||[])].flatMap(read)
 .filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code&&Number(x.programHp)===hp&&x.term==='HT26');
if(identities.length!==1)throw Error('GU Dietetics identity missing or ambiguous');
const url='https://www.gu.se/syllabus/7e9cefff-cb7d-11f0-a255-650837bd40cf';
const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
if(!response.ok||new URL(response.url).host!=='www.gu.se')throw Error('Official GU syllabus unavailable');
const html=await response.text();
const clean=x=>String(x||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;|\u00a0|\u202f/g,' ').replace(/\s+/g,' ').trim();
const plain=clean(html);
if(!plain.includes(code)||!plain.includes('Giltig fr.o.m.')||!plain.includes('Hösttermin 2026')||!plain.includes('240 högskolepoäng (hp)'))throw Error('GU Dietetics syllabus identity, credits or version conflict');
const content=html.match(/Termin 1[\s\S]*?Termin 8[\s\S]*?(?=Följande två kurser)/)?.[0];
if(!content)throw Error('GU Dietetics term sequence missing');
const rows=[];let term=0;
for(const line of content.split(/<br\s*\/?\s*>|<\/p>|<\/li>|<\/h[1-6]>/i).map(clean).filter(Boolean)){
 const mark=line.match(/^Termin\s*([1-8])$/i);
 if(mark){term=Number(mark[1]);continue}
 if(!term)continue;
 const m=line.match(/^(?:\([^)]+\)\s*)?([A-ZÅÄÖ]{2,5}\d{3,5})(?:\/([A-ZÅÄÖ]{2,5}\d{3,5}))?\s+(.+?),\s*(7[,.]5|15|30)\s*hp(?:\s*\([^)]*\))?(?:\s*-\s*halvfart)?$/i);
 if(m){
   const name=m[3].trim(),credits=Number(m[4].replace(',','.'));
   rows.push({term,code:m[1],name,hp:credits,category:'mandatory',isSlot:false,courseCodeVerified:true});
   continue;
 }
 if(/^Valbara kurser i klinisk nutrition,\s*15\s*hp$/i.test(line))
   rows.push({term,code:'',name:'Valbara kurser i klinisk nutrition',hp:15,category:'elective',isSlot:true,slotType:'elective-slot',courseCodeVerified:false});
}
const expected={
  1:[['DIP110',7.5],['DIP120',15],['DIP130',7.5]],
  2:[['DIP140',15],['DIP150',15]],
  3:[['DIP210',30]],
  4:[['DIP220',15],['DIP230',15]],
  5:[['DIP310',30]],
  6:[['DIP320',15],['DIP330',15]],
  7:[['MED722',7.5],['MED723',7.5],['',15]],
  8:[['MED730',30]]
};
for(let t=1;t<=8;t++){
 const actual=rows.filter(x=>x.term===t);
 if(actual.reduce((n,x)=>n+x.hp,0)!==30||actual.length!==expected[t].length)throw Error('GU Dietetics term structure mismatch at '+t);
 for(const [i,[courseCode,credits]] of expected[t].entries())if(actual[i].code!==courseCode||actual[i].hp!==credits)throw Error('GU Dietetics course mismatch at term '+t);
}
if(rows.length!==15)throw Error('GU Dietetics row count mismatch');
const urlRows=manifest.parts.flatMap(p=>{const x=read(root+p);return Array.isArray(x)?x:x.programs}).filter(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
if(urlRows.length>1)throw Error('Duplicate canonical GU Dietetics rows');
if(urlRows.length){
 const current=urlRows[0];
 if(current.verified===true){
   if(current.validFrom!==validFrom||current.sourceEvidenceUrl!==url||JSON.stringify(current.rows)!==JSON.stringify(rows))throw Error('Conflicting verified GU Dietetics plan');
   console.log('GU Dietetics HT26 already materialized');
   process.exit(0);
 }
 if(current.rows?.length||Number(current.hp)!==hp)throw Error('Refusing to replace populated or mismatched GU Dietetics plan');
}
const item={...(urlRows[0]||{}),id:`gu:${code}:${validFrom}`,key:urlRows[0]?.key||identities[0].key,university:'Göteborgs universitet',programCode:code,programName:identities[0].programName,programHp:hp,hp,validFrom,coverage:'choice-required',verified:true,courseCodesVerified:false,choiceRequired:true,source:'gu-official-programme-syllabus',sourceEvidenceUrl:url,sourceUrls:[url],rows,status:'verified',reason:null};
if(process.argv.includes('--write')){
 const partName=manifest.parts.find(p=>p==='programme-structures-ht26.json')||manifest.parts[0],file=root+partName;
 const data=read(file),list=Array.isArray(data)?data:data.programs;
 if(!Array.isArray(list))throw Error('Unexpected canonical GU shard');
 const idx=list.findIndex(x=>x.university==='Göteborgs universitet'&&x.programCode===code);
 if(idx>=0)list[idx]=item;else list.push(item);
 fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2)+'\n');
 const verify=read(file+'.tmp'),vrows=Array.isArray(verify)?verify:verify.programs;
 if(vrows.filter(x=>x.programCode===code&&x.university==='Göteborgs universitet').length!==1)throw Error('GU Dietetics write verification failed');
 fs.renameSync(file+'.tmp',file);
 if(idx<0){manifest.count++;manifest.universities.find(x=>x.university==='Göteborgs universitet').count++;db.tables.programmeStructures.rows=manifest.count;}
 fs.writeFileSync(root+'programme-structures-manifest.json',JSON.stringify(manifest,null,2)+'\n');
 fs.writeFileSync(root+'manifest.json',JSON.stringify(db,null,2)+'\n');
}
console.log(JSON.stringify({code,validFrom,rows:rows.length,termCredits:Array(8).fill(30),courseCodesVerified:false,source:url}));
