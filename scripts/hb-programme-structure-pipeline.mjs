#!/usr/bin/env node
/** Högskolan i Borås programme structure importer.
 * Reads HB's official programme pages + education-plan PDFs and only promotes
 * structures whose term totals can be validated conservatively.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const ROOT = process.env.STRUCTURE_ROOT || 'data/susa';
const LIMIT = Number(process.env.HB_STRUCTURE_LIMIT || 100);
const CONCURRENCY = Number(process.env.HB_STRUCTURE_CONCURRENCY || 5);
const INDEX_CONCURRENCY = Number(process.env.HB_INDEX_CONCURRENCY || 6);
const HB_INDEX = 'https://www.hb.se/utbildning/program-och-kurser/?lang=sv&types=Programme&userInput=true';
const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const norm = v => clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const slug = v => norm(v).replace(/\s+/g, '-');
const normCode = v => clean(v).toLocaleUpperCase('sv-SE').replace(/\s+/g, '');

function hpFlexible(v) {
  const s = clean(v);
  let m = s.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(?:hp|högskolepoäng)\b/i);
  if (m) return Number(m[1]);
  m = s.match(/[\[(]\s*(\d+(?:[,.]\d+)?)\s*[\])](?:\s|$)/);
  if (m) return Number(m[1].replace(',', '.'));
  // Older HB plans often use a table where credits are only the final column.
  m = s.match(/(?:^|\s)(\d+(?:[,.]\d+)?)\s*$/);
  if (m) {
    const n = Number(m[1].replace(',', '.'));
    if (Number.isFinite(n) && n >= 1 && n <= 30) return n;
  }
  return null;
}

function explicitTerm(v) {
  const m = clean(v).match(/(?:kurser\s+under\s+)?termin\s*(\d{1,2})/i);
  return m ? Number(m[1]) : null;
}

function yearSeasonTerm(line) {
  const s = clean(line);
  let m = s.match(/År(?:skurs)?\s*(\d{1,2}).*?\b(Hösttermin(?:en)?|Vårtermin(?:en)?)\b/i);
  if (!m) m = s.match(/\b(Hösttermin(?:en)?|Vårtermin(?:en)?)\b.*?År(?:skurs)?\s*(\d{1,2})/i);
  if (!m) return null;
  const seasonFirst = /^(?:Höst|Vår)/i.test(m[1]);
  const year = Number(seasonFirst ? m[2] : m[1]);
  const season = seasonFirst ? m[1] : m[2];
  if (!Number.isFinite(year) || year < 1 || year > 10) return null;
  return (year - 1) * 2 + (/^Vår/i.test(season) ? 2 : 1);
}

async function fetchText(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'StudieLots-HB-import/1.7' }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return { url: r.url, text: await r.text() };
}

async function fetchBuffer(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'StudieLots-HB-import/1.7' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return { url: r.url, buffer: Buffer.from(await r.arrayBuffer()) };
}

function decodeHtml(s) {
  return String(s || '').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&aring;/gi, 'å').replace(/&auml;/gi, 'ä').replace(/&ouml;/gi, 'ö').replace(/&Aring;/g, 'Å').replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö');
}
function stripHtml(s) { return clean(decodeHtml(String(s || '').replace(/<[^>]+>/g, ' '))); }
function linksFromHtml(html, base) {
  const out = [];
  for (const m of html.matchAll(/href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try { out.push({ url: new URL(decodeHtml(m[1]), base).href, label: stripHtml(m[2]) }); } catch {}
  }
  return out;
}
function educationPlanUrl(html, base) {
  for (const link of linksFromHtml(html, base)) {
    if (/utbildningsplan/i.test(link.label) || (/kursinfodoc\.hb\.se/i.test(link.url) && /type=program/i.test(link.url))) return link.url;
  }
  return '';
}
function codeFromEducationPlanUrl(url) {
  try { return normCode(new URL(url).searchParams.get('code') || ''); } catch { return ''; }
}

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
    let out = '', err = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { err += d; });
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${err}`)));
  });
}

let pdftotextReady;
async function ensurePdfToText() {
  if (pdftotextReady) return pdftotextReady;
  pdftotextReady = (async () => {
    try { await run('pdftotext', ['-v']); return; } catch {}
    console.log('pdftotext missing; installing poppler-utils on GitHub runner...');
    await run('sudo', ['apt-get', 'update', '-qq']);
    await run('sudo', ['apt-get', 'install', '-y', '-qq', 'poppler-utils']);
    await run('pdftotext', ['-v']);
  })();
  return pdftotextReady;
}
async function pdfToText(url, key) {
  await ensurePdfToText();
  const { url: finalUrl, buffer } = await fetchBuffer(url);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'studielots-hb-'));
  const pdf = path.join(dir, `${String(key).replace(/[^a-z0-9_-]/gi, '_')}.pdf`);
  try {
    await fs.writeFile(pdf, buffer);
    return { url: finalUrl, text: await run('pdftotext', ['-layout', pdf, '-']) };
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
}

async function boundedMap(items, concurrency, fn) {
  const out = new Array(items.length); let i = 0;
  async function worker() {
    for (;;) { const n = i++; if (n >= items.length) return; out[n] = await fn(items[n], n); }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, worker));
  return out;
}

async function buildProgrammeIndex() {
  const page = await fetchText(HB_INDEX);
  const links = linksFromHtml(page.text, page.url).filter(x => /\/utbildning\/program-och-kurser\/program\//i.test(x.url));
  const unique = [...new Map(links.map(x => [x.url, x])).values()];
  const byName = new Map(), byCode = new Map();
  for (const x of unique) {
    const key = norm(x.label.replace(/,?\s*\d+(?:[,.]\d+)?\s*(?:hp|högskolepoäng).*$/i, ''));
    if (key && !byName.has(key)) byName.set(key, x.url);
  }
  await boundedMap(unique, INDEX_CONCURRENCY, async x => {
    try {
      const programme = await fetchText(x.url);
      const pdfUrl = educationPlanUrl(programme.text, programme.url);
      const code = codeFromEducationPlanUrl(pdfUrl);
      if (code && !byCode.has(code)) byCode.set(code, { pageUrl: programme.url, pdfUrl });
    } catch {}
  });
  console.log(`HB programme index: ${byName.size} named programme pages, ${byCode.size} programme codes`);
  return { byName, byCode };
}

function programmePageUrl(item, index) {
  const code = normCode(item.programCode || item.code || '');
  if (code && index.byCode.has(code)) return index.byCode.get(code).pageUrl;
  const candidates = [item.programName, item.name, item.title].filter(Boolean).map(norm);
  for (const candidate of candidates) if (index.byName.has(candidate)) return index.byName.get(candidate);
  for (const candidate of candidates) {
    const hit = [...index.byName.entries()].find(([k]) => k === candidate || k.startsWith(candidate + ' ') || candidate.startsWith(k + ' '));
    if (hit) return hit[1];
  }
  const direct = [item.sourceUrl, item.url, item.officialUrl].find(u => typeof u === 'string' && /hb\.se\/utbildning\/program-och-kurser\/program\//i.test(u));
  if (direct) return direct;
  return `https://www.hb.se/utbildning/program-och-kurser/program/${slug(item.programName || item.name || '')}/`;
}

function extractChoice(line) {
  const normalized = line.replace(/[–—]/g, '-');
  const m = normalized.match(/^(.*?)\s*,?\s*(\d+(?:[,.]\d+)?)\s*(?:hp|högskolepoäng)\s*(?:alt\.?|eller)\s*(.*?)\s*,?\s*(\d+(?:[,.]\d+)?)\s*(?:hp|högskolepoäng)/i);
  if (!m) return null;
  const a = Number(m[2].replace(',', '.')), b = Number(m[4].replace(',', '.'));
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > 0.01) return null;
  return { name: `${clean(m[1])} / ${clean(m[3])}`, hp: a, type: 'choice', options: [{ name: clean(m[1]), hp: a }, { name: clean(m[3]), hp: b }] };
}

function mergeSplitAlternatives(rows) {
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i], next = rows[i + 1];
    if (row.choiceContinuation && next && next.term === row.term && next.type === 'required' && Math.abs(next.hp - row.hp) < 0.01) {
      out.push({ term: row.term, name: `${row.name} / ${next.name}`, hp: row.hp, type: 'choice', options: [{ name: row.name, hp: row.hp }, { name: next.name, hp: next.hp }], isThesis: row.isThesis || next.isThesis });
      i++; continue;
    }
    const { choiceContinuation, ...cleanRow } = row; out.push(cleanRow);
  }
  return out;
}

function parseRows(text) {
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const rows = [];
  let currentTerm = null, currentYear = null, inCourseSection = false, explicitTermMode = false;
  for (const line of lines) {
    if (/^(?:programmets\s+kurser|programmets\s+innehåll|kurser\s+i\s+programmet)\b/i.test(line)) { inCourseSection = true; currentTerm = null; continue; }
    const combined = yearSeasonTerm(line);
    if (combined) { currentTerm = combined; currentYear = Math.ceil(combined / 2); inCourseSection = true; continue; }
    const t = explicitTerm(line);
    if (t && t <= 20) { currentTerm = t; inCourseSection = true; explicitTermMode = true; continue; }
    const ym = line.match(/^År(?:skurs)?\s*(\d{1,2})\b/i);
    if (ym) { currentYear = Number(ym[1]); currentTerm = null; if (currentYear >= 1 && currentYear <= 10) inCourseSection = true; continue; }
    if (currentYear && /^Hösttermin(?:en)?\b/i.test(line)) { currentTerm = (currentYear - 1) * 2 + 1; inCourseSection = true; continue; }
    if (currentYear && /^Vårtermin(?:en)?\b/i.test(line)) { currentTerm = (currentYear - 1) * 2 + 2; inCourseSection = true; continue; }
    if (inCourseSection && currentTerm && /^(?:Informationssökning|Förkunskapskrav|Examen|Studentinflytande|Övrigt|Vetenskaplig teori|Undervisningsformer|Internationalisering|Programmets mål|Mål|Kvalitetssäkring|Övergångsbestämmelser|Examinationsformer)\b/i.test(line)) {
      if (explicitTermMode) break;
      currentTerm = null; currentYear = null; inCourseSection = false; continue;
    }
    if (!inCourseSection || !currentTerm) continue;
    const grouped = extractChoice(line);
    if (grouped) { rows.push({ term: currentTerm, ...grouped, isThesis: false }); continue; }
    const credits = hpFlexible(line);
    if (!credits || credits > 30) continue;
    const name = line
      .replace(/^[•\-–]\s*/, '')
      .replace(/\s*,?\s*\d+(?:[,.]\d+)?\s*(?:hp|högskolepoäng).*$/i, '')
      .replace(/\s*[\[(]\s*\d+(?:[,.]\d+)?\s*[\])]\s*$/i, '')
      .replace(/\s+\d+(?:[,.]\d+)?\s*$/, '')
      .trim();
    if (name.length < 3 || /^(?:År|Hösttermin|Vårtermin|Valbart|Obligatoriska kurser|Summa)\b/i.test(name)) continue;
    const choice = /\balt\.?\b|alternativ|valbar|valfri|\beller\b/i.test(line);
    rows.push({ term: currentTerm, name, hp: credits, type: choice ? 'choice' : 'required', choiceContinuation: /\balt\.?\s*$|\beller\s*$/i.test(line), isThesis: /examensarbete|självständigt arbete/i.test(name) });
  }
  return normalizeChoicePools(mergeSplitAlternatives(rows));
}

