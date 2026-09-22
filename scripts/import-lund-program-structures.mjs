#!/usr/bin/env node

/**
 * Materialise Lund's verified programme structures into the canonical HT26
 * structure table.  The importer is deliberately conservative: a programme
 * is written only when an official Lund page exposes every expected term and
 * the parsed credits sum exactly to the catalogue total.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const DATA = path.join(process.cwd(), 'data', 'HT26');
const REPORT = path.join(process.cwd(), 'data', 'import-reviews', 'lund-program-structures-latest.json');
const LIMIT = Math.max(1, Number(process.env.LUND_STRUCTURE_LIMIT || 300));
const CONCURRENCY = Math.max(1, Math.min(8, Number(process.env.LUND_STRUCTURE_CONCURRENCY || 4)));
const REQUEST_TIMEOUT = Math.max(5000, Number(process.env.LUND_STRUCTURE_TIMEOUT || 20000));
const LU_BASE = 'https://www.lu.se/studera/';
const LU_EN_BASE = 'https://www.lunduniversity.lu.se/study/';
const execFileAsync = promisify(execFile);

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

async function getJson(url) {
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'StudieLots-Lund-structure-import/1.0' },
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  const body = await response.text();
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}: ${body.slice(0, 500)}`);
    error.status = response.status;
    throw error;
  }
  return { data: JSON.parse(body), url: response.url || url };
}

async function getPdfText(url) {
  const response = await fetch(url, {
    headers: { accept: 'application/pdf', 'user-agent': 'StudieLots-Lund-structure-import/1.0' },
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const file = path.join(os.tmpdir(), `studielots-lund-${process.pid}-${Date.now()}.pdf`);
  try {
    await fs.writeFile(file, Buffer.from(await response.arrayBuffer()));
    const [raw, layout] = await Promise.all([
      execFileAsync('pdftotext', ['-raw', file, '-'], { maxBuffer: 8 * 1024 * 1024 }),
      execFileAsync('pdftotext', ['-layout', file, '-'], { maxBuffer: 8 * 1024 * 1024 }),
    ]);
    return { text: raw.stdout || layout.stdout || '', layoutText: layout.stdout || '', url: response.url || url };
  } finally {
    await fs.rm(file, { force: true });
  }
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
  const values = [...text(html).matchAll(/(\d+(?:[.,]\d+)?)\s*(?:högskolepoäng|hp|credits)\b/gi)]
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
  if (/(obligatorisk|mandatory|required|obligatory)/.test(valueNorm) && !/alternativ|valbar|valfri|optional|elective/.test(valueNorm)) return 'mandatory';
  if (/valbar|valfri|alternativobligatorisk|alternativ obligatorisk|optional|elective/.test(valueNorm)) return 'elective';
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
      if (/obligatorisk|valbar|valfri|alternativ|mandatory|required|optional|elective/i.test(cell)) type = cell;
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
  const marks = [...paragraph.matchAll(/\b(?:Termin|Term)\s+(\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?\b/gi)]
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
    for (const match of part.text.matchAll(/([^.;:]{3,160}?)\s*\(?\s*(\d+(?:[.,]\d+)?)\s*(?:hp|credits)\s*\)?/gi)) {
      const credits = Number(match[2].replace(',', '.'));
      if (!(credits > 0 && credits <= 30)) continue;
      let name = clean(match[1].replace(/^[-–:;,\s]+/, '').replace(/^(?:och|samt)\s+/i, ''));
      if (name.length > 140 || /programmet|terminen|sammanlagt|motsvarande/i.test(name)) continue;
      const codeMatch = name.match(/\(([A-ZÅÄÖ]{2,8}\d{1,4}[A-Z]?)\)\s*$/i);
      name = clean(name.replace(/\s*\([A-ZÅÄÖ]{2,8}\d{1,4}[A-Z]?\)\s*$/i, ''));
      const context = `${name} ${part.text.slice(Math.max(0, (match.index || 0) - 80), (match.index || 0) + match[0].length + 80)}`;
      rows.push({ name, code: codeMatch ? code(codeMatch[1]) : '', hp: round1(credits), term: part.term,
        category: /valbar|valfri|välj|utlandsstudier|praktik|elective|optional|exchange|internship/i.test(context) ? 'elective' : 'unknown', sourceKind: 'term-text' });
    }
  }
  return dedupe(rows);
}

function parseChoiceTerms(html, occupied) {
  const paragraph = text(html), rows = [], seen = new Set();
  for (const match of paragraph.matchAll(/\b(?:Termin|Term)\s+(\d{1,2})\b/gi)) {
    const term = Number(match[1]);
    if (!(term >= 1 && term <= 20) || occupied.has(term) || seen.has(term)) continue;
    const raw = paragraph.slice((match.index || 0) + match[0].length, (match.index || 0) + match[0].length + 1200);
    const after = norm(raw);
    const explicit = (/tematermin/.test(after) && /välj bland|valbar|valfri|elective|optional/.test(after)) ||
      /arbetslivspraktik|utlandsstudier|praktik eller valbara|valbara kurser|exchange|internship|elective courses|optional courses/.test(after) ||
      /val av huvudomrade|valja huvudomrade|välja huvudområde|main field|specialisation|specialization/.test(after) || /examensarbete|thesis|degree project/.test(after);
    if (!explicit) continue;
    seen.add(term);
    if (term === 6 && /examensarbete|thesis|degree project/.test(after)) {
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

// `quality()` deliberately tolerates small gaps while deciding which pages are
// worth reviewing.  Publishing is stricter: every term and the programme
// total must reconcile exactly, otherwise a PDF or another official source
// still needs to be tried.
function exactQuality(parsed, totalHp) {
  if (!parsed?.complete || !(Number(totalHp) > 0)) return false;
  const expected = round1(Number(totalHp));
  const rows = Array.isArray(parsed.courses) ? parsed.courses : [];
  const total = round1(rows.reduce((sum, row) => sum + Number(row.hp || 0), 0));
  if (Math.abs(total - expected) > 0.01) return false;
  return [...Array(parsed.expectedTerms).keys()].every(index => {
    const term = index + 1;
    const termTotal = round1(rows.filter(row => Number(row.term) === term)
      .reduce((sum, row) => sum + Number(row.hp || 0), 0));
    return Math.abs(termTotal - 30) <= 0.01;
  });
}

function title(html) {
  return text(String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
}

function candidateNames(program) {
  const original = clean(program.programName || program.name);
  const names = new Set([original]);
  const master = original.match(/^Masterprogram\s+i\s+(.+)$/i);
  const magister = original.match(/^Magisterprogram\s+i\s+(.+)$/i);
  const candidate = original.match(/^Kandidatprogram(?:met)?\s+i\s+(.+)$/i);
  const candidateNoI = original.match(/^Kandidatprogram(?:met)?\s+(.+)$/i);
  const civil = original.match(/^Civilingenjörsutbildning\s+i\s+(.+)$/i);
  const masterEdu = original.match(/^Masterutbildning\s+i\s+(.+)$/i);
  const högskole = original.match(/^Högskoleingenjörsutbildning\s+i\s+(.+)$/i);
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
  if (candidate) {
    names.add(`${candidate[1]} Kandidatprogram`);
    names.add(`${candidate[1]} - Kandidatprogram`);
    names.add(`${candidate[1]} Bachelors Programme`);
  }
  if (candidateNoI) {
    names.add(`${candidateNoI[1]} Kandidatprogram`);
    names.add(`${candidateNoI[1]} - Kandidatprogram`);
  }
  if (civil) {
    names.add(`${civil[1]} Civilingenjörsutbildning`);
    names.add(`${civil[1]} - Civilingenjörsutbildning`);
  }
  if (masterEdu) {
    names.add(`${masterEdu[1]} Masterutbildning`);
    names.add(`${masterEdu[1]} - Masterutbildning`);
    names.add(`${masterEdu[1]} Masters Programme`);
  }
  if (högskole) {
    names.add(`${högskole[1]} Högskoleingenjörsutbildning`);
    names.add(`${högskole[1]} - Högskoleingenjörsutbildning`);
  }
  names.add(original.replace(/\s*[-–]\s*(Kandidatprogram|Masterprogram|Magisterprogram)\s*$/i, ' $1'));
  return [...names].filter(Boolean);
}

function candidateUrls(program) {
  const urls = [];
  for (const name of candidateNames(program)) urls.push(`${LU_BASE}${slug(name)}-${code(program.programCode)}`);
  const original = clean(program.programName || program.name);
  const master = original.match(/^(?:Masterprogram|Masterutbildning)\s+i\s+(.+)$/i);
  const magister = original.match(/^Magisterprogram\s+i\s+(.+)$/i);
  const candidate = original.match(/^Kandidatprogram(?:met)?\s+i\s+(.+)$/i);
  if (master) urls.push(`${LU_EN_BASE}${slug(master[1])}-masters-programme-${code(program.programCode)}`);
  if (magister) urls.push(`${LU_EN_BASE}${slug(magister[1])}-masters-programme-one-year-${code(program.programCode)}`);
  if (candidate) urls.push(`${LU_EN_BASE}${slug(candidate[1])}-bachelors-programme-${code(program.programCode)}`);
  return [...new Set(urls)];
}

function extractLinks(html, baseUrl) {
  const links = [];
  for (const match of String(html || '').matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)) {
    const href = decodeHtml(match[1]);
    try { links.push(new URL(href, baseUrl).href); } catch { /* ignore malformed links */ }
  }
  return [...new Set(links)];
}

