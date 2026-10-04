#!/usr/bin/env node
// Materialize only officially confirmed Karlstad standalone course rounds.
import fs from 'node:fs';
import {datesFromKarlstadWeeks} from './kau-offering-week-dates.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const dbFile = 'data/studielots-db/manifest.json';
const db = read(dbFile);
const storage = db.tables?.courseOfferings?.storage;
if (db.database !== 'StudieLots DB' || !String(storage || '').startsWith('data/studielots-db/')) throw Error('Unexpected canonical offering storage');
const primary = read(storage);
const additional = (db.tables.courseOfferings.additionalStorages || []).map(read);
const existing = [primary, ...additional].flat();
if (!Array.isArray(primary) || existing.length !== db.tables.courseOfferings.rows) throw Error('Canonical offering count mismatch');
let backfilledDates = 0;
const datedExisting = primary.map(row => {
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
  .map(x => [x.code, x])).values()].slice(Number(process.env.KAU_OFFERING_OFFSET || 0), Number(process.env.KAU_OFFERING_OFFSET || 0) + Number(process.env.KAU_OFFERING_BATCH_SIZE || 35));
const byKey = new Map(existing.map(x => [x.key, x]));
for (const row of datedExisting) byKey.set(row.key, row);
const newRows = [];
const report = {checkedAt: new Date().toISOString(), candidates: catalogue.length, added: 0, backfilledDates, rateLimited: false, review: []};
const text = html => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

courseLoop: for (const course of catalogue) {
  await pause(800);
  const url = `https://www.kau.se/utbildning/program-och-kurser/kurser/${course.code}`;
  if (!/^https:\/\/www\.kau\.se\/utbildning\/program-och-kurser\/kurser\/[A-Z0-9]+$/.test(url)) {
    report.review.push({code: course.code, reason: 'invalid-official-url'}); continue;
  }
  let html;
  try {
    const response = await fetch(url, {signal: AbortSignal.timeout(25000)});
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    html = await response.text();
  } catch (error) {
    report.review.push({code: course.code, reason: String(error)});
    if (String(error).includes('HTTP 429')) {report.rateLimited = true; break;}
    continue;
  }
  if (!new RegExp(`"courseCode"\\s*:\\s*"${course.code}"`).test(html)) {
    report.review.push({code: course.code, reason: 'identity-unverified'}); continue;
  }
  const officialHp = Number(html.match(/"name"\s*:\s*"[^"]+?\s+(\d+(?:\.\d+)?)\s+HP"/)?.[1]);
  if (!(officialHp > 0) || Math.abs(officialHp - Number(course.hp)) > 0.01) {
    report.review.push({code: course.code, reason: 'official-hp-mismatch'}); continue;
  }
  const tabs = [...html.matchAll(/href="\?occasion=(\d+)"[^>]*>\s*(HT|VT)-(\d{2})/g)]
    .filter(([, , season, year]) => ['HT26', 'VT27'].includes(`${season}${year}`));
  if (!tabs.length) {report.review.push({code: course.code, reason: 'no-target-round'}); continue;}
  for (const [, occasion, season, year] of tabs) {
    const term = `${season}${year}`;
    const roundUrl = `${url}?occasion=${occasion}`;
    let roundHtml = html;
    if (tabs.length !== 1 || !new RegExp(`href="\\?occasion=${occasion}"[^>]*bg-yellow`).test(html)) {
      try {
        await pause(800);
        const response = await fetch(roundUrl, {signal: AbortSignal.timeout(25000)});
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        roundHtml = await response.text();
      } catch (error) {
        report.review.push({code: course.code, occasion, reason: String(error)});
        if (String(error).includes('HTTP 429')) {report.rateLimited = true; break courseLoop;}
        continue;
      }
    }
    const active = [...roundHtml.matchAll(/href="\?occasion=(\d+)"([^>]*)>\s*(HT|VT)-(\d{2})/g)]
      .find(([, id]) => id === occasion);
    if (!active || !active[2].includes('bg-yellow') || active[3] !== season || active[4] !== year) {
      report.review.push({code: course.code, occasion, reason: 'round-selection-unverified'}); continue;
    }
    const end = roundHtml.indexOf('Till anmälan', active.index);
    if (end < 0) {report.review.push({code: course.code, occasion, reason: 'application-link-missing'}); continue;}
    const details = roundHtml.slice(active.index, end);
    const field = label => text(details.match(new RegExp(`<span[^>]*>${label}<\\/span>\\s*<span[^>]*>([\\s\\S]*?)<\\/span>`, 'i'))?.[1] || '');
    const code = field('Kurskod'), applicationCode = field('Anmälningskod');
    const start = field('Start'), form = field('Studieform'), pace = field('Studietakt'), period = field('Studieperiod');
    const directApplication = new RegExp(`https://www\\.antagning\\.se/se/addtobasket\\?id=${applicationCode}&amp;period=${season}_20${year}`).test(details);
    if (code !== course.code || applicationCode !== `KAU-${occasion}` || !directApplication || !start.includes(season === 'HT' ? 'Hösttermin 20' : 'Vårtermin 20') || !new RegExp(`20${year}`).test(start) || !/^\d+%/.test(pace) || !period || !form) {
      report.review.push({code: course.code, occasion, reason: 'incomplete-or-conflicting-round'}); continue;
    }
    const dates = datesFromKarlstadWeeks(period, term);
    if (!dates) {report.review.push({code: course.code, occasion, reason: 'invalid-week-period'}); continue;}
    const key = `karlstads-universitet|${code}|${term}|${applicationCode}`;
    if (byKey.has(key)) continue;
    const row = {key, university: 'Karlstads universitet', courseCode: code, courseName: course.name, courseHp: Number(course.hp), offeringTerm: term, ...dates, studyPace: pace, studyPacePercent: Number(pace.match(/^\d+/)[0]), studyLocation: form.match(/\(([^)]+)\)/)?.[1] || '', teachingForm: form, distance: /distans/i.test(form), partOfTerm: period, applicationCode, standaloneSearchable: true, source: 'karlstad-official-course-page', sourceUrl: roundUrl, checkedAt: report.checkedAt};
    byKey.set(key, row); newRows.push(row);
    report.added++;
  }
}

if (report.added || backfilledDates) {
  fs.writeFileSync(storage, JSON.stringify([...datedExisting, ...newRows], null, 2) + '\n');
  db.tables.courseOfferings.rows = existing.length + report.added;
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2) + '\n');
}
report.canonicalTotal = existing.length + report.added;
fs.writeFileSync('data/import-reviews/kau-verified-offerings-latest.json', JSON.stringify(report, null, 2) + '\n');
console.log(report);
