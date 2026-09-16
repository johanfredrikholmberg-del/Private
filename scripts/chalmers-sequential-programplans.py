#!/usr/bin/env python3
"""Collect official Chalmers 2026/27 programme-plan evidence, without canonical promotion."""
import datetime
import json
import re
import time
from pathlib import Path
import requests
from bs4 import BeautifulSoup

PROGRAMMES = [('TKAUT', 3), ('MPENM', 2)]
OUT = Path('data/chalmers/programplans-2026-sequential-evidence.json')
BASE = 'https://www.chalmers.se/utbildning/dina-studier/hitta-kurs-och-programplaner/programplaner/'
CODE = re.compile(r'^([A-Z]{2,5}[0-9]{3})\s+(.+)$')

def save(report):
    OUT.parent.mkdir(parents=True, exist_ok=True)
    report['totalSourceRows'] = sum(y['sourceRows'] for p in report['programmes'] for y in p['years'])
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def main():
    report = {'schemaVersion': 1, 'university': 'Chalmers tekniska högskola', 'academicYear': '2026/2027', 'generatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'status': 'collecting-unverified', 'cohortVerified': False, 'canonicalDatabaseWritten': False, 'liveDatabaseWritten': False, 'note': 'Source rows represent examination modules, not distinct courses or additive credits; course options are not additive.', 'programmes': []}
    session = requests.Session()
    session.headers['User-Agent'] = 'StudieLots-evidence-collector/1.0 (official public programme plans)'
    for code, years in PROGRAMMES:
        programme = {'programmeCode': code, 'years': []}
        report['programmes'].append(programme)
        for year in range(1, years + 1):
            url = f'{BASE}{code}/?acYear=2026%2F2027&year={year}'
            item = {'year': year, 'sourceUrl': url, 'sourceRows': 0, 'status': 'unverified', 'rows': []}
            programme['years'].append(item)
            try:
                response = session.get(url, timeout=35)
                response.raise_for_status()
                soup = BeautifulSoup(response.text, 'html.parser')
                text = soup.get_text(' ', strip=True)
                item['diagnostics'] = {'httpStatus': response.status_code, 'finalUrl': response.url, 'htmlBytes': len(response.content), 'tableCount': len(soup.find_all('table')), 'title': soup.title.get_text(' ', strip=True) if soup.title else None, 'yearMentioned': '2026/2027' in text, 'programmeCodeMentioned': code in text}
                if not item['diagnostics']['yearMentioned'] or not item['diagnostics']['programmeCodeMentioned']:
                    item['status'] = 'source-year-or-programme-unconfirmed'
                else:
                    for table in soup.find_all('table'):
                        heading = table.find_previous(['h2', 'h3', 'h4', 'h5', 'h6'])
                        context = heading.get_text(' ', strip=True) if heading else 'unlabelled'
                        for tr in table.find_all('tr'):
                            cells = [c.get_text(' ', strip=True) for c in tr.find_all(['td', 'th'], recursive=False)]
                            if not cells: continue
                            match = CODE.match(cells[0])
                            if match:
                                item['rows'].append({'courseCode': match.group(1), 'courseName': match.group(2), 'sourceCells': cells, 'sectionHeading': context, 'sourceUrl': response.url})
                    item['sourceRows'] = len(item['rows'])
                    item['status'] = 'source-module-rows-unverified' if item['sourceRows'] else 'no-source-rows'
            except Exception as exc:
                item['status'] = 'fetch-error'
                item['error'] = str(exc)[:350]
            save(report)
            print(code, year, item['status'], item['sourceRows'], flush=True)
            time.sleep(1)
    report['status'] = 'source-module-rows-unverified' if report['totalSourceRows'] else 'blocked-no-source-rows'
    save(report)
    print('TOTAL SOURCE MODULE ROWS', report['totalSourceRows'], flush=True)

if __name__ == '__main__':
    main()
