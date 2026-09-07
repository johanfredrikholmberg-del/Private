import { readFile } from 'node:fs/promises';

const loader = await readFile(new URL('../studielots-runtime-v625.js', import.meta.url), 'utf8');
const core = await readFile(new URL('../studielots-v624.js', import.meta.url), 'utf8');

const required = [
  '/studielots-engine-owner-v722.js?v=722',
  "degreeEngine:'engine-owner-722'",
];
for (const token of required) {
  if (!loader.includes(token)) throw new Error(`Missing engine owner token: ${token}`);
}

const ownerIndex = loader.indexOf('/studielots-engine-owner-v722.js?v=722');
const coreIndex = loader.indexOf('/studielots-v624.js?v=624');
if (ownerIndex < coreIndex) throw new Error('Engine owner must load after the legacy core has completed its internal overrides.');

const riskyAfterOwner = [
  'canonicalPathResult',
  'evaluateUniversityProgramV2',
];
const loaderTail = loader.slice(ownerIndex);
for (const name of riskyAfterOwner) {
  const laterModuleHint = new RegExp(`script\\([^\\n]*${name}`, 'i');
  if (laterModuleHint.test(loaderTail)) throw new Error(`${name} appears to be patched after the engine owner.`);
}

const canonicalOverrides = (core.match(/canonicalPathResult\s*=\s*function/g) || []).length;
const evaluatorOverrides = (core.match(/evaluateUniversityProgramV2\s*=\s*function/g) || []).length;
console.log(JSON.stringify({
  ok: true,
  engineOwner: '722',
  legacyCoreOverrides: { canonicalPathResult: canonicalOverrides, evaluateUniversityProgramV2: evaluatorOverrides },
  note: 'Legacy overrides remain inside core, but runtime ownership is locked after core/official-source boot.'
}, null, 2));