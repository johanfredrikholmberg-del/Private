import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const loader = await readFile(new URL('../studielots-runtime-v625.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');

const required = [
  'studielots-v624.js?v=624',
  'studielots-responsive-v706.css?v=707',
  'studielots-planner-ui-v647.js?v=700',
  'studielots-master-selector-v684.js?v=684',
  'studielots-planner-summary-v703.js?v=703',
  'studielots-runtime-overlay-v706.js?v=706',
  'studielots-auto-structure.js?v=701',
  'studielots-official-source-v704.js?v=704',
  'studielots-studies-compact-v707.js?v=707',
  'studielots-planner.js?v=690',
];

assert.match(index, /studielots-runtime-v625\.js\?v=625/);
assert.match(loader, /const BASELINE='709'/);
for (const asset of required) assert.ok(loader.includes(asset), `runtime baseline is missing ${asset}`);
assert.match(loader, /__studielotsLoaderAudit/);
assert.doesNotMatch(loader, /studielots-planner-bridge-v708\.js/);
assert.doesNotMatch(loader, /studielots-v625\.js\?v=625/);

console.log('StudieLots runtime baseline v709 passed');
