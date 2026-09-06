import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const fixture = JSON.parse(await readFile(new URL('../tests/fixtures/ladok-national-regression-01.json', import.meta.url), 'utf8'));

const courses = fixture.courses || [];
const totalHp = courses.reduce((sum, c) => sum + Number(c.hp || 0), 0);
const institutions = new Set(courses.map(c => c.institution).filter(Boolean));

assert.equal(courses.length, fixture.expected.courseCount, 'course count changed');
assert.equal(totalHp, fixture.expected.totalHp, 'total hp changed');
assert.equal(institutions.size, fixture.expected.institutionCount, 'institution count changed');
assert.equal(fixture.expected.issuedDegrees.length, 1, 'issued degree baseline changed');
assert.equal(fixture.expected.issuedDegrees[0].subject, 'Idrottsvetenskap');
assert.equal(fixture.expected.issuedDegrees[0].hp, 180);
assert.equal(courses.filter(c => c.thesis).length, 1, 'thesis baseline changed');
assert.equal(courses.find(c => c.code === 'IKG246')?.name, 'Hälsofrämjande arbete - pedagogiska och psykologiska perspektiv', 'multiline course name was not preserved');
assert.equal(courses.find(c => c.code === 'FÖ118G')?.name, 'Företagsekonomi GR (A), Organisation och ledarskap', 'second multiline course name was not preserved');

for (const c of courses) {
  assert.ok(c.code, 'every regression course must keep a course code');
  assert.ok(c.name, `missing name for ${c.code}`);
  assert.ok(Number(c.hp) > 0, `invalid hp for ${c.code}`);
  assert.ok(c.institution, `missing institution for ${c.code}`);
}

assert.equal(fixture.engineExpectations.doNotInferExactDegreeMembership, true);
assert.equal(fixture.engineExpectations.doNotReuseSameBachelorThesisAsAnotherMainFieldThesis, true);
assert.equal(fixture.engineExpectations.doNotInferCourseLevelFromCertificateWhenLevelIsAbsent, true);
assert.equal(fixture.engineExpectations.singleHpAuthorityRequired, true);

console.log('Ladok regression fixture passed');
console.log({ courses: courses.length, totalHp, institutions: institutions.size, issuedDegree: fixture.expected.issuedDegrees[0] });
