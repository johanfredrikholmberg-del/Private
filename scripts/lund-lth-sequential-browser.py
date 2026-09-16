#!/usr/bin/env python3
"""Render one LTH programme at a time; retain raw evidence, never infer completeness."""
import datetime
import json
import re
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

CODES = ['I','W','A','B','C','D','E','F','K','L','M','N','Pi','V']
OUT = Path('data/lund/lth-2026-sequential-browser-evidence.json')
COURSE_CODE = re.compile(r'\b[A-Z]{3,5}[A-Z0-9]{2,4}\b')

def main():
    report = {'schemaVersion':1,'university':'Lunds universitet','faculty':'LTH','academicYear':'2026/27','generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'browser-extracted-unverified','cohortVerified':False,'canonicalDatabaseWritten':False,'liveDatabaseWritten':False,'programmes':[]}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page(locale='sv-SE')
        for code in CODES:
            url = f'https://kurser.lth.se/lot/programme?programme={code}&ay=26_27'
            item = {'programmeCode':code,'sourceUrl':url,'courseRows':0,'sections':[],'status':'unverified'}
            try:
                response = page.goto(url,wait_until='domcontentloaded',timeout=45000)
                try: page.wait_for_load_state('networkidle',timeout=12000)
                except Exception: pass
                page.wait_for_timeout(1500)
                html = page.content()
                soup = BeautifulSoup(html,'html.parser')
                item['diagnostics'] = {'httpStatus':response.status if response else None,'finalUrl':page.url,'title':page.title(),'tableCount':len(soup.find_all('table')),'htmlBytes':len(html.encode('utf-8')),'visibleTextExcerpt':soup.get_text(' ',strip=True)[:350]}
                seen = set()
                for table in soup.find_all('table'):
                    heading = table.find_previous(['h1','h2','h3','h4','h5'])
                    label = heading.get_text(' ',strip=True) if heading else 'unlabelled'
                    rows = []
                    for tr in table.find_all('tr'):
                        cells = [cell.get_text(' ',strip=True) for cell in tr.find_all(['td','th'],recursive=False)]
                        match = next((COURSE_CODE.fullmatch(cell) for cell in cells if COURSE_CODE.fullmatch(cell)),None)
                        if not match: continue
                        key = (label,match.group(),tuple(cells))
                        if key in seen: continue
                        seen.add(key)
                        rows.append({'courseCode':match.group(),'sourceCells':cells,'classificationContext':label,'sourceUrl':page.url})
                    if rows: item['sections'].append({'heading':label,'rows':rows})
                item['courseRows'] = sum(len(section['rows']) for section in item['sections'])
                item['status'] = 'extracted-unverified' if item['courseRows'] else 'no-matching-table-rows'
            except Exception as exc:
                item['status'] = 'fetch-error'
                item['error'] = str(exc)[:500]
            report['programmes'].append(item)
            report['totalCourseRows'] = sum(p['courseRows'] for p in report['programmes'])
            report['programmesWithRows'] = sum(p['courseRows'] > 0 for p in report['programmes'])
            OUT.parent.mkdir(parents=True,exist_ok=True)
            OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
            print(code,item['status'],item['courseRows'],flush=True)
        browser.close()
    report['status'] = 'browser-extracted-unverified' if report['totalCourseRows'] else 'blocked-no-course-rows-diagnostics-only'
    OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('TOTAL',report['totalCourseRows'],'PROGRAMMES',report['programmesWithRows'],flush=True)

if __name__ == '__main__': main()
