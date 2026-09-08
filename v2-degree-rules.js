(()=>{'use strict';
const norm=v=>String(v??'').trim().toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const rules=[
{id:'gu-general-candidate',university:'Göteborgs universitet',kind:'candidate',totalHp:180,subjectHp:90,thesisHp:15,excludeAdvancedFromTotal:true,source:'gu-official',sourceUrl:'https://www.gu.se/samhallsvetenskap/studera-hos-oss/bygg-din-egen-examen',note:'Generella kandidatkrav: 180 hp, minst 90 hp med successiv fördjupning i huvudområdet och examensarbete om minst 15 hp. Vissa huvudområden kan ha ytterligare krav.'},
{id:'lu-fil-kandidatexamen',university:'Lunds universitet',kind:'candidate',totalHp:180,subjectHp:90,thesisHp:15,excludeAdvancedFromTotal:true,outsideSubjectHp:30,source:'lu-official',sourceUrl:'https://www.lu.se/node/716',note:'Filosofie kandidatexamen: 180 hp, minst 90 hp med successiv fördjupning i huvudområdet och minst 15 hp självständigt arbete. För samhällsvetenskapliga fakulteten och Campus Helsingborg krävs dessutom minst 30 hp utanför huvudområdet.'}
];
function universityMatch(rule,u){const a=norm(rule.university),b=norm(u);return a===b||(a.includes('goteborg')&&/(^|\s)gu(\s|$)/.test(b))||(a.includes('lund')&&/(^|\s)lu(\s|$)/.test(b))}
function get(university,subject,kind='candidate'){return rules.find(r=>r.kind===kind&&universityMatch(r,university))||null}
function evaluate(courses,{university,subject,kind='candidate'}={}){const rule=get(university,subject,kind),engine=window.StudieLotsV2?.engine;if(!rule||!engine)return null;const result=engine.evaluate(courses,{totalHp:rule.totalHp,subject,subjectHp:rule.subjectHp,thesisHp:rule.thesisHp,excludeAdvancedFromTotal:rule.excludeAdvancedFromTotal});return{rule,result,verified:true}}
window.StudieLotsV2=window.StudieLotsV2||{};window.StudieLotsV2.degreeRules=Object.freeze({rules,get,evaluate});
})();