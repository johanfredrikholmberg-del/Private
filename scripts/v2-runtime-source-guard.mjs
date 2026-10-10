import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {canonicalTerm,appliesToTerm} from '../api/program-index.js';

const runtimeFiles=[
  'src/bootstrap.js',
  'src/features/programs/program-paths.js',
  'src/pages/opportunities/controller.js',
  'src/pages/programs/controller.js',
  'src/pages/planner/controller.js',
  'src/features/fast-route/fast-route-v3.js',
];

const forbidden=[
  /\/api\/(?:gu|kau|kth|lu|lund|susa)-/i,
  /program-structure-resolved/i,
  /studielots-index-fallback/i,
  /gu-plan-recovery/i,
  /kau-paths/i,
  /discover-guard/i,
  /data\/HT26/i,
  /data\/program-db/i,
];

for(const file of runtimeFiles){
  const source=await readFile(file,'utf8');
  for(const pattern of forbidden){
    assert.doesNotMatch(source,pattern,`${file} bypasses StudieLots DB via ${pattern}`);
  }
}

assert.equal(canonicalTerm('2027VT'),'VT27');
assert.equal(canonicalTerm('HT26'),'HT26');
assert.equal(appliesToTerm({term:'HT26'},'VT27'),false);
assert.equal(appliesToTerm({validFrom:'2027VT'},'VT27'),true);
assert.equal(appliesToTerm({},'VT27'),true);

const paths=await readFile('src/features/programs/program-paths.js','utf8');
assert.match(paths,/\/api\/program-index/, 'Programme runtime must use canonical program-index');
assert.match(paths,/term:currentTerm\(\)/, 'Programme discovery must pass the selected start term');
const requestedUrls=[];
const runtimeWindow={StudieLotsV2:{appContext:{state:{startTerm:'VT27'}}}};
const mockProgramme={university:'Testuniversitetet',programCode:'TEST1',programName:'Testprogram',programHp:30,structureCoverage:'complete',sourceEvidenceUrl:'https://example.edu/programplan',rows:[{term:1,name:'Testkurs',hp:30}]};
new Function('window','fetch','URLSearchParams','AbortController','setTimeout','clearTimeout',paths)(runtimeWindow,async url=>{requestedUrls.push(String(url));const listing=String(url).includes('listTerms=1');return{ok:true,json:async()=>listing?({terms:['HT26','VT27','HT27'],source:'studielots-db',fallback:false}):({programs:[mockProgramme],source:'studielots-db',fallback:false})}},URLSearchParams,AbortController,setTimeout,clearTimeout);
await runtimeWindow.StudieLotsV2.paths.discover('Företagsekonomi');
assert.equal(new URL(requestedUrls.find(url=>url.includes('subject=')),'https://studielots.test').searchParams.get('term'),'VT27', 'Opportunities must request programmes for the selected start term');
await runtimeWindow.StudieLotsV2.paths.structure({university:'Testuniversitetet',programCode:'TEST1',programName:'Testprogram'},[]);
assert.equal(new URL(requestedUrls.filter(url=>url.includes('/api/program-index?')).at(-1),'https://studielots.test').searchParams.get('term'),'VT27', 'Ordinary path lookup must retain the selected start term');
const opportunities=await readFile('src/pages/opportunities/controller.js','utf8');
assert.match(opportunities,/root\.paths\.structure\(program,courses\)/, 'Opportunities must load the programme structure from program-index');
assert.match(opportunities,/root\.planner\?\.enter\?\.\(item,university,data\)/, 'Ordinary route must pass the canonical structure into Planner');

const fast=await readFile('src/features/fast-route/fast-route-v3.js','utf8');
assert.match(fast,/\/api\/catalog-data/, 'Fast route must use canonical catalog-data');
assert.match(fast,/canonical-offerings/, 'Fast route must request canonical offerings');

const api=await readFile('api/program-index.js','utf8');
assert.match(api,/studielotsTable\('programmes'\)/, 'program-index must read StudieLots DB programmes');
assert.match(api,/canonicalProgrammeStructures\(\)/, 'program-index must read canonical structures');
assert.match(api,/fallback:false/, 'program-index must fail closed without fallback');

const offerings=await readFile('lib/api-handlers/canonical-offerings.js','utf8');
assert.match(offerings,/studielotsTable\('courseOfferings'\)/, 'canonical offerings must read StudieLots DB');
assert.match(offerings,/source:'studielots-db'/, 'canonical offerings must identify StudieLots DB');


const vercel=JSON.parse(await readFile('vercel.json','utf8'));
assert.equal(vercel.functions?.['api/catalog-data.js']?.includeFiles,'data/studielots-db/**', 'catalog-data must package the canonical database');
assert.ok(!vercel.rewrites?.some(route=>['/api/syllabus','/api/gu-program-structure','/api/lu-program-structure','/api/program-structure'].includes(route.source)), 'Legacy live-source API rewrites must be absent');
const catalog=await readFile('api/catalog-data.js','utf8');
assert.doesNotMatch(catalog,/syllabus|fetch\(/i, 'catalog-data must not expose live syllabus scraping');

const {readdir} = await import('node:fs/promises');
const runtimeApis=(await readdir('api')).filter(name=>name.endsWith('.js')).sort();
assert.deepEqual(runtimeApis,['_studielots-db.js','catalog-data.js','program-index.js'],
  'Only canonical StudieLots DB runtime APIs may be deployed');

console.log('Runtime source guard passed: user-facing programme and planner flows are canonical-only.');
