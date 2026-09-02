(()=>{
  'use strict';
  const VERSION='628';
  const norm=v=>String(v??'').trim().toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9åäö]+/g,' ').replace(/\s+/g,' ').trim();
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
  const stop=new Set(['och','eller','i','for','för','till','av','med','inom','pa','på','en','ett','kurs','kurser','hp','hogskolepoang','högskolepoäng','grundniva','grundnivå','avancerad','niva','nivå','valbar','valbara','obligatorisk','obligatoriska']);
  const tokens=v=>norm(v).split(' ').filter(x=>x.length>2&&!stop.has(x));
  const needText=need=>norm([
    need?.label,need?.name,need?.title,need?.subject,need?.type,need?.kind,need?.level,need?.description,need?.requirement
  ].filter(Boolean).join(' '));
  const courseText=course=>norm([course?.name,course?.subject,course?.code].filter(Boolean).join(' '));
  const needHp=need=>[need?.remainingHp,need?.missingHp,need?.requiredHp,need?.hp,need?.credits].map(num).find(x=>x!==null&&x>0)||null;
  const subjectEq=(course,need)=>norm(course?.subject)&&norm(course?.subject)===norm(need?.subject);
  const has=(text,re)=>re.test(text);
  const themes=[
    ['thesis',/(examensarbete|uppsats|självständigt arbete|självstandigt arbete|thesis)/,/(examensarbete|uppsats|självständigt arbete|sjalvstandigt arbete|thesis)/],
    ['method',/(metod|forskningsmetodik|vetenskaplig metod)/,/(metod|forskningsmetodik|vetenskaplig metod)/],
    ['statistics',/(statistik|kvantitativ)/,/(statistik|kvantitativ)/],
    ['accounting',/(redovisning|bokföring|bokforing|revision)/,/(redovisning|bokföring|bokforing|revision)/],
    ['marketing',/(marknadsföring|marknadsforing|marketing)/,/(marknadsföring|marknadsforing|marketing)/],
    ['organisation',/(organisation|organisering|ledarskap|management)/,/(organisation|organisering|ledarskap|management)/],
    ['finance',/(finans|finansiering|financial)/,/(finans|finansiering|financial)/],
    ['economics',/(nationalekonomi|mikroekonomi|makroekonomi)/,/(nationalekonomi|mikroekonomi|makroekonomi)/],
    ['psychology',/(psykologi|psychology)/,/(psykologi|psychology)/],
    ['sport',/(idrott|träning|traning|sport)/,/(idrott|träning|traning|sport)/]
  ];

  function scoreCourseForNeed(course,need){
    if(!course||course.verified!==true||course.distance!==true||!(Number(course.hp)>0))return -Infinity;
    if(course.noPhysicalMeetings===false)return -Infinity;
    const nt=needText(need),ct=courseText(course);
    let score=0;
    if(subjectEq(course,need))score+=50;
    else if(need?.subject&&norm(course?.subject)!==norm(need.subject))return -Infinity;

    const nTokens=tokens(nt),cTokens=new Set(tokens(ct));
    const overlap=nTokens.filter(x=>cTokens.has(x));
    score+=Math.min(32,overlap.length*8);

    for(const [,needRe,courseRe] of themes){
      if(has(nt,needRe))score+=has(ct,courseRe)?24:-18;
    }
    if(has(nt,/(examensarbete|uppsats|självständigt arbete|självstandigt arbete|thesis)/)&&!has(ct,/(examensarbete|uppsats|självständigt arbete|sjalvstandigt arbete|thesis)/))return -Infinity;

    const target=needHp(need),chp=Number(course.hp)||0;
    if(target){
      const delta=Math.abs(chp-target);
      if(delta<0.01)score+=18;
      else if(chp<target)score+=Math.max(2,12-delta);
      else score-=Math.min(18,(chp-target)*1.5);
    }
    if(course.noPhysicalMeetings===true)score+=10;
    if(Number(course.pace)>0&&Number(course.pace)<=50)score+=3;
    if(course.currentOffering===true)score+=5;
    return score;
  }

  function rankedCoursesForNeed(need){
    let rows=[];
    try{rows=typeof allDistanceCourses==='function'?allDistanceCourses():window.allDistanceCourses?.()||[]}catch(_){rows=[]}
    return rows.map(course=>({course,score:scoreCourseForNeed(course,need)}))
      .filter(x=>Number.isFinite(x.score)&&x.score>=42)
      .sort((a,b)=>b.score-a.score||Number(a.course.semester||99999)-Number(b.course.semester||99999)||String(a.course.university||'').localeCompare(String(b.course.university||''),'sv'))
      .slice(0,12)
      .map(x=>({...x.course,matchScore:x.score,distanceConfidence:x.course.noPhysicalMeetings===true?'no-physical-meetings-verified':'distance-verified-meetings-unknown'}));
  }

  const matches=function(course,need){return scoreCourseForNeed(course,need)>=42};
  try{distanceCourseMatchesNeed=matches}catch(_){}
  try{window.distanceCourseMatchesNeed=matches}catch(_){}
  try{verifiedDistanceCoursesForNeed=rankedCoursesForNeed}catch(_){}
  try{window.verifiedDistanceCoursesForNeed=rankedCoursesForNeed}catch(_){}

  window.__studielotsDistanceRanking={version:VERSION,policy:'requirement-first',rejectPhysicalMeetings:true,unknownMeetingStatusAllowedButNotClaimedAsFullyRemote:true,topPerNeed:12};

  // Re-render an already open distance path so the improved ranking takes effect immediately.
  try{
    const key=sessionStorage.getItem('lotsen_detail_key');
    const o=window.opportunityByKey?.(key);
    if(o&&(sessionStorage.getItem('lotsen_mypath_mode')==='distance'||sessionStorage.getItem('studielots_mode')==='distance')){
      requestAnimationFrame(()=>{try{renderDistancePath(o)}catch(_){}try{if(typeof renderMyPath==='function')renderMyPath()}catch(_){}});
    }
  }catch(_){}
})();
