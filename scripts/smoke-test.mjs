import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const [html, css, app, runtime, manifest] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../studielots-v614.css', import.meta.url), 'utf8'),
  readFile(new URL('../studielots-v614.js', import.meta.url), 'utf8'),
  readFile(new URL('../studielots-runtime-v614.js', import.meta.url), 'utf8'),
  readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'),
]);

assert.match(html, /studielots-v614\.css\?v=614/);
assert.match(html, /studielots-v614\.js\?v=614/);
assert.match(html, /studielots-runtime-v614\.js\?v=614/);
assert.doesNotMatch(html, /pdf\.min\.mjs/);
assert.match(app, /async function loadPdfJs\(\)/);
assert.match(runtime, /const VERSION='614'/);
assert.match(runtime, /window\.__studielotsHpAuthority=authority/);
assert.match(app, /#sl-pace-picker/);
assert.match(app, /v576-open-cue/);

for (const retired of ['v567', 'v568', 'v569', 'v571', 'v576', 'v577', 'v581', 'v582']) {
  assert.doesNotMatch(app, new RegExp(`version:'${retired}'`));
}

assert.doesNotMatch(app, /serviceWorker\.register/);
assert.equal((app.match(/new MutationObserver/g) || []).length, 1);
assert.equal(JSON.parse(manifest).share_target, undefined);
assert.ok(Buffer.byteLength(html) < 30_000);
assert.ok(Buffer.byteLength(css) < 700_000);

console.log('StudieLots smoke test passed');
