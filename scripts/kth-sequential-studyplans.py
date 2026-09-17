#!/usr/bin/env python3
"""Collect KTH HT26 cohort course lists sequentially; evidence only, never canonical import."""
import datetime as dt
import json
import re
from pathlib import Path
import requests
from bs4 import BeautifulSoup

PROGRAMMES = ['TCOMK', 'CELTE', 'COPEN', 'TIDSD']
OUT = Path('data/kth/ht26-sequential-studyplan-evidence.json')
CODE = re.compile(r'^[A-Z]{1,4}[0-9]{3}[A-Z0-9]?$')
HP = re.compile(r'\b(\d+(?:[,.]\d+)?)\s*hp\b', re.I)

def main():
    report = {'schemaVersion': 1, 'university': 'Kungliga Tekniska högskolan', 'cohort': 'HT2026', 'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'status': 'unverified-evidence', 'cohortVerified': False, 'canonicalDatabaseWritten': False, 'liveDatabaseWritten': False, 'programmes': []}
    session = requests.Session()
    session.headers.update({'User-Agent': 'StudieLots evidence research (programme course-list validation)'})
    for programme in PROGRAMMES:
        url = f'https://www.kth.se/student/kurser/program/{programme}/20262/kurslista'
        item = {'programmeCode': programme, 'sourceUrl': url, 'courseRows': 0, 'sections': [], 'status': 'unverified'}
        try:
            response = session.get(url, timeout=35)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            text = soup.get_text(' ', strip=True)
            diagnostics = {'httpStatus': response.status_code, 'finalUrl': response.url, 'title': soup.title.get_text(' ', strip=True) if soup.title else None, 'tableCount': len(soup.find_all('table')), 'textExcerpt': text[:250], 'ht26Mentioned': bool(re.search(r'HT\s*2026|HT\s*26', text, re.I))}
            # Preserve bounded, source-derived DOM clues when the legacy table parser finds no rows.
            # These are diagnostic samples, NOT verified courses or an import source.
            main = soup.find('main') or soup.find(id='main') or soup.body or soup
            diagnostics['mainElement'] = main.name if main else None
            diagnostics['mainTextExcerpt'] = main.get_text(' ', strip=True)[:1200] if main else ''
            diagnostics['courseCodeTextMatches'] = list(dict.fromkeys(re.findall(r'\b[A-Z]{1,4}[0-9]{3}[A-Z0-9]?\b', main.get_text(' ', strip=True))))[:20] if main else []
            diagnostics['courseLinkSamples'] = [
                {'href': a.get('href', '')[:250], 'text': a.get_text(' ', strip=True)[:180], 'parentTag': a.parent.name if a.parent else None, 'parentClass': (a.parent.get('class') or [])[:5] if a.parent else []}
                for a in (main.find_all('a', href=True) if main else [])
                if re.search(r'/kurser/|/course/|kurs|course', a.get('href', ''), re.I)
            ][:18]
            diagnostics['headingSamples'] = [{'tag': h.name, 'text': h.get_text(' ', strip=True)[:160]} for h in (main.find_all(['h1', 'h2', 'h3', 'h4']) if main else [])][:24]
            diagnostics['embeddedDataScriptSamples'] = [{'id': s.get('id'), 'type': s.get('type'), 'textExcerpt': (s.string or s.get_text(' ', strip=True))[:240]} for s in soup.find_all('script') if s.get('type') == 'application/json' or s.get('id') == '__NEXT_DATA__'][:4]
            item['diagnostics'] = diagnostics
            if not diagnostics['ht26Mentioned']:
                item['status'] = 'cohort-not-confirmed'
            else:
                seen = set()
                for table in soup.find_all('table'):
                    heading = table.find_previous(['h2','h3','h4','h5'])
                    label = heading.get_text(' ', strip=True) if heading else 'unlabelled'
                    rows = []
                    for tr in table.find_all('tr'):
                        cells = [c.get_text(' ', strip=True) for c in tr.find_all(['td','th'], recursive=False)]
                        if len(cells) < 3 or not CODE.fullmatch(cells[0]):
                            continue
                        hp_match = next((HP.search(c) for c in cells[1:] if HP.search(c)), None)
                        if not hp_match:
                            continue
                        key = (label, cells[0], tuple(cells))
                        if key in seen:
                            continue
                        seen.add(key)
                        rows.append({'courseCode': cells[0], 'courseName': cells[1], 'creditsHp': float(hp_match.group(1).replace(',', '.')), 'sourceCells': cells, 'classificationContext': label, 'sourceUrl': response.url})
                    if rows:
                        item['sections'].append({'heading': label, 'rows': rows})
                item['courseRows'] = sum(len(section['rows']) for section in item['sections'])
                item['status'] = 'extracted-unverified' if item['courseRows'] else 'no-matching-course-rows'
        except Exception as exc:
            item['status'] = 'fetch-error'
            item['error'] = str(exc)[:400]
        report['programmes'].append(item)
        report['totalCourseRows'] = sum(p['courseRows'] for p in report['programmes'])
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(programme, item['status'], item['courseRows'], flush=True)
    report['status'] = 'extracted-unverified' if report['totalCourseRows'] else 'blocked-no-course-rows-diagnostics-only'
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

if __name__ == '__main__':
    main()
