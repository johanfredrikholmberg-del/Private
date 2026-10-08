#!/usr/bin/env node
// Import only KTH course rounds with an explicit date on the official course-memo page.
import fs from 'node:fs';

const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const dbPath = 'data/studielots-db/manifest.json';
const db = read(dbPath);
const storage = db.tables?.courseOfferings?.storage;
if (db.database !== 'StudieLots DB' || !String(storage || '').startsWith('data/studielots-db/')) throw Error('Unexpected canonical offerings storage');
const primary = read(storage);
const additional = (db.tables.courseOfferings.additionalStorages || []).map(read);
const existing = [primary, ...additional].flat();
if (!Array.isArray(primary)) throw Error('Canonical primary offering shard is not an array');
const manifestRowsBefore=Number(db.tables.courseOfferings.rows)||0;
if(existing.length!==manifestRowsBefore)console.warn(`Reconciling canonical offering count from stored rows: manifest=${manifestRowsBefore}, actual=${existing.length}`);
const courses = read('data/kth/courses.json').courses;
if (!Array.isArray(courses) || courses.length < 100) throw Error('Missing KTH catalogue');

const month = {Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12};
const byKey = new Map(existing.map(x => [x.key, x]));
const newRows = [];
const report = {checkedAt: new Date().toISOString(), source: 'kth-official-course-memo', catalogue: courses.length, fetched: 0, sourceFailures: [], noDatedRound: [], conflictingCredits: [], added: 0, total: existing.length};

async function check(course) {
  const code = String(course.code || '').toUpperCase();
  if (!/^[A-Z0-9]{5,7}$/.test(code) || !(Number(course.hp) > 0)) return {code, error: 'invalid-identity'};
  const url = `https://www.kth.se/kurs-pm/${code}/om-kurs-pm?l=en`;
  try {
    let response; for(let attempt=1;attempt<=3;attempt++){ try{ response=await fetch(url,{signal:AbortSignal.timeout(20000)}); break; }catch(error){ if(attempt===3)throw error; await new Promise(r=>setTimeout(r,attempt*1000)); } }
    if (!response.ok) return {code, error: `HTTP ${response.status}`};
    const html = await response.text();
    const heading = html.match(/id="page-sub-heading"[^>]*>\s*([\s\S]*?)<\/p>/i)?.[1]?.replace(/<[^>]*>/g, '').trim();
    if (!heading?.startsWith(`${code} `)) return {code, error: 'course-identity-missing'};
    const hp = Number(heading.match(/([\d.]+) credits\s*$/i)?.[1]);
    if (Math.abs(hp - Number(course.hp)) > 0.01) return {code, conflict: true};
    const sections = [...html.matchAll(/<h3>Course offerings starting (Autumn|Spring) (20\d{2})<\/h3>([\s\S]*?)(?=<h3>|<\/section>)/g)];
    const dates = new Set();
    for (const [, season, year, section] of sections) {
      for (const [, day, mon, datedYear] of section.matchAll(/<h4>[^<]*\(Start date (\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (20\d{2})\)<\/h4>/g)) {
        if (datedYear !== year) continue;
        const date = `${year}-${String(month[mon]).padStart(2, '0')}-${day.padStart(2, '0')}`;
        if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) continue;
        if ((season === 'Autumn' && month[mon] < 7) || (season === 'Spring' && month[mon] > 6)) continue;
        dates.add(`${season === 'Autumn' ? 'HT' : 'VT'}${year.slice(2)}|${date}`);
      }
    }
    return {code, url, dates: [...dates]};
  } catch (error) { return {code, error: String(error)}; }
}

const selected = courses.slice(0, Number(process.env.KTH_OFFERING_TEST_LIMIT) || courses.length);
for (let i = 0; i < selected.length; i += 8) {
  const results = await Promise.all(selected.slice(i, i + 8).map(check));
  for (const result of results) {
    if (result.error) { report.sourceFailures.push({code: result.code, reason: result.error}); continue; }
    report.fetched++;
    if (result.conflict) { report.conflictingCredits.push(result.code); continue; }
    if (!result.dates.length) { report.noDatedRound.push(result.code); continue; }
    const course = courses.find(c => c.code === result.code);
    for (const termDate of result.dates) {
      const [term, date] = termDate.split('|');
      const key = `kth|${result.code}|${term}|${date}`;
      if (byKey.has(key)) continue;
      const row = {key, university: 'KTH', courseCode: result.code, courseName: course.name, courseHp: Number(course.hp), offeringTerm: term, startDate: date, distance: null, standaloneSearchable: false, source: report.source, sourceUrl: result.url, checkedAt: report.checkedAt};
      byKey.set(key, row); newRows.push(row);
      report.added++;
    }
  }
}
if (!report.fetched) throw Error('No official KTH course pages were fetched; preserving canonical DB');
report.total = existing.length + newRows.length;
if (report.added) fs.writeFileSync(storage, JSON.stringify([...primary, ...newRows], null, 2) + '\n');
if (report.added || report.total !== manifestRowsBefore) {
  db.tables.courseOfferings.rows = report.total;
  db.generatedAt = report.checkedAt;
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n');
}
fs.mkdirSync('data/import-reviews', {recursive: true});
fs.writeFileSync('data/import-reviews/kth-dated-offerings.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({...report, sourceFailures: report.sourceFailures.length, noDatedRound: report.noDatedRound.length, conflictingCredits: report.conflictingCredits.length}));

// Resume official KTH dated course offering refresh 2026-10-08.
