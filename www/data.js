/* STRAJA - date statice: agenți AI cunoscuți, listă de verificare, scanare demo. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StrajaData = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Listă orientativă (pachete Android). Aplicația permite și marcarea manuală.
  var KNOWN_AI = {
    'com.google.android.apps.bard': 'Gemini',
    'com.openai.chatgpt': 'ChatGPT',
    'com.anthropic.claude': 'Claude',
    'com.microsoft.copilot': 'Microsoft Copilot',
    'ai.perplexity.app.android': 'Perplexity',
    'com.deepseek.chat': 'DeepSeek',
    'ai.x.grok': 'Grok',
    'com.facebook.stella': 'Meta AI',
    'com.samsung.android.bixby.agent': 'Bixby',
    'com.moonshot.kimichat': 'Kimi'
  };

  // platform: 'both' | 'android' | 'ios'
  var CHECKLIST = [
    { id: 'review',   platform: 'both' },
    { id: 'noauto',   platform: 'both' },
    { id: 'notif',    platform: 'android' },
    { id: 'a11y',     platform: 'android' },
    { id: 'assistant', platform: 'both' },
    { id: 'photos',   platform: 'both' },
    { id: 'files',    platform: 'android' },
    { id: 'temp',     platform: 'both' },
    { id: 'periodic', platform: 'both' },
    { id: 'signal',   platform: 'both' },
    { id: 'training', platform: 'both' },
    { id: 'others',   platform: 'both' }
  ];

  var TEMP_MINUTES = [15, 60, 240, 1440];
  var WATCH_MINUTES = [15, 30, 60, 360];

  function demoScan() {
    return {
      ts: Date.now(),
      assistantPkg: 'com.google.android.apps.bard',
      apps: [
        { pkg: 'com.google.android.apps.bard', label: 'Gemini', system: false, notif: true, a11y: false, readsScreen: false, assistant: true, perms: ['images', 'contacts'], declared: [] },
        { pkg: 'com.facebook.stella', label: 'Meta AI', system: false, notif: true, a11y: true, readsScreen: true, assistant: false, perms: ['images', 'video', 'mic'], declared: ['overlay'] },
        { pkg: 'com.openai.chatgpt', label: 'ChatGPT', system: false, notif: false, a11y: false, readsScreen: false, assistant: false, perms: ['selected'], declared: [] },
        { pkg: 'org.example.autoclicker', label: 'Auto Clicker', system: false, notif: false, a11y: true, readsScreen: true, assistant: false, perms: [], declared: ['overlay'] },
        { pkg: 'com.example.smartwatch', label: 'Smartwatch', system: false, notif: true, a11y: false, readsScreen: false, assistant: false, perms: ['contacts', 'sms'], declared: [] },
        { pkg: 'org.thoughtcrime.securesms', label: 'Signal', system: false, notif: false, a11y: false, readsScreen: false, assistant: false, perms: ['contacts', 'mic'], declared: [] },
        { pkg: 'com.android.talkback', label: 'TalkBack', system: true, notif: false, a11y: true, readsScreen: true, assistant: false, perms: [], declared: [] }
      ]
    };
  }

  return { KNOWN_AI: KNOWN_AI, CHECKLIST: CHECKLIST, TEMP_MINUTES: TEMP_MINUTES, WATCH_MINUTES: WATCH_MINUTES, demoScan: demoScan };
});
