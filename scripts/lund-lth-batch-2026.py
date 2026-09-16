#!/usr/bin/env python3
"""Stage LTH LoT evidence only; never promote to canonical or live databases."""
import json, re, time, urllib.request, datetime
from pathlib import Path
from bs4 import BeautifulSoup

CODES = ['I','W','A','B','C','D','E','F','K','L','M','N','Pi','V']
BASE = 'https://kurser.lth.se/lot/programme?programme={}&ay=26_27'
OUT = Path('data/lund/lth-2026-batch-evidence.json')
HEADERS = ('h1','h2','h3','h4','h5')
CODE = re.compile(r'^[A-Z]{3,5}[A-Z0-9]{2,4}$')

def extract(code):
    url = BASE.format(code)
    req = urllib.request.Request(url, headers={'User-Agent':'StudieLots-research/1.0 (source attribution; evidence staging)'})
    with urllib.request.urlopen(req, timeout=35) as resp:
        html = resp.read(5_000_000).decode('utf-8','replace')
    soup = BeautifulSoup(html, 'html.parser')
    sections, seen = [], set()
    for table in soup.find_all('table'):
        heading = table.find_previous(HEADERS)
        label = heading.get_text(' ',strip=True) if heading else 'unlabelled'
        rows = []
        for tr in table.find_all('tr'):
            cells = [c.get_text(' ',strip=True) for c in tr.find_all(['td','th'],recursive=False)]
            if not cells: continue
            matches = [x for x in cells if CODE.fullmatch(x)]
            if not matches: continue
            course = matches[0]
            key = (label,course,tuple(cells))
            if key in seen: continue
            seen.add(key)
            rows.append({'courseCode':course,'sourceCells':cells,'classificationContext':label,'sourceUrl':url})
        if rows: sections.append({'heading':label,'rows':rows})
    return {'programmeCode':code,'academicYear':'2026/27','sourceUrl':url,'status':'extracted-unverified' if sections else 'no-course-table','sections':sections,'courseRows':sum(len(s['rows']) for s in sections)}

def main():
    result={'schemaVersion':1,'university':'Lunds universitet','faculty':'LTH','academicYear':'2026/27','generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'source-evidence-only','cohortVerified':False,'canonicalDatabaseWritten':False,'liveDatabaseWritten':False,'method':'Official LoT HTML tables; original cells and section heading preserved; course options not additive','programmes':[]}
    for code in CODES:
        try: item=extract(code)
        except Exception as e: item={'programmeCode':code,'sourceUrl':BASE.format(code),'status':'fetch-error','error':str(e),'sections':[],'courseRows':0}
        result['programmes'].append(item)
        print(code,item['status'],item['courseRows'],flush=True)
        time.sleep(.4)
    result['totalCourseRows']=sum(x['courseRows'] for x in result['programmes'])
    result['programmesWithRows']=sum(x['courseRows']>0 for x in result['programmes'])
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    if not result['totalCourseRows']: raise SystemExit('No course evidence extracted; report retained locally for diagnosis')
    print('TOTAL',result['totalCourseRows'],'PROGRAMMES',result['programmesWithRows'])

if __name__=='__main__': main()
