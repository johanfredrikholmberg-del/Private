#!/usr/bin/env node
/** Högskolan i Borås programme structure importer.
 * Uses the official public programme page to locate the current education-plan PDF,
 * converts that PDF to text, and only promotes internally consistent term structures.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const ROOT = process.env.STRUCTURE_ROOT || 'data/susa';
const LIMIT = Number(process.env.HB_STRUCTURE_LIMIT || 100);
const CONCURRENCY = Number(process.env.HB_STRUCTURE_CONCURRENCY || 5);
const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const norm = v => clean(v).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const slug = v => norm(v).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const hp = v => {
  const m = clean(v).replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(?:hp|högskolepoäng)/i);
  return m ? Number(m[1]) : null;
};
const term = v => {
  const m = clean(v).match(/(?:kurser\s+under\s+)?termin\s*(\d{1,2})/i);
  return m ? Number(m[1]) : null;
};

async function fetchText(url) {
  const r = await fetch(url, {
    headers: { 'user-agent': 'StudieLots-HB-import/1.1' },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return { url: r.url, text: await r.text() };
}

async function fetchBuffer(url) {
  const r = await fetch(url, {
    headers: { 'user-agent': 'StudieLots-HB-import/1.1' },
    redirect: 'follow',
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return { url: r.url, buffer: Buffer.from(await r.arrayBuffer()) };
}

function decodeHtml(s) {
  return s
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function educationPlanUrl(html, base) {
  const links = [...html.matchAll(/href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  for (const m of links) {
    const href = decodeHtml(m[1]);
    const label = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (/utbildningsplan/i.test(label) || (/kursinfodoc\.hb\.se/i.test(href) && /type=program/i.test(href))) {
      try {
        return new URL(href, base).href;
      } catch {
        // keep looking
      }
    }
  }
  return '';
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { err += d; });
    p.on('error', reject);
    p.on('close', code => {
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} exited ${code}: ${err}`));
    });
  });
}

async function pdfToText(url, key) {
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

function parseRows(text) {
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const rows = [];
  let currentTerm = null;
  for (const line of lines) {
    const t = term(line);
    if (t && t <= 20) {
      currentTerm = t;
      if (/^(?:programmets kurser\s*)?(?:kurser\s+under\s+)?termin\s*\d+/i.test(line)) continue;
    }
    if (!currentTerm) continue;
    const credits = hp(line);
    if (!credits || credits > 30) continue;
    const name = line
      .replace(/^[•\-–]\s*/, '')
      .replace(/\s*,?\s*\d+(?:[,.]\d+)?\s*(?:hp|högskolepoäng).*$/i, '')
      .trim();
    if (name.length < 3) continue;
    const choice = /\balt\.?\b|alternativ|valbar|valfri/i.test(line);
    const thesis = /examensarbete|självständigt arbete/i.test(name);
    rows.push({ term: currentTerm, name, hp: credits, type: choice ? 'choice' : 'required', isThesis: thesis });
  }
  return rows;
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
  if (expected && terms.length === expected && exact === expected) {
    return {
      coverage: hasChoice ? 'choice-required' : 'complete',
      reason: 'official-education-plan-all-terms-30hp',
      termSums: Object.fromEntries(terms),
    };
  }
  if (exact >= 2) {
    return {
      coverage: 'partial-structure',
      reason: 'official-education-plan-some-complete-terms',
      termSums: Object.fromEntries(terms),
    };
  }
  return {
    coverage: 'manual-review',
    reason: 'official-education-plan-insufficient-consistency',
    termSums: Object.fromEntries(terms),
  };
}

async function enrich(item) {
  const pageUrl = `https://www.hb.se/utbildning/program-och-kurser/program/${slug(item.programName)}/`;
  try {
    const page = await fetchText(pageUrl);
    const pdfUrl = educationPlanUrl(page.text, page.url);
    if (!pdfUrl) throw new Error('education-plan-link-not-found');
    const pdf = await pdfToText(pdfUrl, item.programCode || item.key);
    const rows = parseRows(pdf.text);
    const c = classify(rows, Number(item.hp) || null);
    return {
      ...item,
      status: 'processed',
      source: 'hogskolan-i-boras-utbildningsplan',
      sourceUrl: pdf.url,
      sourceUrls: [page.url, pdf.url],
      rows,
      ...c,
      checkedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      ...item,
      status: 'manual-review',
      coverage: 'metadata-only',
      reason: `hb-import:${e.message}`,
      checkedAt: new Date().toISOString(),
    };
  }
}

async function pool(items) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    for (;;) {
      const n = i++;
      if (n >= items.length) return;
      out[n] = await enrich(items[n]);
      console.log(`${n + 1}/${items.length} ${out[n].coverage} ${items[n].programCode || ''} ${out[n].reason}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
  return out;
}

async function main() {
  const queue = JSON.parse(await fs.readFile(path.join(ROOT, 'structure-queue.json'), 'utf8'));
  let structures = [];
  try {
    structures = JSON.parse(await fs.readFile(path.join(ROOT, 'structures.json'), 'utf8'));
  } catch {
    // first run
  }
  const map = new Map(structures.map(x => [x.key, x]));
  const hb = queue
    .filter(x => norm(x.university) === 'hogskolan i boras')
    .filter(x => !map.get(x.key) || ['metadata-only', 'manual-review', 'partial-structure'].includes(map.get(x.key).coverage))
    .slice(0, LIMIT);
  const fresh = await pool(hb);
  const rank = { complete: 5, 'choice-required': 4, 'partial-structure': 3, 'manual-review': 2, 'metadata-only': 1 };
  for (const x of fresh) {
    const old = map.get(x.key);
    if (!old || (rank[x.coverage] || 0) >= (rank[old.coverage] || 0)) map.set(x.key, x);
  }
  const all = [...map.values()];
  const counts = all.reduce((a, x) => {
    a[x.coverage] = (a[x.coverage] || 0) + 1;
    return a;
  }, {});
  const retryable = all.filter(x => ['metadata-only', 'manual-review'].includes(x.coverage)).length;
  await fs.writeFile(path.join(ROOT, 'structures.json'), JSON.stringify(all, null, 2) + '\n');
  await fs.writeFile(path.join(ROOT, 'structure-meta.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    processed: all.length,
    remaining: Math.max(0, queue.length - all.length),
    retryable,
    counts,
  }, null, 2) + '\n');
  console.log({ hbProcessed: fresh.length, processed: all.length, counts });
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
