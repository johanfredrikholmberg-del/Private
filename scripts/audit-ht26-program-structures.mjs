#!/usr/bin/env node
/** Read-only audit of the canonical HT26 programme structures. Never modifies import data. */
import fs from 'node:fs/promises';

const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const text = value => String(value ?? '').trim();
const norm = value => text(value).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const number = value => Number(String(value ?? '').replace(',', '.'));
const round = value => Math.round(value * 10) / 10;
const programmeCode = p => text(p.programCode || p.code).toUpperCase();
const programmeName = p => text(p.programName || p.name || p.title);
const programmeHp = p => number(p.programHp ?? p.hp ?? p.credits);
const identity = p => `${norm(p.university || p.providerName || p.provider)}|${programmeCode(p) || norm(programmeName(p))}`;
const issue = (category, p, details = {}) => ({ category, university: text(p.university), programCode: programmeCode(p), programName: programmeName(p), ...details });

const [programs, structures, courses] = await Promise.all([
  read('data/HT26/programs.json'),
  read('data/HT26/program-structures.json'),
  read('data/HT26/courses.json')
]);
if (![programs, structures, courses].every(Array.isArray)) throw new Error('Canonical HT26 input is not an array');
const courseKeys = new Set(courses.map(c => `${norm(c.university)}|${text(c.courseCode || c.code).toUpperCase()}`));
const byProgram = new Map();
for (const p of programs) {
  const key = identity(p);
  if (!byProgram.has(key)) byProgram.set(key, []);
  byProgram.get(key).push(p);
}
const byStructure = new Map();
for (const s of structures) {
  const key = identity(s);
  if (!byStructure.has(key)) byStructure.set(key, []);
  byStructure.get(key).push(s);
}
const findings = [];
for (const [key, matches] of byProgram) {
  if (matches.length > 1) findings.push(issue('duplicate-programme-identity', matches[0], { count: matches.length }));
  if (!byStructure.has(key)) findings.push(issue('missing-programme-structure', matches[0]));
}
for (const [key, matches] of byStructure) {
  if (matches.length > 1) findings.push(issue('duplicate-structure-identity', matches[0], { count: matches.length }));
  if (!byProgram.has(key)) findings.push(issue('orphan-programme-structure', matches[0]));
  for (const s of matches) {
    const rows = Array.isArray(s.rows) ? s.rows : [];
    const coverage = text(s.coverage);
    const hp = programmeHp(s) || programmeHp(byProgram.get(key)?.[0] || {});
    const expectedTerms = Number(s.expectedTerms) || (hp > 0 ? Math.ceil(hp / 30) : 0);
    if (!rows.length) findings.push(issue('no-term-course-rows', s, { coverage }));
    if (['complete', 'choice-required'].includes(coverage) && !rows.length) findings.push(issue('complete-status-without-rows', s, { coverage }));
    const grouped = new Map();
    for (const row of rows) {
      const term = Number(row.term);
      const rowHp = number(row.hp ?? row.courseHp);
      if (!Number.isInteger(term) || term < 1 || (expectedTerms > 0 && term > expectedTerms)) findings.push(issue('invalid-term-number', s, { term: row.term, courseCode: row.code || row.courseCode }));
      if (!Number.isFinite(rowHp) || rowHp <= 0) findings.push(issue('invalid-course-hp', s, { term: row.term, courseCode: row.code || row.courseCode, hp: row.hp }));
      if (Number.isInteger(term) && term > 0 && Number.isFinite(rowHp) && rowHp > 0) {
        if (!grouped.has(term)) grouped.set(term, []);
        grouped.get(term).push(row);
      }
      const code = text(row.code || row.courseCode).toUpperCase();
      if (code && !row.isSlot && !courseKeys.has(`${norm(s.university)}|${code}`)) findings.push(issue('course-code-not-in-canonical-catalogue', s, { term: row.term, courseCode: code }));
    }
    if (['complete', 'choice-required'].includes(coverage) && expectedTerms > 0) {
      for (let term = 1; term <= expectedTerms; term++) {
        const termRows = grouped.get(term) || [];
        if (!termRows.length) { findings.push(issue('missing-term-in-complete-structure', s, { term })); continue; }
        const required = termRows.filter(r => !r.isSlot && r.type !== 'choice' && r.category !== 'elective');
        const slots = termRows.filter(r => r.isSlot || r.slotType === 'elective-slot');
        const actual = round([...required, ...slots].reduce((sum, r) => sum + number(r.hp ?? r.courseHp), 0));
        const target = hp > 0 ? round(Math.min(30, hp - 30 * (term - 1))) : 30;
        if (target > 0 && Math.abs(actual - target) > 0.2) findings.push(issue('term-hp-mismatch', s, { term, actualHp: actual, expectedHp: target }));
      }
    }
  }
}
const counts = Object.fromEntries([...new Set(findings.map(f => f.category))].sort().map(category => [category, findings.filter(f => f.category === category).length]));
const report = { database: 'StudieLots HT26', audit: 'read-only-programme-structure-quality', generatedAt: new Date().toISOString(), input: { programs: programs.length, structures: structures.length, courses: courses.length }, counts, totalFindings: findings.length, findings };
console.log(JSON.stringify(report, null, 2));
if (process.env.AUDIT_STRICT === '1' && findings.length) process.exitCode = 1;
