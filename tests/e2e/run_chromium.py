"""End-to-end checks of the real extension in real Chromium against a local fake watch page.

Development only: needs Playwright for Python and an X display (for example `xvfb-run -a`).
Set CHROME_PATH to use a specific Chromium build. YouTube itself is never contacted.
"""

import asyncio
import glob
import os
from pathlib import Path
import sys
import tempfile

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
PAGE = (Path(__file__).parent / "fake_watch.html").read_text(encoding="utf-8")
BUTTON = "#transcript-copier-button"
SENTINEL = "SENTINEL-CLIPBOARD"


def chrome_path():
    if os.environ.get("CHROME_PATH"):
        return os.environ["CHROME_PATH"]
    found = sorted(glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome")))
    return found[-1] if found else None


async def set_clipboard(page, text):
    await page.evaluate(
        """t => { const a=document.createElement('textarea'); a.id='__c'; a.value=t; document.body.append(a); a.select(); document.execCommand('copy'); a.remove(); }""",
        text,
    )


async def read_clipboard(page):
    await page.evaluate("""() => { const a=document.createElement('textarea'); a.id='__p'; document.body.append(a); a.focus(); }""")
    await page.keyboard.press("Control+V")
    await page.wait_for_timeout(100)
    return await page.evaluate("""() => { const a=document.getElementById('__p'); const v=a.value; a.remove(); return v; }""")


async def state(page, wanted, timeout=20000):
    await page.wait_for_function(
        "w => w.includes(document.querySelector('#transcript-copier-button')?.dataset.state)", arg=wanted, timeout=timeout
    )


class Results:
    failed = 0

    def check(self, name, condition, detail=""):
        print(f"{'PASS' if condition else 'FAIL'}  {name}{'' if condition else f'  -> {detail}'}")
        if not condition:
            self.failed += 1


async def main():
    results = Results()
    extension = sys.argv[1] if len(sys.argv) > 1 else str(ROOT)
    async with async_playwright() as playwright:
        with tempfile.TemporaryDirectory() as profile:
            context = await playwright.chromium.launch_persistent_context(
                profile, headless=False, executable_path=chrome_path(), viewport={"width": 1200, "height": 800},
                args=[f"--disable-extensions-except={extension}", f"--load-extension={extension}"],
            )

            async def fake(route):
                await route.fulfill(status=200, content_type="text/html", body=PAGE)

            await context.route("https://www.youtube.com/**", fake)
            page = context.pages[0]
            worker = context.service_workers[0] if context.service_workers else await context.wait_for_event("serviceworker")

            await page.goto("https://www.youtube.com/watch?v=AAAAAAAAAAA")
            await page.wait_for_selector(BUTTON)
            results.check("button mounts once", await page.locator(BUTTON).count() == 1)

            await set_clipboard(page, SENTINEL)
            await page.click(BUTTON)
            await state(page, ["copied", "error"])
            text = await read_clipboard(page)
            results.check("copies every row in order", text.startswith("AAAAAAAAAAA line 0 ") and text.endswith("line 23"), text[:80])
            results.check("excludes timestamps and a11y labels", "second label" not in text and "0:01" not in text, text[:80])
            results.check("panel closed afterwards", await page.get_attribute("#panel", "visibility") == "ENGAGEMENT_PANEL_VISIBILITY_HIDDEN")
            results.check("hide marker removed", await page.evaluate("!document.documentElement.hasAttribute('data-transcript-copier-extracting')"))

            await page.evaluate("spa('VIRTBBBBBBB')")
            await page.wait_for_timeout(300)
            results.check("single button after SPA navigation", await page.locator(BUTTON).count() == 1)
            await page.click(BUTTON)
            await state(page, ["copied", "error"], 60000)
            text = await read_clipboard(page)
            results.check("reads every row of a recycled 1500-row list", len(text.split(" line ")) == 1501 and text.endswith("line 1499"), f"{len(text.split(' line '))}")

            await page.evaluate("rerenderActions()")
            await page.wait_for_timeout(300)
            results.check("remounts after YouTube re-renders", await page.locator(BUTTON).count() == 1)

            await page.evaluate("spa('NONEccccccc')")
            await page.wait_for_timeout(300)
            await set_clipboard(page, SENTINEL)
            await page.click(BUTTON)
            await state(page, ["error"])
            results.check("no captions: visible error", "No transcript" in await page.inner_text("#transcript-copier-toast"))
            results.check("no captions: clipboard unchanged", await read_clipboard(page) == SENTINEL)

            await page.wait_for_timeout(2500)
            await page.evaluate("spa('SLOWddddddd')")
            await page.wait_for_timeout(300)
            await set_clipboard(page, SENTINEL)
            await page.click(BUTTON)
            await page.wait_for_timeout(500)
            await page.evaluate("spa('AAAAAAAAAAA')")
            await page.wait_for_function("document.querySelector('#transcript-copier-toast')?.textContent.includes('Video changed')", timeout=10000)
            results.check("stale navigation: clipboard unchanged", await read_clipboard(page) == SENTINEL)

            await page.wait_for_timeout(2500)
            await page.click(BUTTON)
            await page.click(BUTTON)
            await page.wait_for_timeout(100)
            await state(page, ["copied", "error"])
            results.check("double click runs once", (await read_clipboard(page)).count("line 23") == 1)

            await page.wait_for_timeout(2500)
            await set_clipboard(page, SENTINEL)
            await page.evaluate("document.body.focus()")
            await worker.evaluate("chrome.commands.onCommand.dispatch('copy-transcript')")
            await state(page, ["busy", "copied"])
            await state(page, ["copied"])
            results.check("keyboard command, no user gesture", (await read_clipboard(page)).endswith("line 23"))

            extension_id = worker.url.split("/")[2]
            popup = await context.new_page()
            await popup.goto(f"chrome-extension://{extension_id}/src/popup/popup.html")
            results.check("remove timestamps is on by default", await popup.is_checked("#removeTimestamps"))
            results.check("popup shows the product name", await popup.inner_text("#name") == "Transcript Copier")
            await popup.uncheck("#removeTimestamps")
            await popup.wait_for_timeout(200)
            await popup.close()
            await page.bring_to_front()
            await page.wait_for_timeout(2500)
            await page.click(BUTTON)
            await state(page, ["busy", "copied"])
            await state(page, ["copied"])
            text = await read_clipboard(page)
            results.check("turning the toggle off adds timestamps", text.startswith("[00:00] AAAAAAAAAAA line 0\n"), text[:60])

            await page.goto("https://www.youtube.com/feed/subscriptions")
            await page.wait_for_timeout(800)
            results.check("no button off watch pages", await page.locator(BUTTON).count() == 0)
            await context.close()
    print(f"\n{results.failed} failure(s)")
    return 1 if results.failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
