import asyncio
from playwright.async_api import async_playwright
OUT='store-assets-raw'
INIT="""try{localStorage.setItem('leftly.offlineReadyNoticeSeen','1');localStorage.setItem('leftly.backupReminderSnoozedUntil','2099-01-01T00:00:00.000Z')}catch(e){}"""
async def clickv(pg, name, wait=700):
    for b in await pg.get_by_role('button').all():
        try:
            if await b.is_visible() and (await b.inner_text()).split('\n')[0].strip()==name:
                await b.click(); await pg.wait_for_timeout(wait); return True
        except Exception: pass
    print('not found', name); return False
async def newpage(b):
    ctx=await b.new_context(viewport={'width':390,'height':780}, device_scale_factor=3, is_mobile=True, has_touch=True)
    await ctx.add_init_script(INIT)
    pg=await ctx.new_page(); await pg.goto('http://localhost:4173/'); await pg.wait_for_timeout(1500); return pg
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        # setup screen (fresh)
        pg=await newpage(b)
        await pg.get_by_role('button', name='Set up my first paycheck').click(); await pg.wait_for_timeout(500)
        await pg.get_by_placeholder('3200').fill('2150'); await pg.wait_for_timeout(200)
        await pg.locator('body').click(position={'x':5,'y':5}); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/05-setup.png')
        # demo data
        pg=await newpage(b)
        await pg.get_by_role('button', name='Open More').click(); await pg.wait_for_timeout(400)
        await clickv(pg,'Data & backup'); await clickv(pg,'Load demo data'); await clickv(pg,'Load demo and replace local data',1500)
        await pg.get_by_role('button', name='Go to Overview').click(); await pg.wait_for_timeout(800)
        await pg.screenshot(path=f'{OUT}/01-overview.png')
        await pg.get_by_role('button', name='Add an expense').click(); await pg.wait_for_timeout(800)
        await pg.screenshot(path=f'{OUT}/02-quick-add.png')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        await pg.get_by_role('button', name='Go to Bill Plan').click(); await pg.wait_for_timeout(800)
        await pg.screenshot(path=f'{OUT}/03-bill-plan.png')
        await pg.get_by_role('button', name='Go to History').click(); await pg.wait_for_timeout(800)
        await pg.screenshot(path=f'{OUT}/04-history.png')
        await pg.get_by_role('button', name='Go to Overview').click(); await pg.wait_for_timeout(500)
        if await clickv(pg,'View forecast',900): await pg.screenshot(path=f'{OUT}/06-forecast.png')
        await b.close()
asyncio.run(main())
