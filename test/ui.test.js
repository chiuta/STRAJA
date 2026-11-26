const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const www = path.join(__dirname, '../www');
const read = (f) => fs.readFileSync(path.join(www, f), 'utf8');
const plain = (x) => JSON.parse(JSON.stringify(x));
const tick = (ms = 15) => new Promise((r) => setTimeout(r, ms));

function boot({ cap, lang = 'ro', pre } = {}) {
  const dom = new JSDOM(read('index.html').replace(/<script[^>]*><\/script>/g, ''), { runScripts: 'outside-only', url: 'https://localhost/', pretendToBeVisual: true });
  const w = dom.window;
  Object.defineProperty(w.navigator, 'language', { value: lang });
  w.confirm = () => true;
  w.scrollTo = () => {};
  const copied = [];
  Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async (s) => { copied.push(s); } } });
  const errors = [];
  w.addEventListener('error', (e) => errors.push(e.message));
  if (cap) w.Capacitor = cap;
  if (pre) pre(w);
  for (const f of ['i18n.js', 'i18n.fr.js', 'i18n.it.js', 'i18n.es.js', 'i18n.pt.js', 'i18n.de.js', 'i18n.hu.js', 'data.js', 'core.js', 'app.js']) w.eval(read(f));
  return { w, dom, copied, errors, $: (s) => w.document.querySelector(s), $$: (s) => [...w.document.querySelectorAll(s)] };
}
const clickAct = (w, act, sel = '') => { const el = w.document.querySelector(`[data-act="${act}"]${sel}`); assert.ok(el, 'lipsește butonul ' + act + sel); el.click(); };

function androidMock() {
  const calls = [];
  const demo = require('../www/data.js').demoScan();
  const plugins = {
    Straja: {
      scan: async () => { calls.push(['scan']); return { apps: demo.apps, assistantPkg: demo.assistantPkg, ts: Date.now() }; },
      checkNow: async (a) => { calls.push(['checkNow', a]); return { events: [{ t: 1, pkg: 'com.facebook.stella', label: 'Meta AI', kind: 'notif' }] }; },
      events: async () => ({ events: [{ t: 1700000000000, pkg: 'com.facebook.stella', label: 'Meta AI', kind: 'perm:images' }] }),
      watchStatus: async () => ({ watching: false, hasBaseline: false }),
      watch: async (a) => { calls.push(['watch', a]); return { watching: !!a.enabled }; },
      getSecure: async () => ({ secure: true }),
      setSecure: async (a) => { calls.push(['setSecure', a]); return { secure: a.enabled }; },
      openSettings: async (a) => { calls.push(['openSettings', a]); },
      setTexts: async (a) => { calls.push(['setTexts', a]); },
      acceptBaseline: async () => { calls.push(['baseline']); },
      clearEvents: async () => { calls.push(['clearEvents']); }
    },
    LocalNotifications: {
      checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({ display: 'granted' }),
      schedule: async (a) => { calls.push(['schedule', a]); }, cancel: async (a) => { calls.push(['cancel', a]); },
      addListener: async (n, f) => { calls.push(['listener', n]); }
    }
  };
  return { calls, cap: { getPlatform: () => 'android', isNativePlatform: () => true, registerPlugin: (n) => plugins[n] } };
}

test('browser (demo): fiecare filă se randează fără erori și are conținut', async () => {
  const b = boot();
  await tick();
  for (const tab of ['home', 'apps', 'monitor', 'guide', 'settings']) {
    clickAct(b.w, 'tab', `[data-v="${tab}"]`);
    assert.ok(b.$('#view').textContent.length > 80, tab + ' gol');
    assert.ok(b.$('h1'), tab + ' fără titlu');
  }
  assert.deepEqual(b.errors, []);
  assert.equal(b.w.document.documentElement.lang, 'ro');
});

