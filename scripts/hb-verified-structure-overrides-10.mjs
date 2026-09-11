#!/usr/bin/env node
import fs from 'node:fs/promises';
const FILE='data/susa/structures.json',META='data/susa/structure-meta.json';
const all=JSON.parse(await fs.readFile(FILE,'utf8'));
const p=all.find(v=>String(v.programCode||'').toUpperCase()==='GSJUK');
const r=(term,name,hp)=>({term,name,hp,type:'required',isThesis:/examensarbete/i.test(name)});
if(p){p.rows=[r(1,'Introduktion till vårdvetenskap med inriktning mot omvårdnad',15),r(1,'Humanbiologi',15),r(2,'Mikrobiologi och vårdhygien',4.5),r(2,'Somatisk ohälsa, sjukdom och farmakologi I',7.5),r(2,'Vårdvetenskap med inriktning mot omvårdnad I',10.5),r(2,'Somatisk ohälsa, sjukdom och farmakologi II',7.5),r(3,'Vårdvetenskap med inriktning mot omvårdnad II',9),r(3,'Omvårdnad med inriktning mot sjuksköterskans profession I',15),r(3,'Psykisk hälsa, ohälsa och sjukdom I',6),r(4,'Psykisk hälsa, ohälsa och sjukdom II',9),r(4,'Omvårdnad med inriktning mot sjuksköterskans profession II',12),r(4,'Vetenskaplig teori och metod och förbättringskunskap',9),r(5,'Hälsofrämjande och förebyggande vård',10.5),r(5,'Vårdande i hemmet',10.5),r(5,'Vårdande i akuta situationer',9),r(6,'Vetenskaplig teori och metod',6),r(6,'Examensarbete',15),r(6,'Slutexaminationer i klinisk omvårdnad',9)];p.termSums={1:30,2:30,3:30,4:30,5:30,6:30};p.coverage='complete';p.reason='official-current-plan-verified-complete-six-semester-structure';p.verifiedProgrammeOverride=true;p.studyStructureGranularity='term';p.termPlacementVerified=true;p.sourceEvidenceUrl='https://kursinfodoc.hb.se/PdfMaker.aspx?code=GSJUK&language=SV&revision=41%2C10&type=program';p.checkedAt=new Date().toISOString()}
await fs.writeFile(FILE,JSON.stringify(all,null,2)+'\n');
const meta=JSON.parse(await fs.readFile(META,'utf8'));meta.generatedAt=new Date().toISOString();meta.counts=all.reduce((a,v)=>(a[v.coverage]=(a[v.coverage]||0)+1,a),{});meta.retryable=all.filter(v=>['metadata-only','manual-review'].includes(v.coverage)&&!v.verifiedProgrammeOverride).length;await fs.writeFile(META,JSON.stringify(meta,null,2)+'\n');
console.log('HB verified batch 10',p&&{code:p.programCode,coverage:p.coverage,termSums:p.termSums});
await import('./hb-verified-structure-overrides-11.mjs');
