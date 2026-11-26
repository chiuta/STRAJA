'use strict';
// Regresie pentru "ecran negru pe Android": rulează pagina așa cum o servește Capacitor pe Android,
// adică cu native-bridge.js REAL (fără mock pentru Capacitor.registerPlugin) și scripturile din index.html în ordinea lor.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const www = path.join(__dirname, '../www');
const bridgeFile = path.join(__dirname, '../node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js');
const tick = (ms = 25) => new Promise((r) => setTimeout(r, ms));

const METHODS = {
  Straja: ['scan', 'watchStatus', 'events', 'getSecure', 'setTexts', 'checkNow', 'watch', 'setSecure', 'acceptBaseline', 'clearEvents', 'openSettings', 'info'],
  LocalNotifications: ['checkPermissions', 'requestPermissions', 'schedule', 'cancel', 'addListener', 'removeListener', 'removeAllListeners']
};

function bootAndroid({ lang = 'de' } = {}) {
  const html = fs.readFileSync(path.join(www, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  const dom = new JSDOM(html.replace(/<script[^>]*><\/script>/g, ''), { runScripts: 'outside-only', url: 'https://localhost/', pretendToBeVisual: true });
  const w = dom.window;
  Object.defineProperty(w.navigator, 'language', { value: lang });
  w.scrollTo = () => {};
  const errors = [], posted = [];
  w.addEventListener('error', (e) => errors.push(e.message));
  w.addEventListener('unhandledrejection', (e) => errors.push('rejection: ' + e.reason));
  const R = {
    Straja: { watchStatus: { watching: false, hasBaseline: false }, events: { events: [] }, getSecure: { secure: true }, setTexts: {}, scan: { apps: [], assistantPkg: null, ts: 1 } },
    LocalNotifications: { checkPermissions: { display: 'granted' }, requestPermissions: { display: 'granted' }, schedule: {}, cancel: {}, addListener: {}, removeAllListeners: {} }
  };
  // exact ce injectează Capacitor în <head> înainte de scripturile paginii
  w.WEBVIEW_SERVER_URL = 'https://localhost';
  w.androidBridge = {
    postMessage(m) {
      const d = JSON.parse(m); posted.push(d);
      const out = (R[d.pluginId] || {})[d.methodName];
      setTimeout(() => w.Capacitor.fromNative({ callbackId: d.callbackId, pluginId: d.pluginId, methodName: d.methodName, success: out !== undefined, data: out || {}, error: out === undefined ? { message: 'not implemented' } : undefined }), 5);
    }
  };
  w.Capacitor = { PluginHeaders: Object.entries(METHODS).map(([name, ms]) => ({ name, methods: ms.map((n) => ({ name: n, rtype: 'promise' })) })) };
  w.eval(fs.readFileSync(bridgeFile, 'utf8'));
  for (const f of scripts) w.eval(fs.readFileSync(path.join(www, f), 'utf8'));
  return { w, errors, posted, scripts, $: (s) => w.document.querySelector(s) };
}

test('Android real: pagina se randează cu native-bridge.js + capacitor.js (nu rămâne ecran gol)', async () => {
  const b = bootAndroid();
  await tick(80);
  assert.equal(b.w.Capacitor.getPlatform(), 'android');
  assert.deepEqual(b.errors, []);
  assert.ok(b.$('#view').textContent.length > 80, 'interfața nu s-a randat');
  assert.ok(b.$('[data-act="scan"]'), 'lipsește butonul de analiză (mod Android)');
  assert.ok(b.posted.some((d) => d.pluginId === 'Straja' && d.methodName === 'getSecure'), 'apelurile ajung la plugin-ul nativ Straja');
  assert.ok(b.posted.some((d) => d.pluginId === 'Straja' && d.methodName === 'setTexts'), 'textele notificărilor sunt trimise nativ');
});

test('index.html încarcă runtime-ul Capacitor înaintea app.js și garda de pornire prima', () => {
  const b = bootAndroid();
  const s = b.scripts;
  assert.ok(s.indexOf('capacitor.js') > -1 && s.indexOf('capacitor.js') < s.indexOf('app.js'));
  assert.equal(s[0], 'boot.js');
});

test('www/capacitor.js este identic cu runtime-ul @capacitor/core instalat', () => {
  const strip = (t) => t.replace(/^\/\*[\s\S]*?\*\/\s*/, '');
  assert.equal(strip(fs.readFileSync(path.join(www, 'capacitor.js'), 'utf8')),
    strip(fs.readFileSync(path.join(__dirname, '../node_modules/@capacitor/core/dist/capacitor.js'), 'utf8')));
});

test('fără registerPlugin (runtime lipsă) interfața tot se randează, prin Capacitor.Plugins', async () => {
  const html = fs.readFileSync(path.join(www, 'index.html'), 'utf8');
  const dom = new JSDOM(html.replace(/<script[^>]*><\/script>/g, ''), { runScripts: 'outside-only', url: 'https://localhost/', pretendToBeVisual: true });
  const w = dom.window; w.scrollTo = () => {};
  const errors = []; w.addEventListener('error', (e) => errors.push(e.message));
  const stub = () => Promise.resolve({});
  w.Capacitor = { getPlatform: () => 'android', isNativePlatform: () => true, Plugins: { Straja: { watchStatus: stub, events: stub, getSecure: stub, setTexts: stub }, LocalNotifications: { addListener: stub } } };
  for (const f of ['boot.js', 'i18n.js', 'i18n.fr.js', 'i18n.it.js', 'i18n.es.js', 'i18n.pt.js', 'i18n.de.js', 'i18n.hu.js', 'data.js', 'core.js', 'app.js']) w.eval(fs.readFileSync(path.join(www, f), 'utf8'));
  await tick(40);
  assert.deepEqual(errors, []);
  assert.ok(w.document.querySelector('#view').textContent.length > 80);
});

test('garda de pornire afișează eroarea în loc de ecran gol', () => {
  const dom = new JSDOM('<main id="view"></main>', { runScripts: 'outside-only', url: 'https://localhost/' });
  dom.window.eval(fs.readFileSync(path.join(www, 'boot.js'), 'utf8'));
  dom.window.dispatchEvent(new dom.window.ErrorEvent('error', { message: 'boom' }));
  assert.match(dom.window.document.querySelector('#view').textContent, /boom/);
});
