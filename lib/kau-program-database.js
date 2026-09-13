const row=(term,name,hp,category='mandatory',extra={})=>({term,name,code:'',hp,category,status:'remaining',credited:false,isCredited:false,programmeSource:'karlstad-program-database',programmeCategory:category,...extra});
const slot=(term,hp,options=[])=>row(term,'Valbara studier enligt programplan',hp,'elective-slot',{options:options.map(([name,credits])=>({name,code:'',hp:credits}))});

export const KAU_PROGRAM_DB={
  TGKDV:{
    name:'Kandidatprogram i datavetenskap',totalHp:180,sourceUrl:'https://www.kau.se/utbildning/program-och-kurser/program/TGKDV',verifiedAt:'2026-09-13',
    courses:[
      row(1,'Datavetenskapens grunder',7.5),row(1,'Matematik för datavetare',7.5),row(1,'Programmeringsteknik',7.5),row(1,'Generell projektledningsmetodik',7.5),
      row(2,'Programutvecklingsmetodik',7.5),row(2,'C#.NET',7.5),row(2,'HTML och CSS för webbutveckling',5),row(2,'JavaScript för webbutveckling',5),row(2,'Serverprogrammering i JavaScript',5),
      row(3,'Databasteknik',5),row(3,'Datorsystemteknik',5),row(3,'Operativsystem',5),row(3,'Datastrukturer och algoritmer',7.5),row(3,'Dataetik',7.5),
      row(4,'Matematisk statistik',7.5),row(4,'Datakommunikation I',7.5),row(4,'Grunderna till Software Engineering',7.5),row(4,'Programspråk',7.5),
      row(5,'Software Engineering',7.5),row(5,'Datasäkerhet I',7.5),slot(5,15,[['Användartester, prototyping och utvärdering',7.5],['Inbyggda system',4.5],['Hållbar IT',3],['Interaktionsdesign',7.5],['Tillämpad maskininlärning',7.5],['Projektarbete i Datavetenskap',7.5]]),
      row(6,'Examensarbete / Kandidatarbete',15),slot(6,15,[['Grunderna inom mjukvarutestning',7.5],['Tillämpad systemintegration',7.5],['Internets domännamnssystem',7.5]])
    ]
  },
  NGBIO:{
    name:'Biologiprogrammet',totalHp:180,sourceUrl:'https://www.kau.se/utbildning/program-och-kurser/program/NGBIO',verifiedAt:'2026-09-13',
    courses:[
      row(1,'Floristik och faunistik',15),row(1,'Biologiska metoder och analyser',15),row(2,'Cellbiologi',15),row(2,'Botanik',15),row(3,'Ekologi',15),row(3,'Zoologi',15),
      slot(4,30,[['Valfri kurs',15],['Beteendeekologi',15],['Naturvårdsbiologi',15]]),
      slot(5,30,[['Livets utveckling och mångfald',15],['MKB, miljökonsekvensbeskrivning',7.5],['Orienteringskurs i GIS',7.5],['Sötvattensbiologi',15]]),
      row(6,'Kandidatuppsats i biologi',15),slot(6,15,[['Valfri kurs',15],['Biologi i praktiken',15]])
    ]
  },
  SGSYE:{
    name:'Systemvetenskapliga programmet inriktning ekonomi',totalHp:180,sourceUrl:'https://www.kau.se/utbildning/program-och-kurser/program/SGSYE',verifiedAt:'2026-09-13',
    courses:[
      row(1,'Introduktion till IT-design',7.5),row(1,'Verksamhet och IT',7.5),row(1,'Anskaffning av IT-system',7.5),row(1,'Introduktion till programmering',7.5),
      row(2,'Företagsekonomi I',30),
      row(3,'Databasdesign',7.5),row(3,'Affärssimulering och dataanalys',7.5),row(3,'Grundläggande statistik för dataanalys',7.5),row(3,'Nosql databaser',7.5),
      row(4,'Affärssystem I: Analysmodeller',7.5),row(4,'Affärssystem II: Kundmodeller',7.5),row(4,'Information för affärsbeslut',7.5),row(4,'Ledarskap och organisation',7.5),
      row(5,'Tjänster och IT: Elektroniska affärer',15),slot(5,15,[['Interaktionsdesign',7.5],['Business by Web och webbanalys',7.5],['Informatik, praktik',7.5],['Generell projektledningsmetodik',7.5]]),
      row(6,'Informatik - Kandidatuppsats',15),row(6,'Verksamhetsutveckling med process- och flerpartsperspektiv',7.5),row(6,'Systemintegration',7.5)
    ]
  },
  TGHEL:{
    name:'Högskoleingenjörsprogrammet i elektroteknik',totalHp:180,sourceUrl:'https://www.kau.se/utbildning/program-och-kurser/program/TGHEL',verifiedAt:'2026-09-13',
    courses:[
      row(1,'Introduktion till elektroteknik',7.5),row(1,'Matematik för ingenjörer I',7.5),row(1,'Introduktion till programmering och databehandling',7.5),row(1,'Kretsteknik 1',7.5),
      row(2,'Kretsteknik 2',7.5),row(2,'Digitalteknik',7.5),row(2,'Kraftelektronik',7.5),row(2,'Matematik för ingenjörer II',7.5),
      row(3,'Introduktion till elkraftsystem',7.5),row(3,'Matematik för ingenjörer III',7.5),row(3,'Reglerteknik',7.5),row(3,'Industriella automationssystem',7.5),
      row(4,'Signaler och system',7.5),row(4,'Elmaskiner',7.5),row(4,'Modellering och simulering av dynamiska system',7.5),row(4,'Förnybara energikällor och tillämpningar',7.5),
      row(5,'Elkraftsystem',7.5),row(5,'Tillämpningar av kraftelektronik',7.5),row(5,'Integrering av förnybar energi i elkraftsystem',7.5),row(5,'Elinstallationer och introduktion till skyddssystem i elkraftsystem',7.5),
      row(6,'Examensarbete',22.5),slot(6,7.5,[['Programutvecklingsmetodik',7.5],['Företagsekonomins grunder',7.5]])
    ]
  },
  TGHID:{
    name:'Högskoleingenjörsprogrammet i innovationsteknik och design',totalHp:180,sourceUrl:'https://www.kau.se/utbildning/program-och-kurser/program/TGHID',verifiedAt:'2026-09-13',
    courses:[
      row(1,'Introduktion till innovationsteknik och design för högskoleingenjörer',7.5),row(1,'Matematik för ingenjörer I',7.5),row(1,'Introduktion till programmering och databehandling',7.5),row(1,'Mekanik 1: statik',7.5),
      row(2,'Tillverkningsteknik 1',7.5),row(2,'Grundläggande energiteknik',7.5),row(2,'Matematik för ingenjörer II',7.5),row(2,'Materialteknik grundkurs',7.5),
      row(3,'Mekanik 2: dynamik',7.5),row(3,'Elteknik',7.5),row(3,'Hållfasthetslära I för högskoleingenjörer',7.5),row(3,'Design- och innovationsteorier',7.5),
      row(4,'Kommunikationsverktyg i designarbete',7.5),row(4,'Maskinelement',7.5),row(4,'Produktionssystem I',7.5),row(4,'Konstruktionsteknik I, högskoleingenjörsprogrammet',7.5),
      row(5,'Ergonomi',7.5),row(5,'Visuellt tänkande och gestaltning',7.5),row(5,'Hållbar produktutveckling',15),
      row(6,'Examensarbete för högskoleingenjörsexamen i innovationsteknik och design',22.5),slot(6,7.5,[['Designprocesser i teori och praktik',7.5],['Konstruktionsteknik II, IoD',7.5],['Produktionssystem II',7.5]])
    ]
  }
};

export function getKauProgram(code){
  const key=String(code||'').trim().toUpperCase();
  const p=KAU_PROGRAM_DB[key];
  if(!p)return null;
  const courses=p.courses.map((r,i)=>({...r,originalTerm:r.term,__slOriginalTerm:r.term,__slOriginalIndex:i}));
  return {found:true,structureAvailable:true,courses,program:{name:p.name,code:key,university:'Karlstads universitet'},sourceUrls:[p.sourceUrl],source:'karlstad-program-database',confidence:'official-verified-persisted',coverage:'complete-term-sequence',quality:{complete:true,expectedTerms:Math.round(p.totalHp/30),completeTerms:Array.from({length:Math.round(p.totalHp/30)},(_,i)=>i+1),totalHp:p.totalHp,persisted:true,verifiedAt:p.verifiedAt},policy:'Persisted only after manual verification against Karlstad University official programme study path. Ambiguous semesters are not stored as complete.'};
}
