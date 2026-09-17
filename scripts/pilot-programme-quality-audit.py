#!/usr/bin/env python3
"""Conservative audit of staged pilot evidence; never write canonical programme data."""
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path('data')
HP = re.compile(r'(?<!\w)(\d+(?:[,.]\d+)?)\s*hp\b', re.I)
COURSE = re.compile(r'^.+?,?\s+\d+(?:[,.]\d+)?\s*hp\s*$', re.I)
NOTE = re.compile(r'^\s*(?:\*+\s*)?(?:kan ersättas|ersätts|alternativt|observera|under termin|exempelvis|följande kurser)', re.I)


def audit_uppsala():
    evidence = json.loads((ROOT / 'uppsala/ht26-sequential-studyplan-evidence.json').read_text(encoding='utf-8'))
    result = []
    for programme in evidence['programmes']:
        terms = defaultdict(list)
        for course in programme['courses']:
            terms[course['term']].append(course)
        rows = []
        for term, courses in sorted(terms.items()):
            alternatives = [c for c in courses if c.get('classificationContext') == 'elective-options-not-additive']
            fixed = [c for c in courses if c not in alternatives]
            fixed_hp = sum(c['hp'] for c in fixed)
            rows.append({'term': term, 'fixedCreditsHp': fixed_hp, 'alternativeOptions': [{'courseCode': c['courseCode'], 'hp': c['hp']} for c in alternatives], 'alternativeCreditsNotSummed': True, 'requiresReview': bool(alternatives) or fixed_hp != 30})
        result.append({'programmeCode': programme['programmeCode'], 'sourceUrl': programme['sourceUrl'], 'termAudit': rows, 'reviewRequired': any(t['requiresReview'] for t in rows) or any(c.get('classificationContext') == 'unspecified' for c in programme['courses'])})
    return result


def audit_umea():
    evidence = json.loads((ROOT / 'umea/ht26-sequential-studyplan-evidence.json').read_text(encoding='utf-8'))
    result = []
    for programme in evidence['programmes']:
        term_audit = []
        seen_terms = set()
        for term in programme['terms']:
            number = term['term']
            lines = term['sourceLines']
            hp_lines = [line for line in lines if HP.search(line)]
            placeholder = [line for line in hp_lines if re.search(r'\bvalbar(?:a)?\b|\bfria\b', line, re.I)]
            notes = [line for line in hp_lines if line not in placeholder and NOTE.search(line)]
            candidate = [line for line in hp_lines if line not in placeholder and line not in notes and COURSE.fullmatch(line)]
            ambiguous = [line for line in hp_lines if line not in placeholder and line not in notes and line not in candidate]
            term_audit.append({'term': number, 'duplicateTermHeading': number in seen_terms, 'candidateCourseLines': candidate, 'electivePlaceholders': placeholder, 'replacementOrExplanatoryNotes': notes, 'ambiguousHpLines': ambiguous, 'candidateCreditsHp': sum(float(HP.search(line).group(1).replace(',', '.')) for line in candidate), 'requiresReview': True})
            seen_terms.add(number)
        result.append({'programmeCode': programme['programmeCode'], 'sourceUrl': programme['sourceUrl'], 'termAudit': term_audit, 'reviewRequired': True, 'note': 'Candidate credits are not programme requirements. Duplicate term headings may indicate separate pathways; replacement notes, alternatives and split lines require official source validation.'})
    return result


def main():
    report = {'schemaVersion': 2, 'status': 'pilot-quality-review-required', 'cohortVerified': False, 'canonicalDatabaseWritten': False, 'liveDatabaseWritten': False, 'uppsala': audit_uppsala(), 'umea': audit_umea()}
    output = ROOT / 'pilot-programme-quality-audit.json'
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Pilot quality audit saved:', output, 'Uppsala:', len(report['uppsala']), 'Umea:', len(report['umea']))


if __name__ == '__main__':
    main()
