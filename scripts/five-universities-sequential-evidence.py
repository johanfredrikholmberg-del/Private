#!/usr/bin/env python3
"""Collect source evidence per institution; no canonical or live writes."""
import datetime as dt
import json
import os
import re
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
import requests
from bs4 import BeautifulSoup

SOURCES = {
 'linkoping': [('Civilingenjör datateknik, HT2026', 'https://studieinfo.liu.se/program/6CDDD/6298')],
 'jonkoping': [('Bachelor in International Economics, HT2026', 'https://jonkopinguniversity.se/student/studier/utbildningsplaner-med-kursplaner.html?id=748ada1b-79ba-11f0-b4fd-2140da76402d&year=2026')],
 'kalmar': [('Ekonomprogrammet redovisning/ekonomistyrning, Kalmar HT2026', 'https://www.lnu.se/program/ekonomprogrammet-inriktning-redovisning-ekonomistyrning/kalmar-ht/')],
 'malmo': [('Datateknik och Mobil IT, HT2026', 'https://mau.se/sok-utbildning/program/thdtb')],
 'handels-stockholm': [('BSc Business and Economics, programme structure', 'https://www.hhs.se/education/bachelor/business-economics/program-structure/')],
}
# A course candidate must look like a complete course entry, not prose mentioning a course.
COURSE_LINE = re.compile(r'^.{3,130}?\([A-Z]{1,5}\d[A-Z0-9]{2,6}\)\s*,?\s*\d+(?:[.,]\d+)?\s*(?:hp|ECTS|credits)\s*$', re.I)

def fetch(session, url, item):
    try:
        return session.get(url, timeout=35)
    except requests.exceptions.SSLError as exc:
        # Do not disable certificate verification. Retry only Jönköping's alternate www hostname.
        if urlsplit(url).hostname != 'jonkopinguniversity.se':
            raise
        parts = urlsplit(url)
        alternate = urlunsplit((parts.scheme, 'www.jonkopinguniversity.se', parts.path, parts.query, parts.fragment))
        item['retryReason'] = 'original-host-ssl-error'
        item['retryUrl'] = alternate
        item['originalError'] = str(exc)[:300]
        return session.get(alternate, timeout=35)

def main():
    institution = os.environ['INSTITUTION']
    if institution not in SOURCES:
        raise ValueError('Unknown institution')
    output = Path('data') / institution / 'ht26-sequential-source-evidence.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    report = {'institution': institution, 'targetStart': 'HT2026', 'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'status': 'source-diagnostics-unverified', 'cohortVerified': False, 'canonicalDatabaseWritten': False, 'liveDatabaseWritten': False, 'programmes': []}
    session = requests.Session()
    session.headers['User-Agent'] = 'StudieLots educational source evidence collector/1.1'
    for name, url in SOURCES[institution]:
        item = {'programme': name, 'sourceUrl': url, 'courseRows': 0, 'candidateTextLines': [], 'status': 'unverified'}
        try:
            response = fetch(session, url, item)
            soup = BeautifulSoup(response.text, 'html.parser')
            for tag in soup(['script', 'style', 'nav', 'footer']):
                tag.decompose()
            lines = [line.strip() for line in soup.get_text('\n').splitlines() if line.strip()]
            item['diagnostics'] = {'httpStatus': response.status_code, 'finalUrl': response.url, 'title': soup.title.get_text(' ', strip=True) if soup.title else '', 'htmlBytes': len(response.content), 'textExcerpt': ' '.join(lines[:35])[:800]}
            # Raw candidate lines only; no credit inference, cohort validation, or canonical import.
            item['candidateTextLines'] = [line[:250] for line in lines if COURSE_LINE.fullmatch(line)][:200]
            item['courseRows'] = len(item['candidateTextLines'])
            item['status'] = 'candidate-lines-unverified' if item['courseRows'] else 'no-single-line-course-matches'
            if response.status_code != 200:
                item['status'] = 'http-error'
        except requests.RequestException as exc:
            item['status'] = 'fetch-error'
            item['error'] = str(exc)[:400]
        report['programmes'].append(item)
        report['totalCandidateLines'] = sum(p['courseRows'] for p in report['programmes'])
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(institution, name, item['status'], item['courseRows'], flush=True)
    print('Saved', output, flush=True)

if __name__ == '__main__':
    main()
