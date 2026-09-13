const url='https://www.umu.se/utbildning/kurs-och-utbildningsplan/sgsds/';
const r=await fetch(url,{headers:{accept:'text/html,application/xhtml+xml','user-agent':'StudieLots/1.0'}});
const html=await r.text();
console.log('status',r.status,'bytes',html.length);
for(const needle of ['Programmets upplägg','Studieplan','Termin 1','Programkod','SGSDS','Verktyg för data science'])console.log(needle,html.indexOf(needle));
const idx=Math.max(html.indexOf('Programmets upplägg'),html.indexOf('Studieplan'),html.indexOf('Termin 1'));
console.log(html.slice(Math.max(0,idx-1500),Math.min(html.length,idx+5000)));
