#!/usr/bin/env node
/** Högskolan i Borås programme structure importer.
 * Resolves programme pages from HB's own programme index, locates the official
 * education-plan PDF, converts it to text, and only promotes consistent terms.
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
const hp = v => {
  const m = clean(v).replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(?:hp|högskolepoäng)/i);
  return m ? Number(m[1]) : null;
};
const hpFlexible = v => {
  const withUnit = hp(v);
  if (withUnit) return withUnit;
  const m = clean(v).match(/[\[(]\s*(\d+(?:[,.]\d+)?)\s*[\])](?:\s|$)/);
  return m ? Number(m[1].replace(',', '.')) : null;
};
const term = v => {
  const m = clean(v).match(/(?:kurser\s+under\s+)?termin\s*(\d{1,2})/i);
  return m ? Number(m[1]) : null;
};

async function fetchText(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'StudieLots-HB-import/1.5' }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return { url: r.url, text: await r.text() };
}

async function fetchBuffer(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'StudieLots-HB-import/1.5' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return { url: r.url, buffer: Buffer.from(await r.arrayBuffer()) };
}

function decodeHtml(s) {
  return s.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&aring;/gi, 'å').replace(/&auml;/gi, 'ä').replace(/&ouml;/gi, 'ö').replace(/&Aring;/g, 'Å').replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö');
}

function stripHtml(s) {
  return clean(decodeHtml(String(s || '').replace(/<[^>]+>/g, ' ')));
}

function linksFromHtml(html, base) {
  const out = [];
  for (const m of html.matchAll(/href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      out.push({ url: new URL(decodeHtml(m[1]), base).href, label: stripHtml(m[2]) });
    } catch {}
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
  try {
    return normCode(new URL(url).searchParams.get('code') || '');
  } catch {
    return '';
  }
}

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
    let out = '';
    let err = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { err += d; });
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${err}`)));
  });
}

let pdftotextReady = null;
async function ensurePdfToText() {
  if (pdftotextReady) return pdftotextReady;
  pdftotextReady = (async () => {
    try {
      await run('pdftotext', ['-v']);
      return;
    } catch {}
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
    const text = await run('pdftotext', ['-layout', pdf, '-']);
    return { url: finalUrl, text };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function boundedMap(items, concurrency, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    for (;;) {
      const n = i++;
      if (n >= items.length) return;
      out[n] = await fn(items[n], n);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, worker));
  return out;
}

async function buildProgrammeIndex() {
  const page = await fetchText(HB_INDEX);
  const links = linksFromHtml(page.text, page.url).filter(x => /\/utbildning\/program-och-kurser\/program\//i.test(x.url));
  const unique = [...new Map(links.map(x => [x.url, x])).values()];
  const byName = new Map();
  const byCode = new Map();
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
  for (const candidate of candidates) {
    if (index.byName.has(candidate)) return index.byName.get(candidate);
  }
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
  const altMatch = normalized.match(/^(.*?)\s*,?\s*(\d+(?:[,.]\d+)?)\s*(?:hp|högskolepoäng)\s*(?:alt\.?|eller)\s*(.*?)\s*,?\s*(\d+(?:[,.]\d+)?)\s*(?:hp|högskolepoäng)/i);
  if (!altMatch) return null;
  const firstHp = Number(altMatch[2].replace(',', '.'));
  const secondHp = Number(altMatch[4].replace(',', '.'));
  if (!Number.isFinite(firstHp) || !Number.isFinite(secondHp) || Math.abs(firstHp - secondHp) > 0.01) return null;
  return {
    name: `${clean(altMatch[1])} / ${clean(altMatch[3])}`,
    hp: firstHp,
    type: 'choice',
    options: [
      { name: clean(altMatch[1]), hp: firstHp },
      { name: clean(altMatch[3]), hp: secondHp }
    ]
  };
}

function parseRows(text) {
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const rows = [];
  let currentTerm = null;
  let currentYear = null;
  let inCourseSection = false;
  let explicitTermMode = false;

  for (const line of lines) {
    if (/^programmets kurser\b/i.test(line)) {
      inCourseSection = true;
      explicitTermMode = true;
      currentTerm = null;
      continue;
    }

    const t = term(line);
    if (t && t <= 20) {
      inCourseSection = true;
      explicitTermMode = true;
      currentTerm = t;
      continue;
    }

    const yearMatch = line.match(/^År(?:skurs)?\s*(\d{1,2})\b/i);
    if (yearMatch) {
      currentYear = Number(yearMatch[1]);
      if (currentYear >= 1 && currentYear <= 10) inCourseSection = true;
      currentTerm = null;
      continue;
    }

    if (currentYear) {
      if (/^Höstterminen\b/i.test(line)) {
        currentTerm = (currentYear - 1) * 2 + 1;
        inCourseSection = true;
        continue;
      }
      if (/^Vårterminen\b/i.test(line)) {
        currentTerm = (currentYear - 1) * 2 + 2;
        inCourseSection = true;
        continue;
      }
    }

    if (inCourseSection && currentTerm && /^(?:Informationssökning|Förkunskapskrav|Examen|Studentinflytande|Övrigt|Vetenskaplig teori|Självständigt arbete \(examensarbete\)|Undervisningsformer|Internationalisering)\b/i.test(line)) {
      if (explicitTermMode) break;
      currentTerm = null;
      currentYear = null;
      inCourseSection = false;
      continue;
    }

    if (!inCourseSection || !currentTerm) continue;

    const groupedChoice = extractChoice(line);
    if (groupedChoice) {
      rows.push({ term: currentTerm, ...groupedChoice, isThesis: false });
      continue;
    }

    const credits = hpFlexible(line);
    if (!credits || credits > 30) continue;
    const name = line
      .replace(/^[•\-–]\s*/, '')
      .replace(/\s*,?\s*\d+(?:[,.]\d+)?\s*(?:hp|högskolepoäng).*$/i, '')
      .replace(/\s*[\[(]\s*\d+(?:[,.]\d+)?\s*[\])]\s*$/i, '')
      .trim();
    if (name.length < 3) continue;
    if (/^(?:År|Höstterminen|Vårterminen|Valbart|Obligatoriska kurser)/i.test(name)) continue;
    const choice = /\balt\.?\b|alternativ|valbar|valfri|\beller\b/i.test(line);
    const thesis = /examensarbete|självständigt arbete/i.test(name);
    rows.push({ term: currentTerm, name, hp: credits, type: choice ? 'choice' : 'required', isThesis: thesis });
  }
  return normalizeChoicePools(rows);
}

