#!/usr/bin/env node
/**
 * Resolve filtered KTH historical TG records against data/kth/courses.json.
 * Input JSON must contain already-filtered 1-to-1 records.
 * No fuzzy matching: target course name + hp must resolve uniquely.
 */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const [,,input='data/kth/history-1to1.json',catalog='data/kth/courses.json',output='data/kth/history-resolved.json']=process.argv;
const norm=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const hp=v=>{const m=String(v??'').replace(',','.').match(/\d+(?:\.\d+)?/);return m?Number(m[0]):0};
const generic=s=>/utbytesstudier|kurser inom programmet|valbar|elective|generell|unspecified/i.test(String(s??''));
const stableId=r=>'kth-'+crypto.createHash('sha256').update(JSON.stringify([r.STUDENT,r.UTBILDNING_KOD,r.BESLUTSDATUM,r.KURS,r.KURS_HP,r.KURS_KTH,r.KURS_KTH_HP])).digest('hex').slice(0,20);

const history=JSON.parse(await fs.readFile(input,'utf8'));
const cat=JSON.parse(await fs.readFile(catalog,'utf8'));
const courses=cat.courses||cat;
const index=new Map();
for(const c of courses){
 const key=norm(c.nameSv||c.name||c.title);
 if(!key)continue;
 const a=index.get(key)||[];a.push(c);index.set(key,a);
}
const resolved=[],unresolved=[];
for(const r of history){
 const sourceName=r.KURS??r.sourceName, targetName=r.KURS_KTH??r.targetName;
 const sourceHp=hp(r.KURS_HP??r.sourceHp), targetHp=hp(r.KURS_KTH_HP??r.targetHp);
 if(!sourceName||!targetName||generic(targetName)){unresolved.push({...r,reason:'generic-or-missing'});continue}
 const candidates=(index.get(norm(targetName))||[]).filter(c=>Math.abs(hp(c.hp)-targetHp)<0.01);
 if(candidates.length!==1){unresolved.push({...r,reason:candidates.length?'ambiguous':'no-exact-match'});continue}
 const c=candidates[0];
 resolved.push({id:stableId(r),university:'KTH',sourceName,sourceHp,targetName,targetHp,targetCode:c.code,decision:'approved',decisionDate:r.BESLUTSDATUM??null,programmeCode:r.UTBILDNING_KOD??null});
}
await fs.writeFile(output,JSON.stringify({source:'KTH historical TG',policy:'strict-1-to-1-exact-name-hp',resolvedCount:resolved.length,unresolvedCount:unresolved.length,records:resolved},null,2)+'\n');
await fs.writeFile(output.replace(/\.json$/,'.unresolved.json'),JSON.stringify({count:unresolved.length,records:unresolved},null,2)+'\n');
console.log(JSON.stringify({input:history.length,resolved:resolved.length,unresolved:unresolved.length}));
