const c=(code,name,hp,level,progression,subject,standalone,delivery,pace,term,requirements,sourceUrl,extra={})=>({code,name,hp,university:'Karlstads universitet',subject,level,progression,standalone,delivery,pace,term,requirements,sourceUrl,verified:true,verifiedAt:'2026-09-13',source:'karlstad-official-course-catalog',...extra});

export const KAU_COURSE_DB={
  DVAD12:c('DVAD12','Datavetenskapliga metoder',7.5,'advanced','A1N','Datavetenskap',true,'Campus',50,'HT 2026','Engelska 6 samt 60 hp datavetenskap. Motsvarandebedömning kan göras.','https://www.kau.se/utbildning/program-och-kurser/kurser/DVAD12'),
  DVAD33:c('DVAD33','Design för integritetsskydd',1.5,'advanced','A1N','Datavetenskap',true,'Distans',10,'HT 2026','Engelska 6 eller B. Datavetenskap 30 hp, eller tre års yrkeserfarenhet inom informationsteknologisektorn. Motsvarandebedömning kan göras.','https://www.kau.se/utbildning/program-och-kurser/kurser/DVAD33',{language:'Engelska',applicationCode:'KAU-55031'}),
  DVAD35:c('DVAD35','Designmönster för integritet i programvarudesign',1.5,'advanced','A1N','Datavetenskap',true,'Distans',10,'HT 2026','Engelska 6 eller B. Datavetenskap 30 hp, eller tre års yrkeserfarenhet inom informationsteknologisektorn. Motsvarandebedömning kan göras.','https://www.kau.se/utbildning/program-och-kurser/kurser/DVAD35',{language:'Engelska',applicationCode:'KAU-55032'}),
  DVAD30:c('DVAD30','Inbyggd integritet',7.5,'advanced','A1N','Datavetenskap',true,'Distans',25,'HT 2026','Engelska 6 eller B. Datavetenskap 30 hp, eller tre års yrkeserfarenhet inom informationsteknologisektorn. Motsvarandebedömning kan göras.','https://www.kau.se/utbildning/program-och-kurser/kurser/DVAD30',{language:'Engelska',applicationCode:'KAU-55028'}),
  DVGA14:c('DVGA14','Datavetenskapens grunder',7.5,'basic','G1N','Datavetenskap',false,'Campus',50,'HT 2026','Grundläggande behörighet samt Matematik 3c/D alternativt Matematik - fortsättning, nivå 1c. Motsvarandebedömning kan göras.','https://www.kau.se/utbildning/program-och-kurser/kurser/DVGA14',{standaloneStatus:'not-verified-as-standalone',applicationCode:'KAU-55006'}),
  DVGA01:c('DVGA01','Programmeringsteknik',7.5,'basic','G1N','Datavetenskap',false,'Campus',50,'HT 2026','', 'https://www.kau.se/utbildning/program-och-kurser/kurser/DVGA01',{standaloneStatus:'program-course-in-current-offering',applicationCode:'KAU-55020'}),
  DVGA02:c('DVGA02','Programutvecklingsmetodik',7.5,'basic','G1F','Datavetenskap',false,'Campus',50,'VT 2027','', 'https://www.kau.se/utbildning/program-och-kurser/kurser/DVGA02',{standaloneStatus:'program-course-in-current-offering',applicationCode:'KAU-55582'}),
  DVAD26:c('DVAD26','Distribuerade system och molntjänster',7.5,'advanced','A1N','Datavetenskap',false,'Campus',50,'VT 2027','', 'https://www.kau.se/utbildning/program-och-kurser/kurser/DVAD26',{standaloneStatus:'program-course-in-current-offering'}),
  DVAD25:c('DVAD25','Etisk hackning',7.5,'advanced','A1N','Datavetenskap',false,'Campus',50,'VT 2027','', 'https://www.kau.se/utbildning/program-och-kurser/kurser/DVAD25',{standaloneStatus:'program-course-in-current-offering'})
};

export function getKauCourse(code){
  return KAU_COURSE_DB[String(code||'').trim().toUpperCase()]||null;
}

export function listKauStandaloneCourses(filters={}){
  const subject=String(filters.subject||'').trim().toLocaleLowerCase('sv-SE');
  const level=String(filters.level||'').trim().toLowerCase();
  const distance=filters.distance;
  return Object.values(KAU_COURSE_DB).filter(course=>course.standalone===true)
    .filter(course=>!subject||String(course.subject).toLocaleLowerCase('sv-SE')===subject)
    .filter(course=>!level||course.level===level)
    .filter(course=>distance==null||Boolean(/distans/i.test(course.delivery))===Boolean(distance));
}
