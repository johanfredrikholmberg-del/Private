import { readFile, writeFile } from "node:fs/promises";

const root = process.cwd();
const stamp = new Date().toISOString();
const mainPath = `${root}/data/studielots-db/programme-structures-ht26.json`;
const main = JSON.parse(await readFile(mainPath, "utf8"));
const entry = main.find((x) => x.university === "Göteborgs universitet" && x.programCode === "S1ANT");
if (!entry) throw new Error("GU S1ANT programme not found");
const sourceUrls = [
  "https://www.gu.se/studera/hitta-utbildning/antropologprogrammet-s1ant",
  "https://www.gu.se/sites/default/files/2025-11/Visuell%20programstruktur%20A3%20S1ANT%20251111_0.pdf",
  "https://studentportal.gu.se/sites/default/files/2023-09/Utbildningsplan-antropologprogrammet.pdf",
];
const fixed = [
  [1, "SA1121", "Introduktion till socialantropologi 1"],
  [1, "SA1122", "Introduktion till socialantropologi 2"],
  [2, "SA1221", "Antropologisk analys"],
  [2, "SA1222", "Antropologisk teori"],
  [3, "SA1231", "Tillämpad antropologi"],
  [3, "SA1232", "Etnografi som arbetsmetod"],
  [5, "SA1251", "Antropologiska debatter och frontlinjer"],
  [5, "SA1312", "Forskningsdesign inom antropologi"],
  [6, "SA1411", "Socialantropologi: fältarbete"],
  [6, "SA1511", "Socialantropologi: examensarbete"],
].map(([term, code, name]) => ({
  term, code, name, hp: 15, category: "mandatory", isSlot: false, courseCodeVerified: true,
}));
const rows = [
  ...fixed.slice(0, 6),
  { term: 4, code: "", name: "Valfria kurser", hp: 30, category: "elective", isSlot: true,
    slotType: "elective-slot", courseCodeVerified: false },
  ...fixed.slice(6),
];
const termHp = Array.from({ length: 6 }, (_, i) =>
  rows.filter((r) => r.term === i + 1).reduce((sum, r) => sum + r.hp, 0));
if (rows.length !== 11 || termHp.some((hp) => hp !== 30)) {
  throw new Error(`Unexpected S1ANT structure: rows=${rows.length}, termHp=${termHp}`);
}
Object.assign(entry, {
  status: "verified", coverage: "choice-required", reason: null, rows,
  source: "gu-official-programme-syllabus", sourceUrl: sourceUrls[0], sourceUrls,
  checkedAt: stamp, verified: true, courseCodesVerified: true, choiceRequired: true,
  sourceEvidenceUrl: sourceUrls[1], apiCoverage: "partial-or-choice-dependent",
  apiConfidence: "official-partial", term: "HT26",
});
await writeFile(mainPath, JSON.stringify(main, null, 2) + "\n");

const coveragePath = `${root}/data/import-reviews/gu-coverage.json`;
const coverage = JSON.parse(await readFile(coveragePath, "utf8"));
coverage.generatedAt = stamp;
coverage.structures = {
  materialized: 233, verified: 50, rows: 594,
  coverage: { complete: 19, choiceRequired: 24, courseCodesUnverified: 6, partial: 2, metadataOnly: 181, manualReview: 1 },
};
await writeFile(coveragePath, JSON.stringify(coverage, null, 2) + "\n");

for (const path of [
  `${root}/data/studielots-db/programme-structures-manifest.json`,
  `${root}/data/studielots-db/manifest.json`,
]) {
  const data = JSON.parse(await readFile(path, "utf8"));
  data.generatedAt = stamp;
  await writeFile(path, JSON.stringify(data, null, 2) + "\n");
}
console.log(`Materialized GU S1ANT: ${rows.length} rows, ${termHp.join("/")} hp by term`);
