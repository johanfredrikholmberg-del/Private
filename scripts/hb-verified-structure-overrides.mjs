#!/usr/bin/env node
import fs from 'node:fs/promises';

const FILE='data/susa/structures.json';
const META='data/susa/structure-meta.json';
const rows=JSON.parse(await fs.readFile(FILE,'utf8'));
const byCode=new Map(rows.filter(x=>x.programCode).map(x=>[String(x.programCode).toUpperCase(),x]));
const hp=x=>x.reduce((s,r)=>s+Number(r.hp||0),0);
const sums=x=>Object.fromEntries([...new Set(x.map(r=>r.term))].sort((a,b)=>a-b).map(t=>[t,hp(x.filter(r=>r.term===t))]));

function setCoverage(item, coverage, reason){
  item.coverage=coverage; item.reason=reason; item.termSums=sums(item.rows||[]); item.checkedAt=new Date().toISOString();
  item.verifiedProgrammeOverride=true;
}

// ASYST: official plan states term 5 has two fixed 7.5-credit courses plus two of three 7.5-credit options.
{
  const x=byCode.get('ASYST');
  if(x?.rows?.length){
    const other=x.rows.filter(r=>r.term!==5);
    const t5=x.rows.filter(r=>r.term===5);
    const fixed=t5.filter(r=>/Systemutvecklingsprojekt|IT Service Management/i.test(r.name||''));
    const candidates=t5.filter(r=>!fixed.includes(r));
    if(fixed.length===2 && hp(fixed)===15 && candidates.length===3 && candidates.every(r=>Number(r.hp)===7.5)){
      x.rows=[...other,...fixed,{term:5,name:'Två av tre valbara systemvetarkurser',hp:15,type:'choice',choiceSlots:2,options:candidates.map(r=>({name:r.name,hp:7.5})),isThesis:false}].sort((a,b)=>a.term-b.term);
      x.sourceEvidenceUrl='https://kursinfodoc.hb.se/PdfMaker.aspx?code=ASYST&language=SV&revision=15&type=program';
      setCoverage(x,'choice-required','official-plan-verified-two-of-three-choice-term-5');
    }
  }
}

// TGTPI: official plan says term 5 contains three elective courses (22.5 cr). Lists after term 6 are option catalogues, not extra term-6 credits.
{
  const x=byCode.get('TGTPI');
  if(x?.rows?.length){
    const keep=x.rows.filter(r=>r.term!==6 || /Textilteknisk fördjupning|Textile Technology Project|Examensarbete|Thesis Project/i.test(r.name||''));
    const t3=keep.filter(r=>r.term===3);
    if(hp(t3)===20){
      keep.push({term:3,name:'Kvalitetssäkring och textil provning',hp:5,type:'required',isThesis:false});
      keep.push({term:3,name:'Sammanfogningstekniker för textila produkter',hp:5,type:'required',isThesis:false});
    }
    x.rows=keep.sort((a,b)=>a.term-b.term);
    x.sourceEvidenceUrl='https://kursinfodoc.hb.se/PdfMaker.aspx?code=TGTPI&language=EN&revision=3%2C20&type=program';
    const ts=sums(x.rows);
    if([1,2,3,4,5,6].every(t=>Math.abs((ts[t]||0)-30)<0.01)) setCoverage(x,'choice-required','official-plan-verified-specialisation-options-not-extra-term-6-credits');
  }
}

// TAREC: official plan explicitly places 30-credit thesis part 1 in term 3 and 30-credit thesis in term 4.
{
  const x=byCode.get('TAREC');
  if(x?.rows?.length){
    const base=x.rows.filter(r=>!(r.isThesis || /Examensarbete i Resursåtervinning/i.test(r.name||'')));
    const ts=sums(base);
    if(Math.abs((ts[1]||0)-30)<0.01 && Math.abs((ts[2]||0)-30)<0.01){
      x.rows=[...base,{term:3,name:'Examensarbete i Resursåtervinning del 1',hp:30,type:'choice',options:[{name:'Examensarbete i Resursåtervinning del 1',hp:30},{name:'Godkända kurser inom hållbar byggteknik/internationalisering',hp:30}],isThesis:true},{term:4,name:'Examensarbete i Resursåtervinning',hp:30,type:'required',isThesis:true}].sort((a,b)=>a.term-b.term);
      x.sourceEvidenceUrl='https://kursinfodoc.hb.se/PdfMaker.aspx?code=TAREC&language=SV&revision=2%2C20&type=program';
      setCoverage(x,'choice-required','official-plan-verified-year-2-terms-3-and-4');
    }
  }
}

// TAVEC is the successor code for the same specialisation. Only apply if first-year structure is exactly two validated 30-credit terms.
{
  const x=byCode.get('TAVEC');
  if(x?.rows?.length){
    const base=x.rows.filter(r=>!(r.isThesis || /Examensarbete i Resursåtervinning/i.test(r.name||'')));
    const ts=sums(base);
    if(Math.abs((ts[1]||0)-30)<0.01 && Math.abs((ts[2]||0)-30)<0.01){
      x.rows=[...base,{term:3,name:'Examensarbete i Resursåtervinning del 1',hp:30,type:'choice',options:[{name:'Examensarbete i Resursåtervinning del 1',hp:30},{name:'Godkända kurser inom hållbar byggteknik/internationalisering',hp:30}],isThesis:true},{term:4,name:'Examensarbete i Resursåtervinning',hp:30,type:'required',isThesis:true}].sort((a,b)=>a.term-b.term);
      x.sourceEvidenceUrl='https://kursinfodoc.hb.se/PdfMaker.aspx?code=TAVEC&language=SV&revision=1%2C00&type=program';
      setCoverage(x,'choice-required','official-plan-successor-structure-year-2-verified');
    }
  }
}

// LAG46: term 3 is an elective subject block. Preserve alternatives as one 30-credit choice instead of summing them.
{
  const x=byCode.get('LAG46');
  if(x?.rows?.length){
    const t3=x.rows.filter(r=>r.term===3);
    if(t3.length>=2 && t3.every(r=>Number(r.hp)===30)){
      x.rows=[...x.rows.filter(r=>r.term!==3),{term:3,name:'Tillvalsämne för grundlärare 4–6',hp:30,type:'choice',choiceSlots:1,options:t3.map(r=>({name:r.name,hp:30})),isThesis:false}].sort((a,b)=>a.term-b.term);
      x.sourceEvidenceUrl='https://kursinfodoc.hb.se/PdfMaker.aspx?code=LAG46&language=SV&revision=22%2C10&type=program';
      const ts=sums(x.rows);
      if(Object.values(ts).every(v=>v<=30.01)) setCoverage(x,'partial-structure','official-plan-verified-term-3-elective-subject-block');
    }
  }
}

await fs.writeFile(FILE,JSON.stringify(rows,null,2)+'\n');
const meta=JSON.parse(await fs.readFile(META,'utf8'));
meta.generatedAt=new Date().toISOString();
meta.counts=rows.reduce((a,x)=>(a[x.coverage]=(a[x.coverage]||0)+1,a),{});
meta.retryable=rows.filter(x=>['metadata-only','manual-review'].includes(x.coverage)).length;
await fs.writeFile(META,JSON.stringify(meta,null,2)+'\n');
console.log('Applied verified Borås structure overrides:', ['ASYST','TGTPI','TAREC','TAVEC','LAG46'].map(code=>({code,coverage:byCode.get(code)?.coverage,reason:byCode.get(code)?.reason,termSums:byCode.get(code)?.termSums})));
// Trigger refresh after workflow integration.
