#!/usr/bin/env node
// Promote verified rows of incomplete GU programme plans without representing
// unknown terms as electives or a complete ordinary study path.
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const db='data/studielots-db/';
const manifestPath=db+'programme-structures-manifest.json';
const manifest=read(manifestPath),parts=manifest.parts.map(name=>read(db+name));
const programmes=read(read(db+'manifest.json').tables.programmes.storage);
const legacy=read('data/HT26/program-structures.json');
const allowed=new Set(['N2SOF','S1GSA','S2MKG','S2SOC']);
const key=x=>`${x.university}|${x.programCode}`;
const seen=new Set(parts.flatMap(p=>p.programs).map(key));
const accepted=[];
for(const source of legacy.filter(x=>x.university==='Göteborgs universitet'&&allowed.has(x.programCode))){
  if(seen.has(key(source)))continue;
  const matches=programmes.filter(x=>key(x)===key(source));
  if(matches.length!==1||Number(matches[0].programHp)!==Number(source.hp))throw Error(`Ambiguous identity/credits: ${source.programCode}`);
  if(source.coverage!=='partial-structure'||!/^https:\/\/www\.gu\.se\//.test(source.sourceUrl))throw Error(`Unverified plan: ${source.programCode}`);
  const expected=Number(source.hp)/30,totals=new Map();
  if(!Number.isInteger(expected)||!source.rows?.length)throw Error(`Invalid plan: ${source.programCode}`);
  const rows=source.rows.map(r=>{
    const term=Number(r.term),hp=Number(r.hp);
    if(!Number.isInteger(term)||term<1||term>expected||!(hp>0)||!r.name)throw Error(`Invalid row: ${source.programCode}`);
    if(!r.code&&r.category!=='elective-slot'&&source.programCode!=='N2SOF')throw Error(`Unidentified course: ${source.programCode}`);
    totals.set(term,(totals.get(term)||0)+hp);
    return {...r,isSlot:r.category==='elective-slot'||r.isSlot===true};
  });
  if([...totals.values()].some(hp=>hp>30.001))throw Error(`Term overflow: ${source.programCode}`);
  const completeTerms=[...totals].filter(([,hp])=>Math.abs(hp-30)<.001).map(([term])=>term).sort((a,b)=>a-b);
  if(completeTerms.length===expected)throw Error(`Complete plan misclassified as partial: ${source.programCode}`);
  accepted.push({id:`gu:${source.programCode}:2026HT`,key:matches[0].key,university:source.university,programCode:source.programCode,programName:source.programName,programHp:source.hp,hp:source.hp,validFrom:'2026HT',coverage:'partial-structure',verified:true,source:source.source,sourceEvidenceUrl:source.sourceUrl,sourceUrls:source.sourceUrls,completeTerms,missingTerms:Array.from({length:expected},(_,i)=>i+1).filter(t=>!completeTerms.includes(t)),rows});
  seen.add(key(source));
}
const result={candidates:allowed.size,added:accepted.map(x=>({code:x.programCode,rows:x.rows.length,missingTerms:x.missingTerms})),before:parts.reduce((n,p)=>n+p.programs.length,0),after:manifest.count+accepted.length};
if(process.argv.includes('--write')&&accepted.length){
  if(result.before!==manifest.count)throw Error('Existing manifest count mismatch');
  const filename=manifest.parts.at(-1),file=db+filename,part=parts.at(-1);
  fs.writeFileSync(file+'.tmp',JSON.stringify({...part,programs:[...part.programs,...accepted]},null,2)+'\n');
  if(read(file+'.tmp').programs.length!==part.programs.length+accepted.length)throw Error('Write verification failed');
  fs.renameSync(file+'.tmp',file);
  const next={...manifest,count:result.after,universities:manifest.universities.map(x=>x.university==='Göteborgs universitet'?{...x,count:x.count+accepted.length}:x)};
  fs.writeFileSync(manifestPath+'.tmp',JSON.stringify(next,null,2)+'\n');
  fs.renameSync(manifestPath+'.tmp',manifestPath);
}
console.log(JSON.stringify(result));