function normalizeChoicePools(rows) {
  const byTerm = new Map();
  for (const row of rows) { if (!byTerm.has(row.term)) byTerm.set(row.term, []); byTerm.get(row.term).push(row); }
  const out = [];
  for (const [termNo, termRows] of byTerm) {
    const required = termRows.filter(r => r.type !== 'choice'), choices = termRows.filter(r => r.type === 'choice');
    const requiredHp = required.reduce((s, r) => s + r.hp, 0), choiceHp = choices.reduce((s, r) => s + r.hp, 0), remaining = Math.round((30 - requiredHp) * 100) / 100;
    if (choices.length > 1 && requiredHp < 30.01 && choiceHp > remaining + 0.01 && remaining > 0) {
      const unit = choices[0].hp, sameUnit = choices.every(r => Math.abs(r.hp - unit) < 0.01), slots = sameUnit ? remaining / unit : NaN;
      if (sameUnit && Math.abs(slots - Math.round(slots)) < 0.01 && Math.round(slots) >= 1 && choices.length >= Math.round(slots)) {
        out.push(...required, { term: termNo, name: `Valbara/alternativa kurser (${Math.round(slots)} val)`, hp: remaining, type: 'choice', choiceSlots: Math.round(slots), options: choices.flatMap(r => r.options || [{ name: r.name, hp: r.hp }]), isThesis: false });
        continue;
      }
    }
    out.push(...termRows);
  }
  return out.sort((a, b) => a.term - b.term);
}

