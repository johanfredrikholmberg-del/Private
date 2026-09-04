import fs from 'node:fs';
import path from 'node:path';
const terms=['openUniversityPathFromOpportunity','selectOpportunityUniversity','selectUniversityForOpportunity','renderUniversityDetail','openStudyPlanner','universityDetailContent','universityDetail'];
function scan(src){const out={};for(const term of terms){const i=src.indexOf(term);out[term]=i<0?null:src.slice(Math.max(0,i-1600),Math.min(src.length,i+6500));}return out}
export default function handler(req,res){
  const out={};
  const root=process.cwd();
  const index=path.join(root,'index.html');if(fs.existsSync(index))out['index.html']=scan(fs.readFileSync(index,'utf8'));
  const catalog=path.join(root,'studielots-catalog-v616.js');if(fs.existsSync(catalog))out['studielots-catalog-v616.js']=scan(fs.readFileSync(catalog,'utf8'));
  const runtime=path.join(root,'studielots-runtime.js');if(fs.existsSync(runtime))out['studielots-runtime.js']=scan(fs.readFileSync(runtime,'utf8'));
  const core=path.join(root,'studielots-runtime-core-v641.js');if(fs.existsSync(core))out['studielots-runtime-core-v641.js']=scan(fs.readFileSync(core,'utf8'));
  const ui=path.join(root,'studielots-planner-ui-v647.js');if(fs.existsSync(ui))out['studielots-planner-ui-v647.js']=scan(fs.readFileSync(ui,'utf8'));
  res.setHeader('Cache-Control','no-store');res.status(200).json(out);
}
