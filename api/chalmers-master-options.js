const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const code=v=>clean(v).toUpperCase().replace(/[^A-Z0-9ÅÄÖ]/g,'');
const OPTIONS={
  TKDAT:[
    {code:'MPALG',name:'Datavetenskap – algoritmer, programspråk och logik',eligibility:'direct',accredited:true},
    {code:'MPCSC',name:'Datorer, system och cybersäkerhet',eligibility:'direct',accredited:true,priority:true},
    {code:'MPHPC',name:'Högpresterande datorsystem',eligibility:'direct',accredited:true,priority:true},
    {code:'MPSOF',name:'Software engineering and technology – utveckling och implementering av mjukvara',eligibility:'direct',accredited:true},
    {code:'MPCAS',name:'Komplexa adaptiva system',eligibility:'direct',accredited:true}
  ]
};
export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=86400, stale-while-revalidate=604800');
  const programCode=code(req.query?.code||req.query?.programCode);
  const university=clean(req.query?.university);
  if(university&&!/chalmers/i.test(university))return res.status(200).json({found:false,options:[]});
  const options=OPTIONS[programCode]||[];
  return res.status(200).json({found:options.length>0,programCode,options,scope:options.length?'verified-direct-eligibility':'not-yet-mapped',academicYear:'2026/2027',source:'chalmers-master-choice-guide',checkedAt:new Date().toISOString(),note:options.length?'Only master programmes where the 2026/27 Chalmers guide states that TKDAT students satisfy the special prerequisites from the compulsory bachelor part without extra course requirements are listed.':'No safe direct-eligibility mapping has been added for this programme yet.'});
}
