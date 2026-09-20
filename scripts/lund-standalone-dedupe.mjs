#!/usr/bin/env node
/** Read-only Lund course import preflight. Never mutate canonical HT26 from unverified staging. */
import fs from 'node:fs/promises';
const inputPath=process.argv.find(x=>x.startsWith('--input='))?.slice(8);
const outputPath=process.argv.find(x=>x.startsWith('--output='))?.slice(9);
if(!inputPath)throw Error('Ange --input=fil.json med Lundkurser.');
if(process.argv.includes('--apply'))throw Error('Direktimport avstängd: granska schema, dubbletter och källor innan kanonisk data ändras.');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const manifest=await read('data/HT26/manifest.json');
const original=await read('data/HT26/courses.json');
const incoming=await read(inputPath);
if(manifest.canonical!==true||manifest.term!=='HT26'||!Array.isArray(original)||!Array.isArray(incoming)||original.length!==manifest.tables?.courses?.rows)throw Error('Kanonisk databas eller manifest är ofullständigt/inkonsekvent.');
const clean=x=>String(x??'').normalize('NFKC').trim().toUpperCase().replace(/\s+/g,'');
const provider=x=>clean(x.providerId??x.providerCode??x.provider??x.university??x.institution??x.larosate??'');
const canonicalProvider=x=>{const p=provider(x).replace(/[._-]/g,'');return /^(LU|LUND|LUNDSUNIVERSITET|LUNDUNIVERSITY)$/.test(p)?'LU':p};
const code=x=>clean(x.courseCode??x.code??x.kurskod??'');
const hp=x=>Number(String(x.credits??x.hp??x.creditPoints??'').replace(',','.'));
const identity=x=>`${canonicalProvider(x)}|${code(x)}`;
const validSource=x=>{try{const url=new URL(x.sourceUrl);return url.protocol==='https:'&&url.hostname.toLowerCase().endsWith('.lu.se')}catch{return false}};
const byIdentity=new Map();
for(const x of original){if(canonicalProvider(x)!=='LU'||!code(x))continue;const k=identity(x);byIdentity.set(k,[...(byIdentity.get(k)||[]),x]);}
const staged=[],duplicates=[],conflicts=[],rejected=[],seen=new Map();
for(const x of incoming){
 const k=identity(x),points=hp(x);
 if(canonicalProvider(x)!=='LU'||!code(x)||!Number.isFinite(points)||points<=0||!String(x.name??'').trim()||!validSource(x)){rejected.push({code:code(x),reason:'Saknar entydigt LU, kurskod, hp, namn eller officiell HTTPS-källänk'});continue;}
 if(!(x.standalone===true||x.isStandalone===true||x.applicationType==='standalone')){rejected.push({code:code(x),reason:'Fristående status ej styrkt i underlaget'});continue;}
 const matches=[...(byIdentity.get(k)||[]),...(seen.get(k)||[])];
 if(matches.some(y=>Number.isFinite(hp(y))&&Math.abs(hp(y)-points)>.001)){conflicts.push({code:code(x),reason:'Samma kurskod men olika hp: kräver manuell granskning'});continue;}
 if(matches.length){duplicates.push({code:code(x),existing:matches.length});continue;}
 seen.set(k,[x]);staged.push(x);
}
const report={canonical:'data/HT26/courses.json',existing:original.length,candidates:incoming.length,newCandidates:staged.length,duplicates:duplicates.length,conflicts:conflicts.length,rejected:rejected.length,stagedCodes:staged.map(code),duplicateDetails:duplicates,conflictDetails:conflicts,rejectedDetails:rejected,safeToAutoMerge:false,reason:'En kandidat är inte ett verifierat kurstillfälle. Kontrollera kanoniskt schema, källa och tillträde före import.'};
console.log(JSON.stringify(report,null,2));
if(outputPath){await fs.writeFile(outputPath,JSON.stringify({report,candidatesForManualReview:staged},null,2)+'\n');console.log(`Skrev granskningsunderlag till ${outputPath}; kanonisk databas är oförändrad.`)}
else console.log('Read-only: inga ändringar i den kanoniska databasen.');
if(conflicts.length||rejected.length)process.exitCode=1;
