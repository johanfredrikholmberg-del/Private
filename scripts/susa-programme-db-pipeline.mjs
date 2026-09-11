#!/usr/bin/env node
/**
 * StudieLots bulk programme catalogue pipeline.
 *
 * Goal:
 *  1) Download the complete higher-education catalogue from SUSA-navet.
 *  2) Materialise stable programme/course/provider identities locally.
 *  3) Produce a structure-enrichment queue for official university pages.
 *  4) On later runs use updatedSince for incremental refreshes.
 *
 * This is an OFFLINE import job, never a request-time Vercel function.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const API = process.env.SUSA_API_BASE || 'https://api.skolverket.se/susa-navet';
const OUT = process.env.SUSA_OUT || 'data/susa';
const UPDATED_SINCE = process.env.SUSA_UPDATED_SINCE || '';
const SCHOOL_TYPE = process.env.SUSA_SCHOOL_TYPE || 'HS';
const PAGE_SIZE = Number(process.env.SUSA_PAGE_SIZE || 500);

const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const arr = v => Array.isArray(v) ? v : (v == null ? [] : [v]);
const first = (...v) => v.map(clean).find(Boolean) || '';
const slug = v => clean(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'StudieLots-SUSA-import/1.0' } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${url}`);
  return r.json();
}

function itemsOf(j) {
  if (Array.isArray(j)) return j;
  for (const k of ['items','results','data','educationEvents','educationInfos','educationProviders']) if (Array.isArray(j?.[k])) return j[k];
  return [];
}
function nextOf(j) {
  return j?.links?.next || j?.next || j?.nextPage || j?._links?.next?.href || '';
}

async function paged(endpoint) {
  const all=[];
  let page=1, next='';
  do {
    const u = next ? new URL(next, API) : new URL(`${API.replace(/\/$/,'')}/${endpoint.replace(/^\//,'')}`);
    if (!next) {
      u.searchParams.set('schoolType', SCHOOL_TYPE);
      u.searchParams.set('pageSize', String(PAGE_SIZE));
      u.searchParams.set('page', String(page));
      if (UPDATED_SINCE) u.searchParams.set('updatedSince', UPDATED_SINCE);
    }
    const j=await getJson(u);
    const xs=itemsOf(j); all.push(...xs);
    next=nextOf(j);
    if (!next && xs.length===PAGE_SIZE) page++; else if (!next) break;
  } while (true);
  return all;
}

function idOf(x) { return first(x?.identifier, x?.id, x?.educationInfoIdentifier, x?.educationEventIdentifier, x?.code); }
function providerIds(x) { return arr(x?.providers ?? x?.provider).map(p => typeof p==='string' ? p : idOf(p)).filter(Boolean); }
function typeOf(x) { return first(x?.educationType, x?.type, x?.educationForm, x?.educationInfoType).toLowerCase(); }
function hpOf(x) { const n=Number(x?.credits ?? x?.creditValue ?? x?.extent?.value ?? x?.scope?.value); return Number.isFinite(n)?n:null; }
function nameOf(x) { return first(x?.name?.sv, x?.name, x?.title?.sv, x?.title); }
function codeOf(x) { return first(x?.educationCode, x?.programCode, x?.courseCode, x?.code); }
function urlsOf(x) { return [...new Set(arr(x?.urls ?? x?.url ?? x?.webpage ?? x?.application?.url).flatMap(v => typeof v==='string'?[v]:[v?.url,v?.href]).filter(Boolean))]; }

function normalizeInfo(x) {
  const type=typeOf(x);
  return {
    susaId:idOf(x), name:nameOf(x), code:codeOf(x), type,
    kind:/course|kurs/.test(type)?'course':(/program|programme/.test(type)?'programme':'other'),
    hp:hpOf(x), level:first(x?.educationLevel, x?.level), subjects:arr(x?.subjects).map(v=>clean(v?.name?.sv ?? v?.name ?? v)).filter(Boolean),
    providerIds:providerIds(x), urls:urlsOf(x), lastEdited:first(x?.lastEdited), expires:first(x?.expires), raw:x
  };
}
function normalizeProvider(x) { return { susaId:idOf(x), name:nameOf(x), code:codeOf(x), urls:urlsOf(x), raw:x }; }
function normalizeEvent(x) { return { susaId:idOf(x), educationInfoId:first(x?.educationInfoIdentifier,x?.educationInfoId,x?.education?.identifier,x?.education?.id), providerIds:providerIds(x), start:first(x?.start,x?.startDate,x?.startSemester), end:first(x?.end,x?.endDate), distance:Boolean(x?.distance ?? x?.isDistance), location:first(x?.location?.name,x?.location,x?.place?.name), urls:urlsOf(x), lastEdited:first(x?.lastEdited), raw:x }; }

async function main(){
  await fs.mkdir(OUT,{recursive:true});
  // Endpoint names follow SUSA v3 resource names. Override base URL in CI if Swagger exposes a versioned prefix.
  const [providerRaw,infoRaw,eventRaw]=await Promise.all([
    paged('education-providers'), paged('education-infos'), paged('education-events')
  ]);
  const providers=providerRaw.map(normalizeProvider).filter(x=>x.susaId);
  const infos=infoRaw.map(normalizeInfo).filter(x=>x.susaId);
  const events=eventRaw.map(normalizeEvent).filter(x=>x.susaId);
  const pmap=new Map(providers.map(x=>[x.susaId,x]));
  const emap=new Map(); for(const e of events){const a=emap.get(e.educationInfoId)||[];a.push(e);emap.set(e.educationInfoId,a)}
  const catalogue=infos.map(i=>({
    ...i, raw:undefined,
    providers:i.providerIds.map(id=>pmap.get(id)).filter(Boolean).map(p=>({id:p.susaId,name:p.name,code:p.code,urls:p.urls})),
    events:(emap.get(i.susaId)||[]).map(({raw,...e})=>e)
  }));
  const programmes=catalogue.filter(x=>x.kind==='programme');
  const courses=catalogue.filter(x=>x.kind==='course');
  const structureQueue=programmes.map(p=>({
    key:`${slug(p.providers[0]?.name)}:${p.code||p.susaId}`,
    susaId:p.susaId, university:p.providers[0]?.name||'', programCode:p.code, programName:p.name, hp:p.hp,
    officialUrls:[...new Set([...p.urls,...p.providers.flatMap(x=>x.urls||[]),...p.events.flatMap(x=>x.urls||[])])],
    status:'pending-official-structure', attempts:0
  }));
  const meta={generatedAt:new Date().toISOString(),schoolType:SCHOOL_TYPE,updatedSince:UPDATED_SINCE||null,counts:{providers:providers.length,educationInfos:infos.length,events:events.length,programmes:programmes.length,courses:courses.length,structureQueue:structureQueue.length}};
  await Promise.all([
    fs.writeFile(path.join(OUT,'meta.json'),JSON.stringify(meta,null,2)+'\n'),
    fs.writeFile(path.join(OUT,'providers.json'),JSON.stringify(providers.map(({raw,...x})=>x),null,2)+'\n'),
    fs.writeFile(path.join(OUT,'programmes.json'),JSON.stringify(programmes,null,2)+'\n'),
    fs.writeFile(path.join(OUT,'courses.json'),JSON.stringify(courses,null,2)+'\n'),
    fs.writeFile(path.join(OUT,'structure-queue.json'),JSON.stringify(structureQueue,null,2)+'\n')
  ]);
  console.log(JSON.stringify(meta,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
