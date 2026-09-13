import {KAU_COURSE_DB,listKauStandaloneCourses,getKauCourse} from '../lib/kau-course-database.js';

const clean=v=>String(v??'').trim();
const bool=v=>/^(1|true|yes)$/i.test(clean(v));

export default function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=21600, stale-while-revalidate=86400');
  const code=clean(req.query?.code);
  if(code){
    const course=getKauCourse(code);
    return res.status(200).json({course,found:Boolean(course),source:'karlstad-course-database'});
  }
  const standalone=clean(req.query?.standalone);
  const filters={subject:clean(req.query?.subject),level:clean(req.query?.level)};
  if(clean(req.query?.distance))filters.distance=bool(req.query.distance);
  let courses=Object.values(KAU_COURSE_DB);
  if(!standalone||bool(standalone))courses=listKauStandaloneCourses(filters);
  else{
    const subject=filters.subject.toLocaleLowerCase('sv-SE');
    courses=courses.filter(c=>!subject||String(c.subject).toLocaleLowerCase('sv-SE')===subject)
      .filter(c=>!filters.level||c.level===filters.level)
      .filter(c=>filters.distance==null||Boolean(/distans/i.test(c.delivery))===filters.distance);
  }
  return res.status(200).json({courses,count:courses.length,university:'Karlstads universitet',source:'karlstad-course-database',verifiedOnly:true,updated:'2026-09-13'});
}
