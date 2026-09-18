const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/features/fast-route/fast-route-v3.js'), 'utf8');
function engine(offerings = []) {
  const window = { StudieLotsV2: {} };
  const fetch = async () => ({ ok: true, json: async () => ({ offerings }) });
  vm.runInNewContext(source, { window, fetch, AbortController, setTimeout, clearTimeout, URLSearchParams, Date, Number, Math, Map, Set, Promise, String, Array, Object }, { filename: 'fast-route-v3.js' });
  return window.StudieLotsV2.fast;
}
const row = (code, hp = 7.5, extra = {}) => ({ code, name: code, hp, term: 1, ...extra });
const offer = (code, extra = {}) => ({ code, startDate: '2029-01-15', endDate: '2029-03-15', url: 'https://example.org/course', university: 'Göteborgs universitet', standaloneSearchable: true, ...extra });
test('missing programme start does not silently use current date', async () => {
  const result = await engine([offer('A')]).build([row('A')], { university: 'Göteborgs universitet' });
  assert.equal(result.complete, false);
  assert.equal(result.scheduledHp, 0);
  assert.equal(result.unscheduled.length, 1);
});
test('credited hp are not scheduled again and possible matches do not count', async () => {
  const rows = [row('DONE', 26, { creditedHp: 26 }), row('LEFT', 154, { creditedHp: 0, matchedHp: 154 })];
  const result = await engine().build(rows, { startDate: '2029-01-15', university: 'Göteborgs universitet' });
  assert.equal(result.remainingHp, 154);
  assert.equal(result.scheduledHp, 0);
  assert.equal(result.unscheduled.length, 1);
});
test('programme-only course without verified access is not scheduled', async () => {
  const result = await engine([offer('A', { standaloneSearchable: false })]).build([row('A')], { startDate: '2029-01-15', university: 'Göteborgs universitet' });
  assert.equal(result.complete, false);
  assert.equal(result.scheduledHp, 0);
});
test('fully dated standalone offering can be scheduled', async () => {
  const result = await engine([offer('A')]).build([row('A')], { startDate: '2029-01-15', university: 'Göteborgs universitet' });
  assert.equal(result.complete, true);
  assert.equal(result.scheduledHp, 7.5);
  assert.equal(result.terms.length, 1);
});
test('incomplete end date never counts as a confirmed course', async () => {
  const result = await engine([offer('A', { endDate: null })]).build([row('A')], { startDate: '2029-01-15', university: 'Göteborgs universitet' });
  assert.equal(result.complete, false);
  assert.equal(result.scheduledHp, 0);
});
