import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {studielotsManifest} from './_studielots-db.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=3600');
  try{
    const manifest=await studielotsManifest();
    const sources=manifest.historicalCreditTransferSources||[];
    const parts=await Promise.all(sources.map(async path=>JSON.parse(await readFile(join(process.cwd(),...path.split('/')),'utf8'))));
    const decisions=parts.flat();
    return res.status(200).json({decisions,count:decisions.length,source:'studielots-db',fallback:false});
  }catch(error){
    console.error('credit-transfer-history',error);
    return res.status(503).json({decisions:[],source:'studielots-db',fallback:false,error:'Historiska tillgodoräknanden är tillfälligt otillgängliga'});
  }
}
