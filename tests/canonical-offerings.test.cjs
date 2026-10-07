const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../lib/api-handlers/canonical-offerings.js'), 'utf8')
  .replace("import {studielotsTable} from '../../api/_studielots-db.js';", 'const studielotsTable = async () => globalThis.__rows;')
  .replace('export default async function handler', 'async function handler') + '\nmodule.exports = handler;';
const rows = [
  { university: 'Göteborgs universitet', courseCode: 'A1', offeringTerm: 'HT26', startDate: '2026-08-31' },
  { university: 'Göteborgs universitet', courseCode: 'A1', offeringTerm: 'VT27', startDate: '2027-01-18' },
  { university: 'Göteborgs universitet', courseCode: 'B1', offeringTerm: 'VT27', startDate: '2027-01-18' },
  { university: 'Karlstads universitet', courseCode: 'A1', offeringTerm: 'VT27', startDate: '2027-01-18' }
];
const sandbox = { module: { exports: {} }, console, __rows: rows };
vm.runInNewContext(source, sandbox, { filename: 'canonical-offerings.js' });
const handler = sandbox.module.exports;
async function call(query) {
  const res = {
    statusCode: 200,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  await handler({ query }, res);
  return res;
}

test('fromTerm includes matching GU offerings in the selected and later terms only', async () => {
  const res = await call({ fromTerm: 'HT26', codes: 'A1', university: 'Göteborgs universitet' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(Array.from(res.body.offerings, x => x.offeringTerm), ['HT26', 'VT27']);
  assert.equal(res.body.count, 2);
});

test('term continues to select one exact term', async () => {
  const res = await call({ term: 'VT27', codes: 'A1', university: 'Göteborgs universitet' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(Array.from(res.body.offerings, x => x.offeringTerm), ['VT27']);
});

test('invalid range term is rejected', async () => {
  const res = await call({ fromTerm: '2027', codes: 'A1' });
  assert.equal(res.statusCode, 400);
});
