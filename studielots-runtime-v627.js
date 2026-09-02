(()=>{
  'use strict';
  const VERSION='627';
  const norm=v=>String(v??'').trim();
  const keyOf=o=>[norm(o?.subject).toLocaleLowerCase('sv-SE'),norm(o?.kind||'candidate').toLocaleLowerCase('sv-SE')].join('|');
  const rowKey=r=>String(r?.offeringKey||[r?.university,r?.code,r?.semester||r?.term||r?.startDate].join('|')).toLocaleLowerCase('sv-SE');
  const cache=new Map();
  let activeKey='';
  let requestSerial=0;

  function unique(rows){
    const seen=new Set(),out=[];
    for(const row of Array.isArray(rows)?rows:[]){
      if(!row||row.verified!==true||row.distance!==true||!(Number(row.hp)>0))continue;
      const k=rowKey(row);if(seen.has(k))continue;seen.add(k);out.push(row);
    }
    return out;
  }

  async function canonicalLoad(o){
    const request={subject:norm(o?.subject),kind:norm(o?.kind||'candidate')};
    const key=keyOf(request);activeKey=key;
    const serial=++requestSerial;
    distanceApiState.loading=true;distanceApiState.error=false;
    try{
      let rows=cache.get(key);
      if(!rows){
        const q=new URLSearchParams(request);
        const r=await fetch('/api/distance-courses?'+q.toString(),{headers:{Accept:'application/json'}});
        if(!r.ok)throw new Error('distance api '+r.status);
        const data=await r.json();
        rows=unique(data?.courses);
        cache.set(key,rows);
        if(serial===requestSerial)distanceApiState.updated=data?.updated||null;
      }
      if(serial!==requestSerial||activeKey!==key)return rows;
      LIVE_DISTANCE_COURSES=rows;
      distanceApiState.loaded=true;
      return rows;
    }catch(error){
      if(serial===requestSerial){distanceApiState.error=true;LIVE_DISTANCE_COURSES=[];distanceApiState.loaded=false}
      console.warn('StudieLots canonical distance API',error);
      return [];
    }finally{
      if(serial===requestSerial){
        distanceApiState.loading=false;
        try{renderDistancePath(o)}catch(_){}
        try{if(myPathMode==='distance')renderMyPath()}catch(_){}
      }
    }
  }

  try{loadDistanceCourses=canonicalLoad}catch(_){}
  try{window.loadDistanceCourses=canonicalLoad}catch(_){}

  try{
    allDistanceCourses=function(){
      const live=unique(LIVE_DISTANCE_COURSES);
      // Once Susa has successfully loaded for the selected subject/degree level,
      // it is authoritative for offerings. The old static index is fallback only.
      if(distanceApiState.loaded&&activeKey)return live;
      return unique(Array.isArray(DISTANCE_COURSE_INDEX)?DISTANCE_COURSE_INDEX:[]);
    };
    window.allDistanceCourses=allDistanceCourses;
  }catch(_){}

  // Force a fresh subject-aware request whenever a distance path is opened.
  const previousOpen=window.openDistancePathFromOpportunity;
  if(typeof previousOpen==='function'){
    window.openDistancePathFromOpportunity=function(key){
      const out=previousOpen.apply(this,arguments);
      try{
        const o=window.opportunityByKey?.(key);
        if(o)canonicalLoad({subject:o.subject||o.name||'',kind:o.degreeType||o.kind||'candidate'});
      }catch(_){}
      return out;
    };
  }

  window.__studielotsDistanceSource={version:VERSION,primary:'skolverket-susa-navet',fallback:'static-index-only-before-live-load',subjectAwareCache:true,dedupe:true};
})();
