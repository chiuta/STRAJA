# -*- coding: utf-8 -*-
"""Generates docs/index.html and README*.md from tools/site_data.py. Run: python3 tools/gen_site.py"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from site_data import LANGS, NAMES, T, VERSION, DATE
from site_data2 import T2

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = 'https://github.com/chiuta/STRAJA'
APK = REPO + '/releases/latest/download/STRAJA-android.apk'
IPA = REPO + '/releases/latest/download/STRAJA-ios-unsigned.ipa'
COFFEE = 'https://buymeacoffee.com/echo.of.the.strings'
SITE = 'https://straja.chiuta.ro/'

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
    data = {l: dict(T[l], **T2[l], name=NAMES[l]) for l in LANGS}
    js = json.dumps(data, ensure_ascii=False).replace('</', '<\\/')
    html = PAGE.replace('%%DATA%%', js).replace('%%APK%%', APK).replace('%%IPA%%', IPA).replace('%%REPO%%', REPO).replace('%%COFFEE%%', COFFEE).replace('%%VERSION%%', VERSION).replace('%%DATE%%', DATE)
    open(os.path.join(ROOT, 'docs', 'index.html'), 'w', encoding='utf-8').write(html)

PAGE = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'page_template.html'), encoding='utf-8').read()

if __name__ == '__main__':
    for l in LANGS: readme(l)
    page()
    print('generated', len(LANGS), 'READMEs and docs/index.html')
