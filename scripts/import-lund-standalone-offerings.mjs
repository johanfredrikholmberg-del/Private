#!/usr/bin/env node
/** Import verified Lund standalone offerings without creating duplicate course definitions. */
import fs from 'node:fs/promises';

const read = async path => JSON.parse(await fs.readFile(path, 'utf8'));
const write = async (path, value) => fs.writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
const clean = value => String(value ?? '').normalize('NFKC').trim();
const code = value => clean(value).toUpperCase().replace(/\s+/g, '');
const officialLund = value => {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === 'lu.se' || host.endsWith('.lu.se') || host === 'lunduniversity.lu.se' || host.endsWith('.lunduniversity.lu.se');
  } catch { return false; }
};
const validApplicationUrl = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (officialLund(value) || url.hostname === 'www.antagning.se' || url.hostname === 'www.universityadmissions.se');
  } catch { return false; }
};

const candidates = await read('data/lund-standalone-ht26-candidates.json');
const courses = await read('data/HT26/courses.json');
const offerings = await read('data/HT26/course-offerings.json');
const manifest = await read('data/HT26/manifest.json');
if (!Array.isArray(candidates) || !Array.isArray(courses) || !Array.isArray(offerings)) throw Error('Ogiltiga kanoniska tabeller.');
if (manifest.canonical !== true || manifest.term !== 'HT26' || offerings.length !== manifest.tables?.courseOfferings?.rows) throw Error('Manifest och kurstillfällen är inkonsekventa.');

const lundCourses = new Map(courses.filter(item => clean(item.university) === 'Lunds universitet' && code(item.courseCode || item.code)).map(item => [code(item.courseCode || item.code), item]));
const imported = [];
for (const item of candidates) {
  const id = code(item.courseCode);
  const canonical = lundCourses.get(id);
  const hp = Number(item.hp);
  if (!canonical) throw Error(`${id}: kanonisk Lund-kurs saknas.`);
  if (Math.abs(Number(canonical.courseHp ?? canonical.hp) - hp) > 0.001) throw Error(`${id}: hp avviker från kanonisk kurs.`);
  if (item.standalone !== true || item.verifiedOffering !== true || item.term !== 'HT26') throw Error(`${id}: fristående HT26-tillfälle är inte verifierat.`);
  if (!officialLund(item.sourceUrl) || !officialLund(item.offeringSourceUrl) || !validApplicationUrl(item.applicationUrl)) throw Error(`${id}: officiell källa eller ansökningslänk saknas.`);
  if (!/^2026-\d{2}-\d{2}$/.test(item.startDate) || !/^202[67]-\d{2}-\d{2}$/.test(item.endDate) || Date.parse(item.endDate) < Date.parse(item.startDate)) throw Error(`${id}: ogiltiga kursdatum.`);
  const applicationCode = clean(item.applicationCode);
  const key = `lunds-universitet|${id}|HT26|${applicationCode || item.startDate}`;
  const record = {
    key,
    university: 'Lunds universitet',
    courseCode: id,
    courseName: clean(canonical.courseName || canonical.name),
    courseHp: hp,
    offeringTerm: 'HT26',
    termHeading: 'Höst 2026',
    startDate: item.startDate,
    endDate: item.endDate,
    studyPace: `${Number(item.studyPacePercent)}%`,
    studyPacePercent: Number(item.studyPacePercent),
    teachingTime: '',
    studyLocation: clean(item.studyLocation),
    teachingForm: clean(item.teachingForm),
    distance: false,
    teachingLanguage: clean(item.teachingLanguage),
    partOfTerm: '',
    applicationStart: '',
    applicationEnd: '',
    applicationCode,
    applicationStatus: clean(item.applicationStatus),
    standaloneSearchable: true,
    url: item.applicationUrl,
    source: 'lund-official-course-page',
    sourceUrl: item.offeringSourceUrl,
    sourceUrls: [...new Set([item.sourceUrl, item.offeringSourceUrl, item.applicationUrl])],
    applicationNote: clean(item.applicationNote),
    checkedAt: '2026-09-22T00:00:00.000Z',
  };
  const sameIdentity = offerings.findIndex(existing => clean(existing.university) === 'Lunds universitet' && code(existing.courseCode) === id && clean(existing.offeringTerm) === 'HT26' && clean(existing.applicationCode) === applicationCode && clean(existing.startDate) === item.startDate);
  if (sameIdentity >= 0) offerings[sameIdentity] = { ...offerings[sameIdentity], ...record };
  else offerings.push(record);
  imported.push({ code: id, action: sameIdentity >= 0 ? 'updated' : 'added', key, applicationStatus: record.applicationStatus });
}

offerings.sort((a, b) => clean(a.university).localeCompare(clean(b.university), 'sv') || code(a.courseCode).localeCompare(code(b.courseCode), 'sv') || clean(a.startDate).localeCompare(clean(b.startDate)));
manifest.tables.courseOfferings.rows = offerings.length;
manifest.generatedAt = new Date().toISOString();
const report = { generatedAt: new Date().toISOString(), scope: 'Lunds universitet', canonicalCourseDefinitionsCreated: 0, verifiedStandaloneOfferings: imported.length, imported };
await write('data/HT26/course-offerings.json', offerings);
await write('data/HT26/manifest.json', manifest);
await write('data/import-reviews/lund-standalone-offerings-latest.json', report);
console.log(JSON.stringify(report, null, 2));