test('browser (demo): scanare, scor, filtre, căutare, marcaj AI', async () => {
  const b = boot();
  clickAct(b.w, 'scan'); await tick();
  assert.ok(b.$('.gauge'), 'gauge lipsă după scanare');
  assert.match(b.$('.lvl').className, /medium|high/);
  clickAct(b.w, 'tab', '[data-v="apps"]');
  const all = b.$$('.app').length;
  assert.ok(all >= 5, 'aplicații: ' + all);
  assert.ok(!b.$$('.app strong').some((e) => e.textContent === 'Signal'), 'Signal (fără semnale) nu e listat');
  clickAct(b.w, 'filter', '[data-v="ai"]');
  const ai = b.$$('.app').length; assert.ok(ai >= 3 && ai < all, 'filtru AI: ' + ai);
  clickAct(b.w, 'filter', '[data-v="all"]');
  const q = b.$('#q'); q.value = 'auto'; q.dispatchEvent(new b.w.Event('input', { bubbles: true }));
  assert.equal(b.$$('.app').length, 1);
  assert.match(b.$('.app').textContent, /Auto Clicker/);
  // marcare ca agent AI ridică scorul
  const before = Number(b.$('.score').textContent);
  clickAct(b.w, 'mark-ai'); await tick();
  assert.ok(Number(b.$('.score').textContent) > before, 'scorul trebuie să crească după marcare');
  assert.ok(b.w.__STRAJA__.state().userAi.includes('org.example.autoclicker'));
  assert.deepEqual(b.errors, []);
});

test('ghid: bifare persistentă, progres, schimbare limbă, temă', async () => {
  const b = boot();
  clickAct(b.w, 'tab', '[data-v="guide"]');
  const boxes = b.$$('input[data-chg="check"]');
  assert.equal(boxes.length, 12);
  boxes[0].checked = true; boxes[0].dispatchEvent(new b.w.Event('change', { bubbles: true }));
  assert.match(b.$('.card p.muted.small').textContent, /1 din 12/);
  assert.ok(JSON.parse(b.w.localStorage.getItem('straja.v1')).done.review);
  const sel = (() => { clickAct(b.w, 'tab', '[data-v="settings"]'); return b.$('#lg'); })();
  sel.value = 'en'; sel.dispatchEvent(new b.w.Event('change', { bubbles: true }));
  assert.equal(b.w.document.documentElement.lang, 'en');
  assert.match(b.$('#view').textContent, /Settings/);
  const th = b.$('#th'); th.value = 'dark'; th.dispatchEvent(new b.w.Event('change', { bubbles: true }));
  assert.equal(b.w.document.documentElement.getAttribute('data-theme'), 'dark');
  assert.deepEqual(b.errors, []);
});

test('ghid: mesaj pentru terți copiat; raport exportat', async () => {
  const b = boot();
  clickAct(b.w, 'tab', '[data-v="guide"]'); clickAct(b.w, 'copy-msg'); await tick();
  assert.match(b.copied[0], /nu trimiți mesajele sau pozele mele/);
  clickAct(b.w, 'tab', '[data-v="home"]'); clickAct(b.w, 'scan'); await tick(); clickAct(b.w, 'tab', '[data-v="settings"]'); clickAct(b.w, 'export'); await tick();
  assert.match(b.copied[1], /Raport STRAJA/); assert.match(b.copied[1], /Meta AI/); assert.match(b.copied[1], /\/10:/);
});

test('XSS: numele aplicației este escapat', async () => {
  const b = boot();
  clickAct(b.w, 'scan'); await tick();
  const s = b.w.__STRAJA__.state(); s.scan.apps[0].label = '<img src=x onerror=window.__pwn=1>';
  b.w.__STRAJA__.render(); clickAct(b.w, 'tab', '[data-v="apps"]');
  assert.equal(b.w.__pwn, undefined); assert.ok(!b.$('#applist img'));
  assert.match(b.$('#applist').innerHTML, /&lt;img/);
});

