export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=86400');
  const subject=String(req.query?.subject||'').trim();
  const kind=String(req.query?.kind||'candidate').trim();

  // Configure DISTANCE_COURSE_FEED_URL in Vercel to a Susa-navet/UHR-compatible
  // normalized feed. We fail closed: no feed means no invented course suggestions.
  const base=process.env.DISTANCE_COURSE_FEED_URL;
  if(!base){
    return res.status(200).json({courses:[],updated:new Date().toISOString(),source:'not-configured'});
  }
  try{
    const u=new URL(base);
    if(subject)u.searchParams.set('subject',subject);
    if(kind)u.searchParams.set('kind',kind);
    const r=await fetch(u,{headers:{accept:'application/json'}});
    if(!r.ok)throw new Error(`upstream ${r.status}`);
    const data=await r.json();
    const raw=Array.isArray(data)?data:(Array.isArray(data.courses)?data.courses:[]);
    const courses=raw.filter(x=>x && x.distance===true && x.currentOffering===true).map(x=>({
      name:String(x.name||''),
      university:String(x.university||''),
      subject:String(x.subject||subject),
      hp:Number(x.hp||0),
      pace:Number(x.pace||0)||null,
      term:String(x.term||''),
      distance:true,
      currentOffering:true,
      verified:true,
      noPhysicalMeetings:x.noPhysicalMeetings===true?true:x.noPhysicalMeetings===false?false:null,
      url:String(x.url||'')
    })).filter(x=>x.name && x.hp>0);
    return res.status(200).json({courses,updated:data.updated||new Date().toISOString(),source:data.source||'configured-feed'});
  }catch(e){
    console.error(e);
    return res.status(502).json({courses:[],updated:new Date().toISOString(),source:'error'});
  }
}
