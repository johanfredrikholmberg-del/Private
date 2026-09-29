#!/usr/bin/env node
// Materialize only officially confirmed Karlstad standalone course rounds.
import fs from 'node:fs';
import {datesFromKarlstadWeeks} from './kau-offering-week-dates.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const dbFile = 'data/studielots-db/manifest.json';
const db = read(dbFile);
const storage = db.tables?.courseOfferings?.storage;
if (db.database !== 'StudieLots DB' || storage !== 'data/HT26/course-offerings.json') throw Error('Unexpected canonical offering storage');
const existing = read(storage);
if (existing.length !== db.tables.courseOfferings.rows) throw Error('Canonical offering count mismatch');
let backfilledDates = 0;
const datedExisting = existing.map(row => {
  if (row.university !== 'Karlstads universitet' || row.startDate || row.endDate) return row;
  const dates = datesFromKarlstadWeeks(row.partOfTerm, row.offeringTerm);
  if (!dates) return row;
  backfilledDates++;
  return {...row, ...dates};
});
// Work through a small, deterministic SUSA batch. SUSA supplies candidates only;
// the official KAU page and its direct application link establish each offering.
const catalogue = [...new Map(read('data/susa/courses.json')
  .filter(x => x.university === 'Karlstads universitet' && x.code && x.events?.some(e => /20271|20262/.test(e.id || '')))
  .map(x => [x.code, x])).values()].slice(Number(process.env.KAU_OFFERING_OFFSET || 0), Number(process.env.KAU_OFFERING_OFFSET || 0) + 35);
const byKey = new Map(datedExisting.map(x => [x.key, x]));
const report = {checkedAt: new Date().toISOString(), candidates: catalogue.length, added: 0, backfilledDates, review: []};
const text = html => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim();

for (const course of catalogue) {
  const url = `https://www.kau.se/utbildning/program-och-kurser/kurser/${course.code}`;
  if (!/^https:\/\/www\.kau\.se\/utbildning\/program-och-kurser\/kurser\/[A-Z0-9]+$/.test(url)) {
    report.review.push({code: course.code, reason: 'invalid-official-url'}); continue;
  }
  let html;
  try {
    const response = await fetch(url, {signal: AbortSignal.timeout(25000)});
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    html = await response.text();
  } catch (error) {report.review.push({code: course.code, reason: String(error)}); continue;}
  if (!new RegExp(`"courseCode"\\s*:\\s*"${course.code}"`).test(html)) {
    report.review.push({code: course.code, reason: 'identity-unverified'}); continue;
  }
  const officialHp = Number(html.match(/"name"\s*:\s*"[^"]+?\s+(\d+(?:\.\d+)?)\s+HP"/)?.[1]);
  if (!(officialHp > 0) || Math.abs(officialHp - Number(course.hp)) > 0.01) {
    report.review.push({code: course.code, reason: 'official-hp-mismatch'}); continue;
  }
  const tabs = [...html.matchAll(/href="\?occasion=(\d+)"[^>]*>\s*(HT|VT)-(\d{2})/g)];
  if (tabs.length !== 1) {report.review.push({code: course.code, reason: 'ambiguous-round-tabs'}); continue;}
  const [, occasion, season, year] = tabs[0];
  const term = `${season}${year}`;
  if (!['HT26', 'VT27'].includes(term)) continue;
  const details = html.slice(tabs[0].index, html.indexOf('Till anmälan', tabs[0].index));
  const field = label => text(details.match(new RegExp(`<span[^>]*>${label}<\\/span>\\s*<span[^>]*>([\\s\\S]*?)<\\/span>`, 'i'))?.[1] || '');
  const code = field('Kurskod'), applicationCode = field('Anmälningskod');
  const start = field('Start'), form = field('Studieform'), pace = field('Studietakt'), period = field('Studieperiod');
  const directApplication = new RegExp(`https://www\\.antagning\\.se/se/addtobasket\\?id=${applicationCode}&amp;period=${season}_20${year}`).test(details);
  if (code !== course.code || applicationCode !== `KAU-${occasion}` || !directApplication || !start.includes(season === 'HT' ? 'Hösttermin 20' : 'Vårtermin 20') || !new RegExp(`20${year}`).test(start) || !/^\d+%/.test(pace) || !period || !form) {
    report.review.push({code: course.code, reason: 'incomplete-or-conflicting-round'}); continue;
  }
  const dates = datesFromKarlstadWeeks(period, term);
  if (!dates) {report.review.push({code: course.code, reason: 'invalid-week-period'}); continue;}
  const key = `karlstads-universitet|${code}|${term}|${applicationCode}`;
  if (byKey.has(key) || existing.some(x => x.university === 'Karlstads universitet' && x.courseCode === code && x.offeringTerm === term && x.applicationCode === applicationCode)) continue;
  byKey.set(key, {key, university: 'Karlstads universitet', courseCode: code, courseName: course.name, courseHp: Number(course.hp), offeringTerm: term, ...dates, studyPace: pace, studyPacePercent: Number(pace.match(/^\d+/)[0]), studyLocation: form.match(/\(([^)]+)\)/)?.[1] || '', teachingForm: form, distance: /distans/i.test(form), partOfTerm: period, applicationCode, standaloneSearchable: true, source: 'karlstad-official-course-page', sourceUrl: url, checkedAt: report.checkedAt});
  report.added++;
}

if (report.added || backfilledDates) {
  fs.writeFileSync(storage, JSON.stringify([...byKey.values()], null, 2) + '\n');
  db.tables.courseOfferings.rows = byKey.size;
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2) + '\n');
}
report.canonicalTotal = byKey.size;
fs.writeFileSync('data/import-reviews/kau-verified-offerings-latest.json', JSON.stringify(report, null, 2) + '\n');
console.log(report);
