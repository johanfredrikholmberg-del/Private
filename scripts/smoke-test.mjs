import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const [html, css, catalog, app, runtime, manifest] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../studielots-v615.css', import.meta.url), 'utf8'),
  readFile(new URL('../studielots-catalog-v616.js', import.meta.url), 'utf8'),
  readFile(new URL('../studielots-v622.js', import.meta.url), 'utf8'),
  readFile(new URL('../studielots-runtime-v622.js', import.meta.url), 'utf8'),
  readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'),
]);

assert.match(html, /studielots-v615\.css\?v=615/);
assert.match(html, /studielots-catalog-v616\.js\?v=616/);
assert.match(html, /studielots-v622\.js\?v=622/);
assert.match(html, /studielots-runtime-v622\.js\?v=622/);
assert.doesNotMatch(html, /pdf\.min\.mjs/);
assert.match(app, /async function loadPdfJs\(\)/);
assert.match(catalog, /window\.programCatalog=\[/);
assert.match(app, /var programCatalog=window\.programCatalog\|\|\[\]/);
assert.match(runtime, /const VERSION='622'/);
assert.match(runtime, /window\.__studielotsHpAuthority=authority/);
assert.match(app, /#sl-pace-picker/);
assert.match(app, /v576-open-cue/);
assert.match(app, /version:'v622'/);
assert.match(app, /programSearchRuntime='622'/);
assert.match(runtime, /data-sl622-program/);
assert.match(runtime, /typeof selectProgramForMatch==='function'/);
assert.match(app, /typeof window\.shouldUseV2==='function'/);
assert.match(app, /window\.renderV21Detail=renderV21Detail/);
assert.match(app, /window\.mappedHp=window\.mappedHp\|\|function\(p\)/);

for (const retired of ['v567', 'v568', 'v569', 'v571', 'v576', 'v577', 'v581', 'v582']) {
  assert.doesNotMatch(app, new RegExp(`version:'${retired}'`));
}

assert.doesNotMatch(app, /serviceWorker\.register/);
assert.equal((app.match(/new MutationObserver/g) || []).length, 1);
assert.equal(JSON.parse(manifest).share_target, undefined);
assert.ok(Buffer.byteLength(html) < 30_000);
assert.ok(Buffer.byteLength(css) < 700_000);
assert.ok(Buffer.byteLength(catalog) < 1_200_000);
assert.ok(Buffer.byteLength(app) < 1_300_000);

console.log('StudieLots smoke test passed');
