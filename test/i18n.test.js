const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const I18n = require('../www/i18n.js');
const Core = require('../www/core.js');
const Data = require('../www/data.js');

['fr', 'it', 'es', 'pt', 'de', 'hu'].forEach((l) => require('../www/i18n.' + l + '.js'));
const ro = I18n.dict.ro, en = I18n.dict.en;
const ph = (s) => (s.match(/\{(\w+)\}/g) || []).sort().join(',');

test('cele 8 limbi au exact aceleași chei și aceleași {variabile}', () => {
  assert.deepEqual([...I18n.langs], ['en', 'ro', 'fr', 'it', 'es', 'pt', 'de', 'hu']);
  for (const l of I18n.langs) {
    const d = I18n.dict[l];
    assert.deepEqual(Object.keys(d).sort(), Object.keys(en).sort(), 'chei diferite în ' + l);
    for (const k of Object.keys(en)) {
      assert.equal(ph(d[k]), ph(en[k]), 'variabile diferite la ' + l + ':' + k);
      assert.ok(d[k].trim().length > 0, 'gol: ' + l + ':' + k);
    }
    assert.ok(I18n.names[l]);
  }
});

test('limbile diferite de engleză chiar sunt traduse (nu copii ale englezei)', () => {
  for (const l of I18n.langs.filter((x) => x !== 'en')) {
    const same = Object.keys(en).filter((k) => I18n.dict[l][k] === en[k] && !/^(app\.name|paths\.android\.title|paths\.ios\.title|signal\.|about\.version|ch\.a11y)/.test(k));
    assert.ok(same.length < 25, l + ' are prea multe texte identice cu EN: ' + same.slice(0, 8));
  }
});

test('toate cheile t(\'…\') din app.js există', () => {
  const src = fs.readFileSync(path.join(__dirname, '../www/app.js'), 'utf8');
  const keys = new Set([...src.matchAll(/\bt\('([a-zA-Z0-9_.]+)'(?!\s*\+)/g)].map((m) => m[1]));
  assert.ok(keys.size > 60, 'prea puține chei găsite: ' + keys.size);
  for (const k of keys) assert.ok(k in ro, 'lipsește în RO: ' + k);
});

test('chei dinamice: niveluri, permisiuni, evenimente, filtre, listă de verificare, căi', () => {
  const need = [];
  Core.LEVELS.forEach((l) => need.push('level.' + l));
  Core.PERM_KEYS.concat(Core.DECL_KEYS).forEach((p) => need.push('perm.' + p));
  Core.KIND_KEYS.forEach((k) => need.push('kind.' + k));
  ['known', 'probable', 'user'].forEach((k) => need.push('badge.ai.' + k));
  ['all', 'ai', 'notif', 'a11y', 'media'].forEach((f) => need.push('filter.' + f));
  ['android', 'ios', 'web'].forEach((m) => need.push('mode.' + m));
  ['auto', 'dark', 'light'].forEach((m) => need.push('theme.' + m));
  ['home', 'apps', 'monitor', 'guide', 'settings'].forEach((n) => need.push('nav.' + n));
  ['notif', 'a11y', 'assistant', 'media'].forEach((c) => need.push('ch.' + c, 'ch.' + c + '.d'));
  Data.CHECKLIST.forEach((i) => need.push('check.' + i.id, 'check.' + i.id + '.d'));
  for (let n = 1; n <= 5; n++) need.push('about.l' + n);
  for (let n = 1; n <= 4; n++) need.push('paths.android.' + n);
  for (let n = 1; n <= 3; n++) need.push('paths.ios.' + n);
  for (const k of need) assert.ok(k in ro && k in en, 'lipsește: ' + k);
});

test('make(): variabile și fallback', () => {
  const t = I18n.make('ro');
  assert.equal(t('guide.progress', { done: 3, total: 12 }), '3 din 12 făcute');
  assert.equal(I18n.make('en')('temp.min', { n: 15 }), '15 min');
  assert.equal(t('nu.exista'), 'nu.exista');
});

test('textul din ghid respectă articolul (Signal: versiuni și căi)', () => {
  assert.match(ro['signal.body'], /8\.35\.1/); assert.match(ro['signal.body'], /8\.37/);
  assert.match(en['signal.android'], /Screen security/); assert.match(en['signal.ios'], /Block Siri AI/);
});
