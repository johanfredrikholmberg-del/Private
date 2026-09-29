const assert=require('node:assert/strict');
const {describe,summarize}=require('../src/features/planner/evidence-model.js');

const rows=[
 {hp:15,credited:true,matchedCourse:'Tidigare grundkurs'},
 {hp:15,creditTransfer:{classification:'strong',reasons:['Samma lärandemål'],evidence:{historical:{verifiedApprovalCount:2,decisionIds:['RE1','RE2']}}},creditTransferCountsInStudyPlan:true,creditTransferMatchedHp:12,creditTransferMatchedCourse:'Tidigare statistik'},
 {hp:15,creditTransfer:{classification:'relevant',evidence:{historical:{verifiedApprovalCount:1,decisionIds:['RE2']}}},creditTransferCountsInStudyPlan:true,creditTransferMatchedHp:15},
 {hp:15,creditTransfer:{classification:'limited',evidence:{historical:{verifiedApprovalCount:3,decisionIds:[]}}},creditTransferCountsInStudyPlan:false}
];
assert.equal(describe(rows[0]).matchedHp,15);
assert.equal(describe(rows[1]).matchedHp,12);
assert.deepEqual(describe(rows[1]).reasons,['Samma lärandemål']);
assert.equal(describe(rows[2]).matchedHp,15);
assert.equal(describe(rows[3]).historicalIds.length,0);
assert.deepEqual(summarize(rows),{direct:1,strong:1,relevant:1,limited:1,matched:4,historicalApprovals:2});
console.log('Evidence model: assessment labels, credited hp and unique historical decisions OK');