test('Android: scanare nativă, apelul checkNow, deschidere setări, monitor, ecran protejat', async () => {
  const m = androidMock();
  const b = boot({ cap: m.cap });
  await tick();
  assert.match(b.$('.chip.mode').textContent, /Audit complet/);
  clickAct(b.w, 'scan'); await tick(30);
  assert.ok(m.calls.some((c) => c[0] === 'scan'));
  assert.deepEqual(plain(m.calls.find((c) => c[0] === 'checkNow')[1]), { lang: 'ro' });
  assert.ok(b.$('.gauge'));
  // acțiune "retrage accesul" -> openSettings cu ținta corectă
  const first = b.$('[data-act="open"][data-target]');
  const target = first.dataset.target; first.click(); await tick();
  assert.deepEqual(plain(m.calls.find((c) => c[0] === 'openSettings')[1]), { target, pkg: first.dataset.pkg });
  // monitor
  clickAct(b.w, 'tab', '[data-v="monitor"]');
  assert.match(b.$('#view').textContent, /Meta AI/, 'jurnalul de evenimente trebuie afișat');
  const sw = b.$('input[data-chg="watch"]'); sw.checked = true; sw.dispatchEvent(new b.w.Event('change', { bubbles: true })); await tick();
  assert.deepEqual(plain(m.calls.find((c) => c[0] === 'watch')[1]), { enabled: true, minutes: 30, lang: 'ro' });
  const iv = b.$('#iv'); iv.value = '60'; iv.dispatchEvent(new b.w.Event('change', { bubbles: true })); await tick();
  assert.equal(m.calls.filter((c) => c[0] === 'watch').pop()[1].minutes, 60);
  clickAct(b.w, 'clear-events'); await tick();
  assert.ok(m.calls.some((c) => c[0] === 'clearEvents'));
  // ecran protejat
  clickAct(b.w, 'tab', '[data-v="settings"]');
  const sec = b.$('input[data-chg="secure"]'); assert.ok(sec.checked);
  sec.checked = false; sec.dispatchEvent(new b.w.Event('change', { bubbles: true }));
  assert.deepEqual(plain(m.calls.find((c) => c[0] === 'setSecure')[1]), { enabled: false });
  assert.ok(m.calls.some((c) => c[0] === 'listener' ), 'ascultător pentru atingerea reminderului');
  assert.deepEqual(b.errors, []);
});

test('Android: acces temporar programează o notificare locală; reminderul săptămânal', async () => {
  const m = androidMock();
  const b = boot({ cap: m.cap });
  clickAct(b.w, 'scan'); await tick(30);
  clickAct(b.w, 'tab', '[data-v="apps"]');
  clickAct(b.w, 'temp-open'); 
  const btn = b.$('[data-act="temp-set"][data-min="60"]'); assert.ok(btn);
  const before = Date.now(); btn.click(); await tick(30);
  const sch = m.calls.find((c) => c[0] === 'schedule')[1].notifications[0];
  assert.ok(sch.id >= 2000 && sch.id < 2 ** 31);
  const dt = sch.schedule.at.getTime() - before; assert.ok(dt > 59 * 60000 && dt < 61 * 60000, 'ora programată: ' + dt);
  assert.ok(sch.extra.pkg); assert.match(sch.body, /acces temporar/);
  assert.equal(b.w.__STRAJA__.state().temps.length, 1);
  // weekly
  clickAct(b.w, 'tab', '[data-v="guide"]');
  const w = b.$('input[data-chg="weekly"]'); w.checked = true; w.dispatchEvent(new b.w.Event('change', { bubbles: true })); await tick(30);
  const weekly = m.calls.filter((c) => c[0] === 'schedule').pop()[1].notifications[0];
  assert.equal(weekly.id, 1001); assert.deepEqual(plain(weekly.schedule.on), { weekday: 2, hour: 10, minute: 0 });
  assert.equal(b.w.__STRAJA__.state().weekly, true);
  assert.deepEqual(b.errors, []);
});

