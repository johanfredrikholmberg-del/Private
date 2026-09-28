import {studielotsTable} from '../../api/_studielots-db.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=3600');
  try{
    const decisions=await studielotsTable('creditTransferEvidence');
    return res.status(200).json({decisions,count:decisions.length,source:'studielots-db',fallback:false});
  }catch(error){
    console.error('credit-transfer-history',error);
    return res.status(503).json({decisions:[],source:'studielots-db',fallback:false,error:'Historiska tillgodoräknanden är tillfälligt otillgängliga'});
  }
}
