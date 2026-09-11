#!/usr/bin/env node
import fs from 'node:fs/promises';
const FILE='data/susa/structures.json',META='data/susa/structure-meta.json';
const all=JSON.parse(await fs.readFile(FILE,'utf8'));
const find=code=>all.find(v=>String(v.programCode||'').toUpperCase()===code);
const c=(name,hp,type='required')=>({name,hp,type,isThesis:/självständigt arbete|examensarbete/i.test(name)});
const markYear=(p,url,reason,years)=>{if(!p)return;p.rows=[];p.academicYearCourses=years;p.academicYearSums=Object.fromEntries(Object.entries(years).map(([y,cs])=>[y,cs.reduce((s,x)=>s+Number(x.hp||0),0)]));p.coverage='manual-review';p.reason=reason;p.verifiedProgrammeOverride=true;p.studyStructureGranularity='academic-year-only';p.termPlacementVerified=false;p.sourceEvidenceUrl=url;p.checkedAt=new Date().toISOString()};
markYear(find('ACIVE'),'https://kursinfodoc.hb.se/PdfMaker.aspx?code=ACIVE&language=SV&revision=16%2C20&type=program','official-current-plan-verifies-complete-academic-year-structure-with-year-3-specialisation-choice-term-placement-unresolved',{
1:[c('Makroekonomi',7.5),c('Organisering och ledning',7.5),c('Statistik I',7.5),c('Redovisningens grunder och tekniker',7.5),c('Mikroekonomi',7.5),c('Grundläggande marknadsföring',7.5),c('Internationell ekonomi',7.5),c('Ekonomistyrning I',7.5)],
2:[c('Affärsjuridik I',15),c('Finansiell planering',7.5),c('Strategisk marknadsföring',7.5),c('Finansiell ekonomi',7.5),c('Statistik II',7.5),c('Organisationsdesign och managementrecept',7.5),c('Externredovisning',7.5)],
3:[{name:'Vald inriktning: management, marknadsföring eller redovisning',hp:60,type:'choice',isThesis:false}]
});
markYear(find('SGEMA'),'https://kursinfodoc.hb.se/PdfMaker.aspx?code=SGEMA&language=SV&revision=16%2C30&type=program','official-current-plan-verifies-complete-academic-year-structure-with-explicit-year-3-choice-term',{
1:[c('Entreprenörskap och försäljning',7.5),c('Event som upplevelseproduktion',7.5),c('Grundläggande redovisning',7.5),c('Ekonomi och samhälle',7.5),c('Marknadskommunikation för event',7.5),c('Projektledning för event',7.5),c('Organisering och ledning',7.5),c('Eventledning och praktiskt eventarbete',7.5)],
2:[c('Konsumentbeteende',7.5),c('Strategisk marknadsföring för event',7.5),c('Evenemangsjuridik',7.5),c('Ekonomistyrning',7.5),c('Eventmarknadsföring',7.5),c('Projektbaserat utvecklingsarbete',7.5),c('Organisering av event',7.5),c('Strategisk destinationsutveckling genom event',7.5)],
3:[c('Praktiktermin, utlandstermin eller valbara kurser',30,'choice'),c('Eventstudier',7.5),c('Forskningsmetoder på kandidatnivå',7.5),c('Självständigt arbete för kandidatexamen inom företagsekonomi',15)]
});
markYear(find('SGOFD'),'https://kursinfodoc.hb.se/PdfMaker.aspx?code=SGOFD&language=SV&revision=5%2C10&type=program','official-current-plan-verifies-years-1-2-and-explicit-terms-5-6-with-choice-term',{
1:[c('Förvaltning och politiska system',20),c('Samhällsekonomi',10),c('Organisationsteori för offentlig sektor',7.5),c('Förvaltningsrätt',7.5),c('Ekonomistyrning',7.5),c('Redovisning i offentlig sektor',7.5)],
2:[c('Etik och hållbar utveckling',7.5),c('Projektbaserat förändringsarbete i offentliga organisationer',7.5),c('Introduktion till forskningsmetoder i offentlig förvaltning',7.5),c('Maktrelationer och förvaltningspraktik',7.5),c('Styrning och ledning i offentlig sektor',7.5),c('Reformer, utvärdering och implementering',7.5),c('Välfärdens utmaningar',7.5),c('Utvärdering i praktiken',7.5)],
3:[c('Forskningsmetoder i offentlig förvaltning',15),c('Självständigt arbete för kandidatexamen i offentlig förvaltning',15),c('Handledd studiepraktik, valbara kurser eller utlandstermin',30,'choice')]
});
await fs.writeFile(FILE,JSON.stringify(all,null,2)+'\n');
const meta=JSON.parse(await fs.readFile(META,'utf8'));meta.generatedAt=new Date().toISOString();meta.counts=all.reduce((a,v)=>(a[v.coverage]=(a[v.coverage]||0)+1,a),{});meta.retryable=all.filter(v=>['metadata-only','manual-review'].includes(v.coverage)&&!v.verifiedProgrammeOverride).length;await fs.writeFile(META,JSON.stringify(meta,null,2)+'\n');
console.log('HB verified batch 11',all.filter(v=>['ACIVE','SGEMA','SGOFD'].includes(String(v.programCode||'').toUpperCase())).map(v=>({code:v.programCode,coverage:v.coverage,academicYearSums:v.academicYearSums})));
