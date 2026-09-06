import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../studielots-v624.js', import.meta.url), 'utf8');
const failures=[];
const check=(name,re,expect=1)=>{const n=(app.match(re)||[]).length;if(n<expect)failures.push(`${name}: expected >=${expect}, got ${n}`);else console.log(`PASS ${name}: ${n}`)};

console.log('StudieLots degree-engine invariants');
console.log('==================================');
check('single calc declaration',/function\s+calc\s*\(/g,1);
check('candidate audit exists',/function\s+candidateCourseAudit\s*\(/g,1);
check('advanced courses held for review',/Avancerad nivå[^\n]*kontrollera med lärosätet/g,1);
check('thesis subject reuse guard',/function\s+thesisReuseStatus\s*\(/g,1);
check('prior degree reuse guard',/function\s+priorDegreeReuseDecision\s*\(/g,1);
check('remaining uses strongest unmet requirement',/Math\.max\(totalMissing,subjectMissing,thesisMissing\)/g,1);
check('percentage capped at 100',/Math\.min\(100/g,1);

const calcCount=(app.match(/function\s+calc\s*\(/g)||[]).length;
if(calcCount!==1) failures.push(`calc must have exactly one declaration, got ${calcCount}`);
const canonicalOverrides=(app.match(/canonicalPathResult\s*=\s*function/g)||[]).length;
const evaluatorOverrides=(app.match(/evaluateUniversityProgramV2\s*=\s*function/g)||[]).length;
console.log(`INFO canonicalPathResult runtime overrides: ${canonicalOverrides}`);
console.log(`INFO evaluateUniversityProgramV2 runtime overrides: ${evaluatorOverrides}`);
if(canonicalOverrides>1) failures.push(`too many canonicalPathResult overrides: ${canonicalOverrides}`);
if(evaluatorOverrides>1) failures.push(`too many evaluateUniversityProgramV2 overrides: ${evaluatorOverrides}`);

if(failures.length){console.error('\nFAIL');for(const f of failures)console.error('- '+f);process.exit(1)}
console.log('\nPASS: degree engine invariants are intact.');
