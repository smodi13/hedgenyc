import { chromium } from "@playwright/test";
const [w, h, prefix] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4]];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 600, isMobile: w < 600 });
const p = await ctx.newPage();
await p.goto("http://localhost:3100/", { waitUntil: "networkidle" });
await p.waitForSelector("html[data-hydrated]");
await p.waitForTimeout(2500);
await p.evaluate(() => document.querySelectorAll("[data-reveal]").forEach((e) => e.classList.add("in")));
// hero scrolled to lens state
await p.evaluate((h) => window.scrollTo(0, h * 1.05), h);
await p.waitForTimeout(900);
await p.screenshot({ path: `screenshots/${prefix}-hero-scrolled.png` });
for (const id of ["thesis", "risk", "cases", "lab", "market-fit", "concepts", "pipeline", "evidence"]) {
  await p.evaluate((i) => document.getElementById(i)?.scrollIntoView({ block: "start" }), id);
  await p.waitForTimeout(500);
  await p.locator("#" + id).screenshot({ path: `screenshots/${prefix}-sec-${id}.png` });
}
await p.evaluate(() => document.getElementById("screen")?.scrollIntoView());
await p.getByLabel("Search name, sector, risk, fact").fill("sail");
await p.waitForTimeout(600);
await p.locator("#screen").screenshot({ path: `screenshots/${prefix}-sec-screen.png` });
await p.locator("#screen ol button").first().click();
await p.waitForTimeout(900);
await p.screenshot({ path: `screenshots/${prefix}-drawer.png` });
if (w < 1024) { await p.keyboard.press("Escape"); await p.evaluate(() => scrollTo(0, 0)); await p.getByRole("button", { name: "Open menu" }).click(); await p.waitForTimeout(500); await p.screenshot({ path: `screenshots/${prefix}-menu.png` }); }
await b.close();
