import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import {resolve} from 'node:path';

// Keep modules independent and visible: this test checks the actual bootstrap,
// without deleting or merging any existing module.
const bootstrap = await readFile(resolve('src/bootstrap.js'), 'utf8');
const groups = [...bootstrap.matchAll(/\{name:'([^']+)',scripts:\[([^\]]*)\]\}/g)].map(([, name, scripts]) => ({
  name,
  scripts: [...scripts.matchAll(/'([^']+)'/g)].map(match => match[1]),
}));
assert.ok(groups.length >= 5, 'Expected modular bootstrap groups');
assert.equal(new Set(groups.map(group => group.name)).size, groups.length, 'Duplicate bootstrap group');
const all = groups.flatMap(group => group.scripts);
assert.equal(new Set(all.map(path => path.split('?')[0])).size, all.length, 'Duplicate script path (including different versions)');
for (const path of all) {
  assert.match(path, /^\/src\/[\w/-]+\.js\?v=\d+$/, `Unexpected script URL: ${path}`);
  await access(resolve(`.${path.split('?')[0]}`));
}
const order = names => names.map(name => groups.findIndex(group => group.name === name));
const [credit, controllers, runtime, post] = order(['credit-transfer', 'page-controllers', 'app-runtime', 'post-processing']);
assert.ok(credit >= 0 && controllers > credit && runtime > controllers && post > runtime,
  'Credit transfer must load before controllers; post-processing must load after runtime');
for (const required of ['src/core/match-consistency.js', 'src/features/planner/planner-summary.js', 'src/features/planner/route-clarity.js']) {
  assert.ok(all.some(path => path.split('?')[0] === `/${required}`), `Missing existing module: ${required}`);
}
console.log(`Module boundary check passed: ${groups.length} groups, ${all.length} unique existing scripts.`);
