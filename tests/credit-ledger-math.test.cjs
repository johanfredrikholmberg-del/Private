'use strict';
const assert = require('node:assert/strict');
const { summarize } = require('../src/core/credit-ledger-math.js');
const exact = summarize(180, [
  { hp: 30, countedHp: 30 },
  { hp: 45, countedHp: 45 },
  { hp: 90, countedHp: 0, possibleHp: 90 }
]);
assert.deepEqual(exact, { total: 180, credited: 75, possible: 90, remaining: 105, pct: 42 });
assert.deepEqual(summarize(30, [{ hp: 15, countedHp: 50 }, { hp: 15, countedHp: 50 }]),
  { total: 30, credited: 30, possible: 0, remaining: 0, pct: 100 });
assert.deepEqual(summarize(30, [{ hp: 15, possibleHp: 15 }, { hp: 15, possibleHp: 15 }]),
  { total: 30, credited: 0, possible: 30, remaining: 30, pct: 0 });
assert.deepEqual(summarize(0, [{ hp: 15, countedHp: 15 }]),
  { total: 0, credited: 0, possible: 0, remaining: 0, pct: 0 });
console.log('credit-ledger-math: 4 assertions passed');
