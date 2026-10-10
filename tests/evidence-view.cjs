const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const model=require('../src/features/planner/evidence-model.js');
const nodes={};
function node(){return {hidden:false,innerHTML:'',children:[],querySelector(selector){return selector==='.evidence-course-link'?this.children.find(x=>x.className==='evidence-course-link'):null},append(child){this.children.push(child)},scrollIntoView(){}}}
nodes['#evidenceEntry']=node();nodes['#evidencePanel']=node();
nodes['.route-switch']=node();nodes['#ordinaryPlan']=node();nodes['#fastPlan']=node();
const cards=[node(),node()];
const planner={querySelector(selector){return nodes[selector]},querySelectorAll(selector){return selector==='#ordinaryPlan .course'?cards:[]},addEventListener(){}};
const data={item:{programName:'Program',university:'Lärosäte'},rows:[
 {name:'Stark kurs',hp:15,term:1,creditTransferCountsInStudyPlan:true,creditTransferMatchedHp:15,creditTransferMatchedCourse:'Tidigare kurs',creditTransfer:{classification:'strong',reasons:['Innehållet överlappar'],evidence:{historical:{verifiedApprovalCount:1,decisionIds:['RE1']}}}},
 {name:'Relevant kurs',hp:15,term:2,creditTransferCountsInStudyPlan:false,creditTransfer:{classification:'relevant'}}
]};
const root={appContext:{state:{plannerData:data}},planner:{route(){}}};
const context={window:{StudieLotsV2:root,StudieLotsEvidenceModel:model,StudieLotsEngines:{creditTransferHistory:{decisions:[{id:'RE1',sourceName:'Tidigare kurs',targetName:'Stark kurs',university:'Testuniversitet'}]}},addEventListener(){}},document:{querySelector(){return planner},createElement(){return {dataset:{},remove(){}}}},Element:class{}};
vm.runInNewContext(fs.readFileSync(require.resolve('../src/features/planner/evidence-view.js'),'utf8'),context);
root.evidenceView.render(data);
assert.match(nodes['#evidenceEntry'].innerHTML,/1 stark kursmatchning · 1 tidigare bifall/);
assert.match(nodes['#evidencePanel'].innerHTML,/beslutsdatum saknas i datan · 1 bifall · RE1/);
assert.match(nodes['#evidencePanel'].innerHTML,/Stark kurs/);
assert.doesNotMatch(nodes['#evidencePanel'].innerHTML,/Relevant kurs/);
assert.equal(cards[0].children.length,1);
assert.equal(cards[1].children.length,0);
root.evidenceView.show(0);
assert.equal(nodes['#evidencePanel'].hidden,false);
assert.equal(nodes['#evidenceEntry'].hidden,false);
assert.equal(nodes['.route-switch'].hidden,false);
assert.equal(nodes['#ordinaryPlan'].hidden,false);
assert.match(nodes['#evidenceEntry'].innerHTML,/aria-expanded="true"/);
root.evidenceView.close();
assert.equal(nodes['#evidencePanel'].hidden,true);
data.rows[0].creditTransfer.evidence.historical={verifiedApprovalCount:0,decisionIds:[]};
root.evidenceView.render(data);
assert.match(nodes['#evidenceEntry'].innerHTML,/0 tidigare bifall/);
assert.match(nodes['#evidencePanel'].innerHTML,/Inga verifierade bifall matchar/);
console.log('Evidence view: only strong rows and explicit historical decisions OK');