function normalizeChoicePools(rows) {
  const byTerm = new Map();
  for (const row of rows) {
    if (!byTerm.has(row.term)) byTerm.set(row.term, []);
    byTerm.get(row.term).push(row);
  }
  const out = [];
  for (const [termNo, termRows] of byTerm) {
    const required = termRows.filter(r => r.type !== 'choice');
    const choices = termRows.filter(r => r.type === 'choice');
    const requiredHp = required.reduce((s, r) => s + r.hp, 0);
    const choiceHp = choices.reduce((s, r) => s + r.hp, 0);
    const remaining = Math.round((30 - requiredHp) * 100) / 100;

    if (choices.length > 1 && requiredHp < 30.01 && choiceHp > remaining + 0.01 && remaining > 0) {
      const optionHps = choices.map(r => r.hp);
      const unit = optionHps[0];
      const sameUnit = optionHps.every(v => Math.abs(v - unit) < 0.01);
      const slots = sameUnit ? remaining / unit : NaN;
      if (sameUnit && Number.isInteger(Math.round(slots)) && Math.abs(slots - Math.round(slots)) < 0.01 && Math.round(slots) >= 1 && choices.length >= Math.round(slots)) {
        out.push(...required);
        out.push({
          term: termNo,
          name: `Valbara/alternativa kurser (${Math.round(slots)} val)`,
          hp: remaining,
          type: 'choice',
          choiceSlots: Math.round(slots),
          options: choices.flatMap(r => r.options || [{ name: r.name, hp: r.hp }]),
          isThesis: false
        });
        continue;
      }
    }
    out.push(...termRows);
  }
  return out.sort((a, b) => a.term - b.term);
}

