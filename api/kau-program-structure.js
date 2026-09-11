const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const decode=s=>String(s??'').replace(/&nbsp;|&#160;|&#xA0;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&aring;/gi,'å').replace(/&auml;/gi,'ä').replace(/&ouml;/gi,'ö').replace(/&Aring;/g,'Å').replace(/&Auml;/g,'Ä').replace(/&Ouml;/g,'Ö').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
async function getHtml(url){const r=await fetch(url,{headers:{accept:'text/html,application/xhtml+xml','user-agent':'StudieLots/1.0 programme-structure'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`Karlstad ${r.status}`);return r.text()}
function totalHp(html){const text=decode(String(html).replace(/<[^>]+>/g,' '));const m=text.match(/(?:Civilekonomprogrammet|programmet|program)\s*\(?\s*(\d{2,3})\s*hp\s*\)?/i)||text.match(/(\d{2,3})\s*hp\s*\|\s*Karlstads universitet/i);return m?Number(m[1]):0}
function tokenized(html){
 let s=String(html||'');
 s=s.replace(/<a\b[^>]*href=["'][^"']*\/kurser\/([A-ZÅÄÖ0-9-]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi,(_,code,label)=>`${decode(label.replace(/<[^>]+>/g,' '))} [[CODE:${clean(code).toUpperCase()}]]`);
 s=s.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(?:tr|p|div|li|h[1-6]|section|article)>/gi,'\n').replace(/<\/td>/gi,'\t').replace(/<[^>]+>/g,' ');
 return decode(s).replace(/\r/g,'').split('\n').map(x=>x.replace(/[ \t]+/g,' ').trim()).filter(Boolean)
}
function parseRows(html){
 const lines=tokenized(html);let start=lines.findIndex(x=>/programmets studiegång/i.test(x));if(start<0)start=0;
 let term=0;const rows=[];
 for(let i=start;i<lines.length;i++){
  const line=lines[i];if(i>start&&/^(?:Efter utbildningen|Examen|Behörighet|Kontakt|Mer information)\b/i.test(line))break;
  const tm=line.match(/^Termin\s+(\d{1,2})\b/i);if(tm){term=Number(tm[1]);continue}
  if(!term||/poängsumma/i.test(line))continue;
  let candidate=line;let hpMatch=candidate.match(/(?:\||\s)(\d+(?:[,.]\d+)?)\s*(?:hp)?\s*$/i);
  if(!hpMatch&&/^\d+(?:[,.]\d+)?$/.test(lines[i+1]||'')){candidate=`${candidate} ${lines[++i]}`;hpMatch=candidate.match(/(\d+(?:[,.]\d+)?)\s*$/)}
  if(!hpMatch)continue;const hp=Number(hpMatch[1].replace(',','.'));if(!(hp>0&&hp<=60))continue;
  const code=clean(candidate.match(/\[\[CODE:([^\]]+)\]\]/i)?.[1]).toUpperCase();
  let name=clean(candidate.slice(0,hpMatch.index).replace(/\[\[CODE:[^\]]+\]\]/ig,'').replace(/\|\s*$/,'').replace(/\((?:Obligatorisk|Valbar|Valfri)\)/ig,' '));
  const category=/\(Valbar\)|\bValbar kurs\b/i.test(candidate)?'elective':/\(Valfri\)|\bValfri kurs\b/i.test(candidate)?'elective':'mandatory';
  if(!name||/^(?:HP|Termin|Poängsumma)$/i.test(name))continue;
  const note=clean(candidate.replace(/\[\[CODE:[^\]]+\]\]/ig,'').replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),'').replace(/\d+(?:[,.]\d+)?\s*(?:hp)?\s*$/i,'').replace(/[|()]/g,' '));
  rows.push({term,__slOriginalTerm:term,name,code,hp,category,status:'remaining',credited:false,isCredited:false,programmeSource:'kau-official-program-page',note});
 }
 const seen=new Set();return rows.filter(r=>{const k=`${r.term}|${norm(r.name)}|${r.code}|${r.hp}`;if(seen.has(k))return false;seen.add(k);return true})
}
function normalizeTerms(rows,total){
 const expected=total?Math.round(total/30):Math.max(0,...rows.map(r=>r.term));const courses=[];let choiceRequired=false;const completeTerms=[];
 for(let term=1;term<=expected;term++){
  const list=rows.filter(r=>r.term===term),sum=Math.round(list.reduce((s,r)=>s+r.hp,0)*10)/10;
  if(sum>=27&&sum<=33){courses.push(...list);completeTerms.push(term);continue}
  if(sum>33&&list.length>=2){choiceRequired=true;courses.push({term,__slOriginalTerm:term,name:'Val inom programmet',code:'',hp:30,category:'elective',status:'remaining',credited:false,isCredited:false,programmeSource:'kau-official-program-page',slotType:'programme-choice-slot',isSlot:true,selectionMode:'published-programme-options',choicePolicy:'published-options-only',options:list.map(x=>({name:x.name,code:x.code,hp:x.hp,category:x.category,note:x.note}))});completeTerms.push(term)}
 }
 return{courses:courses.map((r,i)=>({...r,__slOriginalIndex:i})),completeTerms,expectedTerms:expected,choiceRequired,complete:expected>0&&completeTerms.length===expected}
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','s-maxage=21600, stale-while-revalidate=86400');const code=clean(req.query?.code).toUpperCase().replace(/[^A-ZÅÄÖ0-9-]/g,''),name=clean(req.query?.name);if(!code)return res.status(400).json({error:'code is required'});
 const url=`https://www.kau.se/utbildning/program-och-kurser/program/${encodeURIComponent(code)}`;
 try{const html=await getHtml(url),raw=parseRows(html),total=Number(req.query?.hp)||totalHp(html),q=normalizeTerms(raw,total);return res.status(200).json({found:raw.length>0,structureAvailable:q.complete,courses:q.complete?q.courses:[],program:{name:name||'',code,university:'Karlstads universitet'},source:'kau-official-program-page',confidence:q.complete?(q.choiceRequired?'official-published-choice-structure':'official-published-sequenced'):'official-partial',coverage:q.complete?(q.choiceRequired?'choice-required':'complete-term-sequence'):'partial-or-semester-incomplete',completeTerms:q.completeTerms,expectedTerms:q.expectedTerms,totalHp:total||0,parsedHp:Math.round(raw.reduce((s,r)=>s+r.hp,0)*10)/10,parsedRows:raw.length,choiceRequired:q.choiceRequired,sourceUrls:[url],checkedAt:new Date().toISOString(),policy:'Karlstad official programme study path. Terms with mutually exclusive published alternatives are represented as choice slots; StudieLots never combines alternatives into one invented path.'})}catch(error){console.error('kau-program-structure',error);return res.status(200).json({found:false,structureAvailable:false,courses:[],temporarilyUnavailable:true,source:'kau-official-program-page',sourceUrls:[url],checkedAt:new Date().toISOString()})}
}
