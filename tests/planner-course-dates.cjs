'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const plannerHost = { innerHTML: '' };
const calls = [];
const state = { courses: [], startTerm: 'HT26' };
const context = {
  window: { StudieLotsV2: { appContext: { state, q() { return plannerHost; }, qa() { return []; }, fmt: String, esc: String, programmeLevel() {} } } },
  fetch: async url => {
    calls.push(String(url));
    const params = new URLSearchParams(String(url).split('?')[1]);
    const offerings = {
      HT26: [{ courseCode: 'A', offeringTerm: 'HT26', startDate: '2026-09-01', endDate: '2026-12-15', datePrecision: 'exact', sourceUrl: 'https://gu.se/a' }],
      VT27: [{ courseCode: 'B', offeringTerm: 'VT27', startDate: '2027-01-18', endDate: '2027-06-06', datePrecision: 'exact', sourceUrl: 'https://gu.se/b' }]
    }[params.get('term')] || [];
    const codes = new Set((params.get('codes') || '').split(','));
    return { ok: true, json: async () => ({ offerings: offerings.filter(x => codes.has(x.courseCode)) }) };
  },
  URLSearchParams,
  console
};
const source = fs.readFileSync(path.join(__dirname, '../src/pages/planner/controller.js'), 'utf8');
vm.runInNewContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.courseDateLabel = courseDateLabel; globalThis.courseHtml = courseHtml; globalThis.expectedOfferingTerm = expectedOfferingTerm; globalThis.attachOrdinaryOfferings = attachOrdinaryOfferings;})();'), context);
const verified = { name: 'Statistik: Grundkurs 1', hp: 15, __offer: { startDate: '2027-01-18', endDate: '2027-03-29', url: 'https://example.org/course' } };
assert.match(context.courseDateLabel(verified), /18 jan.*29 mars 2027/);
assert.match(context.courseHtml(verified), /class="course-date"/);
assert.equal(context.courseDateLabel({ name: 'Handelsrätt', hp: 15, term: 3 }), 'Terminsplacering ej verifierad');
assert.equal(context.courseDateLabel({ name: 'Handelsrätt', term: 3 }, { startTerm: 'HT26', termPlacementVerified: true }), 'Höst 2027 · exakt datum saknas');
assert.equal(context.courseDateLabel({ name: 'Handelsrätt', term: 3 }, { startTerm: 'HT26', termPlacementVerified: false }), 'Terminsplacering ej verifierad');
assert.equal(context.courseDateLabel({ startDate: '2027-02-30' }), 'Kursdatum ej publicerat');
assert.match(context.courseDateLabel({ startDate: '2026-11-04', endDate: '2027-01-17' }), /2026.*2027/);
assert.equal(context.expectedOfferingTerm('HT26', 1), 'HT26');
assert.equal(context.expectedOfferingTerm('HT26', 2), 'VT27');
assert.equal(context.expectedOfferingTerm('VT27', 2), 'HT27');
assert.equal(context.expectedOfferingTerm('HT26', null), '');
assert.equal(context.courseDateLabel({ __offers: [{ startDate: '2027-03-29', endDate: '2027-06-06', datePrecision: 'week', partOfTerm: 'vecka 13–22' }] }), 'vecka 13–22 2027');
assert.match(context.courseDateLabel({ __offers: [{ startDate: '2027-01-18', endDate: '2027-03-29', datePrecision: 'exact' }, { startDate: '2027-03-30', endDate: '2027-06-06', datePrecision: 'exact' }] }), /18 jan.*29 mars.*30 mars.*6 juni 2027/);
(async () => {
  const data = { verified: true, item: { university: 'Göteborgs universitet' }, rows: [
    { code: 'A', name: 'Kurs A', hp: 7.5, term: 1 },
    { code: 'B', name: 'Kurs B', hp: 7.5, term: 2 }
  ] };
  state.plannerData = data;
  await context.attachOrdinaryOfferings(data, 0);
  assert.equal(state.plannerData.rows[0].__offers[0].offeringTerm, 'HT26');
  assert.equal(state.plannerData.rows[1].__offers[0].offeringTerm, 'VT27');
  assert.match(context.courseDateLabel(state.plannerData.rows[0], { startTerm: 'HT26', termPlacementVerified: true }), /1 sep.*15 dec 2026/);
  assert.equal(calls.length, 2);
  console.log('Planner course dates: ordinary and fast route dates covered');
})().catch(error => { console.error(error); process.exitCode = 1; });
