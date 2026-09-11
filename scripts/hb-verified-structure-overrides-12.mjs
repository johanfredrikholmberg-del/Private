#!/usr/bin/env node
import fs from 'node:fs/promises';
const FILE='data/susa/structures.json',META='data/susa/structure-meta.json';
const all=JSON.parse(await fs.readFile(FILE,'utf8'));
const p=all.find(v=>String(v.programCode||'').toUpperCase()==='TAVEP');
const r=(term,name,hp,type='required')=>({term,name,hp,type,isThesis:/examensarbete/i.test(name)});
if(p){p.rows=[r(1,'Polymerteknologi',7.5),r(1,'Polymerer och textil i kompositer',7.5),r(1,'Experimentella metoder för polymerer och textil',7.5),r(1,'Polymera och textila material och miljön',7.5),r(2,'Resursåtervinning I',7.5),r(2,'Resursåtervinning II',7.5),r(2,'Livscykelanalys',5),r(2,'Cirkulär ekonomi',5),r(2,'Vetenskapsteori och forskningsmetodik',5),r(3,'Examensarbete i Resursåtervinning del 1 eller kurser',30,'choice'),r(4,'Examensarbete i Resursåtervinning',30)];p.termSums={1:30,2:30,3:30,4:30};p.coverage='choice-required';p.reason='official-current-plan-verified-four-semester-structure-with-term-3-thesis-or-course-choice';p.verifiedProgrammeOverride=true;p.studyStructureGranularity='term';p.termPlacementVerified=true;p.sourceEvidenceUrl='https://kursinfodoc.hb.se/PdfMaker.aspx?code=TAVEP&language=SV&revision=3%2C10&type=program';p.checkedAt=new Date().toISOString()}
await fs.writeFile(FILE,JSON.stringify(all,null,2)+'\n');
const meta=JSON.parse(await fs.readFile(META,'utf8'));meta.generatedAt=new Date().toISOString();meta.counts=all.reduce((a,v)=>(a[v.coverage]=(a[v.coverage]||0)+1,a),{});meta.retryable=all.filter(v=>['metadata-only','manual-review'].includes(v.coverage)&&!v.verifiedProgrammeOverride).length;await fs.writeFile(META,JSON.stringify(meta,null,2)+'\n');
console.log('HB verified batch 12',p&&{code:p.programCode,coverage:p.coverage,termSums:p.termSums});
