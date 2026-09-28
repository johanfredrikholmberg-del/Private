#!/usr/bin/env node
// Conservative Linköping Studieinfo importer for published HT26 study plans.
import fs from 'node:fs/promises';
const root='data/studielots-db/';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const codes=['F7KSY','F7KSA','6KIPR','6KLOG'];
const candidates=await read('data/import-reviews/linkoping-programme-candidates.json');
const manifest=await read(root+'programme-structures-manifest.json');
const existing=(await Promise.all(manifest.parts.map(x=>read(root+x)))).flatMap(x=>Array.isArray(x)?x:x.programs||[]);
const report={generatedAt:new Date().toISOString(),university:'Linköpings universitet',catalogueCandidates:candidates.length,attempted:0,added:0,review:[],duplicates:[],canonicalBefore:existing.length};
const strip=s=>s.replace(/<[^>]+>/g,' ').replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const added=[];
for(const code of codes){
  report.attempted++;
  const url=`https://studieinfo.liu.se/program/${code}`;
  try{
    const candidate=candidates.find(x=>x.code?.toUpperCase()===code&&x.hp===180);
    if(!candidate)throw Error('No matching SUSA 180 hp candidate');
    const response=await fetch(url,{signal:AbortSignal.timeout(25000)});
    if(!response.ok)throw Error(`HTTP ${response.status}`);
    const html=await response.text();
    const headings=[...html.matchAll(/Termin\s+([1-6])\s+(HT|VT)\s+(20\d{2})<\/h3>/g)];
    if(headings.length!==6||headings.some((x,i)=>Number(x[1])!==i+1||x[2]!==((i%2)?'VT':'HT')||Number(x[3])!==2026+Math.floor((i+1)/2)))throw Error('Missing HT26 six-semester plan');
    const rows=[];
    for(let i=0;i<6;i++){
      const section=html.slice(headings[i].index,headings[i+1]?.index||html.length);
      const term=i+1,required=[],options=[];
      for(const match of section.matchAll(/<tr\s+class="main-row[^"]*"[^>]*data-course-code="([^"]+)"[^>]*data-field-of-study="[^"]*"[^>]*data-vof="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g)){
        const cells=[...match[3].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x=>strip(x[1]));
        const hp=Number(cells[2]?.replace(',','.'));
        if(!hp||!cells[1])throw Error(`Malformed course ${match[1]} T${term}`);
        const course={term,code:match[1],name:cells[1],hp,category:'mandatory'};
        if(match[2].toLowerCase()==='o')required.push(course);
        else if(match[2].toLowerCase()==='v')options.push(course);
      }
      const requiredHp=required.reduce((n,x)=>n+x.hp,0),optionHp=options.reduce((n,x)=>n+x.hp,0);
      rows.push(...required);
      if(requiredHp<30&&optionHp>=30-requiredHp){
        rows.push({term,code:'',name:'Valbara kurser',hp:30-requiredHp,category:'elective',slotType:'elective-slot',isSlot:true,options:options.map(({code,name,hp})=>({code,name,hp}))});
      }
      if(rows.filter(x=>x.term===term).reduce((n,x)=>n+x.hp,0)!==30)throw Error(`Ambiguous semester T${term}: required ${requiredHp}, options ${optionHp}`);
    }
    const id=`liu:${code}:2026HT`;
    if(existing.some(x=>x.id===id||x.university==='Linköpings universitet'&&x.programCode===code&&x.validFrom==='2026HT')){report.duplicates.push(id);continue;}
    added.push({id,university:'Linköpings universitet',programCode:code,programName:candidate.name,programHp:180,validFrom:'2026HT',coverage:rows.some(x=>x.isSlot)?'choice-required':'complete',verified:true,source:'liu-official-studieinfo',sourceUrls:[url],rows});
  }catch(e){report.review.push({code,url,reason:String(e.message||e)});}
}
if(added.length){
  const part='programme-structures-linkoping-2026.json';
  const old=manifest.parts.includes(part)?await read(root+part):[];
  await fs.writeFile(root+part,JSON.stringify([...old,...added],null,2)+'\n');
  if(!manifest.parts.includes(part))manifest.parts.push(part);
  manifest.count=existing.length+added.length;manifest.generatedAt=new Date().toISOString();
  const u=manifest.universities.find(x=>x.university==='Linköpings universitet');
  if(u)u.count+=added.length;else manifest.universities.push({university:'Linköpings universitet',count:added.length});
  await fs.writeFile(root+'programme-structures-manifest.json',JSON.stringify(manifest,null,2)+'\n');
  const db=await read(root+'manifest.json');db.tables.programmeStructures.rows=manifest.count;db.generatedAt=manifest.generatedAt;
  await fs.writeFile(root+'manifest.json',JSON.stringify(db,null,2)+'\n');
}
report.added=added.length;report.canonicalAfter=existing.length+added.length;report.remaining=candidates.length-report.attempted;
await fs.writeFile('data/import-reviews/linkoping-materialization-latest.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
