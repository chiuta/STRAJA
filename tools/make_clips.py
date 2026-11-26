# -*- coding: utf-8 -*-
"""Records 5 feature clips per language (mp4 + poster webp) from the REAL app UI (www/) with Playwright.
The Android bridge is simulated (no device); system settings screens are shown as a placeholder sheet.
Usage: python3 tools/make_clips.py [lang ...]   (default: all 8)"""
import os, sys, shutil, subprocess, asyncio
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from site_data import LANGS, T
from playwright.async_api import async_playwright
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = 'file://' + os.path.join(ROOT, 'www', 'index.html')
OUT = os.path.join(ROOT, 'docs', 'media')
os.makedirs(OUT, exist_ok=True)
W, H = 390, 720

INIT = r"""
(function(){
  var calls=[], events=[];
  var plugins={
    Straja:{
      scan:function(){return new Promise(function(r){setTimeout(function(){var d=window.StrajaData.demoScan();r({apps:d.apps,assistantPkg:d.assistantPkg,ts:Date.now()})},1100)})},
      checkNow:function(){if(window.__demoEvent)events=[{t:Date.now(),pkg:'com.facebook.stella',label:'Meta AI',kind:'notif'}];return new Promise(function(r){setTimeout(function(){r({events:events})},900)})},
      events:function(){return Promise.resolve({events:events})},
      watchStatus:function(){return Promise.resolve({watching:false,hasBaseline:true})},
      watch:function(a){return Promise.resolve({watching:!!a.enabled})},
      getSecure:function(){return Promise.resolve({secure:true})},
      setSecure:function(a){return Promise.resolve({secure:a.enabled})},
      setTexts:function(){return Promise.resolve()},
      acceptBaseline:function(){return Promise.resolve()},
      clearEvents:function(){events=[];return Promise.resolve()},
      openSettings:function(a){window.__sys&&window.__sys(a);return Promise.resolve()}
    },
    LocalNotifications:{
      checkPermissions:function(){return Promise.resolve({display:'granted'})},
      requestPermissions:function(){return Promise.resolve({display:'granted'})},
      schedule:function(){return Promise.resolve()},cancel:function(){return Promise.resolve()},
      addListener:function(){return Promise.resolve()}
    }
  };
  window.Capacitor={getPlatform:function(){return 'android'},isNativePlatform:function(){return true},registerPlugin:function(n){return plugins[n]}};
  // tap ripple + caption + placeholder system sheet
  document.addEventListener('DOMContentLoaded',function(){
    var st=document.createElement('style');
    st.textContent='.__rip{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:#4cc3d688;border:2px solid #4cc3d6;pointer-events:none;z-index:99999;animation:__r .55s ease-out forwards}@keyframes __r{from{transform:scale(.3);opacity:1}to{transform:scale(1.5);opacity:0}}'+
     '#__cap{position:fixed;left:0;right:0;top:0;z-index:99998;background:#04222acc;color:#e6f4f6;font:600 15px system-ui,sans-serif;padding:10px 14px;text-align:center;backdrop-filter:blur(4px)}'+
     'body{padding-top:42px!important}#__sys{position:fixed;inset:0;z-index:99997;background:#101418;color:#eee;font:16px system-ui,sans-serif;display:none;flex-direction:column;padding:70px 22px;gap:10px}#__sys b{font-size:20px}#__sys small{color:#9aa}';
    document.head.appendChild(st);
    var c=document.createElement('div');c.id='__cap';document.body.appendChild(c);
    var s=document.createElement('div');s.id='__sys';document.body.appendChild(s);
    window.__cap=function(t){c.textContent=t};
    window.__sys=function(a){s.innerHTML='<b>⚙ Android Settings</b><span>'+(a&&a.target||'')+'</span><small>(illustration)</small>';s.style.display='flex';setTimeout(function(){s.style.display='none'},1500)};
    document.addEventListener('click',function(e){var r=document.createElement('div');r.className='__rip';r.style.left=e.clientX+'px';r.style.top=e.clientY+'px';document.body.appendChild(r);setTimeout(function(){r.remove()},600)},true);
  });
})();
"""

