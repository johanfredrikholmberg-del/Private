import guHandler from './gu-program-structure.js';
import lundHandler from './lu-program-structure.js';
import genericHandler from './program-structure.js';

const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');

function provider(university){
  const u=norm(university);
  if(/goteborgs universitet|(^|\s)gu(\s|$)/.test(u))return{handler:guHandler,name:'Göteborgs universitet',specialized:true};
  if(/lunds universitet|(^|\s)lund(\s|$)/.test(u))return{handler:lundHandler,name:'Lunds universitet',specialized:true};
  return{handler:genericHandler,name:clean(university),specialized:false};
}

async function resolveName(req,university){
  const code=clean(req.query?.code),name=clean(req.query?.name);
  if(name||!code||!university)return name;
  const host=clean(req.headers?.['x-forwarded-host']||req.headers?.host);
  if(!host)return'';
  const proto=clean(req.headers?.['x-forwarded-proto'])||'https';
  const url=new URL(`${proto}://${host}/api/program-metadata`);
  url.searchParams.set('code',code);
  url.searchParams.set('university',university);
  const r=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(5000)});
  if(!r.ok)return'';
  const data=await r.json();
  return clean(data?.program?.name);
}

export default async function handler(req,res){
  const university=clean(req.query?.university);
  const p=provider(university);
  try{
    const name=await resolveName(req,p.name);
    if(name&&!clean(req.query?.name))req.query={...(req.query||{}),name};
  }catch(error){
    console.warn('program-structure-resolved metadata',error);
  }
  return p.handler(req,res);
}
