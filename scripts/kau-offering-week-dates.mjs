// Karlstad publishes study periods as ISO week ranges, not exact start/end days.
// Use the Monday and Sunday bounding those weeks, with explicit provenance.
const mondayOfIsoWeek = (year, week) => {
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const firstMonday = new Date(januaryFourth);
  firstMonday.setUTCDate(4 - (januaryFourth.getUTCDay() || 7) + 1);
  const nextJanuaryFourth = new Date(Date.UTC(year + 1, 0, 4));
  const nextFirstMonday = new Date(nextJanuaryFourth);
  nextFirstMonday.setUTCDate(4 - (nextJanuaryFourth.getUTCDay() || 7) + 1);
  const weeksInYear = Math.round((nextFirstMonday - firstMonday) / (7 * 86400000));
  if (!Number.isInteger(week) || week < 1 || week > weeksInYear) return null;
  const date = new Date(firstMonday);
  date.setUTCDate(firstMonday.getUTCDate() + 7 * (week - 1));
  return date;
};

const isoDate = date => date.toISOString().slice(0, 10);

export function datesFromKarlstadWeeks(period, term) {
  const range = /^vecka\s+(\d{1,2})\s*[–-]\s*(\d{1,2})$/i.exec(String(period || '').trim());
  const semester = /^(HT|VT)(\d{2})$/.exec(String(term || ''));
  if (!range || !semester) return null;
  const startWeek = Number(range[1]), endWeek = Number(range[2]);
  const startYear = 2000 + Number(semester[2]);
  // A descending week range spans New Year (e.g. HT26 week 36–2).
  const endYear = startYear + (endWeek < startWeek ? 1 : 0);
  const start = mondayOfIsoWeek(startYear, startWeek);
  const endMonday = mondayOfIsoWeek(endYear, endWeek);
  if (!start || !endMonday) return null;
  const end = new Date(endMonday);
  end.setUTCDate(end.getUTCDate() + 6);
  return {
    startDate: isoDate(start),
    endDate: isoDate(end),
    datePrecision: 'week',
    dateDerivation: 'iso-week-monday-through-sunday',
  };
}
