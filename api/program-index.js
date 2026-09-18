import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
const norm=v=>String(v??'').trim().toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const code=v=>String(v??'').trim().toUpperCase();
const identity=(university,programCode)=>`${norm(university)}:${code(programCode)}`;
const read=async name=>JSON.parse(await readFile(join(process.cwd(),'data','HT26',`${name}.json`),'utf8'));
let cached;
async function catalogue(){
 if(cached)return cached;
 const [programs,structures]=await Promise.all([read('programs'),read('program-structures')]);
 const byKey=new Map(programs.map(p=>[p.key,p])),byIdentity=new Map();
 for(const p of programs){if(!code(p.programCode))continue;const k=identity(p.university,p.programCode);if(!byIdentity.has(k))byIdentity.set(k,[]);byIdentity.get(k).push(p)}
 const complete=new Map();
 for(const s of structures){
  if(String(s.coverage||s.structureCoverage||'').toLowerCase()!=='complete')continue;
  const evidence=s.sourceEvidenceUrl||s.sourceUrl||s.sourceUrls?.[0];
  if(!/^https:\/\//i.test(String(evidence||'')))continue;
  if(!Array.isArray(s.rows)||!s.rows.length||!s.rows.every(r=>Number.isInteger(Number(r.term))&&Number(r.term)>0&&Number(r.hp)>0&&(r.name||r.code)))continue;
  const exact=byKey.get(s.key),matches=exact?[exact]:(byIdentity.get(identity(s.university,s.programCode))||[]);
  if(matches.length!==1)continue;
  const p=matches[0];
  if(Number(s.hp)>0&&Number(p.programHp)>0&&Math.abs(Number(s.hp)-Number(p.programHp))>.01)continue;
  if(!complete.has(p.key))complete.set(p.key,{sourceEvidenceUrl:evidence,structureKey:s.key,rows:s.rows});
 }
 const rows=programs.filter(p=>p.university&&(p.programName||p.name)).map(p=>{
  const structure=complete.get(p.key),isComplete=!!structure;
  return {subject:p.subject||'',university:p.university,programName:p.programName||p.name,programCode:p.programCode||'',programHp:Number(p.programHp)||null,level:p.level||'',source:'studielots-ht26',structureCoverage:isComplete?'complete':'metadata-only',effectiveStructureCoverage:isComplete?'complete':'metadata-only',plannerCoverage:isComplete?'complete':'unavailable',verified:isComplete,...(structure||{})};
 });
 cached={rows,totalPrograms:programs.length,totalStructures:structures.length};return cached;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=300');
 try{const data=await catalogue(),query=norm(req.query?.q),subject=norm(req.query?.subject),university=norm(req.query?.university),coverage=norm(req.query?.coverage);
 const rows=data.rows.filter(p=>(!subject||norm(p.subject)===subject)&&(!university||norm(p.university).includes(university))&&(!query||norm(`${p.programName} ${p.university} ${p.subject} ${p.programCode}`).includes(query))&&(!coverage||coverage==='complete'&&p.structureCoverage==='complete'||coverage==='metadata-only'&&p.structureCoverage==='metadata-only'));
 const complete=rows.filter(p=>p.structureCoverage==='complete').length;
 return res.status(200).json({programs:rows,coverage:{complete,partial:0,metadataOnly:rows.length-complete,total:rows.length},catalogue:{uniquePrograms:data.rows.length,importedPrograms:data.totalPrograms,importedStructures:data.totalStructures},source:'studielots-ht26',fallback:false});
 }catch(error){console.error('program-index HT26',error);return res.status(503).json({programs:[],source:'studielots-ht26',fallback:false,error:'HT26-programdatabasen är tillfälligt otillgänglig'});}
}
