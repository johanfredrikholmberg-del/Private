import fs from 'node:fs';
import path from 'node:path';
export default function handler(req,res){
  const file=path.join(process.cwd(),'studielots-catalog-v616.js');
  const src=fs.readFileSync(file,'utf8');
  const terms=['openUniversityPathFromOpportunity','selectOpportunityUniversity','selectUniversityForOpportunity','renderUniversityDetail','openStudyPlanner'];
  const out={};
  for(const term of terms){
    const i=src.indexOf(term);
    out[term]=i<0?null:src.slice(Math.max(0,i-1200),Math.min(src.length,i+5000));
  }
  res.setHeader('Cache-Control','no-store');
  res.status(200).json(out);
}
