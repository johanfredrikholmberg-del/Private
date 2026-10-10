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

test('course name and hp resolve offerings when a structure row has no course code', async () => {
  sandbox.__rows = [{ university: 'Lunds universitet', courseCode: 'ABC123', courseName: 'Statistik: Grundkurs 1', courseHp: 15, offeringTerm: 'HT26', startDate: '2026-08-31', endDate: '2026-11-03' }];
  const res = await call({ term: 'HT26', names: JSON.stringify([{ name: 'Statistik: Grundkurs 1', hp: 15 }]), university: 'Lunds universitet' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.count, 1);
  assert.equal(res.body.offerings[0].courseCode, 'ABC123');
});

test('ambiguous exact course names are not guessed', async () => {
  sandbox.__rows = [
    { university: 'Lunds universitet', courseCode: 'ABC123', courseName: 'Statistik: Grundkurs 1', courseHp: 15, offeringTerm: 'HT26' },
    { university: 'Lunds universitet', courseCode: 'XYZ987', courseName: 'Statistik: Grundkurs 1', courseHp: 15, offeringTerm: 'HT26' }
  ];
  const res = await call({ term: 'HT26', names: JSON.stringify([{ name: 'Statistik: Grundkurs 1', hp: 15 }]), university: 'Lunds universitet' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.count, 0);
});
