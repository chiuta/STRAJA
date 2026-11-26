# -*- coding: utf-8 -*-
"""Feature screenshots (docs/media/feat-<id>-<lang>.webp) from the REAL app UI, simulated Android bridge.
Usage: python3 tools/make_feature_shots.py [lang ...]"""
import os, sys, asyncio, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_clips import INIT, APP, OUT, W, H, tap, smooth_scroll, wait
from site_data import LANGS
from playwright.async_api import async_playwright
from PIL import Image

HIDE = "document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='#__cap{display:none!important}body{padding-top:0!important}';document.head.appendChild(s)});"
IDS = ['audit', 'monitor', 'open', 'temp', 'guide', 'private']

async def scan(pg):
    await wait(pg, 500); await tap(pg, '[data-act="scan"]', 1700)

async def shot_audit(pg): await scan(pg); await pg.evaluate("window.scrollTo(0,0)"); await wait(pg, 300)
async def shot_monitor(pg):
    await scan(pg); await tap(pg, '[data-act="tab"][data-v="monitor"]', 600)
    await tap(pg, 'input[data-chg="watch"]', 800); await pg.evaluate("window.__demoEvent=true")
    await tap(pg, '[data-act="check-now"]', 1600); await pg.evaluate("window.scrollTo(0,120)"); await wait(pg, 3300)
async def shot_open(pg):
    await scan(pg); await tap(pg, '[data-act="tab"][data-v="apps"]', 600); await tap(pg, '[data-act="filter"][data-v="ai"]', 700)
    await pg.evaluate("window.scrollTo(0,170)"); await wait(pg, 400)
async def shot_temp(pg):
    await scan(pg); await tap(pg, '[data-act="tab"][data-v="apps"]', 600); await tap(pg, '[data-act="temp-open"]', 900)
    await pg.evaluate("document.querySelector('[data-act=temp-set]').scrollIntoView({block:'center'})"); await wait(pg, 500)
async def shot_guide(pg):
    await tap(pg, '[data-act="tab"][data-v="guide"]', 600)
    for _ in range(3): await tap(pg, 'input[data-chg="check"]:not(:checked)', 350)
    await pg.evaluate("window.scrollTo(0,0)"); await wait(pg, 300)
async def shot_private(pg):
    await tap(pg, '[data-act="tab"][data-v="settings"]', 700); await pg.evaluate("window.scrollTo(0,0)"); await wait(pg, 300)
FN = dict(audit=shot_audit, monitor=shot_monitor, open=shot_open, temp=shot_temp, guide=shot_guide, private=shot_private)

async def main(langs):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        for l in langs:
            for i in IDS:
                ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, color_scheme='dark', locale=l + '-XX', has_touch=True)
                await ctx.add_init_script(INIT); await ctx.add_init_script(HIDE)
                pg = await ctx.new_page(); await pg.goto(APP)
                await pg.evaluate("localStorage.setItem('straja.v1', JSON.stringify({lang:'%s'}))" % l)
                await pg.reload(); await wait(pg, 400)
                try: await FN[i](pg)
                except Exception as e: print('!!', l, i, str(e)[:100])
                png = await pg.screenshot(); await ctx.close()
                im = Image.open(io.BytesIO(png)).convert('RGB'); im = im.resize((360, int(360 * im.height / im.width)))
                f = os.path.join(OUT, f'feat-{i}-{l}.webp'); im.save(f, quality=80)
                print('ok', l, i, os.path.getsize(f) // 1024, 'KB', flush=True)
        await b.close()
if __name__ == '__main__': asyncio.run(main(sys.argv[1:] or LANGS))
