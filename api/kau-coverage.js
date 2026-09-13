import {KAU_PROGRAM_CATALOG,KAU_PROGRAM_COUNTS} from '../lib/kau-program-catalog.js';
import {KAU_PROGRAM_DB} from '../lib/kau-program-database.js';
import {KAU_COURSE_DB} from '../lib/kau-course-database.js';

export default function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=21600, stale-while-revalidate=86400');
  const programCodes=Object.keys(KAU_PROGRAM_CATALOG);
  const completeCodes=Object.keys(KAU_PROGRAM_DB);
  const completeSet=new Set(completeCodes);
  const courseRows=Object.values(KAU_COURSE_DB);
  const standalone=courseRows.filter(c=>c.standalone===true);
  const pendingPrograms=programCodes.filter(code=>!completeSet.has(code)).map(code=>KAU_PROGRAM_CATALOG[code]);
  return res.status(200).json({
    university:'Karlstads universitet',
    programCatalog:{...KAU_PROGRAM_COUNTS,catalogued:programCodes.length,coveragePercent:Math.round(programCodes.length/KAU_PROGRAM_COUNTS.total*10000)/100},
    programStructures:{complete:completeCodes.length,pending:pendingPrograms.length,completeCodes,pendingPrograms},
    courseDatabase:{verified:courseRows.length,verifiedStandalone:standalone.length,verifiedProgramOnly:courseRows.length-standalone.length},
    policy:'Catalog coverage and detailed structure coverage are reported separately. A program is complete only when every expected term is reconciled against the official Karlstad University study path. A course is standalone only when an official current offering identifies it as Fristående kurs.',
    auditedAt:'2026-09-13'
  });
}
