const API='https://api.skolverket.se/susa-navet/emil3/';
const fs=await import('node:fs');
const clean=v=>String(v??'').trim();
const loc=v=>{const xs=v?.strings||v?.urls||[];return clean((xs.find(x=>String(x?.lang||'').toLowerCase()==='swe')||xs[0])?.value)};
async function get(path){const r=await fetch(new URL(path,API),{headers:{accept:'application/json'}});if(!r.ok)throw Error(path+' '+r.status);return r.json()}
const list=(d,keys)=>{if(Array.isArray(d))return d;for(const k of keys)if(Array.isArray(d?.[k]))return d[k];return[]};
async function pages(path,keys,max=100){const first=await get(path+'?schoolType=HS&page=0&size=2000');const n=Math.min(Number(first?.totalPages??first?.page?.totalPages??1)||1,max);const out=[...list(first,keys)];for(let p=1;p<n;p++){const d=await get(path+'?schoolType=HS&page='+p+'&size=2000');out.push(...list(d,keys));}return out}
const [events,providers]=await Promise.all([pages('educationEvents',['educationEvents','items','content','results','data'],100),pages('educationProviders',['educationProviders','items','content','results','data'],30)]);
const providerMap=new Map(providers.map(p=>[clean(p?.id||p?.content?.identifier),p]));
const infoCache=new Map();
const rows=[];
for(const event of events){
 const ec=event?.content||{}; const start=clean(ec.startDate||ec.start||ec.from); const ts=Date.parse(start);
 if(!Number.isFinite(ts)||ts<Date.now()-86400000)continue;
 const educationId=clean(ec.education), provider=providerMap.get(clean(ec.providers?.[0])); if(!educationId||!provider)continue;
 let info=infoCache.get(educationId); if(info===undefined){try{info=await get('educationInfos/'+encodeURIComponent(educationId))}catch{info=null}infoCache.set(educationId,info)} if(!info)continue;
 const ic=info.content||{}, cfg=clean(ic?.configuration?.code).toLowerCase(); if(!['kurs','course'].includes(cfg))continue;
 const hp=Number(ic?.credits?.credits)||0, code=clean(ic.code), name=loc(ic.title), university=loc(provider?.content?.name), url=loc(ec?.application?.url)||loc(ic.url);
 if(!name||!university||!code||!(hp>0)||!url)continue;
 const distance=Boolean(ec.distance), offeringId=clean(event?.id||ec.identifier);
 rows.push({source:'skolverket-susa-navet',sourceId:educationId,offeringId,offeringKey:['susa',offeringId||educationId,start].join('|'),definitionKey:[university.toLocaleLowerCase('sv'),code.toUpperCase().replace(/[^A-Z0-9ÅÄÖ]/g,''),'course'].join('|'),name,code,university,hp,pace:Number(ec?.paceOfStudy?.percentage)||null,startDate:start,distance,standaloneSearchable:true,currentOffering:true,verified:true,url});
}
const seen=new Set(), offerings=rows.filter(x=>!seen.has(x.offeringKey)&&seen.add(x.offeringKey)).sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.university.localeCompare(b.university,'sv')||a.code.localeCompare(b.code,'sv'));
fs.mkdirSync('data/offerings',{recursive:true}); fs.writeFileSync('data/offerings/canonical.json',JSON.stringify(offerings,null,2)+'\n');
const meta={updated:new Date().toISOString(),source:'skolverket-susa-navet',count:offerings.length,distance:offerings.filter(x=>x.distance).length,universities:new Set(offerings.map(x=>x.university)).size};
fs.writeFileSync('data/offerings/meta.json',JSON.stringify(meta,null,2)+'\n'); console.log(meta);