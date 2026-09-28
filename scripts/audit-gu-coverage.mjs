import fs from 'node:fs';

const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const arr=x=>Array.isArray(x)?x:Array.isArray(x?.items)?x.items:Array.isArray(x?.programmes)?x.programmes:Array.isArray(x?.courses)?x.courses:[];
const norm=v=>String(v??'').toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const isGu=x=>{
  const vals=[x?.university,x?.providerName,x?.provider?.name,x?.provider,x?.universityName,x?.providerId,x?.provider?.id];
  return vals.some(v=>/goteborgs universitet|p\.uoh\.gu/.test(norm(v)));
};
const code=x=>String(x?.code??x?.courseCode??x?.programCode??x?.educationCode??'').trim();
const hp=x=>Number(x?.hp??x?.credits??x?.creditPoints??0);
const name=x=>String(x?.name??x?.title??x?.educationName??'').trim();

const programmes=arr(read('data/susa/programmes.json')).filter(isGu);
const courses=arr(read('data/susa/courses.json')).filter(isGu);
const pdb=read('data/program-db.json');
const structures=arr(pdb?.programs??pdb).filter(isGu);
const h1=read('data/gu/history/specific-1to1-p1.json');
const h2=read('data/gu/history/specific-1to1-p2.json');
const history=[...h1,...h2];

const baseComplete=x=>Boolean(name(x)&&code(x)&&hp(x)>0);
const targetCodes=new Set(history.map(x=>String(x.targetCode||'').trim()).filter(Boolean));
const courseCodes=new Set(courses.map(code).filter(Boolean));
const historicalTargetsInCatalogue=[...targetCodes].filter(x=>courseCodes.has(x));

const report={
 schemaVersion:1,
 generatedAt:new Date().toISOString(),
 university:'Göteborgs universitet',
 catalogue:{
   programmes:programmes.length,
   programmesWithBaseMetadata:programmes.filter(baseComplete).length,
   courses:courses.length,
   coursesWithBaseMetadata:courses.filter(baseComplete).length
 },
 structures:{
   materialized:structures.length,
   verified:structures.filter(x=>x.verified===true).length,
   rows:structures.reduce((s,x)=>s+(Array.isArray(x.rows)?x.rows.length:0),0)
 },
 historicalCreditTransfer:{
   rows:history.length,
   uniqueTargetCodes:targetCodes.size,
   approvalCount:history.reduce((s,x)=>s+(Number(x.approvalCount)||0),0),
   targetCodesPresentInSusaCourseCatalogue:historicalTargetsInCatalogue.length
 },
 definitions:{
   baseMetadata:'name + education code + hp',
   completeProgrammeForPlanner:'requires verified/materialized programme structure; catalogue metadata alone is not counted as complete'
 }
};
fs.mkdirSync('data/import-reviews',{recursive:true});
fs.writeFileSync('data/import-reviews/gu-coverage.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
