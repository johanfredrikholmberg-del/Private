#!/usr/bin/env python3
import json,re,time,urllib.request,urllib.parse
from pathlib import Path
from io import BytesIO
from pypdf import PdfReader

RANK={'metadata-only':1,'manual-review':2,'partial-structure':3,'choice-required':4,'complete':5}
UA={'User-Agent':'StudieLots-KAU-plan/2.0'}
def get(url,binary=False):
    last=None
    for attempt in range(6):
        try:
            req=urllib.request.Request(url,headers=UA)
            with urllib.request.urlopen(req,timeout=30) as r:
                return r.geturl(),r.read() if binary else r.read().decode('utf-8','ignore')
        except Exception as e:
            last=e; time.sleep(min(12,1.2*(2**attempt)))
    raise last

def clean(s): return re.sub(r'\s+',' ',s or '').strip()
def pdf_link(html,base):
    html=html.replace('&amp;','&')
    m=re.search(r'href=["\']([^"\']*utbildningsplaner[^"\']*\.pdf[^"\']*)["\']',html,re.I)
    return urllib.parse.urljoin(base,m.group(1)) if m else None

def hpnum(s): return float(s.replace(',','.'))
def parse_plan(text,fallback_hp=0):
    m=re.search(r'Högskolepoäng/ECTS:\s*(\d+(?:[,.]\d+)?)',text,re.I)
    total=hpnum(m.group(1)) if m else float(fallback_hp or 0)
    marks=list(re.finditer(r'^\s*Termin\s+(\d{1,2})\s*$',text,re.I|re.M))
    segs=[]
    for i,m in enumerate(marks):
        end=marks[i+1].start() if i+1<len(marks) else len(text)
        segs.append((int(m.group(1)),text[m.end():end]))
    expected=int((total+29)//30) if total else max([t for t,_ in segs],default=0)
    final=[]; complete=[]; choice=False
    for term,seg in segs:
        if term>expected: continue
        target=30 if term<expected else (total-30*(expected-1) or 30)
        req=[]; opts=[]
        for line in [clean(x) for x in seg.splitlines() if clean(x)]:
            mm=re.match(r'(.+?),\s*(\d+(?:[,.]\d+)?)\s*hp\b(?:\s*\(([^)]*)\))?',line,re.I)
            if mm:
                name=clean(mm.group(1)); h=hpnum(mm.group(2)); note=(mm.group(3) or '')+' '+line
                item={'term':term,'code':'','name':name,'hp':h,'type':'choice' if re.search(r'valbar|valfri|eller',note,re.I) else 'required','category':'elective' if re.search(r'valbar|valfri|eller',note,re.I) else 'mandatory'}
                (opts if item['type']=='choice' else req).append(item); continue
            mm=re.match(r'(Obligatoriska|Valbara|Valfria)\s+kurser\s+om\s+totalt\s+(\d+(?:[,.]\d+)?)\s*hp',line,re.I)
            if mm:
                h=hpnum(mm.group(2)); is_req=mm.group(1).lower().startswith('oblig')
                item={'term':term,'code':'','name':'Obligatoriska kurser enligt utbildningsplan' if is_req else 'Valbara studier enligt utbildningsplan','hp':h,'type':'required' if is_req else 'choice','category':'mandatory-slot' if is_req else 'elective-slot'}
                (req if is_req else opts).append(item); continue
            mm=re.match(r'(Utlandsstudier|Praktik|Valfria studier),?\s*(\d+(?:[,.]\d+)?)\s*hp',line,re.I)
            if mm: opts.append({'term':term,'code':'','name':mm.group(1),'hp':hpnum(mm.group(2)),'type':'choice','category':'elective'} )
        reqhp=sum(x['hp'] for x in req); gap=round(target-reqhp,1); optsum=sum(x['hp'] for x in opts)
        if abs(gap)<.2:
            complete.append(term); final.extend(req)
        elif gap>0 and optsum>=gap-.2:
            complete.append(term); choice=True; final.extend(req)
            final.append({'term':term,'code':'','name':'Valbara studier enligt utbildningsplan','hp':gap,'type':'choice','category':'elective-slot','slotType':'elective-slot','isSlot':True,'options':[{'code':'','name':x['name'],'hp':x['hp']} for x in opts]})
    coverage='metadata-only'
    if expected and len(set(complete))==expected: coverage='choice-required' if choice else 'complete'
    elif len(set(complete))>=2: coverage='partial-structure'
    elif final: coverage='manual-review'
    return {'total':total,'expected':expected,'complete':sorted(set(complete)),'rows':final,'coverage':coverage}

def main():
    p=Path('data/kau/structures.json'); rows=json.loads(p.read_text())
    upgraded=0; errors=0
    for i,row in enumerate(rows):
        if RANK.get(row.get('coverage'),0)>=4: continue
        try:
            page_url,html=get((row.get('officialUrls') or [row.get('sourceUrl')])[0])
            pdf=pdf_link(html,page_url)
            if not pdf: continue
            pdf_url,data=get(pdf,True)
            reader=PdfReader(BytesIO(data)); text='\n'.join((pg.extract_text() or '') for pg in reader.pages)
            parsed=parse_plan(text,row.get('hp') or 0)
            if RANK.get(parsed['coverage'],0)>RANK.get(row.get('coverage'),0):
                row.update({'hp':parsed['total'] or row.get('hp'),'rows':parsed['rows'],'coverage':parsed['coverage'],'reason':'official-education-plan-pdf-reconciled','expectedTerms':parsed['expected'],'completeTerms':parsed['complete'],'source':'karlstad-official-education-plan','sourceUrl':pdf_url,'sourceUrls':[page_url,pdf_url],'educationPlanUrl':pdf_url,'status':'processed','checkedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}); upgraded+=1
        except Exception as e:
            row['educationPlanFallbackError']=str(e); errors+=1
        time.sleep(.25)
    p.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
    sp=Path('data/susa/structures.json'); glob=json.loads(sp.read_text()); by={str(x.get('programCode','')).upper():x for x in rows}; glob=[by.get(str(x.get('programCode','')).upper(),x) if 'karlstads universitet' in str(x.get('university','')).lower() else x for x in glob]; sp.write_text(json.dumps(glob,ensure_ascii=False,indent=2)+'\n')
    mp=Path('data/kau/structure-meta.json'); meta=json.loads(mp.read_text()); counts={}
    for x in rows: counts[x.get('coverage','metadata-only')]=counts.get(x.get('coverage','metadata-only'),0)+1
    meta.update({'counts':counts,'educationPlanFallbackUpgraded':upgraded,'educationPlanFallbackErrors':errors}); mp.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'upgraded':upgraded,'errors':errors,'counts':counts},ensure_ascii=False,indent=2))
if __name__=='__main__': main()
