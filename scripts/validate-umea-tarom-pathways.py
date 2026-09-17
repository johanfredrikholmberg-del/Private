#!/usr/bin/env python3
"""Fail closed on TAROM pilot evidence; no canonical or live database writes."""
import json
from pathlib import Path

root = Path('data/umea')
source = json.loads((root / 'ht26-sequential-studyplan-evidence.json').read_text(encoding='utf-8'))
review = json.loads((root / 'tarom-ht26-pathway-review.json').read_text(encoding='utf-8'))
validated = json.loads((root / 'tarom-ht26-official-plan-validation.json').read_text(encoding='utf-8'))
programme = next(p for p in source['programmes'] if p['programmeCode'] == 'TAROM')
terms = programme['terms']
assert len(terms) == 8, 'Expected two separate four-term pathway blocks'
assert [t['term'] for t in terms] == [1, 2, 3, 4] * 2
assert review['canonicalDatabaseWritten'] is False and review['liveDatabaseWritten'] is False
assert validated['canonicalDatabaseWritten'] is False and validated['liveDatabaseWritten'] is False
assert validated['planApplicableToIntakeStartDateVerified'] is True
assert validated['individualCourseOfferingsForHT26Verified'] is False
assert validated['electiveCatalogueNotAdditiveToTerm4'] is True
assert validated['additionalOfficialRule']['needsCrossAreaDegreeRuleReview'] is True
assert validated['additionalOfficialRule']['doNotAutomaticallyApplyToElectronicsDegree'] is True
assert len(review['pathways']) == len(validated['pathways']) == 2
for index, (path, official) in enumerate(zip(review['pathways'], validated['pathways'])):
    expected = list(range(index * 4, index * 4 + 4))
    assert path['id'] == official['id']
    assert path['sourceTermBlockIndicesZeroBased'] == expected
    assert official['sourceTermBlockIndicesZeroBased'] == expected
    assert official['termCreditsHp'] == [30] * 4
    assert official['term4ThesisCourseCodeVerified'] is False
    assert official['term2NamedCourseCreditsHp'] + official['term2ElectiveSlotsHp'] == 30
    assert official['term3NamedCourseCreditsHp'] + official['term3ElectiveSlotsHp'] == 30
    assert 'Minst två' in official['officialElectiveDegreeRule']
    assert all(terms[i]['term'] == term for term, i in enumerate(expected, start=1))
    assert any('Examensarbete' in line for line in terms[expected[-1]]['sourceLines'])
assert review['electiveCatalogue']['belongsToSingleTerm'] is False
assert review['electiveCatalogue']['notAdditiveToTerm4Credits'] is True
print('PASS: TAROM two pathways, HT26 plan scope and elective safeguards; course offerings remain unverified; no database writes.')
