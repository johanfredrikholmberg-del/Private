import guHandler from './gu-program-structure.js';
import lundHandler from './lu-program-structure.js';

const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
function provider(university){const u=norm(university);if(/goteborgs universitet|(^|\s)gu(\s|$)/.test(u))return{handler:guHandler,name:'Göteborgs universitet'};if(/lunds universitet|(^|\s)lund(\s|$)/.test(u))return{handler:lundHandler,name:'Lunds universitet'};return null}
async function resolveName(req,university){const code=clean(req.query?.code),name=clean(req.query?.name);if(name||!code)return name;const host=clean(req.headers?.['x-forwarded-host']||req.headers?.host);if(!host)return'';const proto=clean(req.headers?.['x-forwarded-proto'])||'https';const url=new URL(`${proto}://${host}/api/program-metadata`);url.searchParams.set('code',code);url.searchParams.set('university',university);const r=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(15000)});if(!r.ok)return'';const data=await r.json();return clean(data?.program?.name)}
export default async function handler(req,res){const p=provider(req.query?.university);if(!p)return res.status(400).json({error:'supported university is required'});try{const name=await resolveName(req,p.name);if(name&&!clean(req.query?.name))req.query={...(req.query||{}),name}}catch(error){console.warn('program-structure-resolved metadata',error)}return p.handler(req,res)}
