'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const LANGS = ['en', 'ro', 'fr', 'it', 'es', 'pt', 'de', 'hu'];

test('docs/index.html conține DATA pentru cele 8 limbi, fără chei lipsă', () => {
  const html = fs.readFileSync(path.join(root, 'docs/index.html'), 'utf8');
  const m = html.match(/var DATA=(\{.*?\});\nvar LANGS/s);
  assert.ok(m, 'DATA negăsit');
  const data = JSON.parse(m[1]);
  assert.deepEqual(Object.keys(data), LANGS);
  const keys = Object.keys(data.en).sort().join();
  for (const l of LANGS) assert.equal(Object.keys(data[l]).sort().join(), keys, l);
});

test('README există în 8 limbi și are bara de limbi și linkurile de descărcare', () => {
  for (const l of LANGS) {
    const f = l === 'en' ? 'README.md' : `README.${l}.md`;
    const s = fs.readFileSync(path.join(root, f), 'utf8');
    for (const x of LANGS) assert.ok(s.includes(x === 'en' ? '(README.md)' : `(README.${x}.md)`) || s.includes(`**`), f);
    assert.match(s, /STRAJA-android\.apk/); assert.match(s, /STRAJA-ios-unsigned\.ipa/);
    assert.ok(s.includes(`docs/media/${l}-home.webp`), f);
  }
});

test('capturile de ecran există pentru fiecare limbă', () => {
  for (const l of LANGS) for (const n of ['home', 'apps', 'monitor', 'guide'])
    assert.ok(fs.existsSync(path.join(root, `docs/media/${l}-${n}.webp`)), `${l}-${n}`);
  assert.ok(fs.existsSync(path.join(root, 'docs/logo.svg')));
});

test('clipurile video și posterele există pentru fiecare limbă', () => {
  for (const l of LANGS) for (const c of ['audit', 'apps', 'monitor', 'temp', 'guide']) {
    for (const ext of ['mp4', 'webp']) {
      const f = path.join(root, `docs/media/clip-${c}-${l}.${ext}`);
      assert.ok(fs.existsSync(f) && fs.statSync(f).size > 5000, `${c}-${l}.${ext}`);
    }
  }
});

test('capturile de ecran pentru funcții există în fiecare limbă', () => {
  for (const l of LANGS) for (const i of ['audit', 'monitor', 'open', 'temp', 'guide', 'private'])
    assert.ok(fs.statSync(path.join(root, `docs/media/feat-${i}-${l}.webp`)).size > 4000, `${i}-${l}`);
});
