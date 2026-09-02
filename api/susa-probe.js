const BASE='https://api.skolverket.se/susa-navet/emil3/educationInfos';
const TARGETS={
  'företagsekonomi':['företagsekonomi','business administration'],
  'psykologi':['psykologi','psychology'],
  'idrottsvetenskap':['idrottsvetenskap','sport science'],
  'nationalekonomi':['nationalekonomi','economics'],
  'statsvetenskap':['statsvetenskap','political science'],
  'historia':['historia','history']
};
function titles(item){return (item?.content?.title?.strings||[]).map(x=>String(x.value||'').trim()).filter(Boolean)}
export default async function handler(req,res){try{
  const firstUrl=new URL(BASE);firstUrl.searchParams.set('schoolType','HS');firstUrl.searchParams.set('page','0');firstUrl.searchParams.set('size','2000');
  const first=await (await fetch(firstUrl,{headers:{accept:'application/json'}})).json();
  const totalPages=Number(first?.page?.totalPages)||1;
  const urls=Array.from({length:totalPages},(_,page)=>{const u=new URL(BASE);u.searchParams.set('schoolType','HS');u.searchParams.set('page',String(page));u.searchParams.set('size','2000');return u});
  const pages=await Promise.all(urls.map(async (u,i)=>i===0?first:(await (await fetch(u,{headers:{accept:'application/json'}})).json()).catch?null:null));
  const items=[];
  for(let i=0;i<pages.length;i++){
    const page=i===0?first:pages[i];
    if(page?.educationInfos)items.push(...page.educationInfos);
  }
  const out={};
  for(const [subject,terms] of Object.entries(TARGETS)){
    const matches=items.filter(item=>String(item?.content?.configuration?.code||'').toLowerCase()==='kurs'&&titles(item).some(t=>terms.some(term=>t.toLocaleLowerCase('sv').includes(term))));
    const counts={};
    for(const item of matches)for(const s of item?.content?.subjects||[])if(s.type==='UH_Subject')counts[s.code]=(counts[s.code]||0)+1;
    out[subject]={matches:matches.length,codes:counts,examples:matches.slice(0,20).map(item=>({title:titles(item),subjects:item.content?.subjects,code:item.content?.code,credits:item.content?.credits}))};
  }
  return res.status(200).json({totalPages,totalItems:items.length,out});
}catch(e){return res.status(500).json({error:String(e),stack:String(e?.stack||'').slice(0,800)})}}
