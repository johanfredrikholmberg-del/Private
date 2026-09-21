#!/usr/bin/env node

/**
 * Materialise Lund's verified programme structures into the canonical HT26
 * structure table.  The importer is deliberately conservative: a programme
 * is written only when an official Lund page exposes every expected term and
 * the parsed credits sum exactly to the catalogue total.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const DATA = path.join(process.cwd(), 'data', 'HT26');
const REPORT = path.join(process.cwd(), 'data', 'import-reviews', 'lund-program-structures-latest.json');
const LIMIT = Math.max(1, Number(process.env.LUND_STRUCTURE_LIMIT || 300));
const CONCURRENCY = Math.max(1, Math.min(8, Number(process.env.LUND_STRUCTURE_CONCURRENCY || 4)));
const REQUEST_TIMEOUT = Math.max(5000, Number(process.env.LUND_STRUCTURE_TIMEOUT || 20000));
const LU_BASE = 'https://www.lu.se/studera/';

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const norm = value => clean(value).toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const code = value => clean(value).toUpperCase();
const slug = value => norm(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const isLund = value => /lunds universitet|(^|\s)lund(\s|$)/.test(norm(value));
const identity = (university, programmeCode) => `${norm(university)}:${code(programmeCode)}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  await fs.rename(temporary, file);
}

async function getText(url) {
  let last;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'StudieLots-Lund-structure-import/1.0' },
        redirect: 'follow',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return { html: await response.text(), url: response.url || url };
    } catch (error) {
      last = error;
      if (attempt < 2 && (error?.status === 429 || Number(error?.status) >= 500 || !error?.status)) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      break;
    }
  }
  throw last;
}

function decodeHtml(value) {
  return String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&aring;/gi, 'å').replace(/&Aring;/g, 'Å')
    .replace(/&auml;/gi, 'ä').replace(/&Auml;/g, 'Ä')
    .replace(/&ouml;/gi, 'ö').replace(/&Ouml;/g, 'Ö')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function text(value) {
  return clean(decodeHtml(String(value ?? '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')));
}

const round1 = value => Math.round(Number(value || 0) * 10) / 10;

function hpFromPage(html) {
  const values = [...text(html).matchAll(/(\d+(?:[.,]\d+)?)\s*(?:högskolepoäng|hp)\b/gi)]
    .map(match => Number(match[1].replace(',', '.')))
    .filter(value => value >= 30 && value <= 360 && value % 30 === 0);
  return values[0] || 0;
}

function cellTexts(row) {
  return [...String(row || '').matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
    .map(match => text(match[1])).filter(Boolean);
}

function category(value) {
  const valueNorm = norm(value);
  if (/obligatorisk/.test(valueNorm) && !/alternativ|valbar|valfri/.test(valueNorm)) return 'mandatory';
  if (/valbar|valfri|alternativobligatorisk|alternativ obligatorisk/.test(valueNorm)) return 'elective';
  return 'unknown';
}

function dedupe(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = [row.term, norm(row.code || row.name), row.hp].join('|');
    const old = map.get(key);
    if (!old || (old.category === 'unknown' && row.category !== 'unknown') ||
        (old.sourceKind !== 'table' && row.sourceKind === 'table')) map.set(key, row);
  }
  return [...map.values()];
}

function parseTableRows(html) {
  const rows = [];
  for (const rawRow of String(html || '').match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || []) {
    const cells = cellTexts(rawRow);
    if (cells.length < 3) continue;
    let term = 0, credits = 0, type = '';
    for (const cell of cells) {
      const termMatch = cell.match(/^(?:Termin\s*)?(\d{1,2})$/i);
      if (termMatch && !term) term = Number(termMatch[1]);
      const hpMatch = cell.match(/^(\d+(?:[.,]\d+)?)\s*hp$/i);
      if (hpMatch && !credits) credits = Number(hpMatch[1].replace(',', '.'));
      if (/obligatorisk|valbar|valfri|alternativ/i.test(cell)) type = cell;
    }
    if (!(term >= 1 && term <= 20 && credits > 0 && credits <= 30)) continue;
    const name = cells.find(cell => cell !== type && !/^(?:Termin\s*)?\d{1,2}$/i.test(cell) &&
      !/^\d+(?:[.,]\d+)?\s*hp$/i.test(cell) && !/^(Namn|Typ|Termin|Poäng)$/i.test(cell));
    if (!name) continue;
    const codeMatch = name.match(/\(([A-ZÅÄÖ]{2,8}\d{1,4}[A-Z]?)\)\s*$/i);
    rows.push({
      name: clean(name.replace(/\s*\([A-ZÅÄÖ]{2,8}\d{1,4}[A-Z]?\)\s*$/i, '').replace(/\s*->\s*$/, '')),
      code: codeMatch ? code(codeMatch[1]) : '',
      hp: round1(credits), term, category: category(type), sourceKind: 'table',
    });
  }
  return dedupe(rows);
}

function termSegments(html) {
  const paragraph = text(html);
  const marks = [...paragraph.matchAll(/\bTermin\s+(\d{1,2})\b/gi)]
    .map(match => ({ term: Number(match[1]), index: match.index || 0, end: (match.index || 0) + match[0].length }));
  const out = [];
  for (let i = 0; i < marks.length; i += 1) {
    const mark = marks[i], next = marks[i + 1];
    if (mark.term >= 1 && mark.term <= 20) out.push({ term: mark.term, text: paragraph.slice(mark.end, next ? next.index : Math.min(paragraph.length, mark.end + 2500)) });
  }
  return out;
}

function parseTermStatements(html) {
  const rows = [];
  for (const part of termSegments(html)) {
    for (const match of part.text.matchAll(/([^.;:]{3,160}?)\s*\(?\s*(\d+(?:[.,]\d+)?)\s*hp\s*\)?/gi)) {
      const credits = Number(match[2].replace(',', '.'));
      if (!(credits > 0 && credits <= 30)) continue;
      let name = clean(match[1].replace(/^[-–:;,\s]+/, '').replace(/^(?:och|samt)\s+/i, ''));
      if (name.length > 140 || /programmet|terminen|sammanlagt|motsvarande/i.test(name)) continue;
      const codeMatch = name.match(/\(([A-ZÅÄÖ]{2,8}\d{1,4}[A-Z]?)\)\s*$/i);
      name = clean(name.replace(/\s*\([A-ZÅÄÖ]{2,8}\d{1,4}[A-Z]?\)\s*$/i, ''));
      const context = `${name} ${part.text.slice(Math.max(0, (match.index || 0) - 80), (match.index || 0) + match[0].length + 80)}`;
      rows.push({ name, code: codeMatch ? code(codeMatch[1]) : '', hp: round1(credits), term: part.term,
        category: /valbar|valfri|välj|utlandsstudier|praktik/i.test(context) ? 'elective' : 'unknown', sourceKind: 'term-text' });
    }
  }
  return dedupe(rows);
}

function parseChoiceTerms(html, occupied) {
  const paragraph = text(html), rows = [], seen = new Set();
  for (const match of paragraph.matchAll(/\bTermin\s+(\d{1,2})\b/gi)) {
    const term = Number(match[1]);
    if (!(term >= 1 && term <= 20) || occupied.has(term) || seen.has(term)) continue;
    const raw = paragraph.slice((match.index || 0) + match[0].length, (match.index || 0) + match[0].length + 1200);
    const after = norm(raw);
    const explicit = (/tematermin/.test(after) && /välj bland|valbar|valfri/.test(after)) ||
      /arbetslivspraktik|utlandsstudier|praktik eller valbara|valbara kurser/.test(after) ||
      /val av huvudomrade|valja huvudomrade|välja huvudområde/.test(after) || /examensarbete/.test(after);
    if (!explicit) continue;
    seen.add(term);
    if (term === 6 && /examensarbete/.test(after)) {
      rows.push({ name: 'Examensarbete inom huvudområdet', code: '', hp: 15, term, category: 'mandatory', sourceKind: 'thesis-explicit' });
      rows.push({ name: 'Fördjupning inom huvudområdet', code: '', hp: 15, term, category: 'elective', sourceKind: 'main-subject-specialisation' });
    } else {
      const mainSubject = /huvudomrade|huvudområde/.test(after);
      rows.push({ name: mainSubject ? 'Huvudområde enligt programplan' : 'Valbara studier enligt programplan', code: '', hp: 30,
        term, category: 'elective', sourceKind: mainSubject ? 'main-subject-choice' : 'choice-term' });
    }
  }
  return rows;
}

function mergeRows(table, termRows, choiceRows) {
  const tableTerms = new Set(table.map(row => row.term));
  const choiceTerms = new Set(choiceRows.map(row => row.term));
  const map = new Map();
  for (const row of [...termRows.filter(row => !tableTerms.has(row.term) && !choiceTerms.has(row.term)), ...choiceRows, ...table]) {
    const key = [row.term, norm(row.code || row.name)].join('|');
    const old = map.get(key);
    if (!old || (old.sourceKind !== 'table' && row.sourceKind === 'table')) map.set(key, row);
  }
  return [...map.values()];
}

function quality(rows, totalHp) {
  const expectedTerms = totalHp ? Math.round(totalHp / 30) : Math.max(0, ...rows.map(row => row.term));
  const completeTerms = [], termHp = {}, courses = [];
  for (let term = 1; term <= expectedTerms; term += 1) {
    const termRows = rows.filter(row => row.term === term);
    const mandatory = termRows.filter(row => row.category === 'mandatory');
    const elective = termRows.filter(row => row.category === 'elective');
    const unknown = termRows.filter(row => row.category === 'unknown');
    const mandatoryHp = round1(mandatory.reduce((sum, row) => sum + row.hp, 0));
    const electiveHp = round1(elective.reduce((sum, row) => sum + row.hp, 0));
    const unknownHp = round1(unknown.reduce((sum, row) => sum + row.hp, 0));
    let covered = false, gap = Math.max(0, round1(30 - mandatoryHp)), fixedUnknown = false;
    if (mandatoryHp >= 27 && mandatoryHp <= 33) { covered = true; gap = 0; }
    else if (mandatoryHp + unknownHp >= 27 && mandatoryHp + unknownHp <= 33 && electiveHp === 0) { covered = true; fixedUnknown = true; gap = 0; }
    else if (gap > 0 && electiveHp >= gap - 0.2) covered = true;
    else if (mandatoryHp === 0 && unknownHp === 0 && electiveHp >= 29.8) { covered = true; gap = 30; }
    termHp[term] = { mandatoryHp, electiveListedHp: electiveHp, unknownHp, covered };
    if (!covered) continue;
    completeTerms.push(term);
    courses.push(...mandatory);
    if (fixedUnknown) courses.push(...unknown.map(row => ({ ...row, category: 'mandatory-unlabelled' })));
    if (gap > 0) {
      const exactElective = elective.length === 1 && Math.abs(elective[0].hp - gap) < 0.2 ? elective[0] : null;
      courses.push(exactElective ? { ...exactElective, category: 'elective-slot' } : {
        name: 'Valbara studier enligt programplan', code: '', hp: round1(gap), term, category: 'elective-slot',
        options: elective.map(row => ({ name: row.name, code: row.code, hp: row.hp })),
      });
    }
  }
  return { complete: expectedTerms >= 2 && completeTerms.length === expectedTerms, expectedTerms, completeTerms, termHp, courses };
}

function title(html) {
  return text(String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
}

function candidateNames(program) {
  const original = clean(program.programName || program.name);
  const names = new Set([original]);
  const master = original.match(/^Masterprogram\s+i\s+(.+)$/i);
  const magister = original.match(/^Magisterprogram\s+i\s+(.+)$/i);
  if (master) {
    names.add(`${master[1]} Masterprogram`);
    names.add(`${master[1]} - Masterprogram`);
    names.add(`${master[1]} Masters Programme`);
  }
  if (magister) {
    names.add(`${magister[1]} Magisterprogram`);
    names.add(`${magister[1]} - Magisterprogram`);
    names.add(`${magister[1]} Masters Programme One Year`);
  }
  names.add(original.replace(/\s*[-–]\s*(Kandidatprogram|Masterprogram|Magisterprogram)\s*$/i, ' $1'));
  return [...names].filter(Boolean);
}

function candidateUrls(program) {
  const urls = [];
  for (const name of candidateNames(program)) urls.push(`${LU_BASE}${slug(name)}-${code(program.programCode)}`);
  return [...new Set(urls)];
}

async function discover(program) {
  let best = null;
  const attemptedUrls = candidateUrls(program);
  for (const url of attemptedUrls) {
    try {
      const main = await getText(url);
      const contentUrl = `${main.url.replace(/\/$/, '')}/programmets-innehall`;
      let content = main;
      try { content = await getText(contentUrl); } catch { /* the main page may contain the plan */ }
      const table = parseTableRows(content.html);
      const termRows = parseTermStatements(content.html);
      const choiceRows = parseChoiceTerms(content.html, new Set(table.map(row => row.term)));
      const rows = mergeRows(table, termRows, choiceRows);
      const totalHp = hpFromPage(main.html) || hpFromPage(content.html);
      const parsed = quality(rows, totalHp);
      const result = { found: true, structureAvailable: parsed.complete, courses: parsed.courses,
        program: { name: title(main.html) || program.programName, code: code(program.programCode), university: 'Lunds universitet' },
        sourceUrls: [main.url, ...(content.url !== main.url ? [content.url] : [])], source: 'lund-official-programplan',
        quality: { ...parsed, totalHp, tableRows: table.length, textRows: termRows.length, choiceTerms: choiceRows.map(row => row.term) } };
      if (parsed.complete) return { ...result, attemptedUrls };
      if (!best || (parsed.completeTerms?.length || 0) > (best.quality.completeTerms?.length || 0)) best = result;
    } catch { /* try the next official slug */ }
  }
  return best ? { ...best, attemptedUrls } : { found: false, structureAvailable: false, courses: [], source: 'lund-official-programplan', attemptedUrls };
}