test('iOS: fără scanare; ghid cu 9 pași; registru manual + remindere', async () => {
  const m = androidMock(); m.cap.getPlatform = () => 'ios';
  const b = boot({ cap: m.cap });
  await tick();
  assert.match(b.$('.chip.mode').textContent, /Mod ghid/);
  assert.ok(!b.$('[data-act="scan"]'), 'iOS nu are buton de scanare');
  assert.match(b.$('#view').textContent, /iPhone: ghid, nu audit/);
  clickAct(b.w, 'tab', '[data-v="guide"]');
  assert.equal(b.$$('input[data-chg="check"]').length, 9);
  clickAct(b.w, 'tab', '[data-v="apps"]');
  b.$('#regname').value = 'ChatGPT'; b.$('#regform').dispatchEvent(new b.w.Event('submit', { bubbles: true, cancelable: true }));
  assert.match(b.$('#view').textContent, /ChatGPT/);
  clickAct(b.w, 'temp-open'); b.$('[data-act="temp-set"][data-min="15"]').click(); await tick(30);
  assert.ok(m.calls.some((c) => c[0] === 'schedule'));
  clickAct(b.w, 'tab', '[data-v="monitor"]'); assert.match(b.$('#view').textContent, /doar pe Android/);
  assert.ok(!m.calls.some((c) => c[0] === 'scan' || c[0] === 'watch'), 'iOS nu apelează pluginul Android');
  assert.deepEqual(b.errors, []);
});

test('toate cele 8 limbi se randează și se detectează din limba telefonului', async () => {
  for (const l of ['en', 'ro', 'fr', 'it', 'es', 'pt', 'de', 'hu']) {
    const b = boot({ lang: l + '-XX' }); await tick();
    assert.equal(b.w.document.documentElement.lang, l, 'limba detectată ' + l);
    for (const tab of ['home', 'apps', 'monitor', 'guide', 'settings']) { clickAct(b.w, 'tab', `[data-v="${tab}"]`); assert.ok(b.$('#view').textContent.length > 80); }
    assert.deepEqual(b.errors, [], l);
    assert.equal(b.$$('#lg option').length, 8);
  }
  const b = boot({ lang: 'ja-JP' }); assert.equal(b.w.document.documentElement.lang, 'en', 'limbă necunoscută -> engleză');
});

test('Android: textele notificărilor native sunt trimise în limba aleasă', async () => {
  const m = androidMock(); const b = boot({ cap: m.cap, lang: 'de' }); await tick(30);
  const first = m.calls.find((c) => c[0] === 'setTexts')[1].texts;
  assert.match(first.title, /neuer Zugriff/); assert.ok(first['kind.perm_images']); assert.ok(first['kind.notif']);
  clickAct(b.w, 'tab', '[data-v="settings"]');
  const sel = b.$('#lg'); sel.value = 'fr'; sel.dispatchEvent(new b.w.Event('change', { bubbles: true })); await tick();
  assert.match(m.calls.filter((c) => c[0] === 'setTexts').pop()[1].texts.title, /nouvel accès/);
});

test('reset șterge datele locale', async () => {
  const b = boot();
  clickAct(b.w, 'scan'); await tick();
  clickAct(b.w, 'tab', '[data-v="settings"]'); clickAct(b.w, 'reset'); await tick();
  assert.equal(b.w.__STRAJA__.state().scan, null);
  assert.equal(b.w.localStorage.getItem('straja.v1'), null);
});

test('fără resurse externe: nicio URL http(s) în www/', () => {
  for (const f of fs.readdirSync(www)) {
    const s = read(f).replace(/http:\/\/www\.w3\.org\/\d+\/svg/g, '');
    assert.doesNotMatch(s, /https?:\/\//, 'URL extern în ' + f);
  }
});
