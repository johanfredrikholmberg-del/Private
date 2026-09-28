#!/usr/bin/env node
// Enrich the single logical StudieLots DB programmes table with official GU
// future-term identities. Does not pretend these are HT26 offers/structures.
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const manifestPath='data/studielots-db/manifest.json',manifest=read(manifestPath);
const table=manifest.tables.programmes,base=read(table.storage);
const partPath='data/studielots-db/programmes-gu-2027.json';
const prior=fs.existsSync(partPath)?read(partPath):[];
const programme=(code,hp,term,url)=>({code,hp,term,url});
const sources=[
  programme('N2DCM',120,'HT27','https://www.gu.se/en/study-gothenburg/master-in-digital-communication-n2dcm'),
  programme('S2EUA',60,'VT27','https://www.gu.se/studera/hitta-utbildning/magisterprogrammet-i-eu-forvaltning-s2eua'),
  programme('S2EUM',120,'HT27','https://www.gu.se/studera/hitta-utbildning/masterprogrammet-i-europastudier-s2eum'),
  programme('S2FIC',60,'HT27','https://www.gu.se/en/study-gothenburg/master-of-science-programme-in-finance-s2fic'),
  programme('S2IAM',120,'HT27','https://www.gu.se/studera/hitta-utbildning/masterprogrammet-i-internationell-administration-och-global-samhallsstyrning-s2iam'),
  programme('S2PSM',120,'HT27','https://www.gu.se/en/study-gothenburg/masters-program-in-political-science-s2psm')
];
const staged=read('data/susa/programmes.json').filter(x=>x.university==='Göteborgs universitet');
const existing=[...base,...prior];
const added=[];
for(const source of sources){
  const id=`Göteborgs universitet|${source.code}`;
  const present=existing.filter(x=>`${x.university}|${x.programCode}`===id);
  if(present.length>1)throw Error(`Duplicate canonical GU programme code: ${source.code}`);
  if(present.length===1)continue;
  const matches=staged.filter(x=>x.code===source.code);
  if(matches.length!==1||Number(matches[0].hp)!==source.hp)throw Error(`SUSA identity conflict: ${source.code}`);
  const response=await fetch(source.url,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error(`GU source unavailable: ${source.code} ${response.status}`);
  const html=await response.text(),season=source.term.startsWith('HT')?'Höst|Autumn':'Vår|Spring';
  if(!html.includes(source.code)||!new RegExp(`(?:${season})\\s+2027`,'i').test(html))throw Error(`GU code/start term unverified: ${source.code}`);
  const row={...matches[0],key:`goteborgs universitet|${source.code}|${source.hp}`,term:source.term,programCode:source.code,programName:matches[0].name,programHp:source.hp,source:'gu-official-programme-page',sourceUrls:[source.url],verifiedFields:['programCode','programHp','term'],structureCoverage:'metadata-only'};
  added.push(row);existing.push(row);
}
const report={base:base.length,prior:prior.length,added:added.map(x=>({code:x.programCode,term:x.term,hp:x.programHp})),after:base.length+prior.length+added.length};
if(process.argv.includes('--write')&&added.length){
  const out=[...prior,...added];fs.writeFileSync(partPath+'.tmp',JSON.stringify(out,null,2)+'\n');
  if(read(partPath+'.tmp').length!==out.length)throw Error('Part verification failed');
  fs.renameSync(partPath+'.tmp',partPath);
  const updated={...manifest,tables:{...manifest.tables,programmes:{...table,additionalStorages:[partPath],rows:report.after}}};
  fs.writeFileSync(manifestPath+'.tmp',JSON.stringify(updated,null,2)+'\n');
  fs.renameSync(manifestPath+'.tmp',manifestPath);
}
console.log(JSON.stringify(report));
