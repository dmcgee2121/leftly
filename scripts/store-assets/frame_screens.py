import asyncio, base64
from playwright.async_api import async_playwright
caps = [
 ('01-overview','Know what’s <b>safe to spend</b>','Every paycheck, at a glance'),
 ('02-quick-add','Add spending <b>in seconds</b>','One tap from any screen'),
 ('03-bill-plan','Plan bills <b>before they’re due</b>','Recurring bills, ready each payday'),
 ('04-history','See how each <b>paycheck went</b>','Averages and trends over time'),
 ('06-forecast','Look ahead to your <b>next paycheck</b>','Try “what if” income safely'),
 ('05-setup','Set up in <b>about a minute</b>','No account. No bank connection.'),
]
TPL = """<html><head><style>
html,body{margin:0;width:1080px;height:1920px;overflow:hidden}
body{background:radial-gradient(1200px 800px at 50% -10%,#0e3a4a 0%,#071224 45%,#040812 100%);font-family:Inter,sans-serif;color:#f8fafc;display:flex;flex-direction:column;align-items:center}
h1{margin:120px 80px 0;font-size:84px;line-height:1.08;font-weight:700;letter-spacing:-1.5px;text-align:center}
h1 b{color:#5ee0f5;font-weight:800}
p{margin:28px 0 0;font-size:42px;color:#9fb3c8;font-weight:500}
.phone{margin-top:72px;width:680px;height:1360px;border-radius:64px;overflow:hidden;border:10px solid #1c2c44;box-shadow:0 40px 120px rgba(0,0,0,.55),0 0 0 2px #2b4060}
.phone img{width:100%;display:block}
</style></head><body><h1>{h}</h1><p>{s}</p><div class="phone"><img src="data:image/png;base64,{img}"></div></body></html>"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1080,'height':1920}, device_scale_factor=1)
        for i,(f,h,s) in enumerate(caps,1):
            img=base64.b64encode(open(f'store-assets-raw/{f}.png','rb').read()).decode()
            await pg.set_content(TPL.replace('{h}',h).replace('{s}',s).replace('{img}',img)); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f'store-assets-out/framed-{i:02d}.png')
        await b.close()
asyncio.run(main())
