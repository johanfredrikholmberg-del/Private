import assert from 'node:assert/strict';
import {normalizeResponse} from '../api/distance-courses.js';

const fixture={educationEvents:[
  {title:'Företagsekonomi A',provider:{name:'Testuniversitetet'},courseCode:'FEK101',credits:30,studyForm:'Distans',startDate:'2099-08-20',informationUrl:'https://example.test/fek'},
  {title:'Företagsekonomi B',provider:{name:'Campusuniversitetet'},courseCode:'FEK201',credits:30,studyForm:'Campus',startDate:'2099-08-20'},
  {title:'Historia A',provider:{name:'Testuniversitetet'},courseCode:'HI101',credits:30,studyForm:'Distans',startDate:'2099-08-20'},
  {title:'Företagsekonomi utan poäng',provider:{name:'Testuniversitetet'},studyForm:'Distans',startDate:'2099-08-20'}
]};
const courses=normalizeResponse(fixture,'Företagsekonomi');
assert.equal(courses.length,1);
assert.equal(courses[0].name,'Företagsekonomi A');
assert.equal(courses[0].distance,true);
assert.equal(courses[0].verified,true);
assert.equal(courses[0].hp,30);
assert.equal(courses[0].university,'Testuniversitetet');
console.log('Distance API normalization test passed');
