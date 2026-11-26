/* STRAJA - interfața. Fără rețea, fără biblioteci externe. */
(function () {
  'use strict';

  var Core = window.StrajaCore, Data = window.StrajaData, I18n = window.StrajaI18n;
  var VERSION = '1.0.0';
  var cap = window.Capacitor || null;
  var platform = cap && cap.getPlatform ? cap.getPlatform() : 'web';
  var isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  var isAndroid = isNative && platform === 'android';
  var isIos = isNative && platform === 'ios';
  var Straja = isAndroid ? cap.registerPlugin('Straja') : null;
  var LN = isNative ? cap.registerPlugin('LocalNotifications') : null;
  var guidePlatform = isIos ? 'ios' : 'android'; // în browser arătăm varianta Android

  // ---------------------------------------------------------------- stare
  var KEY = 'straja.v1';
  var DEFAULTS = { lang: null, theme: 'auto', done: {}, userAi: [], trusted: [], scan: null, weekly: false, temps: [], registry: [], watchMin: 30 };
  var S = load();
  var ui = { tab: 'home', filter: 'all', q: '', tempFor: null, events: [], watching: false, secure: true, busy: false, lastAuto: 0 };

  function load() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { s = {}; }
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) { out[k] = s[k] !== undefined ? s[k] : JSON.parse(JSON.stringify(DEFAULTS[k])); });
    return out;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* stocare indisponibilă */ } }

  function lang() {
    if (S.lang && I18n.langs.indexOf(S.lang) >= 0) return S.lang;
    var n = String(navigator.language || 'en').slice(0, 2).toLowerCase();
    return I18n.langs.indexOf(n) >= 0 ? n : 'en';
  }
  function t(k, v) { return I18n.make(lang())(k, v); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function fmtMin(n) {
    if (n >= 1440) return t('temp.days', { n: n / 1440 });
    if (n >= 60) return t('temp.hours', { n: n / 60 });
    return t('temp.min', { n: n });
  }
  function fmtTime(ts) {
    try { return new Date(ts).toLocaleString(lang()); } catch (e) { return String(ts); }
  }
  function $(id) { return document.getElementById(id); }

  // ---------------------------------------------------------------- date derivate
  function apps() {
    if (!S.scan) return [];
    return S.scan.apps.map(function (a) {
      var ai = Core.detectAi(a, Data.KNOWN_AI, S.userAi);
      var trusted = S.trusted.indexOf(a.pkg) >= 0;
      return Object.assign({}, a, { ai: ai, trusted: trusted, risk: Core.appRisk(a, ai, trusted) });
    });
  }
  // Aplicațiile obișnuite cu doar câteva permisiuni nu apar: lista ar deveni zgomot.
  function relevant(list) {
    return list.filter(function (a) { return a.ai || a.notif || a.a11y || a.assistant || a.risk.score >= 1.5; });
  }
  function mediaOf(a) { return (a.perms || []).some(function (p) { return ['images', 'video', 'storage', 'selected', 'sms'].indexOf(p) >= 0; }); }
  function primary(a) {
    if (a.assistant) return { target: 'assistant', key: 'act.revoke.assistant' };
    if (a.a11y) return { target: 'accessibility', key: 'act.revoke.a11y' };
    if (a.notif) return { target: 'notifications', key: 'act.revoke.notif' };
    return { target: 'app', key: 'act.app' };
  }

  // ---------------------------------------------------------------- randare
  var ICONS = {
    home: '<path d="M12 2 4 5.2v6c0 5 3.4 9.5 8 10.8 4.6-1.3 8-5.8 8-10.8v-6z"/>',
    apps: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    monitor: '<circle cx="12" cy="12" r="3"/><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/>',
    guide: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M9 9h6M9 13h6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>'
  };
  var TABS = ['home', 'apps', 'monitor', 'guide', 'settings'];

  function renderNav() {
    $('tabs').innerHTML = TABS.map(function (k) {
      var on = ui.tab === k;
      return '<button type="button" class="tab' + (on ? ' on' : '') + '" data-act="tab" data-v="' + k + '"' + (on ? ' aria-current="page"' : '') + '>' +
        '<svg viewBox="0 0 24 24" aria-hidden="true" class="ic">' + ICONS[k] + '</svg><span>' + esc(t('nav.' + k)) + '</span></button>';
    }).join('');
  }

  function modeChip() {
    var m = isAndroid ? 'android' : isIos ? 'ios' : 'web';
    return '<span class="chip mode ' + m + '">' + esc(t('mode.' + m)) + '</span>';
  }

  function header() {
    return '<header class="hdr"><div><h1 id="title">' + esc(t('app.name')) + '</h1><p class="tag">' + esc(t('app.tag')) + '</p></div>' + modeChip() + '</header>';
  }

  function gauge(risk, level) {
    var c = 2 * Math.PI * 54;
    return '<svg class="gauge ' + level + '" viewBox="0 0 128 128" role="img" aria-label="' + esc(t('home.risk')) + ' ' + risk + '/100">' +
      '<circle class="g-bg" cx="64" cy="64" r="54"/>' +
      '<circle class="g-fg" cx="64" cy="64" r="54" stroke-dasharray="' + (c * risk / 100).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 64 64)"/>' +
      '<text x="64" y="72" text-anchor="middle" class="g-num">' + risk + '</text></svg>';
  }

  function hygieneBlock() {
    var p = Core.progress(Data.CHECKLIST, S.done, guidePlatform);
    return '<section class="card"><h2>' + esc(t('home.hygiene')) + '</h2>' +
      '<progress max="100" value="' + p.pct + '" aria-label="' + esc(t('home.hygiene')) + '"></progress>' +
      '<p class="muted">' + esc(t('guide.progress', { done: p.done, total: p.total })) + '</p>' +
      '<button type="button" class="btn ghost" data-act="tab" data-v="guide">' + esc(t('nav.guide')) + '</button></section>';
  }

  function viewHome() {
    var h = header();
    if (!isAndroid && !demo()) {
      return h + '<section class="card"><h2>' + esc(t('ios.title')) + '</h2><p>' + esc(t('ios.body')) + '</p></section>' + hygieneBlock() + whyCard();
    }
    var banner = demo() ? '<p class="banner" role="note">' + esc(t('web.demo')) + '</p>' : '';
    var list = apps();
    var scanBtn = '<button type="button" class="btn primary" data-act="scan"' + (ui.busy ? ' disabled' : '') + '>' + esc(ui.busy ? t('home.scanning') : t('home.scan')) + '</button>';
    if (!S.scan) {
      return h + banner + '<section class="card"><h2>' + esc(t('home.first.title')) + '</h2><p>' + esc(t('home.first.body')) + '</p>' + scanBtn + '</section>' + whyCard();
    }
    var d = Core.deviceRisk(list);
    var rel = Core.sortApps(relevant(list));
    var summary = (d.counts.ai || d.counts.notif || d.counts.a11y)
      ? t('home.summary', { ai: d.counts.ai, notif: d.counts.notif, a11y: d.counts.a11y }) : t('home.summary.none');
    var assistantName = S.scan.assistantPkg ? (nameOf(S.scan.assistantPkg, list) || S.scan.assistantPkg) : t('ch.none');
    var chans =
      chan('ch.notif', d.counts.notif) + chan('ch.a11y', d.counts.a11y + (d.counts.reads ? ' (' + d.counts.reads + ')' : '')) +
      chan('ch.assistant', esc(assistantName), true) + chan('ch.media', d.counts.media);
    var top = rel.filter(function (a) { return a.risk.score >= 2; }).slice(0, 3).map(function (a) {
      var p = primary(a);
      return '<li class="row"><div><strong>' + esc(a.label) + '</strong><span class="muted small">' + esc(reasonText(a)) + '</span></div>' +
        '<button type="button" class="btn small" data-act="open" data-target="' + p.target + '" data-pkg="' + esc(a.pkg) + '">' + esc(t(p.key)) + '</button></li>';
    }).join('');
    return h + banner +
      '<section class="card hero"><div class="gwrap">' + gauge(d.risk, d.level) + '</div><div><h2 class="lvl ' + d.level + '">' + esc(t('level.' + d.level)) + '</h2>' +
      '<p>' + esc(summary) + '</p><p class="muted small">' + esc(t('home.lastscan', { when: fmtTime(S.scan.ts) })) + '</p>' + scanBtn + '</div></section>' +
      '<section class="card"><h2>' + esc(t('home.channels')) + '</h2><div class="chans">' + chans + '</div></section>' +
      (top ? '<section class="card"><h2>' + esc(t('home.top')) + '</h2><ul class="list">' + top + '</ul></section>' : '') +
      hygieneBlock() + whyCard();
  }
  function chan(key, val, raw) {
    return '<div class="chan"><span class="cv">' + (raw ? val : esc(String(val))) + '</span><span class="cn">' + esc(t(key)) + '</span><span class="muted small">' + esc(t(key + '.d')) + '</span></div>';
  }
  function whyCard() { return '<section class="card soft"><p>' + esc(t('home.why')) + '</p></section>'; }
  function nameOf(pkg, list) {
    for (var i = 0; i < list.length; i++) if (list[i].pkg === pkg) return list[i].label;
    return Data.KNOWN_AI[pkg] || null;
  }
  function reasonText(a) {
    return a.risk.reasons.map(function (r) {
      if (r === 'reads') return t('badge.reads');
      if (Core.PERM_KEYS.indexOf(r) >= 0 || Core.DECL_KEYS.indexOf(r) >= 0) return t('perm.' + r);
      return t('ch.' + (r === 'notif' ? 'notif' : r === 'a11y' ? 'a11y' : 'assistant'));
    }).join(' · ');
  }
  function demo() { return !isNative; }

  // ---- aplicații
  function appCard(a) {
    var b = [];
    if (a.ai) b.push('<span class="chip ai">' + esc(t('badge.ai.' + a.ai)) + '</span>');
    if (a.system) b.push('<span class="chip">' + esc(t('badge.system')) + '</span>');
    if (a.trusted) b.push('<span class="chip ok">' + esc(t('badge.trusted')) + '</span>');
    if (a.readsScreen) b.push('<span class="chip warn">' + esc(t('badge.reads')) + '</span>');
    var tags = a.risk.reasons.filter(function (r) { return r !== 'reads'; }).map(function (r) {
      var txt = (Core.PERM_KEYS.indexOf(r) >= 0 || Core.DECL_KEYS.indexOf(r) >= 0) ? t('perm.' + r) : t('ch.' + (r === 'notif' ? 'notif' : r === 'a11y' ? 'a11y' : 'assistant'));
      return '<span class="chip soft">' + esc(txt) + '</span>';
    }).join('');
    var acts = '';
    if (a.notif) acts += btn('open', t('act.revoke.notif'), { target: 'notifications', pkg: a.pkg });
    if (a.a11y) acts += btn('open', t('act.revoke.a11y'), { target: 'accessibility', pkg: a.pkg });
    if (a.assistant) acts += btn('open', t('act.revoke.assistant'), { target: 'assistant', pkg: a.pkg });
    acts += btn('open', t('act.app'), { target: 'app', pkg: a.pkg });
    acts += btn('temp-open', t('act.temp'), { pkg: a.pkg });
    acts += btn('mark-ai', a.ai === 'user' ? t('act.unmarkai') : t('act.markai'), { pkg: a.pkg });
    acts += btn('trust', a.trusted ? t('act.untrust') : t('act.trust'), { pkg: a.pkg });
    var picker = '';
    if (ui.tempFor === a.pkg) {
      picker = '<div class="picker" role="group" aria-label="' + esc(t('temp.title')) + '"><span class="small">' + esc(t('temp.title')) + '</span>' +
        Data.TEMP_MINUTES.map(function (m) { return btn('temp-set', fmtMin(m), { pkg: a.pkg, label: a.label, min: m }, 'btn small primary'); }).join('') + '</div>';
    }
    return '<li class="app"><div class="app-h"><div><strong>' + esc(a.label) + '</strong><span class="pkg">' + esc(a.pkg) + '</span></div>' +
      '<span class="score" aria-label="' + a.risk.score + '/10">' + a.risk.score + '</span></div>' +
      '<meter min="0" max="10" low="3" high="6" optimum="0" value="' + a.risk.score + '"></meter>' +
      '<div class="chips">' + b.join('') + tags + '</div><div class="acts">' + acts + '</div>' + picker + '</li>';
  }
  function btn(act, label, data, cls) {
    var attrs = '';
    Object.keys(data || {}).forEach(function (k) { attrs += ' data-' + k + '="' + esc(data[k]) + '"'; });
    return '<button type="button" class="' + (cls || 'btn small') + '" data-act="' + act + '"' + attrs + '>' + esc(label) + '</button>';
  }
  function filtered() {
    var q = ui.q.trim().toLowerCase();
    return Core.sortApps(relevant(apps())).filter(function (a) {
      if (q && (a.label + ' ' + a.pkg).toLowerCase().indexOf(q) < 0) return false;
      if (ui.filter === 'ai') return !!a.ai;
      if (ui.filter === 'notif') return a.notif;
      if (ui.filter === 'a11y') return a.a11y;
      if (ui.filter === 'media') return mediaOf(a);
      return true;
    });
  }
  function appListHtml() {
    if (!S.scan) return '<p class="muted">' + esc(t('apps.noscan')) + '</p>';
    var l = filtered();
    return l.length ? '<ul class="apps">' + l.map(appCard).join('') + '</ul>' : '<p class="muted">' + esc(t('apps.empty')) + '</p>';
  }
  function viewApps() {
    if (isIos) return viewRegistry();
    var chips = ['all', 'ai', 'notif', 'a11y', 'media'].map(function (f) {
      return '<button type="button" class="pill' + (ui.filter === f ? ' on' : '') + '" data-act="filter" data-v="' + f + '" aria-pressed="' + (ui.filter === f) + '">' + esc(t('filter.' + f)) + '</button>';
    }).join('');
    return header() + '<section class="card"><h2>' + esc(t('apps.title')) + '</h2>' +
      '<label class="lbl" for="q">' + esc(t('apps.search')) + '</label><input id="q" type="search" class="inp" value="' + esc(ui.q) + '" autocomplete="off">' +
      '<div class="pills">' + chips + '</div></section><div id="applist">' + appListHtml() + '</div>' +
      (S.scan ? '' : '<button type="button" class="btn primary" data-act="scan">' + esc(t('home.scan')) + '</button>');
  }
  function viewRegistry() {
    var items = S.registry.map(function (r, i) {
      var picker = ui.tempFor === 'ios:' + r.id
        ? '<div class="picker"><span class="small">' + esc(t('temp.title')) + '</span>' + Data.TEMP_MINUTES.map(function (m) { return btn('temp-set', fmtMin(m), { pkg: 'ios:' + r.id, label: r.name, min: m }, 'btn small primary'); }).join('') + '</div>' : '';
      return '<li class="app"><div class="app-h"><strong>' + esc(r.name) + '</strong></div><div class="acts">' +
        btn('temp-open', t('act.temp'), { pkg: 'ios:' + r.id }) + btn('reg-del', t('act.remove'), { i: i }) + '</div>' + picker + '</li>';
    }).join('');
    return header() + '<section class="card"><h2>' + esc(t('ios.reg.title')) + '</h2><p>' + esc(t('ios.reg.desc')) + '</p>' +
      '<form id="regform" class="row"><label class="sr" for="regname">' + esc(t('ios.reg.ph')) + '</label><input id="regname" class="inp" placeholder="' + esc(t('ios.reg.ph')) + '" autocomplete="off">' +
      '<button class="btn primary" type="submit">' + esc(t('act.add')) + '</button></form></section>' +
      (items ? '<ul class="apps">' + items + '</ul>' : '<p class="muted">' + esc(t('ios.reg.empty')) + '</p>') + tempsBlock();
  }
  function tempsBlock() {
    var now = Date.now();
    var l = S.temps.filter(function (x) { return x.at > now; });
    if (!l.length) return '';
    return '<section class="card"><h2>' + esc(t('temp.list')) + '</h2><ul class="list">' + l.map(function (x) {
      return '<li class="row"><div><strong>' + esc(x.label) + '</strong><span class="muted small">' + esc(t('temp.at', { when: fmtTime(x.at) })) + '</span></div>' +
        btn('temp-cancel', t('act.cancel'), { id: x.id }) + '</li>';
    }).join('') + '</ul></section>';
  }

  // ---- monitor
  function viewMonitor() {
    var h = header() + '<section class="card"><h2>' + esc(t('monitor.title')) + '</h2><p>' + esc(t('monitor.desc')) + '</p>';
    if (!isAndroid && !demo()) return h + '<p class="banner">' + esc(t('monitor.na')) + '</p></section>';
    var iv = Data.WATCH_MINUTES.map(function (m) { return '<option value="' + m + '"' + (S.watchMin === m ? ' selected' : '') + '>' + esc(fmtMin(m)) + '</option>'; }).join('');
    var ev = ui.events.length ? '<ul class="list">' + ui.events.map(function (e) {
      return '<li class="row"><div><strong>' + esc(e.label) + '</strong><span class="muted small">' + esc(t('kind.' + Core.eventKindKey(e.kind))) + ' · ' + esc(fmtTime(e.t)) + '</span></div>' +
        btn('open', t('act.app'), { target: 'app', pkg: e.pkg }) + '</li>';
    }).join('') + '</ul>' : '<p class="muted">' + esc(t('monitor.noevents')) + '</p>';
    return h +
      '<label class="switch"><input type="checkbox" data-chg="watch"' + (ui.watching ? ' checked' : '') + '><span>' + esc(t('monitor.on')) + '</span></label>' +
      '<label class="lbl" for="iv">' + esc(t('monitor.interval')) + '</label><select id="iv" class="inp" data-chg="interval">' + iv + '</select>' +
      '<p class="muted small">' + esc(t('monitor.note')) + '</p>' +
      '<div class="acts">' + btn('check-now', t('monitor.check'), {}) + btn('baseline', t('monitor.baseline'), {}) + '</div></section>' +
      '<section class="card"><h2>' + esc(t('monitor.events')) + '</h2>' + ev +
      (ui.events.length ? btn('clear-events', t('monitor.clear'), {}) : '') + '</section>';
  }

  // ---- ghid
  function viewGuide() {
    var items = Data.CHECKLIST.filter(function (i) { return Core.applicable(i, guidePlatform); }).map(function (i) {
      return '<li class="chk"><label><input type="checkbox" data-chg="check" data-id="' + i.id + '"' + (S.done[i.id] ? ' checked' : '') + '><span><strong>' + esc(t('check.' + i.id)) + '</strong><span class="muted small block">' + esc(t('check.' + i.id + '.d')) + '</span></span></label></li>';
    }).join('');
    var p = Core.progress(Data.CHECKLIST, S.done, guidePlatform);
    var paths = ['android', 'ios'].map(function (os) {
      var n = os === 'android' ? 4 : 3, lis = '';
      for (var k = 1; k <= n; k++) lis += '<li>' + esc(t('paths.' + os + '.' + k)) + '</li>';
      return '<h3>' + esc(t('paths.' + os + '.title')) + '</h3><ul class="plain">' + lis + '</ul>';
    }).join('');
    return header() + '<section class="card"><h2>' + esc(t('guide.title')) + '</h2><p>' + esc(t('guide.intro')) + '</p>' +
      '<progress max="100" value="' + p.pct + '"></progress><p class="muted small">' + esc(t('guide.progress', { done: p.done, total: p.total })) + '</p>' +
      '<ul class="checks">' + items + '</ul></section>' +
      '<section class="card"><h2>' + esc(t('guide.signal')) + '</h2><p>' + esc(t('signal.body')) + '</p><ul class="plain"><li>' + esc(t('signal.android')) + '</li><li>' + esc(t('signal.ios')) + '</li></ul><p class="muted small">' + esc(t('signal.note')) + '</p></section>' +
      '<section class="card"><details><summary>' + esc(t('guide.paths')) + '</summary>' + paths + '</details></section>' +
      '<section class="card"><h2>' + esc(t('guide.others')) + '</h2><p>' + esc(t('others.body')) + '</p><blockquote>' + esc(t('others.msg')) + '</blockquote>' + btn('copy-msg', t('act.copy'), {}) + '</section>' +
      '<section class="card"><h2>' + esc(t('guide.weekly')) + '</h2><p class="muted">' + esc(t('weekly.desc')) + '</p>' +
      '<label class="switch"><input type="checkbox" data-chg="weekly"' + (S.weekly ? ' checked' : '') + '><span>' + esc(t('guide.weekly')) + '</span></label></section>';
  }

  // ---- setări
  function viewSettings() {
    var langs = I18n.langs.map(function (l) { return '<option value="' + l + '" lang="' + l + '"' + (lang() === l ? ' selected' : '') + '>' + esc(I18n.names[l]) + '</option>'; }).join('');
    var themes = ['auto', 'dark', 'light'].map(function (k) { return '<option value="' + k + '"' + (S.theme === k ? ' selected' : '') + '>' + esc(t('theme.' + k)) + '</option>'; }).join('');
    var limits = [1, 2, 3, 4, 5].map(function (n) { return '<li>' + esc(t('about.l' + n)) + '</li>'; }).join('');
    return header() + '<section class="card"><h2>' + esc(t('settings.title')) + '</h2>' +
      '<label class="lbl" for="lg">' + esc(t('settings.lang')) + '</label><select id="lg" class="inp" data-chg="lang">' + langs + '</select>' +
      '<label class="lbl" for="th">' + esc(t('settings.theme')) + '</label><select id="th" class="inp" data-chg="theme">' + themes + '</select>' +
      (isAndroid ? '<label class="switch"><input type="checkbox" data-chg="secure"' + (ui.secure ? ' checked' : '') + '><span>' + esc(t('settings.secure')) + '</span></label><p class="muted small">' + esc(t('settings.secure.d')) + '</p>' : '') +
      '<div class="acts">' + (S.scan ? btn('export', t('settings.export'), {}) : '') + btn('reset', t('settings.reset'), {}, 'btn small danger') + '</div></section>' +
      '<section class="card"><h2>' + esc(t('about.title')) + '</h2><p>' + esc(t('about.privacy')) + '</p><h3>' + esc(t('about.limits.title')) + '</h3><ul class="plain">' + limits + '</ul>' +
      '<p class="muted small">' + esc(t('about.src')) + '</p><p class="muted small">' + esc(t('about.version', { v: VERSION })) + '</p></section>';
  }

  function render() {
    document.documentElement.lang = lang();
    document.documentElement.setAttribute('data-theme', S.theme === 'auto' ? '' : S.theme);
    var v = { home: viewHome, apps: viewApps, monitor: viewMonitor, guide: viewGuide, settings: viewSettings }[ui.tab]();
    $('view').innerHTML = v;
    renderNav();
  }

  // ---------------------------------------------------------------- acțiuni
  var toastTimer;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
      ta.remove(); return ok;
    }
  }

  async function ensureNotif() {
    if (!LN) return true;
    try {
      var p = await LN.checkPermissions();
      if (p.display !== 'granted') p = await LN.requestPermissions();
      return p.display === 'granted';
    } catch (e) { return false; }
  }

  // Textele notificărilor create de partea nativă (în limba aleasă).
  function syncTexts() {
    if (!Straja) return;
    var o = { title: t('monitor.notif.title'), channel: t('monitor.notif.channel') };
    Core.KIND_KEYS.forEach(function (k) { o['kind.' + k] = t('kind.' + k); });
    try { Straja.setTexts({ texts: o }); } catch (e) { /* notificările folosesc engleza */ }
  }

  async function doScan(silent) {
    if (!silent) { ui.busy = true; render(); }
    try {
      var res = Straja ? await Straja.scan() : Data.demoScan();
      S.scan = { apps: res.apps || [], assistantPkg: res.assistantPkg || '', ts: res.ts || Date.now() };
      save();
      if (Straja) {
        var c = await Straja.checkNow({ lang: lang() });
        var n = (c.events || []).length;
        var e = await Straja.events();
        ui.events = e.events || [];
        if (n) toast(t('monitor.new', { n: n }));
      }
    } catch (e) {
      if (!silent) toast(t('err.scan'));
    }
    ui.busy = false; render();
  }

  async function openSettings(target, pkg) {
    if (!Straja) { toast('(demo) ' + target + (pkg ? ' · ' + pkg : '')); return; }
    try { await Straja.openSettings({ target: target, pkg: pkg || '' }); } catch (e) { toast(t('err.settings')); }
  }

  async function scheduleTemp(pkg, label, min) {
    ui.tempFor = null;
    if (!LN) { toast(t('temp.set', { app: label, when: fmtMin(min) }) + ' (demo)'); render(); return; }
    if (!(await ensureNotif())) { toast(t('temp.denied')); render(); return; }
    var id = 2000 + Math.floor(Math.random() * 1000000);
    var at = new Date(Date.now() + min * 60000);
    try {
      await LN.schedule({ notifications: [{ id: id, title: t('temp.notif.title'), body: t('temp.notif.body', { app: label }), schedule: { at: at, allowWhileIdle: true }, extra: { pkg: pkg } }] });
      S.temps.push({ id: id, pkg: pkg, label: label, at: at.getTime() });
      save();
      toast(t('temp.set', { app: label, when: fmtMin(min) }));
    } catch (e) { toast(t('err.settings')); }
    render();
  }

  async function setWeekly(on) {
    if (on && !(await ensureNotif())) { toast(t('temp.denied')); render(); return; }
    if (LN) {
      try {
        if (on) await LN.schedule({ notifications: [{ id: 1001, title: t('weekly.notif.title'), body: t('weekly.notif.body'), schedule: { on: { weekday: 2, hour: 10, minute: 0 }, allowWhileIdle: true } }] });
        else await LN.cancel({ notifications: [{ id: 1001 }] });
      } catch (e) { /* reminderul nu s-a putut programa */ }
    }
    S.weekly = on; save(); render();
  }

  async function setWatch(on) {
    if (!Straja) { ui.watching = on; render(); return; }
    try {
      if (on) await ensureNotif();
      var r = await Straja.watch({ enabled: on, minutes: S.watchMin, lang: lang() });
      ui.watching = !!r.watching;
    } catch (e) { ui.watching = false; toast(t('err.scan')); }
    render();
  }

  var actions = {
    tab: function (el) { ui.tab = el.dataset.v; ui.tempFor = null; render(); window.scrollTo(0, 0); },
    scan: function () { return doScan(false); },
    open: function (el) { return openSettings(el.dataset.target, el.dataset.pkg); },
    filter: function (el) { ui.filter = el.dataset.v; render(); },
    'temp-open': function (el) { ui.tempFor = ui.tempFor === el.dataset.pkg ? null : el.dataset.pkg; render(); },
    'temp-set': function (el) { return scheduleTemp(el.dataset.pkg, el.dataset.label, parseInt(el.dataset.min, 10)); },
    'temp-cancel': async function (el) {
      var id = parseInt(el.dataset.id, 10);
      try { if (LN) await LN.cancel({ notifications: [{ id: id }] }); } catch (e) { /* deja executat */ }
      S.temps = S.temps.filter(function (x) { return x.id !== id; }); save(); render();
    },
    'mark-ai': function (el) {
      var i = S.userAi.indexOf(el.dataset.pkg);
      if (i >= 0) S.userAi.splice(i, 1); else S.userAi.push(el.dataset.pkg);
      save(); render();
    },
    trust: function (el) {
      var i = S.trusted.indexOf(el.dataset.pkg);
      if (i >= 0) S.trusted.splice(i, 1); else S.trusted.push(el.dataset.pkg);
      save(); render();
    },
    'check-now': async function () {
      if (!Straja) { toast(t('monitor.none')); return; }
      var c = await Straja.checkNow({ lang: lang() }); var n = (c.events || []).length;
      var e = await Straja.events(); ui.events = e.events || [];
      toast(n ? t('monitor.new', { n: n }) : t('monitor.none')); render();
    },
    baseline: async function () { if (Straja) await Straja.acceptBaseline(); toast(t('monitor.baselineok')); },
    'clear-events': async function () { if (Straja) await Straja.clearEvents(); ui.events = []; render(); },
    'copy-msg': async function () { toast((await copy(t('others.msg'))) ? t('others.copied') : t('err.settings')); },
    export: async function () {
      var list = apps(), d = Core.deviceRisk(list);
      var txt = Core.buildReport(t, { device: d, apps: Core.sortApps(list), ts: S.scan && S.scan.ts });
      toast((await copy(txt)) ? t('settings.export.done') : t('err.settings'));
    },
    reset: async function () {
      if (!window.confirm(t('settings.reset.confirm'))) return;
      try { if (LN) { await LN.cancel({ notifications: S.temps.map(function (x) { return { id: x.id }; }).concat([{ id: 1001 }]) }); } } catch (e) { /* nimic de anulat */ }
      try { if (Straja) { await Straja.watch({ enabled: false }); await Straja.clearEvents(); } } catch (e) { /* idem */ }
      try { localStorage.removeItem(KEY); } catch (e) { /* idem */ }
      S = load(); ui.events = []; ui.watching = false; ui.tab = 'home'; render();
    },
    'reg-del': function (el) { S.registry.splice(parseInt(el.dataset.i, 10), 1); save(); render(); }
  };

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    var f = actions[el.dataset.act];
    if (f) { var r = f(el); if (r && r.catch) r.catch(function () { toast(t('err.settings')); }); }
  });

  document.addEventListener('change', function (ev) {
    var el = ev.target, k = el.dataset && el.dataset.chg;
    if (!k) return;
    if (k === 'check') { if (el.checked) S.done[el.dataset.id] = true; else delete S.done[el.dataset.id]; save(); render(); }
    else if (k === 'weekly') setWeekly(el.checked);
    else if (k === 'watch') setWatch(el.checked);
    else if (k === 'interval') { S.watchMin = parseInt(el.value, 10); save(); if (ui.watching) setWatch(true); }
    else if (k === 'lang') { S.lang = el.value; save(); syncTexts(); if (S.weekly) setWeekly(true); render(); }
    else if (k === 'theme') { S.theme = el.value; save(); render(); }
    else if (k === 'secure') {
      ui.secure = el.checked;
      if (Straja) Straja.setSecure({ enabled: el.checked });
    }
  });

  document.addEventListener('input', function (ev) {
    if (ev.target.id === 'q') { ui.q = ev.target.value; var l = $('applist'); if (l) l.innerHTML = appListHtml(); }
  });

  document.addEventListener('submit', function (ev) {
    if (ev.target.id !== 'regform') return;
    ev.preventDefault();
    var inp = $('regname'), name = inp.value.trim();
    if (!name) return;
    S.registry.push({ id: Date.now().toString(36), name: name.slice(0, 60) });
    save(); render();
  });

  // La revenirea din Setări (după ce utilizatorul a retras un acces), rescanăm discret.
  function onResume() {
    if (document.hidden || !Straja || !S.scan) return;
    var now = Date.now();
    if (now - ui.lastAuto < 3000) return;
    ui.lastAuto = now;
    doScan(true);
  }
  document.addEventListener('visibilitychange', onResume);

  async function init() {
    render();
    if (Straja) {
      try {
        var w = await Straja.watchStatus(); ui.watching = !!w.watching;
        var e = await Straja.events(); ui.events = e.events || [];
        var s = await Straja.getSecure(); ui.secure = !!s.secure;
        syncTexts();
      } catch (err) { /* plugin indisponibil: rămânem pe valorile implicite */ }
      render();
    }
    if (LN) {
      try {
        LN.addListener('localNotificationActionPerformed', function (ev) {
          var pkg = ev && ev.notification && ev.notification.extra && ev.notification.extra.pkg;
          if (pkg && Straja && pkg.indexOf('ios:') !== 0) openSettings('app', pkg);
        });
      } catch (err) { /* fără ascultător */ }
    }
  }

  window.__STRAJA__ = { state: function () { return S; }, ui: ui, render: render, doScan: doScan, actions: actions };
  init();
})();
