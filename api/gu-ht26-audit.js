const GU_PROVIDER = 'Göteborgs universitet';
const BASE = 'https://api.skolverket.se/susa-navet/emil3/';

const clean = v => String(v ?? '').trim();
const norm = v => clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const localized = value => {
  const rows = value?.strings || value?.urls || [];
  const swe = rows.find(x => String(x?.lang || '').toLowerCase() === 'swe');
  return clean((swe || rows[0])?.value);
};
const list = (data, keys) => {
  if (Array.isArray(data)) return data;
  for (const key of keys) if (Array.isArray(data?.[key])) return data[key];
  return [];
};
const infoList = data => list(data, ['educationInfos', 'educationInfo', 'items', 'content', 'results', 'data']);
const providerList = data => list(data, ['educationProviders', 'providers', 'items', 'content', 'results', 'data']);
const scalarEntries = (value, path = '', out = []) => {
  if (value == null) return out;
  if (Array.isArray(value)) value.forEach((x, i) => scalarEntries(x, `${path}[${i}]`, out));
  else if (typeof value === 'object') Object.entries(value).forEach(([k, x]) => scalarEntries(x, path ? `${path}.${k}` : k, out));
  else if (['string', 'number', 'boolean'].includes(typeof value)) out.push({ path, value });
  return out;
};
const providerIdFromInfo = info => {
  const c = info?.content || {};
  return clean(c.provider || c.providers?.[0] || c.organizer || c.educationProvider || scalarEntries(c).find(x => /(provider|organizer|educationProvider)(\[0\])?$/i.test(x.path))?.value);
};
const isActive = r => {
  if (!r || String(r.status || 'ACTIVE').toUpperCase() !== 'ACTIVE') return false;
  const expires = r?.content?.expires;
  return !expires || !Number.isFinite(Date.parse(expires)) || Date.parse(expires) >= Date.now() - 86400000;
};
const isProgram = info => ['program', 'programme', 'programmeutbildning'].includes(norm(info?.content?.configuration?.code));

async function getJson(path) {
  const u = new URL(path, BASE);
  u.searchParams.set('schoolType', 'HS');
  u.searchParams.set('page', '0');
  u.searchParams.set('size', '2000');
  const r = await fetch(u, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`Susa-navet ${r.status}`);
  return r.json();
}

async function getGuProgrammes() {
  const [infosRaw, providersRaw] = await Promise.all([getJson('educationInfos'), getJson('educationProviders')]);
  const providers = new Map(providerList(providersRaw).map(p => [clean(p?.id || p?.content?.identifier), localized(p?.content?.name)]));
  return infoList(infosRaw)
    .filter(info => isActive(info) && isProgram(info))
    .map(info => ({
      info,
      provider: providers.get(providerIdFromInfo(info)) || '',
      code: clean(info?.content?.code),
      name: localized(info?.content?.title),
      sourceId: clean(info?.id || info?.content?.identifier)
    }))
    .filter(row => norm(row.provider) === norm(GU_PROVIDER))
    .filter(row => row.code && row.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'sv'));
}

async function invokeGu(programme) {
  const mod = await import('./gu-program-structure.js');
  const handler = mod.default || mod;
  let statusCode = 200;
  let payload = null;
  const req = { method: 'GET', query: { code: programme.code, name: programme.name, university: GU_PROVIDER } };
  const res = {
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; return this; }
  };
  await handler(req, res);
  return { statusCode, payload };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const offset = Math.max(0, Number(req.query?.offset || 0) || 0);
  const limit = Math.min(8, Math.max(1, Number(req.query?.limit || 4) || 4));
  try {
    const programmes = await getGuProgrammes();
    const batch = programmes.slice(offset, offset + limit);
    const rows = [];
    for (const programme of batch) {
      try {
        const { statusCode, payload } = await invokeGu(programme);
        const terms = Array.isArray(payload?.terms) ? payload.terms : [];
        const hp = terms.flatMap(t => Array.isArray(t?.courses) ? t.courses : []).reduce((s, c) => s + (Number(c?.hp) || 0), 0);
        rows.push({
          university: GU_PROVIDER,
          term: 'HT 2026',
          code: programme.code,
          name: programme.name,
          sourceId: programme.sourceId,
          status: payload?.status || (statusCode === 200 ? 'resolved' : 'unresolved'),
          confidence: payload?.confidence || null,
          source: payload?.source || null,
          sourceUrl: payload?.url || payload?.sourceUrl || null,
          hp,
          terms,
          reason: payload?.reason || payload?.message || null
        });
      } catch (error) {
        rows.push({ university: GU_PROVIDER, term: 'HT 2026', code: programme.code, name: programme.name, status: 'error', reason: String(error?.message || error), terms: [] });
      }
    }
    return res.status(200).json({ generatedAt: new Date().toISOString(), university: GU_PROVIDER, term: 'HT 2026', totalProgrammes: programmes.length, offset, limit, nextOffset: offset + batch.length < programmes.length ? offset + batch.length : null, rows });
  } catch (error) {
    return res.status(502).json({ error: 'GU HT26 audit failed', message: String(error?.message || error) });
  }
}
