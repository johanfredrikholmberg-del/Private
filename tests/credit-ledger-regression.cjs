// Run with: node tests/credit-ledger-regression.cjs
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const window = {
  StudieLotsV2: {
    appContext: { state: { courses: [] } },
    paths: { async structure(item, rows) { return { item, totalHp: 180, rows }; } }
  },
  StudieLotsEngines: { creditTransferHistory: { forAssessment: () => [] } }
};
window.StudieLotsEngines.creditTransferAdapter = {
  applyToRows(rows) { return rows.map(row => ({ ...row, creditTransferCountsInStudyPlan: row.creditTransferCountsInStudyPlan || false })); }
};
const document = { readyState: 'complete', querySelectorAll() { return []; }, querySelector() { return null; }, documentElement: {} };
// In a browser globalThis and window refer to the same object. Reproduce that in the VM.
const context = { window, globalThis: window, document, MutationObserver: class { observe() {} }, requestAnimationFrame() {}, sessionStorage: { getItem() { return null; } }, CustomEvent: class {} };
for (const file of ['credit-ledger-math.js', 'match-consistency.js']) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/core', file), 'utf8'), context, { filename: file });
}
const row = (extra = {}) => ({ hp: 30, credited: false, matchedHp: 0, creditMatch: 'none', ...extra });
async function ledger(rows) {
  return (await window.StudieLotsV2.paths.structure({ programName: 'Test', university: 'Test' }, rows)).creditLedger;
}
(async () => {
  assert.equal((await ledger([row({ credited: true, matchedHp: 0 })])).credited, 0, 'Explicit zero must never become full credit');
  assert.equal((await ledger([row({ creditMatch: 'potential', matchedHp: 30 })])).credited, 0, 'Potential is not credited');
  assert.equal((await ledger([row({ credited: true, matchedHp: 15 })])).credited, 15, 'Partial direct match counts only its hp');
  assert.equal((await ledger([row({ credited: true, matchedHp: 15, creditTransferCountsInStudyPlan: true, creditTransferMatchedHp: 30, creditTransfer: { classification: 'strong' } })])).credited, 15, 'Stale transfer annotations must be stripped before reassessment');
  assert.equal((await ledger([row({ creditTransferCountsInStudyPlan: true, creditTransferMatchedHp: 15, creditTransfer: { classification: 'strong' } })])).credited, 0, 'Stale strong transfer annotations cannot count without reassessment');
  assert.equal((await ledger([row({ creditTransferCountsInStudyPlan: true, creditTransferMatchedHp: 30, creditTransfer: { classification: 'relevant' } })])).credited, 0, 'Good evidence cannot deduct credits');
  assert.equal((await ledger(Array.from({ length: 7 }, () => row({ credited: true, matchedHp: 30 })))).credited, 180, 'Never exceed programme total');
  const once = await ledger([row({ credited: true, matchedHp: 15 })]);
  const twice = await ledger(once.rows);
  assert.equal(once.credited, twice.credited, 'Reprocessing prepared rows must be idempotent');
  console.log('Credit ledger regression checks passed (8 cases)');
})().catch(error => { console.error(error); process.exitCode = 1; });
