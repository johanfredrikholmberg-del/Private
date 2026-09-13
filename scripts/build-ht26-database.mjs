#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

// Canonical term database builder. SUSA and university-specific feeds are staging sources only.
const TERM='HT26';
const SRC='data/susa';
const DEST=`data/${TERM}`;

const readJson=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const readOptionalJson=async(file,fallback=[])=>{try{return await readJson(file)}catch{return fallback}};
const writeJson=async(file,value)=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(value,null,2)+'\n')};
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const keyFor=(university,code,name,hp)=>[norm(university),clean(code).toUpperCase()||norm(name),Number(hp)||0].join('|');

async function main(){
  const [programmes,courses,structures,providers,existingSyllabusVersions,existingDegreeRequirements]=await Promise.all([
    readJson(path.join(SRC,'programmes.json')),
    readJson(path.join(SRC,'courses.json')),
    readJson(path.join(SRC,'structures.json')),
    readJson(path.join(SRC,'providers.json')),
    readOptionalJson(path.join(DEST,'syllabus-versions.json'),[]),
    readOptionalJson(path.join(DEST,'degree-requirements.json'),[])
  ]);

  const programMap=new Map();
  for(const p of programmes){
    const university=clean(p.university||p.providerName||p.provider);
    const code=clean(p.programCode||p.code);
    const name=clean(p.programName||p.name||p.title);
    const hp=Number(p.programHp||p.hp||p.credits)||0;
    const key=clean(p.key)||keyFor(university,code,name,hp);
    if(!university||!name) continue;
    const row={...p,key,term:TERM,university,programCode:code,programName:name,programHp:hp};
    const old=programMap.get(key);
    if(!old||String(row.sourceId||'')>String(old.sourceId||'')) programMap.set(key,row);
  }

  const structureMap=new Map();
  for(const s of structures){
    const key=clean(s.key)||keyFor(s.university,s.programCode,s.programName,s.hp||s.programHp);
    if(!key) continue;
    const old=structureMap.get(key);
    const rank={complete:5,'choice-required':4,'partial-structure':3,'manual-review':2,'metadata-only':1};
    if(!old||(rank[s.coverage]||0)>=(rank[old.coverage]||0)) structureMap.set(key,{...s,key,term:TERM});
  }

  const courseMap=new Map();
  for(const c of courses){
    const university=clean(c.university||c.providerName||c.provider);
    const code=clean(c.courseCode||c.code).toUpperCase();
    const name=clean(c.courseName||c.name||c.title);
    const hp=Number(c.courseHp||c.hp||c.credits)||0;
    const key=[norm(university),code||norm(name),hp].join('|');
    if(!university||(!code&&!name)) continue;
    const old=courseMap.get(key);
    const row={...c,key,term:TERM,university,courseCode:code,courseName:name,courseHp:hp};
    if(!old||String(row.sourceId||'')>String(old.sourceId||'')) courseMap.set(key,row);
  }

  const programs=[...programMap.values()];
  const programStructures=[...structureMap.values()];
  const canonicalCourses=[...courseMap.values()];
  const programmeKeys=new Set(programs.map(x=>x.key));
  const orphanStructures=programStructures.filter(x=>!programmeKeys.has(x.key)).map(x=>x.key);
  const syllabusVersions=Array.isArray(existingSyllabusVersions)?existingSyllabusVersions:[];
  const degreeRequirements=Array.isArray(existingDegreeRequirements)?existingDegreeRequirements:[];

  await Promise.all([
    writeJson(path.join(DEST,'programs.json'),programs),
    writeJson(path.join(DEST,'program-structures.json'),programStructures),
    writeJson(path.join(DEST,'courses.json'),canonicalCourses),
    writeJson(path.join(DEST,'providers.json'),providers),
    writeJson(path.join(DEST,'syllabus-versions.json'),syllabusVersions),
    writeJson(path.join(DEST,'degree-requirements.json'),degreeRequirements)
  ]);

  const manifest={
    database:'StudieLots HT26',
    term:TERM,
    schemaVersion:1,
    generatedAt:new Date().toISOString(),
    canonical:true,
    policy:'One canonical record per programme and per course/provider/credit combination. University-specific importers enrich these records; they must not create parallel programme databases.',
    tables:{
      programs:{file:'programs.json',rows:programs.length},
      programStructures:{file:'program-structures.json',rows:programStructures.length},
      courses:{file:'courses.json',rows:canonicalCourses.length},
      providers:{file:'providers.json',rows:providers.length},
      syllabusVersions:{file:'syllabus-versions.json',rows:syllabusVersions.length},
      degreeRequirements:{file:'degree-requirements.json',rows:degreeRequirements.length}
    },
    validation:{orphanStructures:orphanStructures.length,orphanStructureKeys:orphanStructures.slice(0,100)}
  };
  await writeJson(path.join(DEST,'manifest.json'),manifest);
  console.log(JSON.stringify(manifest,null,2));
}

main().catch(error=>{console.error(error);process.exitCode=1});
