import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.ATOLL_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.ATOLL_PREVIEW_URL || "http://127.0.0.1:1425";
const out = process.env.ATOLL_SCREENSHOT_DIR || "artifacts/codenotch";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1000, height: 720 }, reducedMotion: "reduce" });
await context.addInitScript(() => {
  localStorage.setItem("atoll.first-run-complete.v1", "true");
  localStorage.setItem("atoll.settings.v1", JSON.stringify({ language: "en", hideInFullscreen: true, codexUsageEnabled: false, notchEdge: "top", notchVisibility: "auto" }));
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(String(error)));
const checks = [];
const state = async expected => page.waitForFunction(s => document.querySelector("#app")?.dataset.shell === s, expected);
const open = async (preview, edge="top") => {
  await page.goto(base + "/?preview=" + preview + "&edge=" + edge);
  await page.waitForSelector("#app[data-shell]:not([data-shell=hidden])");
};
try {
  await open("reef");
  let bounds = await page.locator(".notch-reef").boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await state("compact");
  await page.locator("[data-notch-panel=media]").hover();
  await state("expanded");
  await page.waitForSelector(".expanded--media");
  await page.mouse.move(990,700);
  await state("reef");
  checks.push("hover reveals rail and media; leaving dismisses");

  await open("compact-media");
  await page.mouse.move(990,700);
  await page.keyboard.press("Tab");
  await state("expanded");
  await page.waitForTimeout(120);
  await page.keyboard.press("Escape");
  await state("reef");
  checks.push("keyboard Tab opens detail without focus recursion; Escape closes");

  await open("compact-media");
  await page.locator("[data-notch-panel=media]").click();
  await state("expanded");
  await page.locator(".notch-rail").evaluate(element => element.click());
  await page.mouse.move(990,700);
  await page.waitForTimeout(650);
  assert.equal(await page.locator("#app").getAttribute("data-shell"),"expanded");
  await page.locator(".notch-rail").evaluate(element => element.click());
  await page.mouse.move(990,700);
  await state("reef");
  checks.push("blank rail click pins detail; unpin and leave dismiss");

  await open("expanded-volume");
  const range = page.locator("[data-control=system-volume]").first();
  await range.evaluate(element => {
    element.value = "35";
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dataset.dragProbe = "retained";
    document.querySelector("[data-action=notch-pin]").click();
  });
  assert.equal(await range.getAttribute("data-drag-probe"), "retained", "a repaint request must not replace the active slider");
  await range.evaluate(element => element.dispatchEvent(new Event("change", { bubbles: true })));
  await page.waitForFunction(() => document.querySelector("[data-control=system-volume]")?.value === "35");
  assert.equal(await page.locator("#app").getAttribute("data-shell"),"expanded");
  await page.locator("[data-action=toggle-volume-mute]").first().click();
  checks.push("volume input and mute preserve expanded panel; active drag survives repaint");

  await open("settings");
  for (const edge of ["right","bottom","left","top"]) {
    await page.locator("[data-action=set-notch-edge][data-value="+edge+"]").click();
    await page.waitForFunction(e => document.querySelector("#app")?.dataset.edge === e, edge);
    assert.equal(await page.locator("[data-action=set-notch-edge][data-value="+edge+"]").getAttribute("aria-pressed"),"true");
  }
  await page.locator("[data-action=set-notch-visibility][data-value=always]").click();
  await page.keyboard.press("Escape");
  await state("compact");
  await page.mouse.move(990,700);
  await page.waitForTimeout(600);
  assert.equal(await page.locator("#app").getAttribute("data-shell"),"compact");
  checks.push("four edge settings and always-visible rail work");

  await open("expanded-media");
  await page.locator("[data-action=media-toggle]").first().click();
  assert.equal(await page.locator("#app").getAttribute("data-shell"),"expanded");
  checks.push("existing media transport still responds");

  const screenshots = [];
  if (!process.env.ATOLL_SKIP_SCREENSHOTS) for (const edge of ["top","right","bottom","left"]) {
    for (const preview of ["compact-media","expanded-codex","expanded-media","expanded-energy","settings"]) {
      await open(preview,edge);
      await page.emulateMedia({ colorScheme: edge==="top" || edge==="left" ? "light" : "dark" });
      await page.addStyleTag({content:"body{background:#bfcbd4}html{background:#bfcbd4}"});
      await page.waitForTimeout(180);
      const overflow = await page.locator(".notch-detail").evaluateAll(nodes => nodes.map(n => ({client:n.clientWidth,scroll:n.scrollWidth})));
      assert.ok(overflow.every(x=>x.scroll<=x.client+2),edge+" "+preview+" horizontal overflow");
      const filename=out+"/"+edge+"-"+preview+".png";
      await page.screenshot({path:filename});
      screenshots.push(filename);
    }
  }
  // Desktop accessibility scaling: no horizontal overflow at 150% and 200% DPR.
  for (const scale of [1.5,2]) {
    const scaled = await browser.newContext({ viewport:{width:800,height:600}, deviceScaleFactor:scale, reducedMotion:"reduce" });
    const p=await scaled.newPage();
    await p.goto(base+"/?preview=expanded-media&edge=left");
    await p.waitForSelector(".notch-detail");
    assert.ok(await p.locator(".notch-detail").evaluate(n=>n.scrollWidth<=n.clientWidth+2));
    await scaled.close();
  }
  checks.push("four edge layouts plus 150%/200% DPR fit");
  assert.deepEqual(errors,[]);
  const report={checks,screenshots,pageErrors:errors};
  await writeFile(out+"/browser-report.json",JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally {
  await browser.close();
}
