
const UA='Lotsen/0.1 syllabus resolver';

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
  for(const l of startLabels){const i=text.toLowerCase().indexOf(l.toLowerCase());if(i>=0&&(start<0||i<start)){start=i;label=l}}
  if(start<0)return '';
  let end=text.length;
  for(const l of endLabels){const i=text.toLowerCase().indexOf(l.toLowerCase(),start+label.length);if(i>=0&&i<end)end=i}
  return clean(text.slice(start+label.length,end));
}
function goalsFromText(text){
  const s=section(text,['Mål','Förväntade studieresultat','Learning outcomes'],['Innehåll','Kursens innehåll','Examination','Undervisning','Behörighetskrav']);
  if(!s)return [];
  return s.split(/(?<=[.!?])\s+|;\s+|\n+/).map(clean).filter(x=>x.length>15).slice(0,30);
}
async function fetchText(url){
  const r=await fetch(url,{headers:{'user-agent':UA,'accept':'text/html,application/xhtml+xml'}});
  if(!r.ok)throw new Error(`HTTP ${r.status}`);
  return await r.text();
}
function parseLevel(text){
  const m=text.match(/(G1N|G1F|G1E|G2F|G2E|A1N|A1F|A1E|A2E)/i);
  if(m)return m[1].toUpperCase();
  return '';
}
async function resolveUmea({code,term}){
  const url=`https://www.umu.se/utbildning/kurs-och-utbildningsplan/${encodeURIComponent(code.toLowerCase())}/`;
  const html=await fetchText(url), text=htmlText(html);
  return {
    provider:'Umeå universitet', code, version:term||'', url,
    level:parseLevel(text),
    content:section(text,['Innehåll','Kursens innehåll'],['Mål','Förväntade studieresultat','Examination','Undervisning','Behörighetskrav']),
    learningGoals:goalsFromText(text)
  };
}
async function resolveGu({code,term}){
  const search=`https://www.gu.se/studera/hitta-utbildning/hitta-kursplan-och-litteraturlista?q=${encodeURIComponent(code)}`;
  const html=await fetchText(search);
  const links=[...html.matchAll(/href=["'](\/syllabus\/[^"'?#]+)["']/gi)].map(m=>m[1]);
  if(!links.length){
    return {provider:'Göteborgs universitet',code,version:term||'',url:search,level:'',content:'',learningGoals:[],unresolved:true};
  }
  const url='https://www.gu.se'+links[0];
  const sh=await fetchText(url), text=htmlText(sh);
  return {
    provider:'Göteborgs universitet',code,version:term||'',url,
    level:parseLevel(text),
    content:section(text,['Innehåll','Kursens innehåll'],['Mål','Lärandemål','Former för undervisning','Examinationsformer','Betyg']),
    learningGoals:goalsFromText(text)
  };
}
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const {code='',university='',term='',name=''}=req.query||{};
  if(!code||!university)return res.status(400).json({error:'code and university are required'});
  try{
    let data;
    if(/umeå/i.test(university)) data=await resolveUmea({code,term,name});
    else if(/göteborg/i.test(university)) data=await resolveGu({code,term,name});
    else return res.status(422).json({error:'University provider not implemented yet',university});
    if(data.unresolved)return res.status(206).json(data);
    return res.status(200).json(data);
  }catch(e){
    return res.status(502).json({error:'Could not resolve syllabus',message:String(e?.message||e)});
  }
}
