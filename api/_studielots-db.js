import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

let cache=null;
const read=async name=>JSON.parse(await readFile(join(process.cwd(),'data','studielots-db',name),'utf8'));

export async function canonicalProgrammeStructures(){
  if(cache)return cache;
  const manifest=await read('programme-structures-manifest.json');
  const parts=await Promise.all((manifest.parts||[]).map(read));
  const programs=parts.flatMap(x=>Array.isArray(x.programs)?x.programs:[]);
  if(programs.length!==Number(manifest.count))throw new Error(`Canonical programme DB count mismatch: ${programs.length}/${manifest.count}`);
  cache={programs,manifest};
  return cache;
}

export function clearCanonicalProgrammeCache(){cache=null;}
