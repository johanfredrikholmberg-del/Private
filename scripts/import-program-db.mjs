#!/usr/bin/env node
/**
 * StudieLots programme DB import/validation pipeline.
 *
 * Input: JSON with { programs:[...] } using the same normalized programme schema
 * as data/program-db*.json.
 *
 * Safe defaults:
 * - dry-run unless --write is supplied
 * - append-only: existing records are never removed or replaced
 * - conflicts/duplicates are reported and skipped
 * - atomic writes (temporary file + rename)
 * - post-merge integrity checks must pass before the destination is replaced
 *
 * Usage:
 *   node scripts/import-program-db.mjs candidates.json data/program-db-lund.json
 *   node scripts/import-program-db.mjs candidates.json data/program-db-lund.json --write
 */
import fs from 'node:fs';
import path from 'node:path';

const [,, candidatePath, dbPath, ...flags] = process.argv;
if (!candidatePath || !dbPath) {
  console.error('Usage: node scripts/import-program-db.mjs <candidates.json> <db.json> [--write]');
  process.exit(2);
}

const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const source = read(candidatePath);
const candidates = Array.isArray(source.programs) ? source.programs : [];
const db = read(dbPath);
const EPS = 0.01;

if (!Array.isArray(db.programs)) {
  console.error(`Refusing to continue: ${dbPath} does not contain a programs array.`);
  process.exit(2);
}

const stableKey = p => `${p.university || ''}|${p.programCode || ''}|${p.validFrom || ''}|${p.subject || ''}`;
const identityKey = p => `${p.university || ''}|${p.programCode || ''}|${p.validFrom || ''}`;

function validate(p) {
  const errors = [], warnings = [];
  if (!p || typeof p !== 'object') return { ok:false, errors:['invalid-record'], warnings:[], termHp:{}, total:0 };
  if (!p.id) errors.push('missing-id');
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
  if (Math.abs(expectedTerms * 30 - Number(p.programHp || 0)) > EPS) errors.push(`non-standard-program-hp:${p.programHp}`);
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

const originalPrograms = db.programs;
const originalCount = originalPrograms.length;
const existingStable = new Map(originalPrograms.map(p => [stableKey(p), p]));
const existingIds = new Set(originalPrograms.map(p => p.id).filter(Boolean));
const seenCandidateKeys = new Set();
const seenCandidateIds = new Set();

const accepted = [], review = [], duplicate = [], conflict = [];
for (const p of candidates) {
  const result = validate(p);
  const key = stableKey(p);

  if (seenCandidateKeys.has(key) || (p.id && seenCandidateIds.has(p.id))) {
    duplicate.push({ id:p.id, key, reason:'duplicate-inside-batch' });
    continue;
  }
  seenCandidateKeys.add(key);
  if (p.id) seenCandidateIds.add(p.id);

  const existing = existingStable.get(key);
  if (existing) {
    duplicate.push({ id:p.id, key, reason:'already-in-database' });
    continue;
  }
  if (p.id && existingIds.has(p.id)) {
    conflict.push({ id:p.id, key, reason:'id-collision' });
    continue;
  }
  if (!result.ok) {
    review.push({ id:p.id, programCode:p.programCode, programName:p.programName, ...result });
    continue;
  }
  accepted.push(p);
}

const mergedPrograms = [...originalPrograms, ...accepted];
const mergedKeys = mergedPrograms.map(stableKey);
const mergedIds = mergedPrograms.map(p => p.id).filter(Boolean);
const integrityErrors = [];
if (mergedPrograms.length !== originalCount + accepted.length) integrityErrors.push('record-count-mismatch');
if (mergedPrograms.length < originalCount) integrityErrors.push('destructive-record-loss');
if (new Set(mergedKeys).size !== mergedKeys.length) integrityErrors.push('duplicate-stable-key-after-merge');
if (new Set(mergedIds).size !== mergedIds.length) integrityErrors.push('duplicate-id-after-merge');
for (let i = 0; i < originalPrograms.length; i++) {
  if (JSON.stringify(originalPrograms[i]) !== JSON.stringify(mergedPrograms[i])) {
    integrityErrors.push(`existing-record-mutated:${originalPrograms[i]?.id || i}`);
    break;
  }
}

const report = {
  generatedAt:new Date().toISOString(),
  database:dbPath,
  existingBefore:originalCount,
  candidates:candidates.length,
  accepted:accepted.length,
  manualReview:review.length,
  duplicates:duplicate.length,
  conflicts:conflict.length,
  existingAfter:mergedPrograms.length,
  integrityOk:integrityErrors.length === 0,
  integrityErrors,
  review,
  duplicate,
  conflict
};
console.log(JSON.stringify(report, null, 2));

if (flags.includes('--write')) {
  if (integrityErrors.length) {
    console.error(`Refusing write: integrity checks failed: ${integrityErrors.join(', ')}`);
    process.exit(1);
  }
  if (conflict.length) {
    console.error(`Refusing write: ${conflict.length} identity conflict(s) require review.`);
    process.exit(1);
  }

  const out = { ...db, programs: mergedPrograms, generatedAt:new Date().toISOString().slice(0,10) };
  const dir = path.dirname(dbPath);
  const tmp = path.join(dir, `.${path.basename(dbPath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(out, null, 2) + '\n', { flag:'wx' });

  // Verify exactly what will replace the database before rename.
  const verify = read(tmp);
  if (!Array.isArray(verify.programs) || verify.programs.length !== mergedPrograms.length) {
    fs.rmSync(tmp, { force:true });
    console.error('Refusing write: temporary output verification failed.');
    process.exit(1);
  }
  if (verify.programs.length < originalCount) {
    fs.rmSync(tmp, { force:true });
    console.error('Refusing write: output would contain fewer records than the source database.');
    process.exit(1);
  }

  fs.renameSync(tmp, dbPath);
  console.error(`Safely merged ${accepted.length} validated programme structure(s): ${originalCount} -> ${mergedPrograms.length} records.`);
}
