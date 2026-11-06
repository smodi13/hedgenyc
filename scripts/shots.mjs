// Visual QA: captures viewport screenshots of each chapter. Usage: node scripts/shots.mjs <width> <height> <prefix>
import { chromium } from "@playwright/test";
const [w, h, prefix] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4]];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 600, isMobile: w < 600 });
const p = await ctx.newPage();
const errs = [];
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
p.on("pageerror", (e) => errs.push("PAGEERR " + e.message));
await p.goto("http://localhost:3100/", { waitUntil: "networkidle" });
await p.waitForTimeout(3500);
await p.screenshot({ path: `screenshots/${prefix}-hero.png` });
for (const id of ["thesis", "risk", "screen", "cases", "lab", "market-fit", "concepts", "pipeline", "evidence"]) {
  await p.evaluate((i) => document.getElementById(i)?.scrollIntoView({ behavior: "instant", block: "start" }), id);
  await p.waitForTimeout(1300);
  await p.screenshot({ path: `screenshots/${prefix}-${id}.png` });
}
const ow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
console.log("horizontal overflow px:", ow, "errors:", errs);
await b.close();
