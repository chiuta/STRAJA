const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../www/core.js');
const Data = require('../www/data.js');

const base = { pkg: 'x.y', label: 'X', system: false, notif: false, a11y: false, readsScreen: false, assistant: false, perms: [], declared: [] };
const mk = (o) => Object.assign({}, base, o);
const dec = (o) => { const a = mk(o); const ai = Core.detectAi(a, Data.KNOWN_AI, []); return Object.assign({}, a, { ai, risk: Core.appRisk(a, ai, false) }); };

test('detectAi: listă cunoscută, euristică, marcaj manual', () => {
  assert.equal(Core.detectAi(mk({ pkg: 'com.openai.chatgpt' }), Data.KNOWN_AI, []), 'known');
  assert.equal(Core.detectAi(mk({ pkg: 'com.foo.superassistant.app', label: 'Foo' }), Data.KNOWN_AI, []), null, 'fără delimitatori nu e potrivire');
  assert.equal(Core.detectAi(mk({ pkg: 'com.foo.ai.helper', label: 'Foo' }), Data.KNOWN_AI, []), 'probable');
  assert.equal(Core.detectAi(mk({ pkg: 'com.foo.bar', label: 'Super Copilot' }), Data.KNOWN_AI, []), 'probable');
  assert.equal(Core.detectAi(mk({ pkg: 'com.foo.bar', label: 'Calculator' }), Data.KNOWN_AI, []), null);
  assert.equal(Core.detectAi(mk({ pkg: 'com.foo.bar' }), Data.KNOWN_AI, ['com.foo.bar']), 'user');
  assert.equal(Core.detectAi(mk({ pkg: 'com.foo.bar', label: 'Maine' }), Data.KNOWN_AI, []), null, '"Maine" nu conține cuvântul "ai"');
});

test('appRisk: căile între aplicații contează; permisiunile obișnuite abia pentru agenți AI', () => {
  const plainCam = Core.appRisk(mk({ perms: ['images', 'mic', 'contacts'] }), null, false);
  assert.ok(plainCam.score < 2, 'o aplicație obișnuită cu foto/mic nu e alarmantă: ' + plainCam.score);
  const agent = Core.appRisk(mk({ perms: ['images', 'mic', 'contacts'] }), 'known', false);
  assert.ok(agent.score > plainCam.score * 3);
  const listener = Core.appRisk(mk({ notif: true }), null, false);
  assert.equal(listener.score, 3);
  const a11y = Core.appRisk(mk({ a11y: true, readsScreen: true }), null, false);
  assert.equal(a11y.score, 5);
  assert.deepEqual(a11y.reasons, ['a11y', 'reads']);
});

test('appRisk: plafon 10, sistem și acceptat reduc scorul', () => {
  const all = mk({ notif: true, a11y: true, readsScreen: true, assistant: true, perms: ['images', 'sms', 'video'], declared: ['allfiles'] });
  assert.equal(Core.appRisk(all, 'known', false).score, 10);
  const sys = Core.appRisk(mk({ a11y: true, readsScreen: true, system: true }), null, false).score;
  assert.ok(sys < 5 && sys > 0);
  const t = Core.appRisk(mk({ notif: true }), null, true).score;
  assert.ok(t < 3);
  // asistentul implicit nu e redus ca "sistem"
  assert.equal(Core.appRisk(mk({ assistant: true, system: true }), null, false).score, 4);
});

test('deviceRisk: telefon curat = scăzut, trei agenți intruzivi = ridicat', () => {
  const clean = Core.deviceRisk([dec({ notif: true, label: 'Ceas' })]);
  assert.equal(clean.level, 'low');
  const nasty = Core.deviceRisk([1, 2, 3].map((i) => dec({ pkg: 'com.openai.chatgpt', notif: true, a11y: true, readsScreen: true, perms: ['images'] })));
  assert.equal(nasty.level, 'high');
  assert.ok(nasty.risk <= 100 && nasty.risk >= 55);
  const demo = Core.deviceRisk(Data.demoScan().apps.map((a) => dec(a)));
  assert.ok(['medium', 'high'].includes(demo.level), 'demo ar trebui să arate risc: ' + demo.level);
  assert.equal(Core.levelOf(24), 'low'); assert.equal(Core.levelOf(25), 'medium'); assert.equal(Core.levelOf(55), 'high');
});

test('progress: numără doar elementele aplicabile platformei', () => {
  const a = Core.progress(Data.CHECKLIST, {}, 'android');
  const i = Core.progress(Data.CHECKLIST, {}, 'ios');
  assert.equal(a.total, 12); assert.equal(i.total, 9);
  assert.equal(Core.progress(Data.CHECKLIST, { review: true, notif: true }, 'ios').done, 1, 'notif e doar Android');
  assert.equal(Core.progress(Data.CHECKLIST, { review: true }, 'android').pct, 8);
});

test('sortApps și eventKindKey', () => {
  const l = Core.sortApps([dec({ label: 'B', notif: true }), dec({ label: 'A', notif: true }), dec({ label: 'C', a11y: true, readsScreen: true })]);
  assert.deepEqual(l.map((x) => x.label), ['C', 'A', 'B']);
  assert.equal(Core.eventKindKey('perm:images'), 'perm_images');
});
