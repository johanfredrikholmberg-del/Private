import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/program-index.js';

test('full term sequences with elective choices are searchable as partial programme plans', async () => {
  const res = {
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  await handler({ query: { term: 'HT26', includeUnplanned: '1', q: 'S2IAG' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.source, 'studielots-db');
  const program = res.body.programs.find(row => row.programCode === 'S2IAG');
  assert.ok(program);
  assert.equal(program.structureCoverage, 'partial');
  assert.equal(program.termPlacementVerified, true);
  assert.ok(program.rows.some(row => row.code === 'AG2500'));
});

test('start terms come from the database and HT27 programmes are queryable', async () => {
  const response = () => ({
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  });
  const terms = response();
  await handler({ query: { listTerms: '1' } }, terms);
  assert.equal(terms.statusCode, 200);
  assert.equal(terms.body.source, 'studielots-db');
  assert.ok(terms.body.terms.includes('HT27'));

  const ht27 = response();
  await handler({ query: { term: 'HT27', includeUnplanned: '1' } }, ht27);
  assert.equal(ht27.statusCode, 200);
  assert.equal(ht27.body.term, 'HT27');
  assert.ok(ht27.body.programs.length > 0);
  assert.ok(ht27.body.programs.every(program => program.source === 'studielots-db'));
});
