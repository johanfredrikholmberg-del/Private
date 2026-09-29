#!/usr/bin/env node
// Materialize only officially confirmed Karlstad standalone course rounds.
import fs from 'node:fs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const dbFile = 'data/studielots-db/manifest.json';
const db = read(dbFile);
const storage = db.tables?.courseOfferings?.storage;
if (db.database !== 'StudieLots DB' || storage !== 'data/HT26/course-offerings.json') throw Error('Unexpected canonical offering storage');
const existing = read(storage);
if (existing.length !== db.tables.courseOfferings.rows) throw Error('Canonical offering count mismatch');
const catalogue = read('data/kau/courses.json').filter(x => x.standalone === true && x.standaloneStatus === 'verified-standalone-offering');
const byKey = new Map(existing.map(x => [x.key, x]));
const report = {checkedAt: new Date().toISOString(), candidates: catalogue.length, added: 0, review: []};
const text = html => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim();

for (const course of catalogue) {
  const url = course.sourceUrl;
  if (!/^https:\/\/www\.kau\.se\/utbildning\/program-och-kurser\/kurser\/[A-Z0-9]+$/.test(url)) {
    report.review.push({code: course.code, reason: 'invalid-official-url'}); continue;
  }
  let html;
  try {
    const response = await fetch(url, {signal: AbortSignal.timeout(25000)});
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    html = await response.text();
  } catch (error) {report.review.push({code: course.code, reason: String(error)}); continue;}
  if (!new RegExp(`"courseCode"\\s*:\\s*"${course.code}"`).test(html) || !/kan även läsas som fristående kurs|fristående kurs/i.test(html)) {
    report.review.push({code: course.code, reason: 'identity-or-standalone-unverified'}); continue;
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
  if (code !== course.code || !/^KAU-\d+$/.test(applicationCode) || !start.includes(season === 'HT' ? 'Hösttermin 20' : 'Vårtermin 20') || !new RegExp(`20${year}`).test(start) || !/^\d+%/.test(pace) || !period) {
    report.review.push({code: course.code, reason: 'incomplete-or-conflicting-round'}); continue;
  }
  const key = `karlstads-universitet|${code}|${term}|${applicationCode}`;
  if (byKey.has(key) || existing.some(x => x.university === 'Karlstads universitet' && x.courseCode === code && x.offeringTerm === term && x.applicationCode === applicationCode)) continue;
  byKey.set(key, {key, university: 'Karlstads universitet', courseCode: code, courseName: course.name, courseHp: Number(course.hp), offeringTerm: term, studyPace: pace, studyPacePercent: Number(pace.match(/^\d+/)[0]), studyLocation: form.match(/\(([^)]+)\)/)?.[1] || '', teachingForm: form, distance: /distans/i.test(form), partOfTerm: period, applicationCode, standaloneSearchable: true, source: 'karlstad-official-course-page', sourceUrl: url, checkedAt: report.checkedAt});
  report.added++;
}

if (report.added) {
  fs.writeFileSync(storage, JSON.stringify([...byKey.values()], null, 2) + '\n');
  db.tables.courseOfferings.rows = byKey.size;
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2) + '\n');
}
report.canonicalTotal = byKey.size;
fs.writeFileSync('data/import-reviews/kau-verified-offerings-latest.json', JSON.stringify(report, null, 2) + '\n');
console.log(report);
