(()=>{'use strict';
const root=window.StudieLotsV2=window.StudieLotsV2||{},base=root.paths;if(!base)return;
const clean=v=>String(v??'').trim(),norm=v=>clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,''),code=v=>clean(v).toUpperCase().replace(/[^A-Z0-9ÅÄÖ]/g,''),hp=v=>Number(v?.hp??v?.credits??v?.ects??0)||0;
const stop=new Set('kurs course grundkurs fortsättningskurs introduktion till och i av för med samt inom om grundnivå avancerad nivå hp ects gr a b c d'.split(' '));
const conceptGroups=[
 ['organisation','organisations','ledarskap','ledning','management'],
 ['marknadsföring','marketing'],
 ['redovisning','externredovisning','accounting'],
 ['ekonomistyrning','managementaccounting','controlling'],
 ['finansiering','finans','finance','financial'],
 ['mikroekonomi','microeconomics','microeconomic'],
 ['makroekonomi','macroeconomics','macroeconomic'],
 ['statistik','statistics','statistical'],
 ['handelsrätt','affärsjuridik','businesslaw','commerciallaw'],
 ['psykologi','psychology'],
 ['pedagogik','education'],
 ['metod','method','methods','methodology']
];
function words(v){return norm(v).replace(/[^a-zåäö0-9]+/g,' ').split(/\s+/).filter(x=>x.length>2&&!stop.has(x))}
function compact(v){return norm(v).replace(/[^a-zåäö0-9]+/g,'')}
function conceptSet(v){const n=norm(v),c=compact(v),out=new Set();conceptGroups.forEach((g,i)=>{if(g.some(x=>n.includes(x)||c.includes(x.replace(/[^a-zåäö0-9]+/g,''))))out.add(i)});return out}
function tokenLike(a,b){if(a===b)return true;const shorter=a.length<=b.length?a:b,longer=a.length<=b.length?b:a;return shorter.length>=6&&longer.startsWith(shorter)}
function overlap(a,b){const used=new Set();let common=0;for(const x of a){const i=b.findIndex((y,j)=>!used.has(j)&&tokenLike(x,y));if(i<0)continue;used.add(i);common++}return common}
function subjectKey(v){const n=norm(v);if(/företagsekonomi|business administration|marketing|marknadsföring|redovisning|finansiering|organisation|ledning/.test(n))return'företagsekonomi';if(/nationalekonomi|economics|mikroekonomi|makroekonomi/.test(n))return'nationalekonomi';if(/statistik|statistics/.test(n))return'statistik';if(/handelsrätt|juridik|business law|commercial law/.test(n))return'juridik';if(/psykologi|psychology/.test(n))return'psykologi';if(/pedagogik|education/.test(n))return'pedagogik';if(/idrottsvetenskap|sport science/.test(n))return'idrottsvetenskap';return n}
function rowSubject(row,programmeSubject=''){const explicit=subjectKey(row?.subject||'');if(explicit)return explicit;const byName=subjectKey(row?.name||'');if(byName&&byName!==norm(row?.name||''))return byName;const optionText=(row?.options||[]).map(x=>x?.name).join(' '),option=subjectKey(optionText);if(option&&option!==norm(optionText))return option;if(/huvudområde|huvudomrade/i.test(`${row?.name||''} ${optionText}`))return subjectKey(programmeSubject);return''}
function meritSubject(c){return subjectKey(c?.subject||c?.subjectName||c?.name||'')}
function semanticScore(row,course){const rn=norm(row?.name),cn=norm(course?.name);if(!rn||!cn)return 0;if(rn===cn)return 1;const rw=[...new Set(words(rn))],cw=[...new Set(words(cn))],common=overlap(rw,cw),coverage=common/Math.max(1,Math.min(rw.length,cw.length)),jaccard=common/Math.max(1,rw.length+cw.length-common);let score=common>=2?coverage*.65+jaccard*.25:0;const rc=conceptSet(rn),cc=conceptSet(cn),shared=[...rc].filter(x=>cc.has(x)).length;if(shared)score=Math.max(score,.76+Math.min(.12,(shared-1)*.04));return Math.min(1,score)}
function allocateProgrammeMatches(courseRows,merits,programmeSubject=''){
 const out=(courseRows||[]).map((row,i)=>({...row,term:Number(row.__slOriginalTerm||row.term)||1,index:i,credited:false,creditMatch:'none',matchScore:0,matchedCourse:'',matchedCourseCode:'',matchedHp:0}));
 const pool=(merits||[]).map((c,i)=>({c,i,total:hp(c),left:hp(c)})).filter(x=>x.total>0);
 const take=(m,amount)=>{const n=Math.max(0,Math.min(Number(amount)||0,m.left));m.left=Math.max(0,m.left-n);return n};
 for(const row of out){const need=hp(row);if(!(need>0))continue;const rc=code(row.code),rn=norm(row.name),m=pool.find(x=>x.left>.01&&((rc&&code(x.c?.code)===rc)||(rn&&norm(x.c?.name)===rn)));if(!m)continue;const got=take(m,need);row.credited=got>=need-.01;row.creditMatch=row.credited?'exact':'partial';row.matchScore=got/need;row.matchedCourse=m.c?.name||'';row.matchedCourseCode=m.c?.code||'';row.matchedHp=got}
 for(const row of out){if(row.credited||row.matchedHp>0)continue;const need=hp(row);if(!(need>0))continue;const target=rowSubject(row,programmeSubject);let best=null;for(const m of pool){if(m.left<=.01)continue;const ms=meritSubject(m.c);if(target&&ms&&target!==ms)continue;const score=semanticScore(row,m.c);if(score<.74)continue;if(!best||score>best.score)best={m,score}}if(!best)continue;const got=take(best.m,need);row.creditMatch=got>=need-.01?'potential':'partial';row.matchScore=best.score;row.matchedHp=got;row.matchedCourse=best.m.c?.name||'';row.matchedCourseCode=best.m.c?.code||''}
 for(const row of out){if(row.credited||row.matchedHp>0||row.slotType==='main-field-or-elective-slot')continue;const need=hp(row),target=rowSubject(row,programmeSubject);if(!(need>0)||!target)continue;const candidates=pool.filter(x=>x.left>.01&&meritSubject(x.c)===target&&semanticScore(row,x.c)>=.45).sort((a,b)=>semanticScore(row,b.c)-semanticScore(row,a.c)||b.left-a.left);if(!candidates.length)continue;let got=0,picked=[];for(const m of candidates){if(got>=need-.01)break;const part=take(m,need-got);if(part<=0)continue;got+=part;picked.push(m)}if(got<=0)continue;row.creditMatch=got>=need-.01?'potential':'partial';row.matchScore=Math.min(.73,got/need*.7);row.matchedHp=got;row.matchedCourse=picked.map(x=>x.c?.name||x.c?.code||'Kurs').join(' + ');row.matchedCourseCode=picked.map(x=>x.c?.code).filter(Boolean).join(', ')}
 return out
}
const originalStructure=base.structure;
async function structure(item,merits=[]){const data=await originalStructure(item,merits);if(!data)return data;const rows=allocateProgrammeMatches(data.rows,merits,item?.subject||'');return{...data,rows,creditedHp:rows.filter(x=>x.credited).reduce((s,x)=>s+Number(x.matchedHp||0),0),potentialHp:rows.filter(x=>!x.credited&&(x.creditMatch==='potential'||x.creditMatch==='partial')).reduce((s,x)=>s+Number(x.matchedHp||0),0)}}
root.paths=Object.freeze({...base,allocateProgrammeMatches,structure});
})();