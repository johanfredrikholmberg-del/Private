import fs from 'node:fs';
import path from 'node:path';
export default function handler(req,res){
  const files=['index.html','studielots-catalog-v616.js','studielots-runtime.js','studielots-runtime-core-v641.js','studielots-planner-ui-v647.js'];
  const terms=['openUniversityPathFromOpportunity','selectOpportunityUniversity','selectUniversityForOpportunity','renderUniversityDetail','openStudyPlanner','universityDetailContent','universityDetail'];
  const out={};
  for(const filename of files){
    const file=path.join(process.cwd(),filename);if(!fs.existsSync(file))continue;const src=fs.readFileSync(file,'utf8');out[filename]={};
    for(const term of terms){const i=src.indexOf(term);out[filename][term]=i<0?null:src.slice(Math.max(0,i-1600),Math.min(src.length,i+6500));}
  }
  res.setHeader('Cache-Control','no-store');res.status(200).json(out);
}
