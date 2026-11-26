# -*- coding: utf-8 -*-
"""Generates docs/index.html and README*.md from tools/site_data.py. Run: python3 tools/gen_site.py"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from site_data import LANGS, NAMES, T, VERSION, DATE

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = 'https://github.com/chiuta/STRAJA'
APK = REPO + '/releases/latest/download/STRAJA-android.apk'
IPA = REPO + '/releases/latest/download/STRAJA-ios-unsigned.ipa'
COFFEE = 'https://buymeacoffee.com/echo.of.the.strings'
SITE = 'https://chiuta.github.io/STRAJA/'

def readme(l):
    t = T[l]; s = t['sec']
    fn = 'README.md' if l == 'en' else 'README.%s.md' % l
    bar = ' · '.join(('**%s**' % NAMES[x]) if x == l else '[%s](%s)' % (NAMES[x], 'README.md' if x == 'en' else 'README.%s.md' % x) for x in LANGS)
    o = ['# STRAJA', '', bar, '', '<p align="center"><img src="docs/logo.svg" width="160" alt="STRAJA"></p>', '',
         '> **%s**' % t['tag'], '', '_Version: %s · %s_' % (VERSION, DATE), '', t['lede'], '',
         '**[%s](%s) · [%s](%s) · [%s](%s)**' % (t['dl_a'], APK, t['dl_i'], IPA, t['dl_s'], REPO), '',
         '<p align="center"><img src="docs/media/%s-home.webp" width="190"> <img src="docs/media/%s-apps.webp" width="190"> <img src="docs/media/%s-monitor.webp" width="190"> <img src="docs/media/%s-guide.webp" width="190"></p>' % ((l,) * 4), '',
         '## ' + t['why_h'], '', t['why'], '',
         '## ' + s['routes'], '']
    o += ['%d. **%s** — %s' % (i + 1, a, b) for i, (a, b) in enumerate(t['routes'])]
    o += ['', '## ' + s['feat'], '']
    o += ['- **%s** — %s' % (a, b) for a, b in t['feats']]
    o += ['', '## ' + s['start'], '']
    o += ['%d. %s' % (i + 1, x) for i, x in enumerate(t['steps'])]
    o += ['', '_%s_' % t['ios_note'], '', '## ' + s['lim'], '']
    o += ['- ' + x for x in t['lims']]
    o += ['', '## ' + s['build'], '', t['build'], '', '## ' + s['priv'], '', t['priv'], '',
          '## ' + s['docs'], '', '- [%s](CHANGELOG.md)' % t['doc_l'][0], '- [%s](%s)' % (t['doc_l'][1], REPO), '- [%s](%s/releases)' % (t['doc_l'][2], REPO), '- [Site](%s)' % SITE, '',
          '## ' + s['sup'], '', '%s <%s>' % (t['sup'], COFFEE), '', '## ' + s['lic'], '', 'MIT © Alexandru‑Ionuț Chiuță (Alexio).', '']
    open(os.path.join(ROOT, fn), 'w', encoding='utf-8').write('\n'.join(o))

def page():
    data = {l: dict(T[l], name=NAMES[l]) for l in LANGS}
    js = json.dumps(data, ensure_ascii=False).replace('</', '<\\/')
    html = PAGE.replace('%%DATA%%', js).replace('%%APK%%', APK).replace('%%IPA%%', IPA).replace('%%REPO%%', REPO).replace('%%COFFEE%%', COFFEE).replace('%%VERSION%%', VERSION)
    open(os.path.join(ROOT, 'docs', 'index.html'), 'w', encoding='utf-8').write(html)

PAGE = r'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0b3a44">
<title>STRAJA</title>
<meta name="description" content="A shield against AI agents that read your phone: Android audit, monitor and guide, 8 languages, offline.">
<link rel="icon" href="logo.svg">
<style>
:root{--bg:#07242b;--card:#0e3640;--ink:#e6f4f6;--dim:#9dbcc2;--acc:#4cc3d6;--ok:#3fb27f;--warn:#e3a93b;--bad:#e0594a}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:radial-gradient(1100px 560px at 50% -10%,#0f5563 0%,#07242b 62%) fixed,#07242b;color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--acc)}
header.top{position:sticky;top:0;z-index:5;background:#07242bee;backdrop-filter:blur(6px);border-bottom:1px solid #12495a;display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;padding:.5rem 1rem}
.brand{font-weight:700;letter-spacing:.22em;margin-right:auto}
.langbar{display:flex;gap:.3rem;flex-wrap:wrap}
button{font:inherit;color:var(--ink);background:#12495a;border:1px solid #1d6277;border-radius:8px;padding:.3rem .65rem;cursor:pointer}
button:hover,button:focus-visible{border-color:var(--acc)}
button[aria-pressed=true]{background:var(--acc);color:#04222a;border-color:var(--acc)}
.hero{text-align:center;padding:4.5rem 1rem 2rem;max-width:56rem;margin:0 auto}
.hero img{width:140px;height:140px}
.hero h1{font-size:clamp(2.2rem,7vw,4rem);margin:.3rem 0;letter-spacing:.18em}
.hero .tag{font-size:1.25rem;color:var(--ink);margin:.2rem 0}
.hero p.lede{color:var(--dim);font-size:1.05rem}
.cta{display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap;margin:1.4rem 0 .4rem}
.cta a{background:var(--acc);color:#04222a;text-decoration:none;font-weight:600;padding:.7rem 1.3rem;border-radius:10px}
.cta a.alt{background:#12495a;color:var(--ink)}
.note{color:var(--dim);font-size:.9rem;text-align:center}
main{max-width:62rem;margin:0 auto;padding:0 1rem 4rem}
h2{border-bottom:1px solid #12495a;padding-bottom:.3rem;margin-top:2.8rem}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));gap:.8rem;margin:1.2rem 0}
.stat{background:var(--card);border:1px solid #12495a;border-radius:12px;padding:.8rem;text-align:center}
.stat b{display:block;font-size:2rem;color:var(--acc)}
.stat span{color:var(--dim);font-size:.9rem}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));gap:1rem}
.card{background:var(--card);border:1px solid #12495a;border-radius:12px;padding:1rem}
.card h3{margin:.1rem 0 .4rem;font-size:1.05rem}
.card p{margin:0;color:var(--dim)}
.tabs{display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.8rem}
#audtext{background:var(--card);border:1px solid #12495a;border-radius:12px;padding:1rem}
.shots{display:flex;gap:.8rem;overflow-x:auto;padding:.3rem 0 1rem;scroll-snap-type:x mandatory}
.shots img{height:440px;width:auto;border-radius:18px;border:1px solid #12495a;scroll-snap-align:start;flex:none}
.demo{background:var(--card);border:1px solid #12495a;border-radius:14px;padding:1rem}
.app{display:grid;grid-template-columns:minmax(7rem,1.2fr) repeat(3,1fr);gap:.5rem;align-items:center;padding:.45rem 0;border-bottom:1px dashed #1d6277}
.app:last-of-type{border-bottom:0}
.app .n{font-weight:600}
.app .ai{font-size:.7rem;background:var(--warn);color:#2b1d00;border-radius:6px;padding:0 .35rem;margin-left:.3rem}
.app label{display:flex;gap:.3rem;align-items:center;font-size:.85rem;color:var(--dim)}
.head{color:var(--dim);font-size:.8rem}
.meter{height:16px;background:#052027;border-radius:8px;overflow:hidden;margin:.6rem 0 .3rem}
.meter i{display:block;height:100%;width:0;background:var(--ok);transition:width .3s,background .3s}
@media(prefers-reduced-motion:reduce){.meter i{transition:none}}
#lvl{font-weight:700}
ol.steps li,ul.lim li{margin:.35rem 0}
footer{text-align:center;color:var(--dim);padding:2rem 1rem 4rem}
#up{position:fixed;right:14px;bottom:14px;width:46px;height:46px;border-radius:50%;display:none}
</style>
</head>
<body>
<header class="top"><span class="brand">STRAJA</span><nav class="langbar" id="langbar" aria-label="Language"></nav></header>
<section class="hero">
<img src="logo.svg" alt="STRAJA">
<h1>STRAJA</h1>
<p class="tag" id="tag"></p>
<p class="lede" id="lede"></p>
<div class="cta"><a href="%%APK%%" id="dl_a"></a><a class="alt" href="%%IPA%%" id="dl_i"></a><a class="alt" href="%%REPO%%" id="dl_s"></a></div>
<p class="note" id="ios_note"></p>
</section>
<main>
<div class="stats" id="stats"></div>
<h2 id="why_h"></h2><p id="why"></p>
<h2 id="routes_h"></h2><div class="grid" id="routes"></div>
<h2 id="demo_h"></h2><p id="demo_intro"></p>
<div class="demo" id="demo"></div>
<h2 id="aud_h"></h2><div class="tabs" id="tabs" role="tablist"></div><div id="audtext" role="tabpanel"></div>
<h2 id="shots_h"></h2><div class="shots" id="shots"></div>
<h2 id="feat_h"></h2><div class="grid" id="feats"></div>
<h2 id="lim_h"></h2><ul class="lim" id="lims"></ul>
<h2 id="start_h"></h2><ol class="steps" id="steps"></ol>
<h2 id="priv_h"></h2><p id="priv"></p><p id="build"></p>
<h2 id="docs_h"></h2><ul id="docs"></ul>
<h2 id="sup_h"></h2><p><span id="sup"></span> <a href="%%COFFEE%%" id="coffee">buymeacoffee.com/echo.of.the.strings</a></p>
</main>
<footer id="foot"></footer>
<button id="up" aria-label="Top">↑</button>
<script>
var DATA=%%DATA%%;
var LANGS=Object.keys(DATA),REPO="%%REPO%%",cur='en',aud=0;
var APPS=[{n:'Meta AI',ai:1,v:[1,0,1]},{n:'Gemini',ai:1,v:[0,1,1]},{n:'Notes+',ai:0,v:[0,0,0]},{n:'Weather',ai:0,v:[1,0,0]}];
var W=[3,3,2];
function $(i){return document.getElementById(i)}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function pick(){
  try{var q=new URLSearchParams(location.search).get('lang');if(q&&DATA[q])return q}catch(e){}
  try{var s=localStorage.getItem('straja.site');if(s&&DATA[s])return s}catch(e){}
  var n=String(navigator.language||'en').slice(0,2).toLowerCase();return DATA[n]?n:'en';
}
function risk(){
  var raw=0;APPS.forEach(function(a){var s=0;a.v.forEach(function(on,i){if(on)s+=W[i]});if(a.ai)s*=1.5;raw+=Math.min(10,s)});
  return Math.round(100*(1-Math.exp(-raw/30)));
}
function renderDemo(){
  var t=DATA[cur];
  var h='<div class="app head"><span></span>'+t.d_ch.map(function(c){return'<span>'+esc(c)+'</span>'}).join('')+'</div>';
  APPS.forEach(function(a,ai){
    h+='<div class="app"><span class="n">'+esc(a.n)+(a.ai?'<span class="ai">AI</span>':'')+'</span>'+a.v.map(function(on,i){return'<label><input type="checkbox" data-a="'+ai+'" data-c="'+i+'"'+(on?' checked':'')+'> </label>'}).join('')+'</div>';
  });
  h+='<div class="meter" aria-hidden="true"><i id="mi"></i></div><div>'+esc(t.d_risk)+': <b id="mv"></b> — <span id="lvl"></span></div>';
  $('demo').innerHTML=h;updRisk();
  $('demo').querySelectorAll('input').forEach(function(x){x.onchange=function(){APPS[+x.dataset.a].v[+x.dataset.c]=x.checked?1:0;updRisk()}});
}
function updRisk(){
  var r=risk(),t=DATA[cur],k=r<25?0:r<55?1:2;
  $('mv').textContent=r+'/100';$('lvl').textContent=t.d_lv[k];$('mi').style.width=r+'%';$('mi').style.background=['var(--ok)','var(--warn)','var(--bad)'][k];
}
function renderAud(){
  var t=DATA[cur];
  $('tabs').innerHTML=t.aud.map(function(a,i){return'<button role="tab" aria-pressed="'+(i===aud)+'" data-i="'+i+'">'+esc(a[0])+'</button>'}).join('');
  $('tabs').querySelectorAll('button').forEach(function(b){b.onclick=function(){aud=+b.dataset.i;renderAud()}});
  $('audtext').textContent=t.aud[aud][1];
}
function render(){
  var t=DATA[cur];document.documentElement.lang=cur;
  document.title='STRAJA — '+t.tag;
  $('langbar').innerHTML=LANGS.map(function(l){return'<button aria-pressed="'+(l===cur)+'" data-l="'+l+'" lang="'+l+'">'+esc(DATA[l].name)+'</button>'}).join('');
  $('langbar').querySelectorAll('button').forEach(function(b){b.onclick=function(){cur=b.dataset.l;try{localStorage.setItem('straja.site',cur)}catch(e){}render()}});
  ['tag','lede','dl_a','dl_i','dl_s','ios_note','why_h','why','routes_h','demo_h','demo_intro','aud_h','shots_h','feat_h','lim_h','start_h','priv_h','priv','build','docs_h','sup_h','sup','foot'].forEach(function(k){$(k).textContent=t[k]});
  $('stats').innerHTML=t.stats.map(function(s){return'<div class="stat"><b>'+esc(s[0])+'</b><span>'+esc(s[1])+'</span></div>'}).join('');
  $('routes').innerHTML=t.routes.map(function(r,i){return'<div class="card"><h3>'+(i+1)+'. '+esc(r[0])+'</h3><p>'+esc(r[1])+'</p></div>'}).join('');
  $('feats').innerHTML=t.feats.map(function(r){return'<div class="card"><h3>'+esc(r[0])+'</h3><p>'+esc(r[1])+'</p></div>'}).join('');
  $('lims').innerHTML=t.lims.map(function(x){return'<li>'+esc(x)+'</li>'}).join('');
  $('steps').innerHTML=t.steps.map(function(x){return'<li>'+esc(x)+'</li>'}).join('');
  $('shots').innerHTML=['home','apps','monitor','guide'].map(function(n){return'<img loading="lazy" src="media/'+cur+'-'+n+'.webp" alt="STRAJA — '+n+'">'}).join('');
  $('docs').innerHTML=[[t.doc_l[0],REPO+'/blob/main/CHANGELOG.md'],[t.doc_l[1],REPO],[t.doc_l[2],REPO+'/releases']].map(function(d){return'<li><a href="'+d[1]+'">'+esc(d[0])+'</a></li>'}).join('');
  renderDemo();renderAud();
}
cur=pick();render();
var up=$('up');up.onclick=function(){window.scrollTo({top:0,behavior:'smooth'})};
window.addEventListener('scroll',function(){up.style.display=window.scrollY>600?'block':'none'},{passive:true});
</script>
</body>
</html>
'''

if __name__ == '__main__':
    for l in LANGS: readme(l)
    page()
    print('generated', len(LANGS), 'READMEs and docs/index.html')
