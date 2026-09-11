#!/usr/bin/env node
/**
 * StudieLots programme DB import/validation pipeline.
 *
 * Input: JSON with { programs:[...] } using the same normalized programme schema
 * as data/program-db*.json. This script is intentionally offline: university/SUSA
 * parsers can write candidates, then this gate validates them before merge.
 *
 * Usage:
 *   node scripts/import-program-db.mjs candidates.json data/program-db-lund.json
 *   node scripts/import-program-db.mjs candidates.json data/program-db-lund.json --write
 */
import fs from 'node:fs';

const [,, candidatePath, dbPath, ...flags] = process.argv;
if (!candidatePath || !dbPath) {
  console.error('Usage: node scripts/import-program-db.mjs <candidates.json> <db.json> [--write]');
  process.exit(2);
}

const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const candidates = read(candidatePath).programs || [];
const db = read(dbPath);
const EPS = 0.01;

function validate(p) {
  const errors = [], warnings = [];
  if (!p.university) errors.push('missing-university');
  if (!p.programCode) errors.push('missing-program-code');
  if (!p.programName) errors.push('missing-program-name');
  if (!(Number(p.programHp) > 0)) errors.push('missing-program-hp');
  if (!p.validFrom) errors.push('missing-valid-from');
  if (!Array.isArray(p.sourceUrls) || !p.sourceUrls.length) errors.push('missing-source-url');
  if (!Array.isArray(p.rows) || !p.rows.length) errors.push('missing-rows');

  const termHp = new Map();
  for (const r of p.rows || []) {
    const term = Number(r.term), hp = Number(r.hp);
    if (!(term > 0)) errors.push('invalid-term');
    if (!(hp > 0)) errors.push(`invalid-hp:t${r.term ?? '?'}`);
    if (term > 0 && hp > 0) termHp.set(term, (termHp.get(term) || 0) + hp);
    if (r.isSlot && !r.slotType) warnings.push(`slot-without-type:t${term}`);
  }

  const expectedTerms = Math.round(Number(p.programHp || 0) / 30);
  for (let t = 1; t <= expectedTerms; t++) {
    const hp = termHp.get(t) || 0;
    if (Math.abs(hp - 30) > EPS) errors.push(`term-hp:t${t}:${hp}`);
  }
  for (const [t, hp] of termHp) if (t > expectedTerms) errors.push(`unexpected-term:t${t}:${hp}`);

  const total = [...termHp.values()].reduce((a,b)=>a+b,0);
  if (Math.abs(total - Number(p.programHp || 0)) > EPS) errors.push(`program-hp:${total}/${p.programHp}`);

  const hasThesis = (p.rows || []).some(r => r.isThesis || Number(r.includesThesisHp) > 0 || /examensarbete|kandidatkurs|master thesis|degree project/i.test(r.name || ''));
  if (!hasThesis) warnings.push('no-thesis-marker');

  return { ok: errors.length === 0, errors:[...new Set(errors)], warnings:[...new Set(warnings)], termHp:Object.fromEntries(termHp), total };
}

const existingKey = new Set((db.programs || []).map(p => `${p.university}|${p.programCode}|${p.validFrom}|${p.subject || ''}`));
const accepted = [], review = [], duplicate = [];
for (const p of candidates) {
  const result = validate(p);
  const key = `${p.university}|${p.programCode}|${p.validFrom}|${p.subject || ''}`;
  if (existingKey.has(key)) duplicate.push({ id:p.id, key });
  else if (result.ok) accepted.push(p);
  else review.push({ id:p.id, programCode:p.programCode, programName:p.programName, ...result });
}

const report = {
  generatedAt:new Date().toISOString(),
  candidates:candidates.length,
  accepted:accepted.length,
  manualReview:review.length,
  duplicates:duplicate.length,
  review,
  duplicate
};
console.log(JSON.stringify(report, null, 2));

if (flags.includes('--write')) {
  db.programs = [...accepted, ...(db.programs || [])];
  db.generatedAt = new Date().toISOString().slice(0,10);
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n');
  console.error(`Merged ${accepted.length} validated programme structures into ${dbPath}`);
}