function classify(rows, programmeHp) {
  if (!rows.length) return { coverage: 'metadata-only', reason: 'no-semester-rows' };
  const sums = new Map(); for (const r of rows) sums.set(r.term, (sums.get(r.term) || 0) + r.hp);
  const terms = [...sums].sort((a, b) => a[0] - b[0]);
  const expected = programmeHp && programmeHp % 30 === 0 ? programmeHp / 30 : null;
  const over = terms.filter(([, s]) => s > 30.01), exact = terms.filter(([, s]) => Math.abs(s - 30) < 0.01).length, hasChoice = rows.some(r => r.type === 'choice');
  if (over.length) return { coverage: 'manual-review', reason: 'term-over-30hp', termSums: Object.fromEntries(terms) };
  if (expected && terms.length === expected && exact === expected) return { coverage: hasChoice ? 'choice-required' : 'complete', reason: 'official-education-plan-all-terms-30hp', termSums: Object.fromEntries(terms) };
  if (exact >= 2) return { coverage: 'partial-structure', reason: 'official-education-plan-some-complete-terms', termSums: Object.fromEntries(terms) };
  return { coverage: 'manual-review', reason: 'official-education-plan-insufficient-consistency', termSums: Object.fromEntries(terms) };
}

function diagnosticLines(text) {
  return text.split(/\r?\n/).map(clean).filter(Boolean).filter(x => /termin|årskurs|^år\b|\bhp\b|högskolepoäng|\d+[,.]\d+\s*$|programmets kurser|programmets innehåll|kurser i programmet/i.test(x)).slice(0, 18);
}

