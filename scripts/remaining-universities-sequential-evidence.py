#!/usr/bin/env python3
"""Discover official programme-plan links, one institution at a time; evidence only."""
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
KEYWORDS = ('utbildningsplan', 'programplan', 'program', 'studieplan', 'syllabus', 'programme')

def main():
    key = os.environ['INSTITUTION']
    name, url = SOURCES[key]
    output = Path('data') / key / 'ht26-source-discovery.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    report = {'institution': name, 'institutionKey': key, 'targetCohort': 'HT2026', 'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'status': 'source-discovery-unverified', 'cohortVerified': False, 'canonicalDatabaseWritten': False, 'liveDatabaseWritten': False, 'programmePlansVerified': 0, 'sourceUrl': url, 'candidateLinks': []}
    try:
        response = requests.get(url, timeout=35, headers={'User-Agent': 'StudieLots source discovery/1.0'})
        soup = BeautifulSoup(response.text, 'html.parser')
        report['diagnostics'] = {'httpStatus': response.status_code, 'finalUrl': response.url, 'title': soup.title.get_text(' ', strip=True) if soup.title else '', 'htmlBytes': len(response.content)}
        host = urlparse(response.url).hostname or ''
        seen = set()
        for anchor in soup.find_all('a', href=True):
            label = anchor.get_text(' ', strip=True)
            target = urljoin(response.url, anchor['href'])
            target_host = urlparse(target).hostname or ''
            if not (target_host == host or target_host.endswith('.' + host)):
                continue
            if not any(term in (label + ' ' + target).lower() for term in KEYWORDS) or target in seen:
                continue
            seen.add(target)
            report['candidateLinks'].append({'label': label[:160], 'url': target, 'verifiedForHT26': False})
            if len(report['candidateLinks']) >= 100:
                break
        if response.status_code != 200:
            report['status'] = 'http-error'
        elif not report['candidateLinks']:
            report['status'] = 'no-candidate-links'
    except requests.RequestException as exc:
        report['status'] = 'fetch-error'
        report['error'] = str(exc)[:400]
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(key, report['status'], 'candidate links:', len(report['candidateLinks']), flush=True)

if __name__ == '__main__':
    main()
