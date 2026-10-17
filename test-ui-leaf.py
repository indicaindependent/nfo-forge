import asyncio, os, sys
from playwright.async_api import async_playwright
URL=os.environ.get("NFO_URL","http://localhost:8765/index.html")
APPROVED=os.environ.get("APPROVED","/tmp/approved-A.keep")
async def main():
    errs=[]; res=[]
    def ok(n,c,x=""): res.append(bool(c)); print(("PASS " if c else "FAIL ")+n+(" -> "+str(x)[:200] if (x and not c) else ""))
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":1500,"height":1100},accept_downloads=True); pg=await ctx.new_page()
        pg.on("console",lambda m: errs.append(m.text) if m.type=="error" else None)
        pg.on("pageerror",lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(400)
        await pg.click("#tabPic"); await pg.set_input_files("#picFile","/tmp/pic-test.png"); await pg.wait_for_timeout(400)
        before=await pg.inner_text("#out")
        await pg.click("#leafBox summary"); await pg.wait_for_timeout(100)
        ok("leaf controls visible once opened", await pg.is_visible("#leafMake"))
        # responsiveness: while the worker paints, the main thread must keep running. Count timer ticks during the paint.
        await pg.evaluate("window.__ticks=0; window.__iv=setInterval(()=>window.__ticks++,50)")
        await pg.click("#leafMake")
        ok("button disabled while painting", await pg.is_disabled("#leafMake"))
        ok("status says it is painting", "Painting" in await pg.inner_text("#leafStatus"), await pg.inner_text("#leafStatus"))
        await pg.wait_for_function("document.getElementById('out').textContent.indexOf('INDICA')>=0", timeout=30000)
        ticks=await pg.evaluate("clearInterval(window.__iv); window.__ticks")
        ok("page stayed responsive during the paint (timer kept ticking)", ticks>=15, f"{ticks} ticks in the paint")
        out=await pg.inner_text("#out"); lines=out.rstrip("\n").split("\n")
        want=open(APPROVED).read().rstrip("\n").split("\n")
        ok("browser leaf is BYTE-IDENTICAL to the approved piece", lines==want, f"{sum(1 for a,b2 in zip(lines,want) if a!=b2)} differing lines of {len(want)}; got {len(lines)} rows")
        ok("56 rows, every line 80 wide", len(lines)==56 and all(len(l)==80 for l in lines), (len(lines), sorted(set(len(l) for l in lines))))
        ok("keyboard ASCII only", all(32<=ord(c)<=126 for l in lines for c in l))
        ok("button re-enabled afterwards", not await pg.is_disabled("#leafMake"))
        ok("status reports the time", "Painted in" in await pg.inner_text("#leafStatus"), await pg.inner_text("#leafStatus"))
        # the bug caught while wiring: saving must save the LEAF, not re-render the picture over it
        async with pg.expect_download() as d: await pg.click("#picDlTxt")
        dl=await d.value; await dl.save_as("/tmp/leaf-dl.txt"); saved=open("/tmp/leaf-dl.txt").read().rstrip("\n").split("\n")
        ok("downloaded .txt is the leaf, not the picture preview", saved==want, f"{len(saved)} rows; first line {saved[0][:30]!r}")
        async with pg.expect_download() as d2: await pg.click("#picDlNfo")
        dl2=await d2.value; await dl2.save_as("/tmp/leaf-dl.nfo"); nraw=open("/tmp/leaf-dl.nfo","rb").read()
        ok(".nfo contains the leaf", b"INDICA INDEPENDENT MEDIA" in nraw and b"SAUCE00" in nraw[-140:])
        # cache: a second click with the same options is instant
        t=await pg.evaluate("""()=>new Promise(r=>{const t=performance.now();document.getElementById('leafMake').click();setTimeout(()=>r(performance.now()-t),0)})""")
        ok("repeat with same options is served from cache", "cache" in (await pg.inner_text("#leafStatus")).lower(), await pg.inner_text("#leafStatus"))
        # custom text
        await pg.fill("#leafTitle","TEST TITLE"); await pg.fill("#leafLetters","ABC"); await pg.fill("#leafTag","MY TAGLINE")
        await pg.click("#leafMake"); await pg.wait_for_function("document.getElementById('out').textContent.indexOf('TEST TITLE')>=0", timeout=30000)
        o2=(await pg.inner_text("#out")).rstrip("\n").split("\n")
        ok("custom title, tagline appear", "TEST TITLE" in o2[1] and any("MY TAGLINE" in l for l in o2))
        ok("custom text keeps every line 80 wide", all(len(l)==80 for l in o2), sorted(set(len(l) for l in o2)))
        # touching a picture control returns to the live picture
        await pg.select_option("#picMode","shade"); await pg.wait_for_timeout(300)
        o3=await pg.inner_text("#out"); ok("changing a picture control returns to the picture preview", "TEST TITLE" not in o3 and len(o3)>200)
        # worker failure falls back rather than hanging
        await pg.evaluate("(()=>{const R=window.Worker;window.Worker=function(u){if(String(u).indexOf('showcase-worker')>=0)throw new Error('no workers');return new R(u)}})()")
        await pg.fill("#leafTitle","FALLBACK"); await pg.click("#leafMake")
        await pg.wait_for_function("document.getElementById('out').textContent.indexOf('FALLBACK')>=0", timeout=30000)
        ok("falls back to a direct call when Workers are unavailable", True)
        # a title far too long cannot widen the frame
        await pg.fill("#leafTitle","X"*76); await pg.click("#leafMake")
        await pg.wait_for_function("document.getElementById('out').textContent.indexOf('XXXXXXXX')>=0", timeout=30000)
        o4=(await pg.inner_text("#out")).rstrip("\n").split("\n"); ok("a maximum-length title still fits the frame", all(len(l)==80 for l in o4), sorted(set(len(l) for l in o4)))
        ok("no console errors", not errs, errs[:3])
        await b.close()
    print(f"\n{sum(res)} passed, {len(res)-sum(res)} failed"); sys.exit(0 if all(res) else 1)
asyncio.run(main())
