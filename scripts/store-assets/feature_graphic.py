import asyncio
from playwright.async_api import async_playwright
ICON=open('assets/icon.svg').read().replace('width="192" height="192" viewBox="0 0 192 192"','width="220" height="220" viewBox="18 18 156 156"')
assert 'viewBox="18 18' in ICON
HTML=f"""<html><head><style>
html,body{{margin:0;width:1024px;height:500px;overflow:hidden}}
body{{background:linear-gradient(120deg,#0b6f86 0%,#0a3d5c 38%,#071530 100%);font-family:Inter,sans-serif;color:#fff;display:flex;align-items:center;gap:56px;padding:0 84px;box-sizing:border-box;position:relative}}
.glow{{position:absolute;right:-120px;top:-160px;width:560px;height:560px;border-radius:50%;background:radial-gradient(circle,#28ccec55 0%,#28ccec00 70%)}}
.icon{{flex:none;border-radius:44px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.45)}}
.icon svg{{display:block}}
h1{{margin:0;font-size:108px;font-weight:800;letter-spacing:-3px;line-height:1}}
p{{margin:22px 0 0;font-size:40px;font-weight:600;line-height:1.2;color:#d7f6fc}}
p b{{color:#5ee0f5}}
</style></head><body><div class="glow"></div><div class="icon">{ICON}</div><div><h1>Leftly</h1><p>Know what’s <b>left</b><br>after every paycheck</p></div></body></html>"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1024,'height':500})
        await pg.set_content(HTML); await pg.wait_for_timeout(300)
        await pg.screenshot(path='feature-graphic.png'); await b.close()
asyncio.run(main())
