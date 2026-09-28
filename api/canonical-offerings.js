import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
const clean=v=>String(v??'').trim(), code=v=>clean(v).toUpperCase().replace(/[^A-Z0-9ÅÄÖ]/g,'');
export default async function handler(req,res){
 res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=3600');
 const term=clean(req.query?.term).toUpperCase();
 if(!/^(HT|VT)\d{2}$/.test(term))return res.status(400).json({offerings:[],error:'term must be HTYY or VTYY'});
 try{
  const rows=JSON.parse(await readFile(join(process.cwd(),'data','offerings','canonical.json'),'utf8'));
  const codes=new Set(clean(req.query?.codes||req.query?.code).split(/[;,]/).map(code).filter(Boolean)), university=clean(req.query?.university).toLocaleLowerCase('sv-SE');
  const offerings=rows.filter(x=>x.term===term&&(!codes.size||codes.has(code(x.code)))&&(!university||clean(x.university).toLocaleLowerCase('sv-SE').includes(university)));
  return res.status(200).json({offerings,term,count:offerings.length,source:'studielots-canonical-offerings',fallback:false});
 }catch(error){console.error('canonical-offerings',error);return res.status(503).json({offerings:[],term,source:'studielots-canonical-offerings',fallback:false,error:'Kurstillfällesdatabasen är tillfälligt otillgänglig'});}
}