function classify(rows, programmeHp) {
  if (!rows.length) return { coverage: 'metadata-only', reason: 'no-semester-rows' };
  const sums = new Map();
  for (const r of rows) sums.set(r.term, (sums.get(r.term) || 0) + r.hp);
  const terms = [...sums].sort((a, b) => a[0] - b[0]);
  const expected = programmeHp && programmeHp % 30 === 0 ? programmeHp / 30 : null;
  const over = terms.filter(([, s]) => s > 30.01);
  const exact = terms.filter(([, s]) => Math.abs(s - 30) < 0.01).length;
  const hasChoice = rows.some(r => r.type === 'choice');
  if (over.length) return { coverage: 'manual-review', reason: 'term-over-30hp', termSums: Object.fromEntries(terms) };
  if (expected && terms.length === expected && exact === expected) return { coverage: hasChoice ? 'choice-required' : 'complete', reason: 'official-education-plan-all-terms-30hp', termSums: Object.fromEntries(terms) };
  if (exact >= 2) return { coverage: 'partial-structure', reason: 'official-education-plan-some-complete-terms', termSums: Object.fromEntries(terms) };
  return { coverage: 'manual-review', reason: 'official-education-plan-insufficient-consistency', termSums: Object.fromEntries(terms) };
}

async function enrich(item, index) {
  const pageUrl = programmePageUrl(item, index);
  try {
    const code = normCode(item.programCode || item.code || '');
    let page;
    let pdfUrl = '';
    if (code && index.byCode.has(code)) {
      const hit = index.byCode.get(code);
      page = { url: hit.pageUrl, text: '' };
      pdfUrl = hit.pdfUrl;
    } else {
      page = await fetchText(pageUrl);
      pdfUrl = educationPlanUrl(page.text, page.url);
    }
    if (!pdfUrl) throw new Error('education-plan-link-not-found');
    const pdf = await pdfToText(pdfUrl, item.programCode || item.key);
    const rows = parseRows(pdf.text);
    const c = classify(rows, Number(item.hp) || null);
    return { ...item, status: 'processed', source: 'hogskolan-i-boras-utbildningsplan', sourceUrl: pdf.url, sourceUrls: [page.url, pdf.url], rows, ...c, checkedAt: new Date().toISOString() };
  } catch (e) {
    return { ...item, status: 'manual-review', coverage: 'metadata-only', reason: `hb-import:${e.message}`, attemptedPageUrl: pageUrl, checkedAt: new Date().toISOString() };
  }
}

async function pool(items, index) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    for (;;) {
      const n = i++;
      if (n >= items.length) return;
      out[n] = await enrich(items[n], index);
      console.log(`${n + 1}/${items.length} ${out[n].coverage} ${items[n].programCode || ''} ${out[n].reason}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
  return out;
}

async function main() {
  const queue = JSON.parse(await fs.readFile(path.join(ROOT, 'structure-queue.json'), 'utf8'));
  let structures = [];
  try { structures = JSON.parse(await fs.readFile(path.join(ROOT, 'structures.json'), 'utf8')); } catch {}
  const map = new Map(structures.map(x => [x.key, x]));
  const hb = queue.filter(x => norm(x.university) === 'hogskolan i boras').filter(x => !map.get(x.key) || ['metadata-only', 'manual-review', 'partial-structure'].includes(map.get(x.key).coverage)).slice(0, LIMIT);
  const index = await buildProgrammeIndex();
  const fresh = await pool(hb, index);
  const rank = { complete: 5, 'choice-required': 4, 'partial-structure': 3, 'manual-review': 2, 'metadata-only': 1 };
  for (const x of fresh) {
    const old = map.get(x.key);
    if (!old || (rank[x.coverage] || 0) >= (rank[old.coverage] || 0)) map.set(x.key, x);
  }
  const all = [...map.values()];
  const counts = all.reduce((a, x) => { a[x.coverage] = (a[x.coverage] || 0) + 1; return a; }, {});
  const hbCounts = fresh.reduce((a, x) => { a[x.coverage] = (a[x.coverage] || 0) + 1; return a; }, {});
  const retryable = all.filter(x => ['metadata-only', 'manual-review'].includes(x.coverage)).length;
  await fs.writeFile(path.join(ROOT, 'structures.json'), JSON.stringify(all, null, 2) + '\n');
  await fs.writeFile(path.join(ROOT, 'structure-meta.json'), JSON.stringify({ generatedAt: new Date().toISOString(), processed: all.length, remaining: Math.max(0, queue.length - all.length), retryable, counts }, null, 2) + '\n');
  console.log({ hbProcessed: fresh.length, hbCounts, processed: all.length, counts });
}

main().catch(e => { console.error(e); process.exitCode = 1; });