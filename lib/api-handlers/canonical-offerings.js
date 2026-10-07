import {studielotsTable} from '../../api/_studielots-db.js';
const clean=v=>String(v??'').trim(), code=v=>clean(v).toUpperCase().replace(/[^A-Z0-9ÅÄÖ]/g,'');
const validTerm=v=>/^(HT|VT)\d{2}$/.test(v);
const termOrder=v=>{const m=/^(HT|VT)(\d{2})$/.exec(String(v||'').toUpperCase());return m?(2000+Number(m[2]))*2+(m[1]==='HT'?1:0):-1};
export default async function handler(req,res){
 res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=3600');
 const term=clean(req.query?.term).toUpperCase(),fromTerm=clean(req.query?.fromTerm).toUpperCase(),startingTerm=fromTerm||term;
 if((term&&!validTerm(term))||(fromTerm&&!validTerm(fromTerm))||!startingTerm)return res.status(400).json({offerings:[],error:'term or fromTerm must be HTYY or VTYY'});
 try{
  const rows=await studielotsTable('courseOfferings');
  const codes=new Set(clean(req.query?.codes||req.query?.code).split(/[;,]/).map(code).filter(Boolean)), university=clean(req.query?.university).toLocaleLowerCase('sv-SE');
  const offerings=rows.filter(x=>{const offeredTerm=clean(x.offeringTerm||x.term).toUpperCase(),termMatch=fromTerm?termOrder(offeredTerm)>=termOrder(fromTerm):offeredTerm===term;return termMatch&&(!codes.size||codes.has(code(x.courseCode||x.code)))&&(!university||clean(x.university).toLocaleLowerCase('sv-SE').includes(university))}).sort((a,b)=>termOrder(a.offeringTerm||a.term)-termOrder(b.offeringTerm||b.term)||String(a.startDate||'').localeCompare(String(b.startDate||'')));
  return res.status(200).json({offerings,term:term||null,fromTerm:fromTerm||null,count:offerings.length,source:'studielots-db',fallback:false});
 }catch(error){console.error('canonical-offerings',error);return res.status(503).json({offerings:[],term,source:'studielots-canonical-offerings',fallback:false,error:'Kurstillfällesdatabasen är tillfälligt otillgänglig'});}
}
