import lundHandler from './lu-program-structure.js';

const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
async function resolveName(req){
  const code=clean(req.query?.code),name=clean(req.query?.name);
  if(name||!code)return name;
  const host=clean(req.headers?.['x-forwarded-host']||req.headers?.host);
  if(!host)return '';
  const proto=clean(req.headers?.['x-forwarded-proto'])||'https';
  const url=new URL(`${proto}://${host}/api/program-metadata`);
  url.searchParams.set('code',code);
  url.searchParams.set('university',clean(req.query?.university)||'Lunds universitet');
  const r=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(15000)});
  if(!r.ok)return '';
  const data=await r.json();
  return clean(data?.program?.name);
}
export default async function handler(req,res){
  try{
    const name=await resolveName(req);
    if(name&&!clean(req.query?.name))req.query={...(req.query||{}),name};
  }catch(error){console.warn('lu-program-structure-v702 metadata',error)}
  return lundHandler(req,res);
}
