'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const context = {
  window: { StudieLotsV2: { appContext: { state: { courses: [] }, q() {}, qa() { return []; }, fmt: String, esc: String, programmeLevel() {} } } },
  console
};
const source = fs.readFileSync(path.join(__dirname, '../src/pages/planner/controller.js'), 'utf8');
vm.runInNewContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.courseDateLabel = courseDateLabel; globalThis.courseHtml = courseHtml; globalThis.expectedOfferingTerm = expectedOfferingTerm;})();'), context);
const verified = { name: 'Statistik: Grundkurs 1', hp: 15, __offer: { startDate: '2027-01-18', endDate: '2027-03-29', url: 'https://example.org/course' } };
assert.match(context.courseDateLabel(verified), /18 jan.*29 mars 2027/);
assert.match(context.courseHtml(verified), /class="course-date"/);
assert.equal(context.courseDateLabel({ name: 'Handelsrätt', hp: 15, term: 3 }), 'Kursdatum ej publicerat');
assert.equal(context.courseDateLabel({ name: 'Handelsrätt', term: 3 }, { startTerm: 'HT26', termPlacementVerified: true }), 'Höst 2027 · exakt datum saknas');
assert.equal(context.courseDateLabel({ name: 'Handelsrätt', term: 3 }, { startTerm: 'HT26', termPlacementVerified: false }), 'Kursdatum ej publicerat');
assert.equal(context.courseDateLabel({ startDate: '2027-02-30' }), 'Kursdatum ej publicerat');
assert.match(context.courseDateLabel({ startDate: '2026-11-04', endDate: '2027-01-17' }), /2026.*2027/);
assert.equal(context.expectedOfferingTerm('HT26', 1), 'HT26');
assert.equal(context.expectedOfferingTerm('HT26', 2), 'VT27');
assert.equal(context.expectedOfferingTerm('VT27', 2), 'HT27');
assert.equal(context.expectedOfferingTerm('HT26', null), '');
assert.equal(context.courseDateLabel({ __offers: [{ startDate: '2027-03-29', endDate: '2027-06-06', datePrecision: 'week', partOfTerm: 'vecka 13–22' }] }), 'vecka 13–22 2027');
assert.match(context.courseDateLabel({ __offers: [{ startDate: '2027-01-18', endDate: '2027-03-29', datePrecision: 'exact' }, { startDate: '2027-03-30', endDate: '2027-06-06', datePrecision: 'exact' }] }), /18 jan.*29 mars.*30 mars.*6 juni 2027/);
console.log('Planner course dates: verified intervals and missing dates handled');
