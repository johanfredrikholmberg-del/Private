#!/usr/bin/env node
import fs from 'node:fs/promises';
import { KAU_GENERATED_PROGRAMS } from '../lib/kau-program-database.generated.js';

const UNI='Karlstads universitet';
const old=JSON.parse(await fs.readFile('data/susa/structures.json','utf8'));
const withoutKau=old.filter(x=>String(x?.university||'').trim()!==UNI);
const fresh=Object.entries(KAU_GENERATED_PROGRAMS).map(([code,p])=>({
  key:`karlstads-universitet:${code}`,
  susaId:'',
  university:UNI,
  programCode:code,
  programName:p.name||'',
  hp:p.hp??null,
  subject:'',
  officialUrls:Array.isArray(p.sourceUrls)?p.sourceUrls:(p.sourceUrl?[p.sourceUrl]:[]),
  status:p.coverage==='metadata-only'?'manual-review':'processed',
  sourceUrl:p.sourceUrl||'',
  source:p.source||'karlstad-audited-program-database',
  rows:Array.isArray(p.rows)?p.rows:[],
  coverage:p.coverage||'metadata-only',
  reason:p.reason||'audited-baseline',
  expectedTerms:p.expectedTerms??null,
  completeTerms:Array.isArray(p.completeTerms)?p.completeTerms:[],
  underPlanning:Boolean(p.underPlanning),
  audited:Boolean(p.audited),
  checkedAt:p.auditedAt||null
}));
if(fresh.length!==134) throw new Error(`Expected 134 audited Karlstad programmes, got ${fresh.length}`);
await fs.writeFile('data/susa/structures.json',JSON.stringify([...withoutKau,...fresh],null,2)+'\n');
const counts=fresh.reduce((a,x)=>(a[x.coverage]=(a[x.coverage]||0)+1,a),{});
console.log(JSON.stringify({merged:fresh.length,counts},null,2));
