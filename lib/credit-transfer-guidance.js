// StudieLots: evidence-based guidance for potential credit transfer.
// Course title may be used for candidate retrieval only. It must never create a match score.

const clamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, Number(n) || 0));

export function syllabusEvidence(input = {}) {
  const { sourceSyllabus, targetSyllabus, learningOutcomes, content, level, credits, prerequisites, progression } = input;
  if (!sourceSyllabus || !targetSyllabus) {
    return { status: 'not-assessed', reason: 'syllabus-missing', score: null, label: 'Ej bedömd' };
  }

  // Internal score only. UI should primarily show the label and explanation.
  const parts = {
    learningOutcomes: clamp(learningOutcomes),
    content: clamp(content),
    level: clamp(level),
    credits: clamp(credits),
    prerequisites: clamp(prerequisites),
    progression: clamp(progression),
  };
  const score =
    parts.learningOutcomes * 0.35 +
    parts.content * 0.30 +
    parts.level * 0.12 +
    parts.credits * 0.10 +
    parts.progression * 0.08 +
    parts.prerequisites * 0.05;

  const label = score >= 0.85 ? 'Hög överensstämmelse' : score >= 0.65 ? 'Medelhög överensstämmelse' : 'Låg överensstämmelse';
  return { status: 'assessed', score, label, parts };
}

export function historicalEvidence(decisions = []) {
  const usable = decisions.filter(d => d && (d.outcome === 'approved' || d.outcome === 'rejected'));
  if (!usable.length) return { status: 'none', label: 'Historik saknas', support: null, approved: 0, rejected: 0 };

  // Exact course/version decisions should pass relevance close to 1; related decisions lower.
  let positive = 0, negative = 0, weight = 0;
  for (const d of usable) {
    const w = clamp(d.relevance ?? 0.5);
    weight += w;
    if (d.outcome === 'approved') positive += w;
    else negative += w;
  }
  const support = weight ? positive / weight : null;
  const label = support >= 0.75 ? 'Starkt stöd' : support >= 0.45 ? 'Visst stöd' : 'Negativ historik';
  return {
    status: 'available', label, support,
    approved: usable.filter(d => d.outcome === 'approved').length,
    rejected: usable.filter(d => d.outcome === 'rejected').length,
  };
}

export function creditTransferGuidance({ syllabus = {}, decisions = [] } = {}) {
  const coursePlan = syllabusEvidence(syllabus);
  const history = historicalEvidence(decisions);

  // No syllabus-to-syllabus review = no positive transfer guidance, regardless of title similarity/history.
  if (coursePlan.status !== 'assessed') {
    return { level: 'not-assessed', label: 'Ej bedömd', coursePlan, history, disclaimer: 'Kursplaner krävs för bedömning.' };
  }

  const s = coursePlan.score;
  const h = history.support;
  let level = 'weak';
  if (s >= 0.85 && (h === null || h >= 0.45)) level = h !== null && h >= 0.75 ? 'strong' : 'promising';
  else if (s >= 0.65 && h !== null && h >= 0.75) level = 'promising';
  else if (s >= 0.65) level = 'uncertain';
  else if (h !== null && h >= 0.75) level = 'uncertain';

  const labels = { strong: 'Starkt underlag', promising: 'Lovande', uncertain: 'Osäkert', weak: 'Svagt underlag' };
  return {
    level,
    label: labels[level],
    coursePlan,
    history,
    disclaimer: 'StudieLots ger vägledning. Lärosätet fattar det slutliga beslutet om tillgodoräknande.',
  };
}
