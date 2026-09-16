#!/usr/bin/env python3
"""Collect official Umea study-plan text one programme at a time; evidence only."""
import datetime as dt
import json
import re
import time
from pathlib import Path
import requests
from bs4 import BeautifulSoup

PROGRAMMES = [('SGSDS', 'https://www.umu.se/utbildning/kurs-och-utbildningsplan/sgsds/'), ('TAROM', 'https://www.umu.se/utbildning/kurs-och-utbildningsplan/tarom/')]
OUT = Path('data/umea/ht26-sequential-studyplan-evidence.json')
TERM = re.compile(r'^Termin\s+(\d+)\b', re.I)
HP = re.compile(r'\b(\d+(?:[,.]\d+)?)\s*hp\b', re.I)

def save(report):
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def main():
    report = {'schemaVersion': 1, 'university': 'Umeå universitet', 'intendedIntake': 'HT2026', 'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'status': 'in-progress', 'cohortVerified': False, 'canonicalDatabaseWritten': False, 'liveDatabaseWritten': False, 'programmes': []}
    session = requests.Session()
    session.headers['User-Agent'] = 'StudieLots programme evidence research/1.0 (public study plans)'
    for code, url in PROGRAMMES:
        item = {'programmeCode': code, 'sourceUrl': url, 'status': 'unverified', 'terms': [], 'courseRows': 0}
        try:
            response = session.get(url, timeout=40)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            main_element = soup.find('main') or soup
            text = main_element.get_text('\n', strip=True)
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            item['diagnostics'] = {'httpStatus': response.status_code, 'finalUrl': response.url, 'title': soup.title.get_text(' ', strip=True) if soup.title else '', 'textLength': len(text), 'mentions2026Intake': bool(re.search(r'2026-08-31|2026-08-30|HT\s*26|höstterminen\s*2026', text, re.I))}
            start = next((i for i, line in enumerate(lines) if line.lower() in ('programmets upplägg', 'studieplan')), None)
            if start is None:
                item['status'] = 'no-programme-layout-heading'
            else:
                current = None
                for line in lines[start+1:]:
                    if re.match(r'^(Anstånd med studiestart|Studieuppehåll|Studieavbrott|Övrigt)$', line, re.I):
                        break
                    match = TERM.match(line)
                    if match:
                        current = {'term': int(match.group(1)), 'sourceLines': []}
                        item['terms'].append(current)
                    elif current is not None:
                        current['sourceLines'].append(line)
                item['courseRows'] = sum(bool(HP.search(line)) for term in item['terms'] for line in term['sourceLines'])
                item['status'] = 'layout-text-extracted-unverified' if item['courseRows'] else 'no-course-lines'
            item['diagnostics']['intakeNotIndependentlyVerified'] = True
        except Exception as exc:
            item['status'] = 'fetch-error'
            item['error'] = str(exc)[:500]
        report['programmes'].append(item)
        report['totalCourseRows'] = sum(p['courseRows'] for p in report['programmes'])
        save(report)
        print(code, item['status'], item['courseRows'], flush=True)
        time.sleep(2)
    report['status'] = 'evidence-extracted-unverified' if report.get('totalCourseRows') else 'blocked-no-course-lines'
    save(report)

if __name__ == '__main__':
    main()
