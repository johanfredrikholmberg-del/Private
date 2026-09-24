// KTH historical credit-transfer import policy.
// Only unambiguous one-source-course -> one-specific-KTH-course decisions may
// become historical evidence. Multi-source decisions and generic/elective
// targets are deliberately excluded.
export const KTH_HISTORY_POLICY=Object.freeze({
  university:'KTH',
  relation:'1-to-1',
  requireSpecificTarget:true,
  excludeMultiSource:true,
  excludeGenericTargets:true,
  requireUnambiguousCourseResolution:true
});

export function isEligibleKthHistoricalGroup(group){
  if(!group||!Array.isArray(group.sources)||group.sources.length!==1)return false;
  const target=group.target||{};
  const name=String(target.name||'').trim();
  if(!name)return false;
  if(/utbytesstudier|valbar|elective|kurser inom programmet|generell|unspecified/i.test(name))return false;
  return true;
}
