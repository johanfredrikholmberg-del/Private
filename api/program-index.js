import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
const norm=v=>String(v??'').trim().toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const code=v=>String(v??'').trim().toUpperCase();
const identity=(university,programCode)=>`${norm(university)}:${code(programCode)}`;
const read=async name=>JSON.parse(await readFile(join(process.cwd(),'data','HT26',`${name}.json`),'utf8'));
function programmeSubject(p){if(p.subject)return p.subject;const name=norm(p.programName||p.name);if(/foretagsekonomi|ekonomie-kandidat|civilekonom|marknadsforing|redovisning-och-styrning|business-administration/.test(name))return 'Företagsekonomi';if(/nationalekonomi|economics/.test(name))return 'Nationalekonomi';if(/psykologi|psychology/.test(name))return 'Psykologi';if(/idrottsvetenskap|sport-science/.test(name))return 'Idrottsvetenskap';if(/juridik|juristprogram|skatteratt/.test(name))return 'Juridik';return ''}
// A source's "complete" flag alone is not enough: every semester and all programme
// credits must be accounted for before the programme can appear in search.
function hasFullStructure(s,p){
 const rows=s.rows,total=Number(p.programHp);
 if(!Number.isFinite(total)||total<=0||!Array.isArray(rows)||!rows.length)return false;
 const terms=new Set();let credits=0;
 for(const r of rows){const term=Number(r.term),hp=Number(r.hp);
  if(!Number.isInteger(term)||term<1||!Number.isFinite(hp)||hp<=0||!(r.name||r.code))return false;
  terms.add(term);credits+=hp;
 }
 if(Math.abs(credits-total)>.01)return false;
 const last=Math.max(...terms);
 return Number.isFinite(last)&&last<=Math.ceil(total/30)+2&&Array.from({length:last},(_,i)=>i+1).every(t=>terms.has(t));
}
// Compare actual course/semester content, not source URLs or array ordering.
// Two different verified plans for one programme must be resolved before publication.
function structureSignature(rows){return JSON.stringify(rows.map(r=>[Number(r.term),code(r.code),norm(r.name),Number(r.hp)]).sort((a,b)=>a[0]-b[0]||String(a[1]).localeCompare(String(b[1]))||String(a[2]).localeCompare(String(b[2]))||a[3]-b[3]));}
let cached;
async function catalogue(){
 if(cached)return cached;
 const [programs,structures]=await Promise.all([read('programs'),read('program-structures')]);
 const byKey=new Map(),byIdentity=new Map();
 for(const p of programs){if(!p.key)continue;if(!byKey.has(p.key))byKey.set(p.key,[]);byKey.get(p.key).push(p);if(!code(p.programCode))continue;const k=identity(p.university,p.programCode);if(!byIdentity.has(k))byIdentity.set(k,[]);byIdentity.get(k).push(p)}
 const complete=new Map(),conflicting=new Set();
 for(const s of structures){
  if(String(s.coverage||s.structureCoverage||'').toLowerCase()!=='complete')continue;
  const evidence=s.sourceEvidenceUrl||s.sourceUrl||s.sourceUrls?.[0];
  if(!/^https:\/\//i.test(String(evidence||'')))continue;
  const exact=byKey.get(s.key)||[],matches=exact.length?exact:(byIdentity.get(identity(s.university,s.programCode))||[]);
  if(matches.length!==1)continue;
  const p=matches[0];
  if(Number(s.hp)>0&&Number(p.programHp)>0&&Math.abs(Number(s.hp)-Number(p.programHp))>.01)continue;
  if(!hasFullStructure(s,p))continue;
  const signature=structureSignature(s.rows),previous=complete.get(p.key);
  if(previous&&previous.signature!==signature){conflicting.add(p.key);continue;}
  if(!previous)complete.set(p.key,{signature,sourceEvidenceUrl:evidence,structureKey:s.key,rows:s.rows});
 }
 for(const key of conflicting)complete.delete(key);
 const rows=programs.filter(p=>p.university&&(p.programName||p.name)&&complete.has(p.key)&&(byKey.get(p.key)||[]).length===1).map(p=>{
  const {signature,...structure}=complete.get(p.key);
  return {subject:programmeSubject(p),university:p.university,programName:p.programName||p.name,programCode:p.programCode||'',programHp:Number(p.programHp)||null,level:p.level||'',source:'studielots-ht26',structureCoverage:'complete',effectiveStructureCoverage:'complete',plannerCoverage:'complete',verified:true,...structure};
 });
 cached={rows,totalPrograms:programs.length,totalStructures:structures.length};return cached;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=300');
 try{const data=await catalogue(),query=norm(req.query?.q),subject=norm(req.query?.subject),university=norm(req.query?.university),coverage=norm(req.query?.coverage);
 const rows=data.rows.filter(p=>(!subject||norm(p.subject)===subject)&&(!university||norm(p.university).includes(university))&&(!query||norm(`${p.programName} ${p.university} ${p.subject} ${p.programCode}`).includes(query))&&(!coverage||coverage==='complete'));
 return res.status(200).json({programs:rows,coverage:{complete:rows.length,partial:0,metadataOnly:0,total:rows.length},catalogue:{uniquePrograms:data.rows.length,importedPrograms:data.totalPrograms,importedStructures:data.totalStructures},source:'studielots-ht26',fallback:false});
 }catch(error){console.error('program-index HT26',error);return res.status(503).json({programs:[],source:'studielots-ht26',fallback:false,error:'HT26-programdatabasen är tillfälligt otillgänglig'});}
}
