#!/usr/bin/env python3
"""Discover and inspect official programme-plan entry points; evidence only, never import."""
import datetime as dt
import json
import os
from pathlib import Path
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup

SOURCES = {
    'stockholm': ('Stockholms universitet', 'https://www.su.se/utbildning'),
    'orebro': ('Örebro universitet', 'https://www.oru.se/utbildning/'),
    'mittuniversitetet': ('Mittuniversitetet', 'https://www.miun.se/utbildning/'),
    'ltu': ('Luleå tekniska universitet', 'https://www.ltu.se/utbildning'),
    'slu': ('Sveriges lantbruksuniversitet', 'https://www.slu.se/utbildning/'),
    'mdu': ('Mälardalens universitet', 'https://www.mdu.se/utbildning'),
}
KEYWORDS = ('utbildningsplan', 'programplan', 'program', 'studieplan', 'syllabus', 'programme', 'kursplan')
PLAN_KEYWORDS = ('utbildningsplan', 'programplan', 'studieplan', 'kursplan', 'syllabus')

def same_host(target, host):
    target_host = urlparse(target).hostname or ''
    return target_host == host or target_host.endswith('.' + host)

def links(soup, base, host, limit=100):
    found, seen = [], set()
    for anchor in soup.find_all('a', href=True):
        label = anchor.get_text(' ', strip=True)
        target = urljoin(base, anchor['href']).split('#', 1)[0]
        if urlparse(target).scheme != 'https' or not same_host(target, host) or target in seen:
            continue
        if not any(term in (label + ' ' + target).lower() for term in KEYWORDS):
            continue
        seen.add(target)
        found.append({'label': label[:160], 'url': target, 'verifiedForHT26': False})
        if len(found) >= limit:
            break
    return found

def main():
    key = os.environ['INSTITUTION']
    name, url = SOURCES[key]
    output = Path('data') / key / 'ht26-source-discovery.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    report = {'institution': name, 'institutionKey': key, 'targetCohort': 'HT2026', 'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'status': 'source-discovery-unverified', 'cohortVerified': False, 'canonicalDatabaseWritten': False, 'liveDatabaseWritten': False, 'programmePlansVerified': 0, 'sourceUrl': url, 'candidateLinks': [], 'inspectedPages': []}
    session = requests.Session()
    session.headers['User-Agent'] = 'StudieLots source discovery/1.1'
    try:
        response = session.get(url, timeout=35)
        soup = BeautifulSoup(response.text, 'html.parser')
        report['diagnostics'] = {'httpStatus': response.status_code, 'finalUrl': response.url, 'title': soup.title.get_text(' ', strip=True) if soup.title else '', 'htmlBytes': len(response.content)}
        host = urlparse(response.url).hostname or ''
        report['candidateLinks'] = links(soup, response.url, host)
        if response.status_code != 200:
            report['status'] = 'http-error'
        elif not report['candidateLinks']:
            report['status'] = 'no-candidate-links'
        # Inspect up to three relevant official entry points, without assuming they are HT26 plans.
        selected = sorted(report['candidateLinks'], key=lambda item: (not any(term in (item['label'] + ' ' + item['url']).lower() for term in PLAN_KEYWORDS), item['url']))[:3]
        for candidate in selected:
            page = {'sourceUrl': candidate['url'], 'status': 'unverified', 'candidateLinks': []}
            try:
                result = session.get(candidate['url'], timeout=25)
                page_soup = BeautifulSoup(result.text, 'html.parser')
                page['httpStatus'] = result.status_code
                page['finalUrl'] = result.url
                page['title'] = page_soup.title.get_text(' ', strip=True) if page_soup.title else ''
                page['htmlBytes'] = len(result.content)
                page['candidateLinks'] = links(page_soup, result.url, host, limit=30)
                page['status'] = 'page-fetched-unverified' if result.status_code == 200 else 'http-error'
            except requests.RequestException as exc:
                page['status'] = 'fetch-error'
                page['error'] = str(exc)[:400]
            report['inspectedPages'].append(page)
    except requests.RequestException as exc:
        report['status'] = 'fetch-error'
        report['error'] = str(exc)[:400]
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(key, report['status'], 'candidate links:', len(report['candidateLinks']), 'inspected pages:', len(report['inspectedPages']), flush=True)

if __name__ == '__main__':
    main()
