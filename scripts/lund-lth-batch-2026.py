#!/usr/bin/env python3
"""Collect LTH LoT evidence; never promote unverified programme coverage."""
import datetime
import json
import re
import time
import urllib.request
from pathlib import Path
from bs4 import BeautifulSoup

CODES = ['I', 'W', 'A', 'B', 'C', 'D', 'E', 'F', 'K', 'L', 'M', 'N', 'Pi', 'V']
BASE = 'https://kurser.lth.se/lot/programme?programme={}&ay=26_27'
OUT = Path('data/lund/lth-2026-batch-evidence.json')
CODE = re.compile(r'^[A-Z]{3,5}[A-Z0-9]{2,4}$')
HEADERS = ('h1', 'h2', 'h3', 'h4', 'h5')

def extract(code):
    url = BASE.format(code)
    req = urllib.request.Request(url, headers={'User-Agent': 'StudieLots-research/1.0 (source attribution; evidence staging)'})
    with urllib.request.urlopen(req, timeout=35) as resp:
        html = resp.read(5_000_000).decode('utf-8', 'replace')
        final_url = resp.geturl()
        http_status = resp.status
    soup = BeautifulSoup(html, 'html.parser')
    sections, seen = [], set()
    for table in soup.find_all('table'):
        heading = table.find_previous(HEADERS)
        label = heading.get_text(' ', strip=True) if heading else 'unlabelled'
        rows = []
        for tr in table.find_all('tr'):
            cells = [c.get_text(' ', strip=True) for c in tr.find_all(['td', 'th'], recursive=False)]
            matches = [cell for cell in cells if CODE.fullmatch(cell)]
            if not matches:
                continue
            course = matches[0]
            key = (label, course, tuple(cells))
            if key in seen:
                continue
            seen.add(key)
            rows.append({'courseCode': course, 'sourceCells': cells, 'classificationContext': label, 'sourceUrl': url})
        if rows:
            sections.append({'heading': label, 'rows': rows})
    visible = soup.get_text(' ', strip=True)
    diagnostics = {'httpStatus': http_status, 'finalUrl': final_url, 'htmlBytes': len(html.encode('utf-8')), 'htmlTitle': soup.title.get_text(' ', strip=True)[:180] if soup.title else None, 'tableCount': len(soup.find_all('table')), 'javascriptRequired': 'javascript' in visible.lower() and ('enable' in visible.lower() or 'aktiver' in visible.lower()), 'visibleTextExcerpt': visible[:350]}
    count = sum(len(section['rows']) for section in sections)
    return {'programmeCode': code, 'academicYear': '2026/27', 'sourceUrl': url, 'status': 'extracted-unverified' if count else 'no-course-table', 'sections': sections, 'courseRows': count, 'diagnostics': diagnostics}

def main():
    result = {'schemaVersion': 2, 'university': 'Lunds universitet', 'faculty': 'LTH', 'academicYear': '2026/27', 'generatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'status': 'source-evidence-only', 'cohortVerified': False, 'canonicalDatabaseWritten': False, 'liveDatabaseWritten': False, 'method': 'Official LoT HTML tables; original cells and section heading preserved; course options not additive', 'programmes': []}
    for code in CODES:
        try:
            item = extract(code)
        except Exception as exc:
            item = {'programmeCode': code, 'sourceUrl': BASE.format(code), 'status': 'fetch-error', 'error': str(exc), 'sections': [], 'courseRows': 0}
        result['programmes'].append(item)
        print(code, item['status'], item['courseRows'], item.get('diagnostics', {}), flush=True)
        time.sleep(.4)
    result['totalCourseRows'] = sum(item['courseRows'] for item in result['programmes'])
    result['programmesWithRows'] = sum(item['courseRows'] > 0 for item in result['programmes'])
    result['status'] = 'source-evidence-only' if result['totalCourseRows'] else 'blocked-no-course-rows-diagnostics-only'
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('TOTAL', result['totalCourseRows'], 'PROGRAMMES', result['programmesWithRows'], 'STATUS', result['status'])

if __name__ == '__main__':
    main()