async def wait(pg, ms): await pg.wait_for_timeout(ms)
async def tap(pg, sel, pause=900):
    el = pg.locator(sel).first
    await el.scroll_into_view_if_needed()
    box = await el.bounding_box()
    await pg.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2, steps=8)
    await wait(pg, 250)
    await el.click(); await wait(pg, pause)

async def smooth_scroll(pg, y, ms=1200):
    await pg.evaluate("y=>window.scrollTo({top:y,behavior:'smooth'})", y); await wait(pg, ms)

# each clip: (id, feature index in T[l]['feats'], script)
async def clip_audit(pg):
    await wait(pg, 900); await tap(pg, '[data-act="scan"]', 1800)
    await smooth_scroll(pg, 330, 1500); await wait(pg, 1000); await smooth_scroll(pg, 700, 1500); await wait(pg, 900)
async def clip_apps(pg):
    await wait(pg, 600); await tap(pg, '[data-act="scan"]', 1500)
    await tap(pg, '[data-act="tab"][data-v="apps"]', 900)
    await tap(pg, '[data-act="filter"][data-v="ai"]', 1100)
    await smooth_scroll(pg, 200, 900)
    await tap(pg, '[data-act="open"]', 2300); await wait(pg, 600)
async def clip_monitor(pg):
    await wait(pg, 500); await tap(pg, '[data-act="scan"]', 1200)
    await tap(pg, '[data-act="tab"][data-v="monitor"]', 900)
    await tap(pg, 'input[data-chg="watch"]', 1200)
    await pg.evaluate("window.__demoEvent=true")
    await tap(pg, '[data-act="check-now"]', 2000)
    await smooth_scroll(pg, 300, 1200); await wait(pg, 1200)
async def clip_temp(pg):
    await wait(pg, 500); await tap(pg, '[data-act="scan"]', 1200)
    await tap(pg, '[data-act="tab"][data-v="apps"]', 900)
    await tap(pg, '[data-act="temp-open"]', 1300)
    await tap(pg, '[data-act="temp-set"]', 2400); await wait(pg, 500)
async def clip_guide(pg):
    await wait(pg, 500); await tap(pg, '[data-act="tab"][data-v="guide"]', 1000)
    for i in range(3):
        await tap(pg, 'input[data-chg="check"]:not(:checked)', 700)
    await smooth_scroll(pg, 900, 1400)
    try: await tap(pg, '[data-act="copy-msg"]', 1500)
    except Exception: await wait(pg, 800)
    await wait(pg, 600)

CLIPS = [('audit', 0, clip_audit), ('apps', 2, clip_apps), ('monitor', 1, clip_monitor), ('temp', 3, clip_temp), ('guide', 4, clip_guide)]

async def main(langs):
    tmp = '/tmp/straja_clips_%d' % os.getpid(); shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        for l in langs:
            for cid, fi, fn in CLIPS:
                d = os.path.join(tmp, f'{l}-{cid}'); os.makedirs(d)
                ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1, color_scheme='dark', locale=l + '-XX',
                                          record_video_dir=d, record_video_size={'width': W, 'height': H}, has_touch=True)
                await ctx.add_init_script(INIT)
                pg = await ctx.new_page()
                await pg.add_init_script("")  # keep ordering explicit
                await pg.goto(APP)
                await pg.evaluate("localStorage.setItem('straja.v1', JSON.stringify({lang:'%s'}))" % l)
                await pg.reload(); await wait(pg, 400)
                await pg.evaluate("t=>window.__cap&&window.__cap(t)", T[l]['feats'][fi][0])
                try:
                    await fn(pg)
                except Exception as e:
                    print('!!', l, cid, str(e)[:120])
                await pg.screenshot(path=f'{d}/poster.png')
                vp = await pg.video.path(); await ctx.close()
                mp4 = os.path.join(OUT, f'clip-{cid}-{l}.mp4')
                subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', vp, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '31', '-preset', 'veryfast', '-movflags', '+faststart', '-an', mp4], check=True)
                Image.open(f'{d}/poster.png').convert('RGB').save(os.path.join(OUT, f'clip-{cid}-{l}.webp'), quality=78)
                print('ok', l, cid, os.path.getsize(mp4) // 1024, 'KB', flush=True)
        await b.close()

if __name__ == '__main__':
    asyncio.run(main(sys.argv[1:] or LANGS))
