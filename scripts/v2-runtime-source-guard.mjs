import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

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

const paths=await readFile('src/features/programs/program-paths.js','utf8');
assert.match(paths,/\/api\/program-index/, 'Programme runtime must use canonical program-index');

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

console.log('Runtime source guard passed: user-facing programme and planner flows are canonical-only.');
