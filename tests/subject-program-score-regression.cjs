'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const output = { textContent: '', setAttribute() {} };
const button = {
  isConnected: true, style: {}, dataset: {},
  querySelector(selector) { return selector === '.op-copy b' ? { textContent: 'Nationalekonomi' } : output; },
  appendChild() {}
};
const host = {
  classList: { contains() { return false; } },
  querySelector() { return null; },
  querySelectorAll() { return [button]; }
};
const courses = [{ code: 'NEK101', name: 'Nationalekonomi', hp: 7.5 }];
const root = {
  opportunities: { render() {}, levelKind() { return 'candidate'; } },
  appContext: { state: { courses }, q() { return host; } },
  paths: {
    async discover() { return [{ structureCoverage: 'partial', programCode: 'S1EKA' }]; },
    async structure() { return { creditLedger: { pct: 34, credited: 62, total: 180 } }; }
  }
};
const context = { window: { StudieLotsV2: root }, document: { createElement() { return { dataset: {}, style: {}, setAttribute() {} }; } }, console };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/features/opportunities/subject-program-scores.js'), 'utf8'), context);
root.opportunities.render();
setImmediate(() => {
  assert.equal(output.textContent, '34 %', 'A programme with a recoverable structure must show the same percentage at subject level');
  console.log('Subject programme score regression passed');
});
