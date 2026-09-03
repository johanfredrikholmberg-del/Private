const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const code=v=>clean(v).toUpperCase().replace(/[^A-Z0-9ÅÄÖ]/g,'');
const OPTIONS={
  TKDAT:[
    {code:'MPALG',name:'Datavetenskap – algoritmer, programspråk och logik',eligibility:'direct',accredited:true,structureReady:true},
    {code:'MPCSC',name:'Datorer, system och cybersäkerhet',eligibility:'direct',accredited:true,priority:true,structureReady:false,structureNote:'Chalmers programplan saknar ännu en komplett maskinläsbar termin 4 i 2026/27-vyn.'},
    {code:'MPHPC',name:'Högpresterande datorsystem',eligibility:'direct',accredited:true,priority:true},
    {code:'MPSOF',name:'Software engineering and technology – utveckling och implementering av mjukvara',eligibility:'direct',accredited:true},
    {code:'MPCAS',name:'Komplexa adaptiva system',eligibility:'direct',accredited:true,structureReady:true}
  ],
  TKELT:[
    {code:'MPHPC',name:'Högpresterande datorsystem',eligibility:'direct',accredited:true},
    {code:'MPEES',name:'Inbyggda elektroniksystem',eligibility:'direct',accredited:true,priority:true,structureReady:true},
    {code:'MPTSE',name:'Industriell ekologi',eligibility:'direct',accredited:true,structureReady:true},
    {code:'MPCAS',name:'Komplexa adaptiva system',eligibility:'direct',accredited:true,structureReady:true},
    {code:'MPSOV',name:'Ljud och vibrationer',eligibility:'direct',accredited:true,structureReady:true},
    {code:'MPENM',name:'Matematik och beräkningsvetenskap',eligibility:'direct',accredited:false},
    {code:'MPNAT',name:'Nanoteknologi',eligibility:'direct',accredited:true,structureReady:true}
  ],
  TKMSK:[
    {code:'MPTSE',name:'Industriell ekologi',eligibility:'direct',accredited:true,priority:true,structureReady:true},
    {code:'MPCAS',name:'Komplexa adaptiva system',eligibility:'direct',accredited:true,structureReady:true},
    {code:'MPQOM',name:'Kvalitets- och verksamhetsledning',eligibility:'direct',accredited:true},
    {code:'MPSOV',name:'Ljud och vibrationer',eligibility:'direct',accredited:true,structureReady:true},
    {code:'MPAEM',name:'Materialteknik',eligibility:'direct',accredited:true,priority:true},
    {code:'MPPEN',name:'Produktionsutveckling',eligibility:'direct',accredited:true,priority:true}
  ],
  TKATK:[
    {code:'MPDSD',name:'Arkitektur och planering för hållbar framtid',eligibility:'direct',accredited:true,priority:true,degree:'architecture'},
    {code:'MPARC',name:'Arkitektur och stadsbyggnad',eligibility:'direct',accredited:true,priority:true,degree:'architecture'},
    {code:'MPTSE',name:'Industriell ekologi',eligibility:'direct',accredited:true,priority:true,degree:'civil-engineering',structureReady:true},
    {code:'MPCAS',name:'Komplexa adaptiva system',eligibility:'direct',accredited:true,priority:true,degree:'civil-engineering',structureReady:true},
    {code:'MPSOV',name:'Ljud och vibrationer',eligibility:'direct',accredited:true,priority:true,degree:'civil-engineering',structureReady:true}
  ]
};
export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=86400, stale-while-revalidate=604800');
  const programCode=code(req.query?.code||req.query?.programCode);
  const university=clean(req.query?.university);
  if(university&&!/chalmers/i.test(university))return res.status(200).json({found:false,options:[]});
  const options=OPTIONS[programCode]||[];
  return res.status(200).json({found:options.length>0,programCode,options,scope:options.length?'verified-direct-eligibility':'not-yet-mapped',academicYear:'2026/2027',source:'chalmers-master-choice-guide',checkedAt:new Date().toISOString(),note:options.length?'Only master programmes where the Chalmers 2026/27 eligibility guide states that students from this programme satisfy the special prerequisites from the compulsory bachelor part without additional course requirements are listed. structureReady=false means the official master programme plan is not yet complete enough for StudieLots to build all four master terms.':'No safe direct-eligibility mapping has been added for this programme yet.'});
}
