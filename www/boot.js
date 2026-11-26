/* STRAJA - gardă de pornire: dacă o eroare oprește interfața, afișează mesajul în loc de un ecran gol. */
(function () {
  'use strict';
  function show(msg) {
    var v = document.getElementById('view');
    if (!v || v.childNodes.length) return;
    var p = document.createElement('pre');
    p.style.cssText = 'white-space:pre-wrap;padding:1rem;font:14px/1.4 monospace';
    p.textContent = 'STRAJA - startup error\n\n' + msg;
    v.appendChild(p);
  }
  window.addEventListener('error', function (e) { show(String(e && e.message || e)); });
  window.addEventListener('unhandledrejection', function (e) { if (!document.getElementById('view').childNodes.length) show(String(e && e.reason || e)); });
})();