async function enrich(item, index) {
  const pageUrl = programmePageUrl(item, index);
  try {
    const code = normCode(item.programCode || item.code || '');
    let page, pdfUrl = '';
    if (code && index.byCode.has(code)) { const hit = index.byCode.get(code); page = { url: hit.pageUrl, text: '' }; pdfUrl = hit.pdfUrl; }
    else { page = await fetchText(pageUrl); pdfUrl = educationPlanUrl(page.text, page.url); }
    if (!pdfUrl) throw new Error('education-plan-link-not-found');
    const pdf = await pdfToText(pdfUrl, item.programCode || item.key);
    const rows = parseRows(pdf.text), c = classify(rows, Number(item.hp) || null);
    if (!rows.length) console.log(`HB-DIAG ${code || item.key}: ${JSON.stringify(diagnosticLines(pdf.text))}`);
    return { ...item, status: 'processed', source: 'hogskolan-i-boras-utbildningsplan', sourceUrl: pdf.url, sourceUrls: [page.url, pdf.url], rows, ...c, checkedAt: new Date().toISOString() };
  } catch (e) {
    return { ...item, status: 'manual-review', coverage: 'metadata-only', reason: `hb-import:${e.message}`, attemptedPageUrl: pageUrl, checkedAt: new Date().toISOString() };
  }
}

async function pool(items, index) {
  const out = new Array(items.length); let i = 0;
  async function worker() {
    for (;;) { const n = i++; if (n >= items.length) return; out[n] = await enrich(items[n], index); console.log(`${n + 1}/${items.length} ${out[n].coverage} ${items[n].programCode || ''} ${out[n].reason}`); }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker)); return out;
}

async function main() {
  const queue = JSON.parse(await fs.readFile(path.join(ROOT, 'structure-queue.json'), 'utf8'));
  let structures = []; try { structures = JSON.parse(await fs.readFile(path.join(ROOT, 'structures.json'), 'utf8')); } catch {}
  const map = new Map(structures.map(x => [x.key, x]));
  const hb = queue.filter(x => norm(x.university) === 'hogskolan i boras').filter(x => !map.get(x.key) || ['metadata-only', 'manual-review', 'partial-structure'].includes(map.get(x.key).coverage)).slice(0, LIMIT);
  const index = await buildProgrammeIndex(), fresh = await pool(hb, index);
  const rank = { complete: 5, 'choice-required': 4, 'partial-structure': 3, 'manual-review': 2, 'metadata-only': 1 };
  for (const x of fresh) { const old = map.get(x.key); if (!old || (rank[x.coverage] || 0) >= (rank[old.coverage] || 0)) map.set(x.key, x); }
  const all = [...map.values()], counts = all.reduce((a, x) => { a[x.coverage] = (a[x.coverage] || 0) + 1; return a; }, {}), hbCounts = fresh.reduce((a, x) => { a[x.coverage] = (a[x.coverage] || 0) + 1; return a; }, {}), retryable = all.filter(x => ['metadata-only', 'manual-review'].includes(x.coverage)).length;
  await fs.writeFile(path.join(ROOT, 'structures.json'), JSON.stringify(all, null, 2) + '\n');
  await fs.writeFile(path.join(ROOT, 'structure-meta.json'), JSON.stringify({ generatedAt: new Date().toISOString(), processed: all.length, remaining: Math.max(0, queue.length - all.length), retryable, counts }, null, 2) + '\n');
  console.log({ hbProcessed: fresh.length, hbCounts, processed: all.length, counts });
}

main().catch(e => { console.error(e); process.exitCode = 1; });
