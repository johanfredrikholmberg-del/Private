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

export async function studielotsManifest(){return read('manifest.json');}

export async function studielotsTable(name){
  const manifest=await studielotsManifest(), table=manifest.tables?.[name];
  if(!table?.storage)throw new Error('StudieLots DB table not registered: '+name);
  const rows=JSON.parse(await readFile(join(process.cwd(),...table.storage.split('/')),'utf8'));
  if(Array.isArray(rows)&&Number.isFinite(Number(table.rows))&&rows.length!==Number(table.rows))throw new Error('StudieLots DB row count mismatch for '+name);
  return rows;
}

export function clearCanonicalProgrammeCache(){cache=null;}
