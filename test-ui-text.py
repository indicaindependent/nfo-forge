import asyncio, json, base64
from playwright.async_api import async_playwright
async def main():
    errs=[]; res=[]
    def ok(n,c,x=""): res.append((n,bool(c),x)); print(("PASS " if c else "FAIL ")+n+(" "+str(x) if (x and not c) else ""))
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":1500,"height":1100},accept_downloads=True); pg=await ctx.new_page()
        pg.on("console",lambda m: errs.append(m.text) if m.type=="error" else None)
        pg.on("pageerror",lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:8765/index.html"); await pg.wait_for_timeout(600)
        out=await pg.inner_text("#out")
        ok("blank template renders",out.startswith("╔") and "YOUR RELEASE NAME" in out)
        lines=out.rstrip("\n").split("\n"); ok("every line 79 wide",all(len(l)==79 for l in lines),[len(l) for l in lines][:5])
        st=await pg.inner_text("#status"); ok("status says all chars fit",("fit CP437" in st),st)
        # live edit
        await pg.fill("#title","HELLO WORLD"); await pg.wait_for_timeout(150)
        ok("live edit updates preview","HELLO WORLD" in await pg.inner_text("#out"))
        # width change
        await pg.fill("#width","60"); await pg.wait_for_timeout(150)
        l2=(await pg.inner_text("#out")).rstrip("\n").split("\n"); ok("width 60 respected",all(len(l)==60 for l in l2),set(len(l) for l in l2))
        # lossy warning
        await pg.fill("#tagline","emoji \u2728 test"); await pg.wait_for_timeout(150)
        ok("lossy char warned in status","?" in await pg.inner_text("#status") and "CP437" in await pg.inner_text("#status"),await pg.inner_text("#status"))
        await pg.fill("#tagline","clean tagline")
        # invalid sections json
        await pg.fill("#sections","{not json"); await pg.wait_for_timeout(150)
        ok("bad sections JSON reported",("invalid" in (await pg.inner_text("#status")).lower()),await pg.inner_text("#status"))
        await pg.fill("#sections",'[{"heading":"Ok","body":"fine"}]')
        # add / remove field
        n0=await pg.locator(".fieldrow").count(); await pg.click("#addField"); n1=await pg.locator(".fieldrow").count()
        ok("add field",n1==n0+1,(n0,n1)); await pg.locator(".fieldrow button").last.click(); ok("remove field",await pg.locator(".fieldrow").count()==n0)
        # download .nfo and verify bytes
        await pg.fill("#width","79")
        async with pg.expect_download() as d: await pg.click("#dlNfo")
        dl=await d.value; path=await dl.path(); data=open(path,"rb").read()
        ok("download filename is slug.nfo",dl.suggested_filename=="hello-world.nfo",dl.suggested_filename)
        ok("downloaded file has SAUCE",data[-128:-123]==b"SAUCE")
        ok("downloaded file has EOF 0x1A directly before SAUCE",data[len(data)-129]==0x1a,hex(data[len(data)-129]))
        body=data.split(b"\x1a")[0]
        ok("body is real CP437 (0xC9 corner present)",b"\xc9" in body and b"\xbb" in body,body[:4])
        ok("body has CRLF line endings",b"\r\n" in body)
        txt=body.decode("cp437").replace("\r\n","\n"); ok("CP437 body decodes to preview text",txt==await pg.inner_text("#out") or txt.rstrip("\n")==(await pg.inner_text("#out")).rstrip("\n"))
        # json export then reload
        async with pg.expect_download() as d2: await pg.click("#dlJson")
        dj=await d2.value; saved=json.load(open(await dj.path()))
        ok("json export has fields + sauce",isinstance(saved.get("fields"),list) and "sauce" in saved)
        open("/tmp/roundtrip.json","w").write(json.dumps(saved))
        await pg.fill("#title","CHANGED"); await pg.set_input_files("#loadJson","/tmp/roundtrip.json"); await pg.wait_for_timeout(300)
        ok("json import restores title",await pg.input_value("#title")=="HELLO WORLD",await pg.input_value("#title"))
        # open an existing nfo (our own downloaded one) as viewer
        await pg.set_input_files("#openFile",path); await pg.wait_for_timeout(300)
        stv=await pg.inner_text("#status"); ok("viewer reads SAUCE",("SAUCE" in stv),stv)
        # theme
        await pg.select_option("#theme","amber"); ok("theme class applied","theme-amber" in await pg.get_attribute("#stage","class"))
        await pg.screenshot(path="screenshot-app.png",full_page=False)
        # mobile
        m=await b.new_context(viewport={"width":390,"height":800}); mp=await m.new_page(); await mp.goto("http://localhost:8765/index.html"); await mp.wait_for_timeout(500)
        ow=await mp.evaluate("document.documentElement.scrollWidth"); ok("no horizontal page overflow at 390px",ow<=392,ow)
        await mp.screenshot(path="screenshot-mobile.png")
        ok("no console errors",not errs,errs)
        await b.close()
    bad=[r for r in res if not r[1]]; print(f"\n{len(res)-len(bad)} passed, {len(bad)} failed")
asyncio.run(main())