function normaliseRows(rows) {
  return (Array.isArray(rows) ? rows : []).map(row => {
    const rawCategory = clean(row.category);
    const elective = /elective|valbar|valfri|choice|slot/i.test(rawCategory) || /valbar|valfri|utlandsstudier|praktik|fördjupning inom huvudområdet|huvudområde enligt/i.test(clean(row.name));
    const name = clean(row.name || row.code);
    const output = { term: Number(row.term), code: code(row.code), name, hp: Number(row.hp), category: elective ? 'elective' : 'mandatory' };
    const thesis = Boolean(row.isThesis) || /examensarbete|uppsats|thesis|degree project/i.test(name);
    const slot = Boolean(row.isSlot) || (elective && !output.code);
    if (slot) { output.isSlot = true; output.slotType = row.slotType || (/huvudområde|specialisering|fördjupning/i.test(name) ? 'main-field-slot' : 'elective-slot'); }
    if (thesis) output.isThesis = true;
    if (Array.isArray(row.options) && row.options.length) output.options = row.options;
    return output;
  }).filter(row => Number.isInteger(row.term) && row.term > 0 && Number.isFinite(row.hp) && row.hp > 0 && row.name);
}

function structureIsComplete(structure, program) {
  if (!structure || String(structure.coverage || '').toLowerCase() !== 'complete') return false;
  if (!/^https:\/\//i.test(String(structure.sourceEvidenceUrl || structure.sourceUrl || structure.sourceUrls?.[0] || ''))) return false;
  const expected = Math.round(Number(program.programHp));
  const rows = normaliseRows(structure.rows);
  if (!(expected > 0) || !rows.length) return false;
  const total = rows.reduce((sum, row) => sum + row.hp, 0);
  if (Math.abs(total - expected) > 0.01) return false;
  const terms = new Map();
  for (const row of rows) terms.set(row.term, (terms.get(row.term) || 0) + row.hp);
  const termCount = Math.round(expected / 30);
  return [...Array(termCount)].every((_, index) => Math.abs((terms.get(index + 1) || 0) - 30) <= 0.01);
}

function makeCanonical(program, rows, sourceUrls, extra = {}) {
  return {
    key: program.key,
    susaId: program.susaId,
    university: 'Lunds universitet',
    programCode: code(program.programCode),
    programName: program.programName || program.name,
    subject: program.subject || '',
    hp: Number(program.programHp),
    officialHp: Number(program.programHp),
    term: program.term || 'HT26',
    coverage: 'complete',
    status: 'processed',
    source: 'lund-official-programplan',
    sourceUrl: sourceUrls?.[0] || '',
    sourceUrls: [...new Set((sourceUrls || []).filter(Boolean))],
    sourceEvidenceUrl: sourceUrls?.[1] || sourceUrls?.[0] || '',
    studyStructureGranularity: 'term',
    termPlacementVerified: true,
    verifiedProgrammeOverride: false,
    rows: normaliseRows(rows),
    checkedAt: new Date().toISOString(),
    ...extra,
  };
}

function sameSignature(a, b) {
  const sig = value => JSON.stringify(normaliseRows(value?.rows).map(row => [row.term, row.code, norm(row.name), row.hp, row.category]).sort());
  return sig(a) === sig(b);
}

function upsert(structures, record, program) {
  let index = structures.findIndex(item => item.key && item.key === record.key);
  if (index < 0) index = structures.findIndex(item => identity(item.university, item.programCode) === identity(program.university, program.programCode));
  if (index < 0) { structures.push(record); return { action: 'added', index: structures.length - 1 }; }
  if (structureIsComplete(structures[index], program)) return { action: 'existing', index };
  structures[index] = record;
  return { action: 'replaced', index };
}

function legacyRows(rows) {
  return normaliseRows(rows).map(row => ({ ...row, isSlot: Boolean(row.isSlot), ...(row.slotType ? { slotType: row.slotType } : {}) }));
}

async function mapPool(items, worker, limit) {
  const output = new Array(items.length);
  let next = 0;
  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      output[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return output;
}

async function main() {
  const [programs, initialStructures, lundDb, lundBatch, variantsDb] = await Promise.all([
    readJson(path.join(DATA, 'programs.json')),
    readJson(path.join(DATA, 'program-structures.json')),
    readJson(path.join(process.cwd(), 'data', 'program-db-lund.json')),
    readJson(path.join(process.cwd(), 'data', 'program-db-lund-batch.json')),
    readJson(path.join(process.cwd(), 'data', 'program-db-variants.json')),
  ]);
  const structures = Array.isArray(initialStructures) ? [...initialStructures] : [];
  const lundPrograms = programs.filter(program => isLund(program.university));
  const byCode = new Map(lundPrograms.map(program => [code(program.programCode), program]));
  const legacyRecords = [
    ...(Array.isArray(lundDb) ? lundDb : lundDb.programs || []),
    ...(Array.isArray(lundBatch) ? lundBatch : lundBatch.programs || []),
    ...(Array.isArray(variantsDb) ? variantsDb : variantsDb.programs || []),
  ].filter(record => isLund(record.university) && byCode.has(code(record.programCode)));
  const legacyGroups = new Map();
  for (const record of legacyRecords) {
    const key = code(record.programCode);
    if (!legacyGroups.has(key)) legacyGroups.set(key, []);
    legacyGroups.get(key).push(record);
  }

  let legacyImported = 0;
  for (const [programmeCode, records] of legacyGroups) {
    const program = byCode.get(programmeCode);
    if (!program) continue;
    const primary = records[0];
    const variants = records.length > 1 ? records.map(record => ({
      id: record.id, subject: record.subject || '', programName: record.programName,
      sourceUrls: record.sourceUrls || [], rows: legacyRows(record.rows),
    })) : undefined;
    const sourceUrls = records.flatMap(record => record.sourceUrls || []).filter(Boolean);
    const record = makeCanonical(program, legacyRows(primary.rows), sourceUrls, variants ? { variants } : {});
    if (!structureIsComplete(record, program)) continue;
    const result = upsert(structures, record, program);
    if (result.action !== 'existing') legacyImported += 1;
  }

  const targets = lundPrograms.filter(program => {
    const current = structures.find(item => item.key === program.key || identity(item.university, item.programCode) === identity(program.university, program.programCode));
    return !structureIsComplete(current, program);
  }).slice(0, LIMIT);
  const attempted = targets.length;
  const errors = [];
  let imported = 0;
  const results = await mapPool(targets, async program => {
    const result = await discover(program);
    const rows = normaliseRows(result.courses);
    const candidate = makeCanonical(program, rows, result.sourceUrls || []);
    if (result.found && result.structureAvailable && structureIsComplete(candidate, program)) {
      const action = upsert(structures, candidate, program);
      if (action.action !== 'existing') imported += 1;
      console.log(`${action.action.toUpperCase()} ${program.programCode} ${program.programName}`);
      return { program, ok: true, action: action.action, sourceUrls: result.sourceUrls || [] };
    }
    const qualityInfo = result.quality || {};
    const reason = result.found ? `partial:${(qualityInfo.completeTerms || []).join(',') || 'none'}` : 'official-page-not-found';
    errors.push({ code: code(program.programCode), name: program.programName, reason, attemptedUrls: result.attemptedUrls || [] });
    console.log(`REVIEW ${program.programCode} ${reason}`);
    return { program, ok: false, reason };
  }, CONCURRENCY);

  const lundStructures = structures.filter(item => isLund(item.university));
  const verifiedCodes = [...new Set(lundStructures.filter((item, index) => structureIsComplete(item, byCode.get(code(item.programCode)) || {}) && byCode.has(code(item.programCode))).map(item => code(item.programCode)))].sort();
  const remaining = lundPrograms.filter(program => !structureIsComplete(structures.find(item => item.key === program.key || identity(item.university, item.programCode) === identity(program.university, program.programCode)), program));
  const report = {
    generatedAt: new Date().toISOString(), scope: 'Lunds universitet', catalogueProgrammes: lundPrograms.length,
    existingCanonicalStructuresBefore: initialStructures.filter(item => isLund(item.university)).length,
    legacyImported, attempted, imported, verifiedProgrammeCodes: verifiedCodes.length,
    verifiedProgrammeCodeList: verifiedCodes,
    remainingProgrammeCodes: remaining.map(program => ({ code: code(program.programCode), name: program.programName, hp: program.programHp })),
    errors, notes: ['Only official Lund pages and previously verified official Lund programme-plan records are used.', 'A structure is published only when all expected terms and total credits validate exactly.', 'EAGAF track variants are retained under the variants field of the canonical programme record.'],
  };
  await writeJson(REPORT, report);
  await writeJson(path.join(DATA, 'program-structures.json'), structures);
  console.log(JSON.stringify({ catalogueProgrammes: lundPrograms.length, legacyImported, attempted, imported, verifiedProgrammeCodes: verifiedCodes.length, remaining: remaining.length }, null, 2));
  void results;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