function programmeStructureSection(value) {
  const source = String(value || '');
  const headings = [...source.matchAll(/(?:Programstruktur(?:\s+för)?|Program structure(?:\s+for)?|Programme structure(?:\s+for)?)/gi)];
  const section = headings.length ? source.slice(headings.at(-1).index || 0) : source;
  const end = section.search(/\n\s*(?:Examen|Examensbenämningar|Förkunskapskrav(?:\s+och\s+urvalsmetod)?|Entry requirements|Other information|Övrigt)\s*\n/i);
  return end > 0 ? section.slice(0, end) : section;
}

function isProgrammePdfHeader(name, credits) {
  if (!(Number(credits) >= 60)) return false;
  return /\([A-ZÅÄÖ]{2,8}\)\s*(?:Kandidat|Master|Magister|Bachelor|Programme|Program)|(?:Kandidat|Master|Magister|Bachelor|Programme|Program)[^,]{0,140},?\s*\d+(?:[.,]\d+)?\s*(?:högskolepoäng|credits)|Examensbenämningar|Filosofie\s+(?:master|kandidat|magister)examen|Degree\s+of\s+(?:Master|Bachelor)/i.test(name);
}

function pdfRows(pdfText) {
  const lines = programmeStructureSection(pdfText).split(/\r?\n/).map(clean).filter(Boolean);
  const rows = [];
  let currentTerm = 0;
  let buffer = [];
  const flush = (credits, categoryHint = '') => {
    const filtered = buffer.filter(line => !/^(?:år|year|period|termin|term|programstruktur|program structure|kursuppgifter|course information|höst|vår|autumn|spring)/i.test(line));
    if (currentTerm > 0 && !(credits > 0)) {
      const choiceText = clean(filtered.join(' '));
      if (/valfri|valbar|utbytesstudier|praktik|exchange|internship|elective|optional/i.test(choiceText)) {
        rows.push({ name: 'Valbara studier enligt programplan', code: '', hp: 30, term: currentTerm, category: 'elective', sourceKind: 'programme-pdf-choice' });
      }
      buffer = [];
      return;
    }
    if (!(currentTerm > 0 && credits > 0)) { buffer = []; return; }
    const name = clean(filtered.join(' ').replace(/\s*[-–:]\s*$/, ''));
    buffer = [];
    if (name.length < 3 || name.length > 220 || /^(?:hp|credits|ects)$/i.test(name)) return;
    if (isProgrammePdfHeader(name, credits)) return;
    const codeMatch = name.match(/\b([A-ZÅÄÖ]{2,8}\d{1,4}[A-Z]?)\b/);
    rows.push({ name, code: codeMatch ? code(codeMatch[1]) : '', hp: round1(credits), term: currentTerm,
      category: category(categoryHint || name), sourceKind: 'programme-pdf' });
  };
  for (const line of lines) {
    const termMatch = line.match(/^(?:Termin|Term)\s+(\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?/i);
    if (termMatch) { flush(0); currentTerm = Number(termMatch[1]); buffer = []; continue; }
    if (/^(?:År|Year)\s+\d+/i.test(line) || /^(?:Period|Termin|Term)\b/i.test(line)) { buffer = []; continue; }
    const creditMatches = [...line.matchAll(/(?:\(|\s)(\d+(?:[.,]\d+)?)\s*(?:hp|credits|ECTS)\s*\)?/gi)];
    if (creditMatches.length) {
      let cursor = 0;
      for (const match of creditMatches) {
        const before = clean(line.slice(cursor, match.index));
        if (before) buffer.push(before);
        flush(Number(match[1].replace(',', '.')));
        cursor = (match.index || 0) + match[0].length;
      }
      const after = clean(line.slice(cursor));
      if (after && !/^(?:hp|credits|ECTS)$/i.test(after)) buffer.push(after);
      continue;
    }
    if (currentTerm && !/^(?:Programmet|The programme|Skolan|Lunds universitet|Lund University|\d+\/\d+)/i.test(line)) buffer.push(line);
  }
  flush(0);
  return dedupe(rows);
}

function pdfColumnRows(lines, term) {
  const rows = [];
  let buffer = [];
  const flush = (credits, hint = '') => {
    if (!(credits > 0)) { buffer = []; return; }
    const name = clean(buffer.filter(line => !/^(?:år|year|period|termin|term|höst|vår|autumn|spring)\b/i.test(line)).join(' ')
      .replace(/\s*[-–:]\s*$/, ''));
    buffer = [];
    if (name.length < 3 || name.length > 220 || /^(?:hp|credits|ects)$/i.test(name)) return;
    if (isProgrammePdfHeader(name, credits)) return;
    if (credits < 2 && /programportfölj|programme portfolio|högskolepoäng|credit|ects|\(hp\)/i.test(name)) return;
    const codeMatch = name.match(/\b([A-ZÅÄÖ]{2,8}\d{1,4}[A-Z]?)\b/);
    rows.push({ name, code: codeMatch ? code(codeMatch[1]) : '', hp: round1(credits), term,
      category: category(`${name} ${hint}`), sourceKind: 'programme-pdf-layout' });
  };
  for (const rawLine of lines) {
    const line = clean(rawLine);
    if (!line || /^(?:år|year|period|termin|term|höst|vår|autumn|spring)\b/i.test(line)) continue;
    const creditMatches = [...line.matchAll(/(?:\(|^|\s)(\d+(?:[.,]\d+)?)\s*(?:hp|credits|ECTS)\s*\)?/gi)];
    if (!creditMatches.length) { buffer.push(line); continue; }
    let cursor = 0;
    for (const match of creditMatches) {
      const before = clean(line.slice(cursor, match.index));
      if (before) buffer.push(before);
      flush(Number(match[1].replace(',', '.')), line);
      cursor = (match.index || 0) + match[0].length;
    }
    const after = clean(line.slice(cursor));
    if (after) buffer.push(after);
  }
  return rows;
}

function pdfLayoutRows(pdfText) {
  const source = programmeStructureSection(pdfText);
  const lines = source.split(/\r?\n/);
  const headingRows = [];
  for (let index = 0; index < lines.length; index += 1) {
    const matches = [...lines[index].matchAll(/(?:Termin|Term)\s+(\d{1,2})\b/gi)]
      .map(match => ({ term: Number(match[1]), start: match.index || 0 }));
    if (matches.length) headingRows.push({ index, matches });
  }
  const rows = [];
  for (let headingIndex = 0; headingIndex < headingRows.length; headingIndex += 1) {
    const heading = headingRows[headingIndex];
    const next = headingRows[headingIndex + 1];
    const block = lines.slice(heading.index + 1, next ? next.index : lines.length);
    const width = Math.max(lines[heading.index].length, ...block.map(line => line.length), 1);
    const termStarts = heading.matches.map(match => match.start);
    for (let termIndex = 0; termIndex < heading.matches.length; termIndex += 1) {
      const term = heading.matches[termIndex].term;
      if (!(term >= 1 && term <= 20)) continue;
      const start = termStarts[termIndex];
      const end = termStarts[termIndex + 1] ?? width;
      const region = block.map(line => line.padEnd(width).slice(start, end));
      let periodStarts = [];
      for (const line of region) {
        const starts = [...line.matchAll(/\bPeriod\s+\d+/gi)].map(match => match.index || 0);
        if (starts.length > periodStarts.length) periodStarts = starts;
      }
      if (!periodStarts.length) periodStarts = [0];
      const termRows = [];
      for (let periodIndex = 0; periodIndex < periodStarts.length; periodIndex += 1) {
        const periodStart = periodStarts[periodIndex];
        const periodEnd = periodStarts[periodIndex + 1] ?? Math.max(1, end - start);
        termRows.push(...pdfColumnRows(region.map(line => line.slice(periodStart, periodEnd)), term));
      }
      if (termRows.length) rows.push(...termRows);
      else {
        const choiceText = clean(region.join(' '));
        if (/valfri|valbar|utbytesstudier|praktik|exchange|internship|elective|optional/i.test(choiceText)) {
          rows.push({ name: 'Valbara studier enligt programplan', code: '', hp: 30, term,
            category: 'elective', sourceKind: 'programme-pdf-layout-choice' });
        }
      }
    }
  }
  return dedupe(rows);
}

function parseOfficialPdf(pdf, totalHp) {
  const variants = [
    { mode: 'raw', text: pdf.text },
    { mode: 'layout', text: pdf.layoutText },
  ].filter((variant, index, all) => variant.text && all.findIndex(other => other.text === variant.text) === index)
    .map(variant => ({ ...variant, rows: pdfRows(variant.text) }));
  if (pdf.layoutText) variants.push({ mode: 'layout-grid', text: pdf.layoutText, rows: pdfLayoutRows(pdf.layoutText) });
  let best = { mode: 'none', rows: [], parsed: quality([], totalHp), score: -Infinity };
  for (const variant of variants) {
    const rows = variant.rows;
    const parsed = quality(rows, totalHp);
    const exact = exactQuality(parsed, totalHp);
    const courseTotal = round1(parsed.courses.reduce((sum, row) => sum + Number(row.hp || 0), 0));
    const distance = Math.abs(Number(totalHp || 0) - courseTotal);
    const score = (exact ? 1_000_000 : 0) + parsed.completeTerms.length * 10_000 - distance * 10 + rows.length;
    if (score > best.score) best = { mode: variant.mode, rows, parsed, score };
  }
  return best;
}

async function discover(program) {
  let best = null;
  const attemptedUrls = candidateUrls(program);
  const pdfDiagnostics = [];

  // Lund's official programme-plan PDF endpoint is stable by programme code
  // even when a programme page has moved or its HTML plan is incomplete.
  const directPdfUrls = [
    `https://kursplaner.lu.se/pdf/program/sv/${code(program.programCode)}`,
    `https://kursplaner.lu.se/pdf/program/en/${code(program.programCode)}`,
  ];
  for (const pdfUrl of directPdfUrls) {
    try {
      const pdf = await getPdfText(pdfUrl);
      const pdfTotalHp = hpFromPage(pdf.text) || Number(program.programHp);
      const pdfParse = parseOfficialPdf(pdf, pdfTotalHp);
      const parsedRows = pdfParse.rows;
      const parsed = pdfParse.parsed;
      const result = { found: true, structureAvailable: parsed.complete, courses: parsed.courses,
        program: { name: program.programName, code: code(program.programCode), university: 'Lunds universitet' },
        sourceUrls: [pdf.url], source: 'lund-official-programme-plan-pdf',
        quality: { ...parsed, totalHp: pdfTotalHp, pdfRows: parsedRows.length, pdfMode: pdfParse.mode } };
      pdfDiagnostics.push({ url: pdf.url, mode: pdfParse.mode, rows: parsedRows.length, complete: parsed.complete, exact: exactQuality(parsed, pdfTotalHp), completeTerms: parsed.completeTerms, totalHp: pdfTotalHp, termHp: parsed.termHp,
        sampleRows: parsedRows.slice(0, 30).map(row => ({ term: row.term, name: row.name, hp: row.hp, category: row.category })) });
      if (exactQuality(parsed, pdfTotalHp)) return { ...result, attemptedUrls: [...attemptedUrls, ...directPdfUrls], pdfDiagnostics };
      if (!best || (parsed.completeTerms?.length || 0) > (best.quality.completeTerms?.length || 0)) best = result;
    } catch (error) { pdfDiagnostics.push({ url: pdfUrl, error: String(error?.message || error) }); }
  }

  for (const url of attemptedUrls) {
    try {
      const main = await getText(url);
      let content = main;
      const contentCandidates = main.url.includes('lunduniversity.lu.se')
        ? [`${main.url.replace(/\/$/, '')}/programme-structure`, `${main.url.replace(/\/$/, '')}/programmets-innehall`]
        : [`${main.url.replace(/\/$/, '')}/programmets-innehall`, `${main.url.replace(/\/$/, '')}/programme-structure`];
      for (const contentUrl of contentCandidates) {
        try { content = await getText(contentUrl); break; } catch { /* try the next official content page */ }
      }
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
      if (exactQuality(parsed, totalHp)) return { ...result, attemptedUrls, pdfDiagnostics };
      if (!best || (parsed.completeTerms?.length || 0) > (best.quality.completeTerms?.length || 0)) best = result;

      const pdfLinks = [...extractLinks(main.html, main.url), ...extractLinks(content.html, content.url)]
        .filter(link => /kursplaner\.lu\.se\/pdf\/program\//i.test(link) || /(?:utbildningsplan|programstruktur|programme-structure).*\.pdf/i.test(link));
      for (const pdfUrl of [...new Set(pdfLinks)]) {
        try {
          const pdf = await getPdfText(pdfUrl);
          const pdfTotalHp = hpFromPage(pdf.text) || Number(program.programHp);
          const pdfParse = parseOfficialPdf(pdf, pdfTotalHp);
          const pdfParsedRows = pdfParse.rows;
          const pdfParsed = pdfParse.parsed;
          const pdfResult = { found: true, structureAvailable: pdfParsed.complete, courses: pdfParsed.courses,
            program: { name: program.programName, code: code(program.programCode), university: 'Lunds universitet' },
            sourceUrls: [pdf.url, main.url, ...(content.url !== main.url ? [content.url] : [])], source: 'lund-official-programme-plan-pdf',
            quality: { ...pdfParsed, totalHp: pdfTotalHp, pdfRows: pdfParsedRows.length, pdfMode: pdfParse.mode } };
          pdfDiagnostics.push({ url: pdf.url, mode: pdfParse.mode, rows: pdfParsedRows.length, complete: pdfParsed.complete, exact: exactQuality(pdfParsed, pdfTotalHp), completeTerms: pdfParsed.completeTerms, totalHp: pdfTotalHp, termHp: pdfParsed.termHp,
            sampleRows: pdfParsedRows.slice(0, 30).map(row => ({ term: row.term, name: row.name, hp: row.hp, category: row.category })) });
          if (exactQuality(pdfParsed, pdfTotalHp)) return { ...pdfResult, attemptedUrls, pdfDiagnostics };
          if (!best || (pdfParsed.completeTerms?.length || 0) > (best.quality.completeTerms?.length || 0)) best = pdfResult;
        } catch (error) { pdfDiagnostics.push({ url: pdfUrl, error: String(error?.message || error) }); }
      }
    } catch { /* try the next official slug */ }
  }
  const allAttemptedUrls = [...attemptedUrls, ...directPdfUrls];
  return best ? { ...best, attemptedUrls: allAttemptedUrls, pdfDiagnostics } : { found: false, structureAvailable: false, courses: [], source: 'lund-official-programplan', attemptedUrls: allAttemptedUrls, pdfDiagnostics };
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

const LTH_PROGRAMME_CODES = {
  TAAEF: 'MAEF', TAARK: 'A', TABIT: 'MBIO', TABRA: 'BR', TABTE: 'B', TADAT: 'D', TADIC: 'C',
  TAEEE: 'MSOC', TAEKO: 'W', TAELT: 'E', TAEMB: 'MEMB', TAFOT: 'MFOT', TAHET: 'MHET', TAIDE: 'MID',
  TAINE: 'I', TAKAK: 'MKAT', TAKEM: 'K', TALAK: 'MLAK', TALAN: 'L', TALIV: 'MLIV', TALSF: 'MLOG',
  TAMAD: 'MD', TAMAR: 'MARK', TAMAS: 'M', TAMSR: 'MMSR', TAMTE: 'BME', TANAV: 'MNAV', TAPRR: 'MPRR',
  TARSK: 'R', TASUD: 'MSUD', TATFY: 'F', TATNA: 'N', TATPI: 'Pi', TAVAR: 'MVAR', TAVOV: 'V',
  TAWIR: 'MWIR', TAWRE: 'MWLU', TGBYA: 'IBYA', TGBYT: 'IBYT', TGDAT: 'IDA', TGELT: 'IEA',
  TGIND: 'KID', TZTNB: 'TNB',
};

function lthTermCandidates(row, yearCount) {
  const year = Number(row.year);
  if (!Number.isInteger(year) || year < 1 || year > yearCount) return [];
  const periods = (row.timePlans || []).flatMap(plan => {
    const start = Number(plan.startSpNr);
    const end = Number(plan.endSpNr);
    return Number.isFinite(start) && Number.isFinite(end) ? [[start, end]] : [];
  });
  const terms = new Set();
  for (const [start, end] of periods) {
    if (start <= 2 && end <= 2) terms.add((year - 1) * 2 + 1);
    else if (start >= 3 && end >= 3) terms.add((year - 1) * 2 + 2);
    else return [];
  }
  if (!terms.size && row.type === 'degree_project' && Number(row.credits) === 30 && year === yearCount) terms.add(year * 2);
  return [...terms];
}

function exactOptionSet(rows, targetHp) {
  const target = Math.round(targetHp * 10);
  if (target === 0) return [];
  const states = new Map([[0, []]]);
  rows.forEach((row, index) => {
    const value = Math.round(Number(row.credits) * 10);
    if (!(value > 0) || value > target) return;
    for (const [sum, picked] of [...states.entries()].sort((a, b) => b[0] - a[0])) {
      const next = sum + value;
      if (next <= target && !states.has(next)) states.set(next, [...picked, index]);
    }
  });
  return states.has(target) ? states.get(target).map(index => rows[index]) : null;
}

async function discoverLth(program) {
  const lthCode = LTH_PROGRAMME_CODES[code(program.programCode)];
  if (!lthCode || !(Number(program.programHp) > 0) || Number(program.programHp) % 60 !== 0) return null;
  const yearCount = Math.round(Number(program.programHp) / 60);
  const apiUrl = `https://api.lth.lu.se/lot/courses?programmeCode=${encodeURIComponent(lthCode)}&academicYearId=26_27`;
  const planUrl = `https://kurser.lth.se/lot/programme?ay=26_27&programme=${encodeURIComponent(lthCode)}`;
  try {
    const response = await getJson(apiUrl);
    const raw = Array.isArray(response.data) ? response.data : [];
    const active = raw.filter(row => row.status === 'active' && row.programmeStatus === 'active' && Number(row.year) >= 1 && Number(row.year) <= yearCount);
    const seenMandatory = new Set();
    const mandatory = active.filter(row => row.choice === 'mandatory' && (row.specialisationGeneral === 1 || row.specialisationCode === 'general'))
      .filter(row => {
        const key = `${row.courseCode}:${row.year}`;
        if (seenMandatory.has(key)) return false;
        seenMandatory.add(key);
        return true;
      });
    const rows = [];
    const termHp = new Map();
    const ambiguousMandatory = [];
    for (const course of mandatory) {
      const terms = lthTermCandidates(course, yearCount);
      if (terms.length !== 1) { ambiguousMandatory.push(course.courseCode); continue; }
      const term = terms[0];
      const hp = Number(course.credits);
      rows.push({ term, code: course.courseCode, name: course.name_sv, hp, category: 'mandatory', sourceKind: 'lth-lot-api' });
      termHp.set(term, round1((termHp.get(term) || 0) + hp));
    }
    const overfullTerms = [...termHp].filter(([, hp]) => hp > 30.01).map(([term, hp]) => ({ term, hp }));
    const slotDiagnostics = [];
    if (!ambiguousMandatory.length && !overfullTerms.length) {
      const needs = Array.from({ length: yearCount * 2 }, (_, index) => ({ term: index + 1, remainder: round1(30 - (termHp.get(index + 1) || 0)) }))
        .filter(item => item.remainder > 0.01);
      const optionRows = active.filter(row => row.choice !== 'mandatory');
      const specialisations = [...new Set(optionRows.map(row => row.specialisationCode || 'general'))];
      let selectedPlan = null;
      let selectedSpecialisation = '';
      for (const specialisation of specialisations) {
        const compatible = optionRows.filter(row => (row.specialisationCode || 'general') === specialisation || row.specialisationGeneral === 1 || row.specialisationCode === 'general');
        const orderedNeeds = [...needs].sort((a, b) => {
          const count = item => compatible.filter(row => lthTermCandidates(row, yearCount).includes(item.term)).length;
          return count(a) - count(b);
        });
        const usedCodes = new Set(mandatory.map(row => row.courseCode));
        const plan = new Map();
        let possible = true;
        for (const need of orderedNeeds) {
          const eligible = compatible.filter(row => lthTermCandidates(row, yearCount).includes(need.term) && !usedCodes.has(row.courseCode));
          const unique = [...new Map(eligible.map(row => [`${row.courseCode}:${row.credits}`, row])).values()];
          const selected = exactOptionSet(unique, need.remainder);
          if (!selected) { possible = false; break; }
          selected.forEach(row => usedCodes.add(row.courseCode));
          plan.set(need.term, selected);
        }
        if (possible) { selectedPlan = plan; selectedSpecialisation = specialisation; break; }
      }
      for (const { term, remainder } of needs) {
        const selected = selectedPlan?.get(term) || null;
        const candidates = optionRows.filter(row => lthTermCandidates(row, yearCount).includes(term));
        if (!selected) { slotDiagnostics.push({ term, remainder, options: candidates.length, matched: false }); continue; }
        rows.push({ term, code: '', name: 'Valbara kurser enligt LTH:s läro- och timplan', hp: remainder,
          category: 'elective-slot', isSlot: true, slotType: 'elective-slot', sourceKind: 'lth-lot-api',
          options: selected.map(row => ({ code: row.courseCode, name: row.name_sv, hp: Number(row.credits) })) });
        slotDiagnostics.push({ term, remainder, options: candidates.length, matched: true, specialisation: selectedSpecialisation,
          selected: selected.map(row => row.courseCode) });
      }
    }
    const candidate = makeCanonical(program, rows, [planUrl, response.url], { source: 'lund-lth-lot-api' });
    const complete = !ambiguousMandatory.length && !overfullTerms.length && structureIsComplete(candidate, program);
    return { found: true, structureAvailable: complete, courses: rows, sourceUrls: [planUrl, response.url], source: 'lund-lth-lot-api',
      quality: { complete, totalHp: Number(program.programHp), expectedTerms: yearCount * 2,
        completeTerms: [...new Set(rows.map(row => row.term))].filter(term => Math.abs(rows.filter(row => row.term === term).reduce((sum, row) => sum + row.hp, 0) - 30) <= 0.01),
        lthCode, apiRows: raw.length, activeRows: active.length, mandatoryRows: mandatory.length,
        ambiguousMandatory, overfullTerms, slotDiagnostics } };
  } catch (error) {
    return { found: false, structureAvailable: false, courses: [], sourceUrls: [planUrl, apiUrl], source: 'lund-lth-lot-api',
      quality: { complete: false, lthCode, error: String(error?.message || error), completeTerms: [] } };
  }
}

function curatedOfficialStructure(program) {
  const programmeCode = code(program.programCode);
  const slot = (term, name, hp, options = []) => ({ term, code: '', name, hp, category: 'elective-slot', isSlot: true, slotType: 'elective-slot', ...(options.length ? { options } : {}) });

  if (programmeCode === 'EAGIB') {
    const sourceUrl = 'https://kursplaner.lu.se/pdf/program/sv/EAGIB';
    const sharedTermTwo = [
      { term: 2, code: '', name: 'Research Strategy and Methods', hp: 10, category: 'mandatory' },
      slot(2, 'Valbar fördjupningskurs i internationell marknadsföring och varumärken', 5, [
        { code: '', name: 'Understanding Consumption', hp: 5 },
        { code: '', name: 'Corporate Brand Management and Reputation', hp: 5 },
        { code: '', name: 'AI-stödd marknadsinsikt: Teori möter praktik', hp: 5 },
      ]),
      { term: 2, code: 'BUSN39', name: 'Degree Project in Global Marketing', hp: 15, category: 'mandatory', isThesis: true },
    ];
    const strategies = [
      { term: 1, code: '', name: 'International Marketing and Strategy', hp: 7.5, category: 'mandatory' },
      { term: 1, code: '', name: 'Strategic Brand Management', hp: 7.5, category: 'mandatory' },
      { term: 1, code: '', name: 'Multichannel Marketing, Retail and Internationalisation', hp: 7.5, category: 'mandatory' },
      slot(1, 'Val mellan Sustainability and Marketing Ethics och AI-Driven Digital Marketing', 7.5, [
        { code: '', name: 'Sustainability and Marketing Ethics', hp: 7.5 },
        { code: '', name: 'AI-Driven Digital Marketing', hp: 7.5 },
      ]),
      ...sharedTermTwo,
    ];
    const consumerTrends = [
      { term: 1, code: '', name: 'Consumer Culture Theory and Consumer Insights', hp: 7.5, category: 'mandatory' },
      { term: 1, code: '', name: 'From Consumer Insight to Innovation', hp: 7.5, category: 'mandatory' },
      { term: 1, code: '', name: 'The Value of Brands in a Consumption Society', hp: 7.5, category: 'mandatory' },
      slot(1, 'Val mellan Sustainability and Marketing Ethics och AI-Driven Digital Marketing', 7.5, [
        { code: '', name: 'Sustainability and Marketing Ethics', hp: 7.5 },
        { code: '', name: 'AI-Driven Digital Marketing', hp: 7.5 },
      ]),
      ...sharedTermTwo,
    ];
    return makeCanonical(program, strategies, [sourceUrl], { source: 'lund-official-programme-plan-pdf', variants: [
      { id: 'STRA', subject: 'Strategier för varumärken och internationella marknader', programName: `${program.programName}, Strategier för varumärken och internationella marknader`, sourceUrls: [sourceUrl], rows: normaliseRows(strategies) },
      { id: 'INCT', subject: 'Internationella konsumenttrender, varumärken och innovation', programName: `${program.programName}, Internationella konsumenttrender, varumärken och innovation`, sourceUrls: [sourceUrl], rows: normaliseRows(consumerTrends) },
    ] });
  }

  if (programmeCode === 'MALÄB') {
    const sourceUrl = 'https://kursplaner.lu.se/pdf/program/sv/MAL%C3%84B';
    const rows = [
      { term: 1, code: '', name: 'Molekyl till vävnad', hp: 30, category: 'mandatory' },
      { term: 2, code: '', name: 'Rörelse och nervsystemet', hp: 30, category: 'mandatory' },
      { term: 3, code: '', name: 'Homeostas', hp: 30, category: 'mandatory' },
      { term: 4, code: '', name: 'Patogenes', hp: 30, category: 'mandatory' },
      { term: 5, code: '', name: 'Klinisk förberedelse', hp: 15, category: 'mandatory' },
      { term: 5, code: '', name: 'Vetenskaplig teori och tillämpning', hp: 15, category: 'mandatory' },
      { term: 6, code: '', name: 'Klinisk medicin 1', hp: 30, category: 'mandatory' },
      { term: 7, code: '', name: 'Klinisk medicin 2', hp: 30, category: 'mandatory' },
      { term: 8, code: '', name: 'Klinisk medicin 3', hp: 30, category: 'mandatory' },
      { term: 9, code: '', name: 'Klinisk medicin 4', hp: 27, category: 'mandatory' },
      { term: 9, code: '', name: 'Examensarbete i medicin - del termin 9', hp: 3, category: 'mandatory', isThesis: true },
      { term: 10, code: '', name: 'Examensarbete i medicin - del termin 10', hp: 27, category: 'mandatory', isThesis: true },
      { term: 10, code: '', name: 'Interprofessionell samverkan', hp: 3, category: 'mandatory' },
      slot(11, 'Två valbara kurser om 7,5 hp eller en valbar kurs om 15 hp', 15),
      { term: 11, code: '', name: 'Individ, samhälle och hälsa 1', hp: 15, category: 'mandatory' },
      { term: 12, code: '', name: 'Individ, samhälle och hälsa 2', hp: 30, category: 'mandatory' },
    ];
    return makeCanonical(program, rows, [sourceUrl], { source: 'lund-official-programme-plan-pdf' });
  }

  if (programmeCode === 'VALGP') {
    const sourceUrl = 'https://kursplaner.lu.se/pdf/program/sv/VALGP';
    const rows = [
      { term: 1, code: '', name: 'Logopediskt arbete I: introduktion', hp: 7.5, category: 'mandatory' },
      { term: 1, code: '', name: 'Logopedi och psykologi', hp: 7.5, category: 'mandatory' },
      { term: 1, code: '', name: 'Logopedi och lingvistik', hp: 7.5, category: 'mandatory' },
      { term: 1, code: '', name: 'Grundläggande anatomi och fysiologi', hp: 7.5, category: 'mandatory' },
      { term: 2, code: '', name: 'Logopedi och fonetik', hp: 7.5, category: 'mandatory' },
      { term: 2, code: '', name: 'Barns kognitiva, kommunikativa och språkliga utveckling', hp: 7.5, category: 'mandatory' },
      { term: 2, code: '', name: 'Senare språkutveckling samt läs-, skriv- och räkneutveckling', hp: 7.5, category: 'mandatory' },
      { term: 2, code: '', name: 'Logopediskt arbete II: bedömning', hp: 7.5, category: 'mandatory' },
      { term: 3, code: '', name: 'Logopediskt arbete III: intervention barn och ungdom', hp: 7.5, category: 'mandatory' },
      { term: 3, code: '', name: 'Utvecklingsrelaterad funktionsnedsättning, tal, språk och kommunikation I', hp: 7.5, category: 'mandatory' },
      { term: 3, code: '', name: 'Utvecklingsrelaterad funktionsnedsättning, tal, språk och kommunikation II', hp: 7.5, category: 'mandatory' },
      { term: 3, code: '', name: 'Utvecklingsrelaterad funktionsnedsättning, tal, språk och kommunikation III', hp: 7.5, category: 'mandatory' },
      { term: 4, code: '', name: 'Utvecklingsrelaterad funktionsnedsättning, tal, språk och kommunikation IV', hp: 7.5, category: 'mandatory' },
      { term: 4, code: '', name: 'Ät- och sväljsvårigheter hos barn och vuxna', hp: 7.5, category: 'mandatory' },
      { term: 4, code: '', name: 'Logopediskt arbete IV: barn och ungdom', hp: 7.5, category: 'mandatory' },
      { term: 4, code: '', name: 'Vetenskapligt fördjupningsarbete', hp: 7.5, category: 'mandatory' },
      { term: 5, code: '', name: 'Neurologopedi och geriatrik', hp: 7.5, category: 'mandatory' },
      { term: 5, code: '', name: 'Neurologopedi II', hp: 7.5, category: 'mandatory' },
      { term: 5, code: '', name: 'Fördjupning i talapparatens anatomi och fysiologi samt talperception', hp: 7.5, category: 'mandatory' },
      { term: 5, code: '', name: 'Logopediskt arbete V: intervention vuxna', hp: 7.5, category: 'mandatory' },
      { term: 6, code: '', name: 'Logopedi och foniatri', hp: 7.5, category: 'mandatory' },
      { term: 6, code: '', name: 'Röstlogopedi', hp: 7.5, category: 'mandatory' },
      { term: 6, code: '', name: 'Talflytsstörningar', hp: 7.5, category: 'mandatory' },
      { term: 6, code: '', name: 'Logopediskt arbete VI: vuxna', hp: 7.5, category: 'mandatory' },
      { term: 7, code: '', name: 'Vetenskapsmetodik', hp: 7.5, category: 'mandatory' },
      { term: 7, code: '', name: 'Vetenskapligt arbete - del termin 7', hp: 7.5, category: 'mandatory', isThesis: true },
      slot(7, 'Valbar kurs', 7.5),
      { term: 7, code: '', name: 'Logopediskt arbete VII: fördjupning', hp: 7.5, category: 'mandatory' },
      { term: 8, code: '', name: 'Vetenskapligt arbete - del termin 8', hp: 25.5, category: 'mandatory', isThesis: true },
      { term: 8, code: '', name: 'Framtidens logopedi', hp: 4.5, category: 'mandatory' },
    ];
    return makeCanonical(program, rows, [sourceUrl], { source: 'lund-official-programme-plan-pdf' });
  }

  if (programmeCode === 'JAMRÄ') {
    const sourceUrl = 'https://kursplaner.lu.se/pdf/program/sv/JAMR%C3%84';
    const rows = [
      { term: 1, code: '', name: 'Folkrätt', hp: 15, category: 'mandatory' },
      { term: 1, code: '', name: 'Internationella mänskliga rättigheter I', hp: 15, category: 'mandatory' },
      { term: 2, code: '', name: 'Internationella mänskliga rättigheter II', hp: 15, category: 'mandatory' },
      slot(2, 'Valbar kurs inom programmet', 15),
      { term: 3, code: '', name: 'Humanitär rätt', hp: 7.5, category: 'mandatory' },
      { term: 3, code: '', name: 'De mänskliga rättigheterna och rättsmedel', hp: 15, category: 'mandatory' },
      slot(3, 'Valbar kurs inom programmet', 7.5),
      { term: 4, code: '', name: 'Självständigt arbete i internationell människorättsjuridik', hp: 30, category: 'mandatory', isThesis: true },
    ];
    return makeCanonical(program, rows, [sourceUrl], { source: 'lund-official-programme-plan-pdf' });
  }

  if (programmeCode === 'NATKL') {
    const sourceUrl = 'https://kursplaner.lu.se/pdf/program/sv/NATKL';
    const rows = [
      { term: 1, code: 'MVEN15', name: 'Miljövetenskap: Klimatförändringen, vetenskap och samhälle', hp: 15, category: 'mandatory' },
      { term: 1, code: 'MVEN16', name: 'Miljövetenskap: Klimatpolitik, samhällsstyrning och kommunikation', hp: 15, category: 'mandatory' },
      { term: 2, code: 'MVEN27', name: 'Miljövetenskap: Samhällsplanering med klimatperspektiv', hp: 15, category: 'mandatory' },
      { term: 2, code: 'MVEN28', name: 'Miljövetenskap: Klimatstrategiska metoder', hp: 15, category: 'mandatory' },
      slot(3, 'Valfria kurser, praktik- eller metodikkurser enligt programplan', 30),
      { term: 4, code: 'MVEM31', name: 'Miljövetenskap med fördjupning i tillämpad klimatstrategi: Examensarbete för masterexamen', hp: 30, category: 'mandatory', isThesis: true },
    ];
    return makeCanonical(program, rows, [sourceUrl], { source: 'lund-official-programme-plan-pdf' });
  }

  if (programmeCode === 'SASDA') {
    const sourceUrl = 'https://kursplaner.lu.se/pdf/program/sv/SASDA';
    const rows = [
      { term: 1, code: '', name: 'Den samhällsvetenskapliga forskningsprocessen', hp: 15, category: 'mandatory' },
      { term: 1, code: '', name: 'Kvantitativ dataanalys i R', hp: 15, category: 'mandatory' },
      { term: 2, code: '', name: 'Samhällsvetenskaplig teori - uppbyggnad och struktur', hp: 7.5, category: 'mandatory' },
      { term: 2, code: '', name: 'Urval och visualisering av data', hp: 7.5, category: 'mandatory' },
      slot(2, 'Två valbara kurser i kvalitativ metod', 15),
      slot(3, 'Valfria kurser som stäms av med programkoordinator', 30),
      { term: 4, code: '', name: 'Examensarbete på masternivå inom studentens huvudområde', hp: 30, category: 'mandatory', isThesis: true },
    ];
    return makeCanonical(program, rows, [sourceUrl], { source: 'lund-official-programme-plan-pdf' });
  }

  if (programmeCode === 'SASTV') {
    const sourceUrl = 'https://www.lu.se/studera/statsvetenskap-masterprogram-SASTV/programmets-innehall';
    const rows = [
      { term: 1, code: '', name: 'Statsvetenskap: Politisk ordning i tid och rum', hp: 15, category: 'mandatory' },
      { term: 1, code: '', name: 'Statsvetenskap: Statsvetenskaplig metodologi', hp: 15, category: 'mandatory' },
      slot(2, 'Valbar fördjupningskurs i statsvetenskap', 15),
      slot(2, 'Valfri kurs inom eller utanför ämnet på avancerad nivå', 15),
      slot(3, 'Valfria kurser, praktik eller utlandsstudier', 30),
      { term: 4, code: '', name: 'Statsvetenskap: Examensarbete för masterexamen', hp: 30, category: 'mandatory', isThesis: true },
    ];
    return makeCanonical(program, rows, [sourceUrl], { source: 'lund-official-programme-page' });
  }

  if (programmeCode === 'SASGE') {
    const sourceUrl = 'https://www.lu.se/studera/samhallsgeografi-masterprogram-SASGE/programmets-innehall';
    const rows = [
      { term: 1, code: '', name: 'Samhällsgeografi: Geografisk idéhistoria', hp: 7.5, category: 'mandatory' },
      { term: 1, code: '', name: 'Samhällsgeografi: Ekonomisk geografiska omvandlingsprocesser - platser, människor och produktion', hp: 7.5, category: 'mandatory' },
      { term: 1, code: '', name: 'Humanekologi: Kritisk tvärvetenskaplig vetenskapsteori, del 1', hp: 7.5, category: 'mandatory' },
      { term: 1, code: '', name: 'Samhällsgeografi: Landskapsgeografi och politisk ekologi', hp: 7.5, category: 'mandatory' },
      { term: 2, code: '', name: 'Ekonomisk geografi: Urban och regional planering', hp: 7.5, category: 'mandatory' },
      { term: 2, code: '', name: 'Samhällsgeografi: Kritisk urbangeografi', hp: 7.5, category: 'mandatory' },
      { term: 2, code: '', name: 'GIS: Geografiska informationssystem för samhällsvetenskap', hp: 7.5, category: 'mandatory' },
      { term: 2, code: '', name: 'Samhällsgeografi: GIS och forskningsmetodologi i fält', hp: 7.5, category: 'mandatory' },
      slot(3, 'Valbara kurser, inklusive möjlighet till praktik', 30),
      { term: 4, code: '', name: 'Samhällsgeografi: Examensarbete för masterexamen', hp: 30, category: 'mandatory', isThesis: true },
    ];
    return makeCanonical(program, rows, [sourceUrl], { source: 'lund-official-programme-page' });
  }

  if (programmeCode === 'SGPOL') {
    const sourceUrl = 'https://www.lu.se/studera/politices-kandidatprogrammet-SGPOL/programmets-innehall';
    const common = [
      { term: 1, code: '', name: 'Statsvetenskap: Grundkurs', hp: 30, category: 'mandatory' },
      { term: 2, code: '', name: 'Nationalekonomi: Grundkurs', hp: 30, category: 'mandatory' },
      slot(3, 'Kompletterande ämne enligt programplan', 30),
      slot(4, 'Fortsättningskurs i valt huvudområde', 30),
    ];
    const candidateFirst = [...common, slot(5, 'Kandidatkurs i valt huvudområde', 30), slot(6, 'Valfri termin, praktik eller utbytesstudier', 30)];
    const freeFirst = [...common, slot(5, 'Valfri termin, praktik eller utbytesstudier', 30), slot(6, 'Kandidatkurs i valt huvudområde', 30)];
    return makeCanonical(program, candidateFirst, [sourceUrl], { source: 'lund-official-programme-page', variants: [
      { id: 'candidate-term-5', subject: 'Kandidatkurs termin 5', programName: program.programName, sourceUrls: [sourceUrl], rows: normaliseRows(candidateFirst) },
      { id: 'candidate-term-6', subject: 'Kandidatkurs termin 6', programName: program.programName, sourceUrls: [sourceUrl], rows: normaliseRows(freeFirst) },
    ] });
  }

  if (programmeCode === 'VGRRS') {
    const sourceUrl = 'https://kursplaner.lu.se/pdf/program/sv/VGRRS';
    const common = [
      { term: 1, code: '', name: 'Röntgensjuksköterskans profession I', hp: 9, category: 'mandatory' },
      { term: 1, code: '', name: 'Anatomi och fysiologi', hp: 7.5, category: 'mandatory' },
      { term: 1, code: '', name: 'Strålningsfysik och teknologi I', hp: 5, category: 'mandatory' },
      { term: 1, code: '', name: 'Röntgensjuksköterskans profession och vetenskap I', hp: 6, category: 'mandatory' },
      { term: 1, code: '', name: 'Omvårdnadens teknik och metod I', hp: 2.5, category: 'mandatory' },
      { term: 2, code: '', name: 'Anatomi, fysiologi, mikrobiologi och patofysiologi', hp: 7.5, category: 'mandatory' },
      { term: 2, code: '', name: 'Den medicinska bilden I', hp: 4.5, category: 'mandatory' },
      { term: 2, code: '', name: 'Röntgensjuksköterskans profession II', hp: 14, category: 'mandatory' },
      { term: 2, code: '', name: 'Omvårdnadens teknik och metod II', hp: 2.5, category: 'mandatory' },
      { term: 2, code: '', name: 'Handledning I', hp: 1.5, category: 'mandatory' },
      { term: 3, code: '', name: 'Strålningsfysik och teknologi II', hp: 7.5, category: 'mandatory' },
      { term: 3, code: '', name: 'Röntgensjuksköterskans profession III', hp: 18.5, category: 'mandatory' },
      { term: 3, code: '', name: 'Omvårdnadens teknik och metod III', hp: 2.5, category: 'mandatory' },
      { term: 3, code: '', name: 'Handledning II', hp: 1.5, category: 'mandatory' },
      { term: 4, code: '', name: 'Den medicinska bilden II', hp: 7, category: 'mandatory' },
      { term: 4, code: '', name: 'Barns, vuxnas och äldres hälsa och ohälsa', hp: 7.5, category: 'mandatory' },
      { term: 4, code: '', name: 'Strålningsfysik och teknologi III', hp: 8, category: 'mandatory' },
      { term: 4, code: '', name: 'Den medicinska bilden III', hp: 7.5, category: 'mandatory' },
      { term: 5, code: '', name: 'Röntgensjuksköterskans profession och vetenskap II', hp: 7.5, category: 'mandatory' },
      { term: 5, code: '', name: 'Ledarskap, informatik och kvalitetsutveckling', hp: 8, category: 'mandatory' },
      { term: 5, code: '', name: 'Handledning III', hp: 2, category: 'mandatory' },
      { term: 6, code: '', name: 'Röntgensjuksköterskans profession och vetenskap III - examensarbete', hp: 15, category: 'mandatory', isThesis: true },
      { term: 6, code: '', name: 'Handledning IV', hp: 2.5, category: 'mandatory' },
    ];
    const professionVFirst = [
      ...common,
      { term: 5, code: '', name: 'Röntgensjuksköterskans profession V', hp: 12.5, category: 'mandatory' },
      { term: 6, code: '', name: 'Röntgensjuksköterskans profession IV', hp: 12.5, category: 'mandatory' },
    ];
    const professionIVFirst = [
      ...common,
      { term: 5, code: '', name: 'Röntgensjuksköterskans profession IV', hp: 12.5, category: 'mandatory' },
      { term: 6, code: '', name: 'Röntgensjuksköterskans profession V', hp: 12.5, category: 'mandatory' },
    ];
    return makeCanonical(program, professionVFirst, [sourceUrl], { source: 'lund-official-programme-plan-pdf', variants: [
      { id: 'profession-v-term-5', subject: 'Profession V termin 5', programName: program.programName, sourceUrls: [sourceUrl], rows: normaliseRows(professionVFirst) },
      { id: 'profession-iv-term-5', subject: 'Profession IV termin 5', programName: program.programName, sourceUrls: [sourceUrl], rows: normaliseRows(professionIVFirst) },
    ] });
  }

  if (programmeCode === 'VASMS') {
    const sourceUrl = 'https://kursplaner.lu.se/pdf/program/sv/VASMS';
    const rows = [
      { term: 1, code: '', name: 'Introduktion till ambulanssjuksköterskans funktion', hp: 4.5, category: 'mandatory' },
      { term: 1, code: '', name: 'Akutsjukvård inom ambulanssjukvård', hp: 18, category: 'mandatory' },
      { term: 1, code: '', name: 'Magisteruppsats inom omvårdnad med inriktning ambulanssjukvård - del termin 1', hp: 7.5, category: 'mandatory', isThesis: true },
      { term: 2, code: '', name: 'Katastrof och traumatologi', hp: 4.5, category: 'mandatory' },
      { term: 2, code: '', name: 'Omvårdnad inom ambulanssjukvård', hp: 18, category: 'mandatory' },
      { term: 2, code: '', name: 'Magisteruppsats inom omvårdnad med inriktning ambulanssjukvård - del termin 2', hp: 7.5, category: 'mandatory', isThesis: true },
    ];
    return makeCanonical(program, rows, [sourceUrl], { source: 'lund-official-programme-plan-pdf' });
  }

  if (programmeCode === 'VGFYT') {
    const sourceUrl = 'https://kursplaner.lu.se/pdf/program/sv/VGFYT';
    const rows = [
      { term: 1, code: '', name: 'Fysioterapi som ämne och profession', hp: 4.5, category: 'mandatory' },
      { term: 1, code: '', name: 'Människans rörelseförutsättningar', hp: 13.5, category: 'mandatory' },
      { term: 1, code: '', name: 'Människans rörelseförutsättningar och rörelseförmåga', hp: 12, category: 'mandatory' },
      { term: 2, code: '', name: 'Grundläggande fysiologi och träningsfysiologi', hp: 16.5, category: 'mandatory' },
      { term: 2, code: '', name: 'Funktionsförmåga vid sjukdomar och skador i andnings- och cirkulationssystemen', hp: 13.5, category: 'mandatory' },
      { term: 3, code: '', name: 'Funktionsförmåga och hälsotillstånd vid sjukdom och skada i nervsystemet', hp: 15, category: 'mandatory' },
      { term: 3, code: '', name: 'Funktionsförmåga vid muskuloskeletala skador och sjukdomstillstånd I', hp: 15, category: 'mandatory' },
      { term: 4, code: '', name: 'Fysioterapi inom området mental hälsa och psykiatri', hp: 12, category: 'mandatory' },
      { term: 4, code: '', name: 'Verksamhetsförlagd utbildning inom rehabilitering, habilitering eller psykiatri', hp: 4.5, category: 'mandatory' },
      { term: 4, code: '', name: 'Verksamhetsförlagd utbildning inom sluten vård', hp: 4.5, category: 'mandatory' },
      { term: 4, code: '', name: 'Människan i arbetslivet', hp: 9, category: 'mandatory' },
      { term: 5, code: '', name: 'Vetenskaplig metodik', hp: 7.5, category: 'mandatory' },
      { term: 5, code: '', name: 'Kandidatuppsats inom fysioterapi - del termin 5', hp: 12, category: 'mandatory', isThesis: true },
      { term: 5, code: '', name: 'Verksamhetsförlagd utbildning inom klinisk utbildningsavdelning, KUA', hp: 3, category: 'mandatory' },
      { term: 5, code: '', name: 'Idrottsmedicin och träning vid olika sjukdomstillstånd', hp: 7.5, category: 'mandatory' },
      { term: 6, code: '', name: 'Funktionsförmåga vid muskuloskeletala skador och sjukdomstillstånd II', hp: 9, category: 'mandatory' },
      { term: 6, code: '', name: 'Kandidatuppsats inom fysioterapi - del termin 6', hp: 3, category: 'mandatory', isThesis: true },
      { term: 6, code: '', name: 'Verksamhetsförlagd utbildning inom öppen vård', hp: 7.5, category: 'mandatory' },
      { term: 6, code: '', name: 'Verksamhetsförlagd utbildning inom rehabilitering i kommunal verksamhet', hp: 7.5, category: 'mandatory' },
      { term: 6, code: '', name: 'Professionell utveckling, ledning och förändring', hp: 3, category: 'mandatory' },
    ];
    return makeCanonical(program, rows, [sourceUrl], { source: 'lund-official-programme-plan-pdf' });
  }

  if (programmeCode !== 'EAEIT') return null;
  const sourceUrl = 'https://kursplaner.lu.se/pdf/program/sv/EAEIT';
  const shared = { term: 1, code: 'HARN50', name: 'Introduktion till europeisk och internationell handels- och skatterätt', hp: 7.5, category: 'mandatory' };
  const tradeRows = [
    shared,
    { term: 1, code: '', name: 'Val mellan HARN51 Internationell kontraktsrätt och HARN52 Immaterialrätt, digitalisering och artificiell intelligens', hp: 7.5, category: 'elective-slot', isSlot: true, options: [
      { code: 'HARN51', name: 'Internationell kontraktsrätt', hp: 7.5 },
      { code: 'HARN52', name: 'Immaterialrätt, digitalisering och artificiell intelligens', hp: 7.5 },
    ] },
    { term: 1, code: '', name: 'Val mellan HARN53 Handel, investeringar och hållbarhet och HARN54 Immaterialrätt och handel', hp: 15, category: 'elective-slot', isSlot: true, options: [
      { code: 'HARN53', name: 'Handel, investeringar och hållbarhet', hp: 15 },
      { code: 'HARN54', name: 'Immaterialrätt och handel', hp: 15 },
    ] },
    { term: 2, code: '', name: 'Val mellan HARN64 Konkurrenspolitik och hållbara marknader och HARN65 Europeisk och internationell arbetsrätt', hp: 15, category: 'elective-slot', isSlot: true, options: [
      { code: 'HARN64', name: 'Konkurrenspolitik och hållbara marknader', hp: 15 },
      { code: 'HARN65', name: 'Europeisk och internationell arbetsrätt', hp: 15 },
    ] },
    { term: 2, code: 'HARN63', name: 'Examensarbete/Magisteruppsats i europeisk och internationell handelsrätt', hp: 15, category: 'mandatory', isThesis: true },
  ];
  const taxRows = [
    shared,
    { term: 1, code: 'HARN66', name: 'Mervärdesbeskattning inom Europeiska unionen', hp: 7.5, category: 'mandatory' },
    { term: 1, code: 'HARN67', name: 'EU-skatterätt och internationell direkt beskattning', hp: 15, category: 'mandatory' },
    { term: 2, code: 'HARN68', name: 'Fördjupningskurs i EU-skatterätt och internationell beskattning', hp: 15, category: 'mandatory' },
    { term: 2, code: 'HARN69', name: 'Examensarbete/Magisteruppsats i europeisk och internationell skatterätt', hp: 15, category: 'mandatory', isThesis: true },
  ];
  return makeCanonical(program, tradeRows, [sourceUrl], { source: 'lund-official-programme-plan-pdf', variants: [
    { id: 'TRAD', subject: 'Europeisk och internationell handelsrätt', programName: `${program.programName}, Handelsrätt`, sourceUrls: [sourceUrl], rows: normaliseRows(tradeRows) },
    { id: 'TAXL', subject: 'Europeisk och internationell skatterätt', programName: `${program.programName}, Skatterätt`, sourceUrls: [sourceUrl], rows: normaliseRows(taxRows) },
  ] });
}

async function probeLthProgrammeSource() {
  const target = 'https://kurser.lth.se/lot/?prog=D&val=program';
  try {
    const page = await getText(target);
    const scripts = [...String(page.html || '').matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)]
      .map(match => {
        try { return new URL(decodeHtml(match[1]), page.url).href; } catch { return ''; }
      }).filter(url => /^https:\/\/kurser\.lth\.se\//i.test(url));
    const assets = [];
    for (const scriptUrl of [...new Set(scripts)].slice(0, 8)) {
      try {
        const script = await getText(scriptUrl);
        const source = String(script.html || '');
        const urls = [...source.matchAll(/(?:https?:\\?\/\\?\/[^"'\x60\s]{4,220}|\/[A-Za-z0-9_.?=&%/-]{3,220})/g)]
          .map(match => match[0].replace(/\\\//g, '/'))
          .filter(value => /api|programme|program|course|lot/i.test(value));
        const calls = [...source.matchAll(/(?:fetch|axios\.(?:get|post)|\.get)\s*\((.{0,260})/gi)]
          .map(match => clean(match[0])).filter(value => /api|programme|program|course|lot/i.test(value));
        const contexts = {};
        for (const needle of ['/curriculum/programmes/', '/courses/programmes', '/courses/academic-years', 'programmeCode', 'academicYearId']) {
          const index = source.indexOf(needle);
          if (index >= 0) contexts[needle] = source.slice(Math.max(0, index - 700), Math.min(source.length, index + 1400));
        }
        assets.push({ url: script.url, size: source.length, candidates: [...new Set([...urls, ...calls])].slice(0, 80), contexts });
      } catch (error) {
        assets.push({ url: scriptUrl, error: String(error?.message || error) });
      }
    }
    const apiBase = 'https://api.lth.lu.se/lot';
    const probes = [];
    const summarise = data => {
      if (Array.isArray(data)) return { type: 'array', count: data.length, sample: data.slice(0, 3) };
      if (data && typeof data === 'object') return { type: 'object', keys: Object.keys(data), sample: data };
      return { type: typeof data, sample: data };
    };
    const probe = async url => {
      try {
        const response = await getJson(url);
        probes.push({ url: response.url, ok: true, ...summarise(response.data) });
        return response.data;
      } catch (error) {
        probes.push({ url, ok: false, error: String(error?.message || error) });
        return null;
      }
    };
    const programmes = await probe(`${apiBase}/courses/programmes`);
    await probe(`${apiBase}/courses/programmes?kull=true`);
    const academicYears = await probe(`${apiBase}/courses/academic-years?programmeCode=D&includePreliminary=true`);
    const courses = await probe(`${apiBase}/courses?programmeCode=D`);
    await probe(`${apiBase}/curriculum/programmes/D`);
    const yearObjects = [];
    const collectObjects = value => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) return value.forEach(collectObjects);
      yearObjects.push(value);
      Object.values(value).forEach(collectObjects);
    };
    collectObjects(academicYears);
    const yearValues = [...new Set(yearObjects.flatMap(item => Object.entries(item)
      .filter(([key]) => /academic.*year|year.*id|^id$|^code$/i.test(key))
      .map(([, value]) => typeof value === 'string' || typeof value === 'number' ? String(value) : '')
      .filter(value => /26|2026|27|2027/.test(value))))].slice(0, 8);
    for (const academicYearId of yearValues) {
      const params = new URLSearchParams({ programmeCode: 'D', academicYearId });
      await probe(`${apiBase}/courses?${params}`);
    }
    const courseRows = Array.isArray(courses) ? courses : [];
    const courseSummary = {};
    for (const row of courseRows) {
      const key = `${row.year || 0}:${row.choice || ''}:${row.choiceShort || ''}:${row.specialisationCode || ''}`;
      if (!courseSummary[key]) courseSummary[key] = { rows: 0, uniqueCourses: new Set(), credits: 0 };
      courseSummary[key].rows += 1;
      const courseKey = `${row.courseCode}:${row.year}:${row.choice}:${row.specialisationCode}`;
      if (!courseSummary[key].uniqueCourses.has(courseKey)) {
        courseSummary[key].uniqueCourses.add(courseKey);
        courseSummary[key].credits += Number(row.credits) || 0;
      }
    }
    const compactSummary = Object.fromEntries(Object.entries(courseSummary).map(([key, value]) => [key, {
      rows: value.rows, uniqueCourses: value.uniqueCourses.size, credits: value.credits,
    }]));
    const compactCourses = courseRows.filter(row => Number(row.year) <= 3).map(row => ({
      courseCode: row.courseCode, name_sv: row.name_sv, credits: row.credits, year: row.year,
      choice: row.choice, choiceShort: row.choiceShort, groupId: row.groupId,
      specialisationCode: row.specialisationCode, specialisationGeneral: row.specialisationGeneral,
      periods: (row.timePlans || []).map(plan => [plan.startSpNr, plan.endSpNr]),
    }));
    return { target: page.url, scripts: [...new Set(scripts)], assets, api: {
      programmes: Array.isArray(programmes) ? programmes : [], programmeSummary: summarise(programmes),
      courseSummary: compactSummary, firstThreeYears: compactCourses, probes,
    } };
  } catch (error) {
    return { target, error: String(error?.message || error) };
  }
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
  // LTH API-derived records are rebuilt on every run so stricter validation is
  // applied retroactively instead of trusting an older generated snapshot.
  for (let index = structures.length - 1; index >= 0; index -= 1) {
    if (structures[index]?.source === 'lund-lth-lot-api' || (structures[index]?.sourceUrls || []).some(url => /api\.lth\.lu\.se\/lot\/courses/i.test(url))) structures.splice(index, 1);
  }
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

  let curatedImported = 0;
  for (const program of lundPrograms) {
    const record = curatedOfficialStructure(program);
    if (!record || !structureIsComplete(record, program)) continue;
    const result = upsert(structures, record, program);
    if (result.action !== 'existing') curatedImported += 1;
  }

  const targets = lundPrograms.filter(program => {
    const current = structures.find(item => item.key === program.key || identity(item.university, item.programCode) === identity(program.university, program.programCode));
    return !structureIsComplete(current, program);
  }).slice(0, LIMIT);
  const attempted = targets.length;
  const errors = [];
  let imported = 0;
  const results = await mapPool(targets, async program => {
    const lthResult = await discoverLth(program);
    const discovered = lthResult?.structureAvailable ? null : await discover(program);
    const result = lthResult?.structureAvailable ? lthResult : discovered;
    const rows = normaliseRows(result.courses);
    const candidate = makeCanonical(program, rows, result.sourceUrls || [], result.source ? { source: result.source } : {});
    if (result.found && result.structureAvailable && structureIsComplete(candidate, program)) {
      const action = upsert(structures, candidate, program);
      if (action.action !== 'existing') imported += 1;
      console.log(`${action.action.toUpperCase()} ${program.programCode} ${program.programName}`);
      return { program, ok: true, action: action.action, sourceUrls: result.sourceUrls || [] };
    }
    const qualityInfo = result.quality || {};
    const reason = result.found ? `partial:${(qualityInfo.completeTerms || []).join(',') || 'none'}` : 'official-page-not-found';
    errors.push({ code: code(program.programCode), name: program.programName, reason,
      attemptedUrls: result.attemptedUrls || [], bestSourceUrls: result.sourceUrls || [], bestQuality: qualityInfo,
      ...(lthResult ? { lthQuality: lthResult.quality, lthSourceUrls: lthResult.sourceUrls } : {}), pdfDiagnostics: result.pdfDiagnostics || [] });
    console.log(`REVIEW ${program.programCode} ${reason}`);
    return { program, ok: false, reason };
  }, CONCURRENCY);

  const lundStructures = structures.filter(item => isLund(item.university));
  const verifiedCodes = [...new Set(lundStructures.filter((item, index) => structureIsComplete(item, byCode.get(code(item.programCode)) || {}) && byCode.has(code(item.programCode))).map(item => code(item.programCode)))].sort();
  const remaining = lundPrograms.filter(program => !structureIsComplete(structures.find(item => item.key === program.key || identity(item.university, item.programCode) === identity(program.university, program.programCode)), program));
  const lthProbe = await probeLthProgrammeSource();
  const report = {
    generatedAt: new Date().toISOString(), scope: 'Lunds universitet', catalogueProgrammes: lundPrograms.length,
    existingCanonicalStructuresBefore: initialStructures.filter(item => isLund(item.university)).length,
    legacyImported, curatedImported, attempted, imported, verifiedProgrammeCodes: verifiedCodes.length,
    verifiedProgrammeCodeList: verifiedCodes,
    remainingProgrammeCodes: remaining.map(program => ({ code: code(program.programCode), name: program.programName, hp: program.programHp })),
    errors, lthProbe, notes: ['Only official Lund pages and previously verified official Lund programme-plan records are used.', 'A structure is published only when all expected terms and total credits validate exactly.', 'EAGAF track variants are retained under the variants field of the canonical programme record.'],
  };
  await writeJson(REPORT, report);
  await writeJson(path.join(DATA, 'program-structures.json'), structures);
  console.log(JSON.stringify({ catalogueProgrammes: lundPrograms.length, legacyImported, attempted, imported, verifiedProgrammeCodes: verifiedCodes.length, remaining: remaining.length }, null, 2));
  void results;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
