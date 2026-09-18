/* Pure, DOM-independent arithmetic for programme credit summaries.
 * Does not decide whether a course qualifies for credit; callers supply counted hp.
 */
(function (global) {
  'use strict';
  const hp = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  function summarize(totalHp, entries) {
    const total = hp(totalHp);
    let credited = 0;
    let possible = 0;
    for (const entry of Array.isArray(entries) ? entries : []) {
      const cap = hp(entry?.hp);
      const counted = Math.min(cap, hp(entry?.countedHp));
      credited += counted;
      // Potential credit is informational only; never deduct it from remaining hp.
      if (!counted) possible += Math.min(cap, hp(entry?.possibleHp));
    }
    credited = Math.min(total, credited);
    possible = Math.min(Math.max(0, total - credited), possible);
    return Object.freeze({
      total, credited, possible,
      remaining: Math.max(0, total - credited),
      pct: Math.round(100 * credited / Math.max(1, total))
    });
  }
  const api = Object.freeze({ hp, summarize });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.StudieLotsCreditLedgerMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
