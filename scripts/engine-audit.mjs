import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../studielots-v624.js', import.meta.url), 'utf8');

const checks = [
  ['canonicalPathResult assignments', /canonicalPathResult\s*=\s*function/g],
  ['evaluateUniversityProgramV2 assignments', /evaluateUniversityProgramV2\s*=\s*function/g],
  ['calc declarations', /function\s+calc\s*\(/g],
  ['mappedHp assignments', /mappedHp\s*=\s*/g],
  ['shouldUseV2 references', /shouldUseV2/g],
  ['legacy wrapper snapshots', /const\s+_[A-Za-z0-9]+(?:CanonicalPathResult|EvaluateUniversityProgramV2)/g],
];

console.log('StudieLots engine audit');
console.log('======================');
for (const [label, re] of checks) {
  const count = (app.match(re) || []).length;
  console.log(`${label}: ${count}`);
}

const suspicious = {
  canonicalPathResultOverrides: (app.match(/canonicalPathResult\s*=\s*function/g) || []).length,
  universityEvaluatorOverrides: (app.match(/evaluateUniversityProgramV2\s*=\s*function/g) || []).length,
};

console.log('\nAudit note: multiple runtime reassignments mean later patches can silently replace earlier calculation rules.');
console.log(JSON.stringify(suspicious, null, 2));
