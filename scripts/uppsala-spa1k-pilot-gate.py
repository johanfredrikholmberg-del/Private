#!/usr/bin/env python3
"""Fail-closed SPA1K pilot import gate. Reads evidence; never writes canonical or live data."""
import json
from collections import defaultdict
from pathlib import Path

source = json.loads(Path('data/uppsala/ht26-sequential-studyplan-evidence.json').read_text(encoding='utf-8'))
assert source['canonicalDatabaseWritten'] is False
assert source['liveDatabaseWritten'] is False
programmes = [p for p in source['programmes'] if p['programmeCode'] == 'SPA1K']
assert len(programmes) == 1, 'Expected exactly one SPA1K source programme'
p = programmes[0]
assert p['ht26VersionVerified'] is True, 'HT26 plan version must be explicitly evidenced'
assert p['status'] == 'extracted-review-required', 'Unexpected pilot evidence state'
assert p['courseRows'] == len(p['courses']) == 15, 'Course count drift'
terms = defaultdict(list)
for c in p['courses']:
    assert c['sourceUrl'] == p['sourceUrl']
    assert c['courseCode'] and c['courseName'] and c['sourceText']
    assert c['hp'] > 0 and 1 <= c['term'] <= 6
    assert c['courseCode'] in c['sourceText'], 'Course code not traceable to source text'
    terms[c['term']].append(c)
assert set(terms) == set(range(1, 7)), 'Missing programme term'
for term in range(1, 5):
    rows = terms[term]
    assert all(c['classificationContext'] == 'unspecified' for c in rows)
    assert sum(c['hp'] for c in rows) == 30, f'Term {term} credit mismatch'
for term in (5, 6):
    rows = terms[term]
    assert len(rows) == 3 and all(c['hp'] == 30 for c in rows)
    assert all(c['classificationContext'] == 'elective-options-not-additive' for c in rows)
    assert len({c['courseCode'] for c in rows}) == 3
assert len({c['courseCode'] for c in p['courses']}) == 15
print('PASS: SPA1K source has four 30-hp fixed-term candidates and two sets of three non-additive 30-hp alternatives.')
print('BLOCKED: first four terms have unspecified mandatory/elective classification; term 5/6 option dependencies, HT26 individual course offerings and degree rules not verified. No canonical/live import.')
