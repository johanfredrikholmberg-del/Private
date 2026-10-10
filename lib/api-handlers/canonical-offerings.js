import {studielotsTable} from '../../api/_studielots-db.js';
const clean=v=>String(v??'').trim(), code=v=>clean(v).toUpperCase().replace(/[^A-Z0-9ÅÄÖ]/g,''),nameKey=v=>clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const validTerm=v=>/^(HT|VT)\d{2}$/.test(v);
const termOrder=v=>{const m=/^(HT|VT)(\d{2})$/.exec(String(v||'').toUpperCase());return m?(2000+Number(m[2]))*2+(m[1]==='HT'?1:0):-1};
export default async function handler(req,res){
 res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=3600');
 const term=clean(req.query?.term).toUpperCase(),fromTerm=clean(req.query?.fromTerm).toUpperCase(),startingTerm=fromTerm||term;
 if((term&&!validTerm(term))||(fromTerm&&!validTerm(fromTerm))||!startingTerm)return res.status(400).json({offerings:[],error:'term or fromTerm must be HTYY or VTYY'});
 try{
  const rows=await studielotsTable('courseOfferings');
  const codes=new Set(clean(req.query?.codes||req.query?.code).split(/[;,]/).map(code).filter(Boolean)), university=clean(req.query?.university).toLocaleLowerCase('sv-SE');
  let namePairs=[];try{namePairs=JSON.parse(clean(req.query?.names||'[]'));if(!Array.isArray(namePairs))namePairs=[]}catch{}
  namePairs=namePairs.filter(x=>clean(x?.name)&&Number(x?.hp)>0).map(x=>({key:nameKey(x.name),hp:Number(x.hp)}));
  if(!codes.size&&!namePairs.length)return res.status(400).json({offerings:[],error:'At least one course code or exact course name is required'});
  const scoped=rows.filter(x=>!university||clean(x.university).toLocaleLowerCase('sv-SE').includes(university));
  const uniqueNamePairs=new Set();
  for(const pair of namePairs){const codesForName=new Set(scoped.filter(x=>nameKey(x.courseName||x.name)===pair.key&&Math.abs(Number(x.courseHp||x.hp)-pair.hp)<.011).map(x=>code(x.courseCode||x.code)).filter(Boolean));if(codesForName.size===1)uniqueNamePairs.add(`${pair.key}|${pair.hp}`)}
  const offerings=scoped.filter(x=>{const offeredTerm=clean(x.offeringTerm||x.term).toUpperCase(),termMatch=fromTerm?termOrder(offeredTerm)>=termOrder(fromTerm):offeredTerm===term;const byCode=codes.has(code(x.courseCode||x.code)),byName=namePairs.some(pair=>uniqueNamePairs.has(`${pair.key}|${pair.hp}`)&&pair.key===nameKey(x.courseName||x.name)&&Math.abs(Number(x.courseHp||x.hp)-pair.hp)<.011);return termMatch&&(byCode||byName)}).sort((a,b)=>termOrder(a.offeringTerm||a.term)-termOrder(b.offeringTerm||b.term)||String(a.startDate||'').localeCompare(String(b.startDate||'')));
  return res.status(200).json({offerings,term:term||null,fromTerm:fromTerm||null,count:offerings.length,source:'studielots-db',fallback:false});
 }catch(error){console.error('canonical-offerings',error);return res.status(503).json({offerings:[],term,source:'studielots-canonical-offerings',fallback:false,error:'Kurstillfällesdatabasen är tillfälligt otillgänglig'});}
}
