import {readFile} from 'node:fs/promises';

const norm=v=>String(v??'').trim().toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const code=v=>String(v??'').trim().toUpperCase();
const identity=(university,programCode)=>`${norm(university)}:${code(programCode)}`;
const read=async name=>JSON.parse(await readFile(new URL(`../data/HT26/${name}.json`,import.meta.url),'utf8'));
let cached;
async function catalogue(){
  if(cached)return cached;
  const [programs,structures]=await Promise.all([read('programs'),read('program-structures')]);
  const byIdentity=new Map();
  for(const p of programs){if(!code(p.programCode))continue;const k=identity(p.university,p.programCode);if(!byIdentity.has(k))byIdentity.set(k,[]);byIdentity.get(k).push(p)}
  const eligible=[];
  for(const s of structures){
    if(String(s.coverage||s.structureCoverage||'').toLowerCase()!=='complete')continue;
    const evidence=s.sourceEvidenceUrl||s.sourceUrl||s.sourceUrls?.[0];
    if(!/^https:\/\//i.test(String(evidence||'')))continue;
    if(!Array.isArray(s.rows)||!s.rows.length||!s.rows.every(r=>Number.isInteger(Number(r.term))&&Number(r.term)>0&&Number(r.hp)>0&&(r.name||r.code)))continue;
    const matches=byIdentity.get(identity(s.university,s.programCode))||[];
    if(matches.length!==1)continue;
    const p=matches[0];
    if(Number(s.hp)>0&&Number(p.programHp)>0&&Math.abs(Number(s.hp)-Number(p.programHp))>.01)continue;
    eligible.push({subject:p.subject||s.subject||'',university:p.university,programName:p.programName||p.name||s.programName,programCode:p.programCode,programHp:Number(p.programHp||s.hp)||null,level:p.level||'',source:'studielots-ht26',structureCoverage:'complete',effectiveStructureCoverage:'complete',plannerCoverage:'complete',verified:true,sourceEvidenceUrl:evidence,structureKey:s.key,rows:s.rows});
  }
  cached=eligible;
  return eligible;
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=86400');
  try{
    const all=await catalogue();
    const query=norm(req.query?.q),subject=norm(req.query?.subject),university=norm(req.query?.university);
    const rows=all.filter(p=>(!subject||norm(p.subject)===subject)&&(!university||norm(p.university).includes(university))&&(!query||norm(`${p.programName} ${p.university} ${p.subject} ${p.programCode}`).includes(query)));
    return res.status(200).json({programs:rows,catalogue:{uniquePrograms:all.length},source:'studielots-ht26',fallback:false});
  }catch(error){console.error('verified-programs',error);return res.status(503).json({programs:[],source:'studielots-ht26',fallback:false,error:'HT26-programdatabasen är tillfälligt otillgänglig'});}
}
