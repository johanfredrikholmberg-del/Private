const UA='Lotsen/0.2 syllabus resolver';

function clean(s=''){return String(s).replace(/\s+/g,' ').trim()}
function htmlText(s=''){
  return clean(String(s)
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/g,' ')
    .replace(/&amp;/g,'&')
    .replace(/&quot;/g,'"')
    .replace(/&#39;/g,"'"));
}
function section(text,startLabels,endLabels){
  let start=-1,label='';
  for(const l of startLabels){
    const i=text.toLowerCase().indexOf(l.toLowerCase());
    if(i>=0&&(start<0||i<start)){start=i;label=l}
  }
  if(start<0)return '';
  let end=text.length;
  for(const l of endLabels){
    const i=text.toLowerCase().indexOf(l.toLowerCase(),start+label.length);
    if(i>=0&&i<end)end=i;
  }
  return clean(text.slice(start+label.length,end));
}
function goalsFromText(text){
  const s=section(text,['Mål','Förväntade studieresultat','Learning outcomes'],['Innehåll','Kursens innehåll','Examination','Undervisning','Behörighetskrav']);
  if(!s)return [];
  return s.split(/(?<=[.!?])\s+|;\s+|\n+/).map(clean).filter(x=>x.length>15).slice(0,30);
}
async function fetchText(url){
  const r=await fetch(url,{headers:{'user-agent':UA,'accept':'text/html,application/xhtml+xml,text/plain'}});
  if(!r.ok)throw new Error(`HTTP ${r.status}`);
  return await r.text();
}
function parseProgression(text){
  const m=String(text||'').match(/\b(G1N|G1F|G1E|G2F|G2E|GX|A1N|A1F|A1E|A2E|AX)\b/i);
  return m?m[1].toUpperCase():'';
}
function parseLevel(text){
  const s=String(text||'').replace(/\u00ad/g,' ');
  const progression=parseProgression(s);
  if(/^A/i.test(progression))return 'Avancerad nivå';
  if(/^G/i.test(progression))return 'Grundnivå';
  if(/avancerad\s*nivå|second\s*cycle|advanced\s*level/i.test(s))return 'Avancerad nivå';
  if(/grund\s*nivå|grundnivå|first\s*cycle/i.test(s))return 'Grundnivå';
  return '';
}
function aroundCode(text,code,radius=1800){
  const s=String(text||''), i=s.toLowerCase().indexOf(String(code||'').toLowerCase());
  if(i<0)return s;
  return s.slice(Math.max(0,i-radius),Math.min(s.length,i+radius));
}
function result(provider,code,term,url,text){
  const local=aroundCode(text,code);
  return {
    provider,code,version:term||'',url,
    level:parseLevel(local),
    progression:parseProgression(local),
    content:section(local,['Innehåll','Kursens innehåll'],['Mål','Förväntade studieresultat','Examination','Undervisning','Behörighetskrav']),
    learningGoals:goalsFromText(local)
  };
}

async function resolveUmea({code,term}){
  const url=`https://www.umu.se/utbildning/kurs-och-utbildningsplan/${encodeURIComponent(code.toLowerCase())}/`;
  const text=htmlText(await fetchText(url));
  return result('Umeå universitet',code,term,url,text);
}
async function resolveGu({code,term}){
  const search=`https://www.gu.se/studera/hitta-utbildning/hitta-kursplan-och-litteraturlista?q=${encodeURIComponent(code)}`;
  const html=await fetchText(search);
  const links=[...html.matchAll(/href=["'](\/syllabus\/[^"'?#]+)["']/gi)].map(m=>m[1]);
  if(!links.length){
    const text=htmlText(html);
    const fallback=result('Göteborgs universitet',code,term,search,text);
    return {...fallback,unresolved:!fallback.level};
  }
  const url='https://www.gu.se'+links[0];
  const text=htmlText(await fetchText(url));
  return result('Göteborgs universitet',code,term,url,text);
}
async function resolveMiun({code,term}){
  const url=`https://www.miun.se/utbildning/kursplaner-och-utbildningsplaner/${encodeURIComponent(code.toUpperCase())}/`;
  const text=htmlText(await fetchText(url));
  return result('Mittuniversitetet',code,term,url,text);
}
async function resolveKau({code,term}){
  const url=`https://www.kau.se/utbildning/program-och-kurser/kurser/${encodeURIComponent(code.toUpperCase())}`;
  const text=htmlText(await fetchText(url));
  return result('Karlstads universitet',code,term,url,text);
}
async function resolveHalmstad({code,term}){
  const url=`https://www.hh.se/student/innehall-a-o/kurs--och-utbildningsplaner.html?query=${encodeURIComponent(code.toUpperCase())}`;
  const text=htmlText(await fetchText(url));
  const local=aroundCode(text,code,900);
  const r=result('Högskolan i Halmstad',code,term,url,local);
  return {...r,unresolved:!r.level};
}
async function resolveLnu({code,term}){
  // LNU exposes level prominently in public course pages. The code convention is
  // also useful as a conservative fallback: 4xxxx = advanced level.
  const search=`https://lnu.se/sok/?q=${encodeURIComponent(code.toUpperCase())}`;
  let text='';
  try{text=htmlText(await fetchText(search))}catch(e){}
  let r=result('Linnéuniversitetet',code,term,search,text);
  if(!r.level && /^4[A-ZÅÄÖ0-9]/i.test(code)){
    r={...r,level:'Avancerad nivå',progression:r.progression||'',levelByCode:true};
  }
  return {...r,unresolved:!r.level};
}

function universityKind(university=''){
  const u=String(university).toLowerCase();
  if(/göteborg|gothenburg/.test(u))return 'gu';
  if(/umeå|umea/.test(u))return 'umu';
  if(/mittuniversitet|mid sweden/.test(u))return 'miun';
  if(/karlstad/.test(u))return 'kau';
  if(/linné|linne|linnaeus/.test(u))return 'lnu';
  if(/halmstad/.test(u))return 'hh';
  return '';
}

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const {code='',university='',term='',name=''}=req.query||{};
  if(!code||!university)return res.status(400).json({error:'code and university are required'});
  try{
    const kind=universityKind(university);
    let data;
    if(kind==='umu')data=await resolveUmea({code,term,name});
    else if(kind==='gu')data=await resolveGu({code,term,name});
    else if(kind==='miun')data=await resolveMiun({code,term,name});
    else if(kind==='kau')data=await resolveKau({code,term,name});
    else if(kind==='lnu')data=await resolveLnu({code,term,name});
    else if(kind==='hh')data=await resolveHalmstad({code,term,name});
    else return res.status(422).json({error:'University provider not implemented yet',university});
    if(data.unresolved)return res.status(206).json(data);
    return res.status(200).json(data);
  }catch(e){
    return res.status(502).json({error:'Could not resolve syllabus',message:String(e?.message||e)});
  }
}
