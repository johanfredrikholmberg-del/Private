#!/usr/bin/env python3
"""Collect Uppsala official study plans sequentially; evidence only, no canonical writes."""
import datetime
import json
import re
from pathlib import Path
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

ROOT='https://www.uu.se'
# Verified public study-plan URL; add further programme-specific official URLs only after discovery.
SOURCES=[{'programmeCode':'SPA1K','url':'https://www.uu.se/utbildning/studieplan?query=8198521a-f7e1-460c-9d49-5ac61489fd49'}]
OUT=Path('data/uppsala/ht26-sequential-studyplan-evidence.json')
COURSE=re.compile(r'(?P<name>.+?),\s*(?P<hp>\d+(?:[,.]\d+)?)\s*hp\s*\((?P<code>[A-Z0-9]{5,8})\)',re.I)

def save(report):
    OUT.parent.mkdir(parents=True,exist_ok=True)
    report['totalCourseRows']=sum(p['courseRows'] for p in report['programmes'])
    OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def main():
    report={'schemaVersion':1,'university':'Uppsala universitet','targetTerm':'HT2026','generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'source-evidence-unverified','canonicalDatabaseWritten':False,'liveDatabaseWritten':False,'programmes':[]}
    session=requests.Session()
    session.headers['User-Agent']='StudieLots educational source review (respectful sequential retrieval)'
    for source in SOURCES:
        item={'programmeCode':source['programmeCode'],'sourceUrl':source['url'],'courseRows':0,'courses':[],'status':'unverified','ht26VersionVerified':False}
        try:
            response=session.get(source['url'],timeout=35)
            response.raise_for_status()
            soup=BeautifulSoup(response.text,'html.parser')
            text=soup.get_text(' ',strip=True)
            item['diagnostics']={'httpStatus':response.status_code,'finalUrl':response.url,'title':soup.title.get_text(' ',strip=True) if soup.title else None,'htmlBytes':len(response.content),'textExcerpt':text[:350]}
            main=soup.find('main') or soup
            term=None
            category='unspecified'
            seen=set()
            for node in main.find_all(['h2','h3','h4','li']):
                if node.name.startswith('h'):
                    heading=node.get_text(' ',strip=True)
                    term_match=re.search(r'\bTermin\s+(\d+)\b',heading,re.I)
                    if term_match: term=int(term_match.group(1)); category='unspecified'
                    elif re.search(r'Obligatoriska kurser',heading,re.I): category='mandatory'
                    elif re.search(r'Valbara kurser|Valbar kurs',heading,re.I): category='elective-options-not-additive'
                elif term is not None:
                    line=node.get_text(' ',strip=True)
                    match=COURSE.search(line)
                    if not match: continue
                    key=(term,match.group('code'),category)
                    if key in seen: continue
                    seen.add(key)
                    item['courses'].append({'term':term,'courseCode':match.group('code'),'courseName':match.group('name').strip(),'hp':float(match.group('hp').replace(',','.')),'classificationContext':category,'sourceText':line[:450],'sourceUrl':response.url})
            item['courseRows']=len(item['courses'])
            item['ht26VersionVerified']=bool(re.search(r'giltig\s+från\s+och\s+med\s+höstterminen\s+2026|Fastställd av[^\n]{0,150}2026',text,re.I))
            item['status']='extracted-review-required' if item['courseRows'] else 'no-course-rows'
        except Exception as exc:
            item['status']='fetch-error'; item['error']=str(exc)[:400]
        report['programmes'].append(item)
        save(report)
        print(item['programmeCode'],item['status'],item['courseRows'],flush=True)
    report['status']='extracted-review-required' if report['totalCourseRows'] else 'blocked-no-course-rows'
    save(report)

if __name__=='__main__': main()
