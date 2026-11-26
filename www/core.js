/* STRAJA - logica pură (fără DOM, fără rețea). Testată cu `npm test`. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StrajaCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Cât contează fiecare cale prin care un agent poate vedea conținutul telefonului.
  var W = {
    notif: 3, a11y: 3, reads: 2, assistant: 4,
    images: 2, video: 1, storage: 2, selected: 0.5,
    sms: 3, calllog: 2, contacts: 1, mic: 1, allfiles: 2, overlay: 1
  };
  var PERM_KEYS = ['images', 'video', 'selected', 'storage', 'sms', 'contacts', 'calllog', 'mic'];
  var DECL_KEYS = ['allfiles', 'overlay'];
  var KIND_KEYS = ['notif', 'a11y', 'assistant', 'perm_images', 'perm_video', 'perm_storage', 'perm_sms', 'perm_calllog'];
  var LEVELS = ['low', 'medium', 'high'];

  var PROBABLE_PKG = /(^|[._-])(ai|gpt|llm|agent|assistant|copilot|gemini|claude|grok|chatbot|bard|llama|mistral|deepseek|perplexity)([._-]|$)/i;
  var PROBABLE_LABEL = /\b(ai|gpt|llm|copilot|gemini|claude|grok|assistant|chatbot|perplexity|deepseek)\b/i;

  function round1(x) { return Math.round(x * 10) / 10; }

  /** 'known' | 'probable' | 'user' | null */
  function detectAi(app, known, userAi) {
    if (userAi && userAi.indexOf(app.pkg) >= 0) return 'user';
    if (known && Object.prototype.hasOwnProperty.call(known, app.pkg)) return 'known';
    if (PROBABLE_PKG.test(app.pkg || '') || PROBABLE_LABEL.test(app.label || '')) return 'probable';
    return null;
  }

  /**
   * Risc 0..10 pentru o aplicație.
   * - cele trei căi între aplicații (notificări, accesibilitate, asistent) contează întotdeauna;
   * - permisiunile obișnuite (foto, SMS...) contează deplin doar pentru agenții AI;
   * - aplicațiile de sistem și cele acceptate de utilizator cântăresc mai puțin.
   */
  function appRisk(app, aiKind, trusted) {
    var s = 0, reasons = [], isAi = !!aiKind, i, k;
    if (app.notif) { s += W.notif; reasons.push('notif'); }
    if (app.a11y) {
      s += W.a11y; reasons.push('a11y');
      if (app.readsScreen) { s += W.reads; reasons.push('reads'); }
    }
    if (app.assistant) { s += W.assistant; reasons.push('assistant'); }
    var permScale = isAi ? 1 : 0.2;
    var perms = app.perms || [], declared = app.declared || [];
    for (i = 0; i < PERM_KEYS.length; i++) {
      k = PERM_KEYS[i];
      if (perms.indexOf(k) >= 0) { s += W[k] * permScale; reasons.push(k); }
    }
    for (i = 0; i < DECL_KEYS.length; i++) {
      k = DECL_KEYS[i];
      if (declared.indexOf(k) >= 0) { s += W[k] * permScale; reasons.push(k); }
    }
    if (app.system && !app.assistant) s *= 0.4;
    if (isAi) s *= 1.5;
    if (trusted) s *= 0.3;
    return { score: Math.min(10, round1(s)), reasons: reasons };
  }

  function levelOf(risk) { return risk < 25 ? 'low' : risk < 55 ? 'medium' : 'high'; }

  /** apps: obiecte decorate {…app, ai, risk:{score}} */
  function deviceRisk(apps) {
    var raw = 0, c = { notif: 0, a11y: 0, reads: 0, assistant: 0, media: 0, sms: 0, ai: 0 };
    apps.forEach(function (a) {
      raw += a.risk.score;
      if (a.notif) c.notif++;
      if (a.a11y) c.a11y++;
      if (a.readsScreen) c.reads++;
      if (a.assistant) c.assistant++;
      var p = a.perms || [];
      // foto/SMS contează în tablou doar pentru agenți AI (aplicațiile de galerie sau SMS au acces firesc)
      var med = p.indexOf('images') >= 0 || p.indexOf('video') >= 0 || p.indexOf('storage') >= 0 || p.indexOf('selected') >= 0;
      var sm = p.indexOf('sms') >= 0;
      if (a.ai && (med || sm)) c.media++;
      if (a.ai && sm) c.sms++;
      if (a.ai) c.ai++;
    });
    var risk = Math.round(100 * (1 - Math.exp(-raw / 30)));
    return { raw: round1(raw), risk: risk, level: levelOf(risk), counts: c };
  }

  function applicable(item, platform) {
    return item.platform === 'both' || item.platform === platform;
  }

  function progress(items, done, platform) {
    var list = items.filter(function (i) { return applicable(i, platform); });
    var n = list.filter(function (i) { return done && done[i.id]; }).length;
    return { done: n, total: list.length, pct: list.length ? Math.round(100 * n / list.length) : 0 };
  }

  function sortApps(apps) {
    return apps.slice().sort(function (a, b) {
      return (b.risk.score - a.risk.score) || String(a.label).localeCompare(String(b.label));
    });
  }

  function eventKindKey(kind) { return String(kind).replace(':', '_'); }

  /** Raportul text (copiat în clipboard); `t` = funcția de traducere. */
  function buildReport(t, ctx) {
    var d = ctx.device, L = [];
    L.push(t('report.title') + ' - ' + new Date(ctx.ts || Date.now()).toISOString().slice(0, 10));
    L.push(t('home.risk') + ': ' + d.risk + '/100 (' + t('level.' + d.level) + ')');
    L.push(t('ch.notif') + ': ' + d.counts.notif + ' | ' + t('ch.a11y') + ': ' + d.counts.a11y +
      ' (' + d.counts.reads + ') | ' + t('ch.assistant') + ': ' + d.counts.assistant +
      ' | AI: ' + d.counts.ai);
    L.push('');
    ctx.apps.filter(function (a) { return a.risk.score > 0; }).slice(0, 30).forEach(function (a) {
      var tags = a.risk.reasons.map(function (r) {
        return t((r === 'reads' ? 'badge.reads' : (W[r] !== undefined && PERM_KEYS.concat(DECL_KEYS).indexOf(r) >= 0 ? 'perm.' + r : 'kind.' + r)));
      });
      L.push('- ' + a.label + ' (' + a.pkg + ') ' + a.risk.score + '/10: ' + tags.join(', '));
    });
    return L.join('\n');
  }

  return {
    W: W, PERM_KEYS: PERM_KEYS, DECL_KEYS: DECL_KEYS, KIND_KEYS: KIND_KEYS, LEVELS: LEVELS,
    detectAi: detectAi, appRisk: appRisk, levelOf: levelOf, deviceRisk: deviceRisk,
    applicable: applicable, progress: progress, sortApps: sortApps,
    eventKindKey: eventKindKey, buildReport: buildReport
  };
});
