import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {canonicalProgrammeStructures,studielotsTable} from './_studielots-db.js';
const norm=v=>String(v??'').trim().toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const code=v=>String(v??'').trim().toUpperCase();
const identity=(university,programCode)=>`${norm(university)}:${code(programCode)}`;
export function canonicalTerm(value){const v=String(value??'').toUpperCase().replace(/[\s/_-]/g,'');let m=v.match(/^(HT|VT)(\d{2}|20\d{2})$/);if(m)return`${m[1]}${m[2].slice(-2)}`;m=v.match(/^(20\d{2})(HT|VT)$/);if(m)return`${m[2]}${m[1].slice(-2)}`;return''}
const termOrder=value=>{const m=/^(HT|VT)(\d{2})$/.exec(String(value||''));return m?(2000+Number(m[2]))*2+(m[1]==='HT'?1:0):-1};
let availableTermsCache=null;
async function availableTerms(){
 if(availableTermsCache)return availableTermsCache;
 const programmes=await studielotsTable('programmes'),now=new Date(),year=now.getFullYear(),month=now.getMonth()+1,current=canonicalTerm(`${month>=7?'HT':'VT'}${year}`),minimum=termOrder(current);
 availableTermsCache=[...new Set(programmes.map(p=>canonicalTerm(p.term)).filter(t=>t&&termOrder(t)>=minimum))].sort((a,b)=>termOrder(a)-termOrder(b));
 return availableTermsCache;
}
export function appliesToTerm(structure,requested){const source=canonicalTerm(structure.validFrom||structure.term);return !source||source===requested}
const readDb=async()=>JSON.parse(await readFile(join(process.cwd(),'data','studielots-db','manifest.json'),'utf8'));
const readStorage=async storage=>JSON.parse(await readFile(join(process.cwd(),...String(storage).split('/')),'utf8'));
function programmeSubject(p){const name=norm(p.programName||p.name);if(/kompletterande-pedagogisk|(^|-)kpu(-|$)|lararutbild|amneslarare|teacher-education/.test(name))return '';if(p.subject)return p.subject;if(/foretagsekonom|ekonomprogram|ekonomie-kandidat|civilekonom|marknadsforing|redovisning|business-administration/.test(name))return 'Företagsekonomi';if(/nationalekonomi|economics/.test(name))return 'Nationalekonomi';if(/psykologi|psychology/.test(name))return 'Psykologi';if(/idrottsvetenskap|sport-science/.test(name))return 'Idrottsvetenskap';if(/statsvetenskap|political-science|international-administration|global-governance|internationell-administration|global-samhallsstyrning/.test(name))return 'Statsvetenskap';if(/juridik|juristprogram|skatteratt/.test(name))return 'Juridik';if(/(^|-)kemi(-|$)|chemistry/.test(name))return 'Kemi';return ''}
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
const cache=new Map();
async function catalogue(term){
 if(cache.has(term))return cache.get(term);
 const db=await readDb();
 const programs=await studielotsTable('programmes');
 const canonical=await canonicalProgrammeStructures();
 const structures=canonical.programs;
 const byKey=new Map(),byIdentity=new Map();
 for(const p of programs){if(!p.key)continue;if(!byKey.has(p.key))byKey.set(p.key,[]);byKey.get(p.key).push(p);if(!code(p.programCode))continue;const k=identity(p.university,p.programCode);if(!byIdentity.has(k))byIdentity.set(k,[]);byIdentity.get(k).push(p)}
 const complete=new Map(),partial=new Map(),conflicting=new Set(),partialConflicting=new Set();
 for(const s of structures){
  if(!appliesToTerm(s,term))continue;
  const evidence=s.sourceEvidenceUrl||s.sourceUrl||s.sourceUrls?.[0];
  if(!/^https:\/\//i.test(String(evidence||'')))continue;
  const exact=byKey.get(s.key)||[],matches=exact.length?exact:(byIdentity.get(identity(s.university,s.programCode))||[]);
  if(matches.length!==1)continue;
  const p=matches[0];
  if(Number(s.hp)>0&&Number(p.programHp)>0&&Math.abs(Number(s.hp)-Number(p.programHp))>.01)continue;
  if(!hasFullStructure(s,p))continue;
  const isComplete=String(s.coverage||s.structureCoverage||'').toLowerCase()==='complete';
  const target=isComplete?complete:partial,bad=isComplete?conflicting:partialConflicting;
  const signature=structureSignature(s.rows),previous=target.get(p.key);
  if(previous&&previous.signature!==signature){bad.add(p.key);continue;}
  if(!previous)target.set(p.key,{signature,sourceEvidenceUrl:evidence,structureKey:s.key,rows:s.rows,sourceCoverage:s.coverage||s.structureCoverage||'partial'});
 }
 for(const key of conflicting)complete.delete(key);
 for(const key of partialConflicting)partial.delete(key);
 for(const key of complete.keys())partial.delete(key);
 const rows=programs.filter(p=>p.university&&(p.programName||p.name)&&complete.has(p.key)&&(byKey.get(p.key)||[]).length===1).map(p=>{
  const {signature,...structure}=complete.get(p.key);
  return {subject:programmeSubject(p),university:p.university,programName:p.programName||p.name,programCode:p.programCode||'',programHp:Number(p.programHp)||null,level:p.level||'',source:'studielots-db',structureCoverage:'complete',effectiveStructureCoverage:'complete',plannerCoverage:'complete',verified:true,...structure};
 });
 const partialRows=programs.filter(p=>p.university&&(p.programName||p.name)&&partial.has(p.key)&&(byKey.get(p.key)||[]).length===1).map(p=>{
  const {signature,...structure}=partial.get(p.key);
  return {subject:programmeSubject(p),university:p.university,programName:p.programName||p.name,programCode:p.programCode||'',programHp:Number(p.programHp)||null,level:p.level||'',source:'studielots-db',structureCoverage:'partial',effectiveStructureCoverage:'partial',plannerCoverage:'partial',verified:false,termPlacementVerified:['choice-required','complete-semester-sequence','complete-course-list-with-elective-choices'].includes(String(structure.sourceCoverage||'').toLowerCase()),...structure};
 });
 const seen=new Set(),catalogueRows=programs.filter(p=>canonicalTerm(p.term)===term&&p.university&&(p.programName||p.name)&&code(p.programCode)).map(p=>{const id=identity(p.university,p.programCode);if(seen.has(id))return null;seen.add(id);if((complete.has(p.key)||partial.has(p.key))&&(byKey.get(p.key)||[]).length===1)return null;return{subject:programmeSubject(p),university:p.university,programName:p.programName||p.name,programCode:p.programCode,programHp:Number(p.programHp)||null,level:p.level||'',source:'studielots-db',structureCoverage:'metadata-only',effectiveStructureCoverage:'metadata-only',plannerCoverage:'metadata-only',verified:false,rows:[]}}).filter(Boolean);
 const result={rows,partialRows,catalogueRows,totalPrograms:programs.length,totalStructures:structures.length};cache.set(term,result);return result;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=300');
 try{const terms=await availableTerms();if(String(req.query?.listTerms||'')==='1')return res.status(200).json({terms,source:'studielots-db',fallback:false});const term=canonicalTerm(req.query?.term||terms[0]||'');if(!term)return res.status(400).json({programs:[],terms,source:'studielots-db',fallback:false,error:'Ogiltig starttermin'});if(!terms.includes(term))return res.status(400).json({programs:[],terms,source:'studielots-db',term,fallback:false,error:'Startterminen saknar programkatalog i StudieLots DB'});const data=await catalogue(term),query=norm(req.query?.q),subject=norm(req.query?.subject),university=norm(req.query?.university),coverage=norm(req.query?.coverage);
 const includeUnplanned=String(req.query?.includeUnplanned||'')==='1',pool=includeUnplanned?[...data.rows,...data.partialRows,...data.catalogueRows]:data.rows;
 const rows=pool.filter(p=>(!subject||norm(p.subject)===subject)&&(!university||norm(p.university).includes(university))&&(!query||norm(`${p.programName} ${p.university} ${p.subject} ${p.programCode}`).includes(query))&&(!coverage||coverage==='complete'));
 return res.status(200).json({programs:rows,coverage:{complete:rows.filter(p=>p.structureCoverage==='complete').length,partial:rows.filter(p=>p.structureCoverage==='partial').length,metadataOnly:rows.filter(p=>p.structureCoverage==='metadata-only').length,total:rows.length},catalogue:{uniquePrograms:data.rows.length,partialPrograms:data.partialRows.length,importedPrograms:data.totalPrograms,importedStructures:data.totalStructures},source:'studielots-db',terms,term,fallback:false});
 }catch(error){const term=String(req.query?.term||'HT26').toUpperCase();console.error('program-index '+term,error);return res.status(503).json({programs:[],source:'studielots-db',term,fallback:false,error:'StudieLots programdatabas är tillfälligt otillgänglig'});}
}
