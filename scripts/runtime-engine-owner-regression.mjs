import { readFile } from 'node:fs/promises';

const loader = await readFile(new URL('../studielots-runtime-v625.js', import.meta.url), 'utf8');
const core = await readFile(new URL('../studielots-v624.js', import.meta.url), 'utf8');
const owner = await readFile(new URL('../studielots-engine-owner-v722.js', import.meta.url), 'utf8');

const required = [
  '/studielots-engine-owner-v722.js?v=725',
  "degreeEngine:'engine-owner-725'",
  'shadowMode:{degreeEngine:true}',
];
for (const token of required) {
  if (!loader.includes(token)) throw new Error(`Missing engine owner token: ${token}`);
}

const ownerIndex = loader.indexOf('/studielots-engine-owner-v722.js?v=725');
const coreIndex = loader.indexOf('/studielots-v624.js?v=624');
if (ownerIndex < coreIndex) throw new Error('Engine owner must load after the legacy core has completed its internal overrides.');
if (!owner.includes("const VERSION='725'")) throw new Error('Engine owner is not v725.');
if (!owner.includes('studielots_engine_shadow_v725')) throw new Error('Shadow comparison storage is missing.');
if (!owner.includes('return result')) throw new Error('Shadow wrapper must preserve legacy return values.');

const canonicalOverrides = (core.match(/canonicalPathResult\s*=\s*function/g) || []).length;
const evaluatorOverrides = (core.match(/evaluateUniversityProgramV2\s*=\s*function/g) || []).length;
console.log(JSON.stringify({
  ok: true,
  engineOwner: '725',
  shadowMode: true,
  legacyCoreOverrides: { canonicalPathResult: canonicalOverrides, evaluateUniversityProgramV2: evaluatorOverrides },
  note: 'Legacy results remain authoritative while the pure engine runs in shadow mode and records comparable hp deltas.'
}, null, 2));