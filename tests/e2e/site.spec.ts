import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const mockSnap = (over: object = {}) => ({
  fetchedAt: "2026-11-06T18:00:00.000Z", status: "ok", source: "https://external-api.kalshi.com/trade-api/v2/markets",
  items: [
    { researchId: "KXRAINWKND-26NOV07-NYC", event: "Measurable rainfall in NYC", sourceUrl: "https://kalshi.com/x", settlementProxy: "proxy", basisMismatch: "high", state: "market", group: null, error: null,
      market: { ticker: "KXRAINWKND-26NOV07-NYC", eventTicker: "E", title: "Mock rain market", status: "closed", closeTime: "2026-11-09T05:00:00Z", updatedTime: "2026-11-09T06:00:00Z", result: "no", yesBid: 0.2, yesAsk: 0.22, yesBidSize: 5, yesAskSize: 5, last: 0.21, volume: 10, openInterest: 20, rulesPrimary: "rule text" },
      book: null, bookNote: 'Market status is "closed"; treated as a historical reference, no order book requested.' },
    { researchId: "KXDIESELW-26NOV09-T6.18", event: "Diesel", sourceUrl: "https://kalshi.com/y", settlementProxy: "p", basisMismatch: "b", state: "market", group: null, error: null,
      market: { ticker: "KXDIESELW-26NOV09-T6.18", eventTicker: "E2", title: "Mock diesel market", status: "active", closeTime: null, updatedTime: null, result: null, yesBid: 0.19, yesAsk: 0.2, yesBidSize: 5, yesAskSize: 5, last: 0.2, volume: 1, openInterest: 1, rulesPrimary: null },
      book: { empty: true, bestYesBid: null, bestYesBidSize: null, impliedYesAsk: null, impliedYesAskSize: null, spread: null, yesLevels: 0, noLevels: 0 }, bookNote: "Order book is empty: no resting bids or offers." },
    { researchId: "NOPE", event: "Missing", sourceUrl: "https://kalshi.com/z", settlementProxy: "p", basisMismatch: "b", state: "not_found", market: null, book: null, bookNote: null, group: null, error: null },
  ],
  ...over,
});

async function gotoHome(page: Page, hash = "") {
  await page.goto("/" + hash);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
}
const count = (page: Page) => page.getByRole("status").filter({ hasText: /businesses?\s·/ });

test.describe("content integrity & chrome", () => {
  test("hero, counts, disclaimers, no console errors, no horizontal overflow", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await gotoHome(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Every business is exposed.");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Not every risk is hedgeable.");
    await expect(page.getByText("Independent research, not affiliated with Kalshi").first()).toBeVisible();
    await expect(page.locator("footer")).toContainText("Independent research work sample. Not affiliated with Kalshi. Illustrative scenarios, not financial advice. No business outreach or trading has occurred.");
    const hero = page.locator("#top");
    await expect(hero).toContainText("47");
    await expect(hero).toContainText("company-site records");
    await expect(hero).toContainText("discovery-only candidates");
    const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(o).toBe(0);
    expect(errors).toEqual([]);
  });

  test("no fabricated claims anywhere on the page", async ({ page }) => {
    await gotoHome(page);
    const txt = (await page.locator("body").innerText()).toLowerCase();
    for (const bad of ["trade now", "buy now", "customer confirmed", "testimonial", "we interviewed", "place order"]) expect(txt).not.toContain(bad);
    await expect(page.locator("#pipeline")).toContainText("0 of 47 records have been contacted");
  });

  test("external links are safe", async ({ page }) => {
    await gotoHome(page);
    const bad = await page.$$eval('a[href^="http"]', (as) => (as as HTMLAnchorElement[]).filter((a) => a.getAttribute("target") !== "_blank" || !/noopener/.test(a.rel) || !/noreferrer/.test(a.rel)).map((a) => a.href));
    expect(bad).toEqual([]);
  });

  test("404 page is branded and safe", async ({ page }) => {
    const res = await page.goto("/definitely-missing");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("not in the research");
    await expect(page.getByText("Independent research, not affiliated with Kalshi").first()).toBeVisible();
  });

  test("OG metadata and favicon", async ({ page }) => {
    await gotoHome(page);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /HedgeNYC/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    expect(await page.locator('link[rel="icon"]').count()).toBeGreaterThan(0);
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
  });
});

test.describe("origination screen", () => {
  test("filters, search, counters and reset all work together", async ({ page }) => {
    await gotoHome(page);
    await page.locator("#screen").scrollIntoViewIfNeeded();
    const status = count(page);
    await expect(status).toContainText("47 businesses · 33 company-site · 14 directory");
    await page.getByRole("button", { name: "Directory", exact: true }).click();
    await expect(status).toContainText("14 businesses · 0 company-site · 14 directory");
    await page.getByRole("button", { name: "Company-site", exact: true }).click();
    await expect(status).toContainText("33 businesses · 33 company-site · 0 directory");
    await page.getByLabel("Search name, sector, risk, fact").fill("  SAILING ");
    await expect(status).not.toContainText("33 businesses");
    const n = Number(/^(\d+)/.exec((await status.innerText()).trim())![1]);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(33);
    await page.getByLabel("Industry").selectOption("Marine tourism");
    await expect(status).toContainText(`${n} `.slice(0, 1));
    await page.getByLabel("Search name, sector, risk, fact").fill("zzzz-no-such-company");
    await expect(page.getByText("No records match these filters.")).toBeVisible();
    await page.getByRole("button", { name: "Reset filters" }).first().click();
    await expect(status).toContainText("47 businesses");
  });

  test("hide-directory checkbox mirrors the evidence filter", async ({ page }) => {
    await gotoHome(page);
    await page.getByLabel("Hide unverified directory leads").check();
    await expect(count(page)).toContainText("33 businesses · 33 company-site · 0 directory");
    await page.getByLabel("Hide unverified directory leads").uncheck();
    await expect(count(page)).toContainText("47 businesses");
  });

  test("sorting changes order", async ({ page }) => {
    await gotoHome(page);
    const first = () => page.locator("#screen ol > li").first().innerText();
    const a = await first();
    await page.getByLabel("Sort").selectOption("name");
    await expect.poll(first).not.toBe(a);
    await expect.poll(first).toContain("Admire Landscaping");
  });

  test("company drawer: details, source link, score explanation, Escape, focus return", async ({ page }) => {
    await gotoHome(page);
    await page.getByLabel("Search name, sector, risk, fact").fill("Brooklyn Sail");
    const row = page.locator("#screen ol button", { hasText: "Brooklyn Sail" }).first();
    await row.click();
    const dlg = page.getByRole("dialog", { name: "Brooklyn Sail" });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole("link", { name: /bksail\.com\/details/ })).toHaveAttribute("href", "https://www.bksail.com/details");
    await expect(dlg).toContainText("NOT CONTACTED");
    await expect(dlg).toContainText("/ 100 · ANALYST TRIAGE");
    await expect(dlg).toContainText("Risk clarity");
    expect(page.url()).toContain("#business-HNY-001");
    await page.keyboard.press("Escape");
    await expect(dlg).toBeHidden();
    await expect(row).toBeFocused();
  });

  test("directory record has no invented URL; deep link opens the drawer", async ({ page }) => {
    await gotoHome(page, "#business-HNY-027");
    const dlg = page.getByRole("dialog", { name: "NYC Water Cruises Pier 36" });
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText("No first-party company source in the dataset");
    await expect(dlg.locator('a[href^="http"]')).toHaveCount(0);
    await dlg.getByRole("button", { name: "Close business details" }).click();
    await expect(dlg).toBeHidden();
  });

  test("negative controls are flagged do-not-pitch", async ({ page }) => {
    await gotoHome(page);
    await page.getByLabel("Search name, sector, risk, fact").fill("Foods of NY");
    await page.locator("#screen ol button", { hasText: "Foods of NY Tours" }).first().click();
    await expect(page.getByRole("dialog")).toContainText("Do not pitch");
  });
});

test.describe("case studies", () => {
  test("tabs: keyboard nav and dispositions", async ({ page }) => {
    await gotoHome(page);
    const tabs = page.getByRole("tablist", { name: "Case studies" });
    await tabs.scrollIntoViewIfNeeded();
    await expect(page.getByRole("tabpanel")).toContainText("HOLD: BASIS RISK NOT YET ACCEPTABLE");
    await tabs.getByRole("tab", { name: /Brooklyn Sail/ }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.getByRole("tab", { name: /Xentra/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toContainText("QUALIFY: MIX, INDEX AND TENOR UNVERIFIED");
    await expect(page.getByRole("tabpanel")).toContainText("$480.00");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tabpanel")).toContainText("PASS FOR NOW: NET STORM EXPOSURE UNKNOWN");
    await expect(page.getByRole("tabpanel")).toContainText("+$400.00");
    await page.getByRole("button", { name: /Test \$500 emergency-margin sensitivity/ }).click();
    await expect(page.getByRole("tabpanel")).toContainText("Adverse net economic exposure: $500.00");
    await tabs.getByRole("tab", { name: /Arborpolitan/ }).focus();
    await page.keyboard.press("Home");
    await expect(page.getByRole("tabpanel")).toContainText("$330.00");
  });

  test("case → lab handoff", async ({ page }) => {
    await gotoHome(page);
    await page.getByRole("tab", { name: /Xentra/ }).click();
    await page.getByRole("button", { name: /Stress-test this case/ }).click();
    await expect(page.locator("#lab").getByRole("button", { name: "Xentra Transport", exact: true, pressed: true })).toBeVisible();
  });
});

test.describe("hedge lab", () => {
  const tile = (page: Page, id: string) => page.getByTestId(id);
  test("Brooklyn Sail defaults reproduce the analyst model", async ({ page }) => {
    await gotoHome(page);
    await expect(tile(page, "m-cash")).toContainText("$111.79");
    await expect(tile(page, "m-cash")).toContainText("$107.50 premium + $4.29 fee");
    await expect(tile(page, "m-yes")).toContainText("+$138.21");
    await expect(tile(page, "m-loss")).toContainText("$330.00");
    await expect(tile(page, "m-ev")).toContainText("−$90.29");
    await expect(tile(page, "m-ev")).toContainText("incremental −$24.29");
    await expect(tile(page, "m-adverse")).toContainText("−$441.79");
    await expect(tile(page, "m-basis")).toContainText("8.0% / 23.0%");
    await expect(page.getByText("Loss + NO (basis miss)")).toBeVisible();
    await expect(page.getByRole("table", { name: /four joint states/i })).toBeVisible();
  });

  test("editing inputs recalculates; reset restores defaults", async ({ page }) => {
    await gotoHome(page);
    await page.getByTestId("contracts").fill("100");
    await expect(tile(page, "m-cash")).toContainText("$44.72"); // 43 + ceil(0.07*100*.43*.57*100)/100 = 1.72
    await page.getByTestId("price").fill("0.5");
    await expect(tile(page, "m-cash")).toContainText("$51.75");
    await page.getByRole("button", { name: /Reset to research defaults/ }).click();
    await expect(tile(page, "m-cash")).toContainText("$111.79");
    await expect(page.getByTestId("contracts")).toHaveValue("250");
  });

  test("invalid probabilities block expected value with a clear reason, rebalance fixes it", async ({ page }) => {
    await gotoHome(page);
    await page.getByTestId("p11").fill("30");
    await expect(page.getByTestId("lab-errors")).toContainText("Expected value blocked");
    await expect(page.getByTestId("lab-errors")).toContainText("sum to 118.00%");
    await expect(tile(page, "m-ev")).toContainText("Blocked");
    await page.getByRole("button", { name: /to remainder/ }).click();
    await expect(page.getByTestId("lab-errors")).toHaveCount(0);
    await expect(tile(page, "m-ev")).not.toContainText("Blocked");
  });

  test("rejects non-numeric, fractional contracts and out-of-range prices", async ({ page }) => {
    await gotoHome(page);
    await page.getByTestId("contracts").fill("2.5");
    await expect(page.getByTestId("lab-errors")).toContainText("whole number");
    await page.getByTestId("contracts").fill("250");
    await page.getByTestId("price").fill("1.2");
    await expect(page.getByTestId("lab-errors")).toContainText("strictly between");
    await page.getByTestId("price").fill("abc");
    await expect(page.getByTestId("lab-errors")).toBeVisible();
  });

  test("Xentra and Arborpolitan analyst defaults", async ({ page }) => {
    await gotoHome(page);
    await page.locator("#lab").getByRole("button", { name: "Xentra Transport", exact: true, pressed: false }).click();
    await expect(tile(page, "m-loss")).toContainText("$480.00");
    await expect(tile(page, "m-cash")).toContainText("$138.78");
    await expect(tile(page, "m-adverse")).toContainText("−$618.78");
    await page.locator("#lab").getByRole("button", { name: "Arborpolitan", exact: true, pressed: false }).click();
    await expect(tile(page, "m-loss")).toContainText("$0.00");
    await expect(page.getByRole("note")).toContainText("Analyst pass");
    await page.getByLabel("Emergency margin earned", { exact: true }).fill("500");
    await expect(tile(page, "m-loss")).toContainText("$500.00");
    await expect(tile(page, "m-cash")).toContainText("$0.00");
    await expect(page.getByRole("note")).toContainText("no suitably matched contract");
  });

  test("slider and number field are linked; keyboard operable", async ({ page }) => {
    await gotoHome(page);
    const slider = page.getByRole("slider", { name: "YES contracts slider" });
    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("contracts")).not.toHaveValue("250");
  });
});

test.describe("market feed", () => {
  test("API 503 → explicit unavailable state, research stays usable, no prices", async ({ page }) => {
    await page.route("**/api/market-snapshot", (r) => r.fulfill({ status: 503, body: "down" }));
    await gotoHome(page);
    await expect(page.locator("#top")).toContainText("Market feed unavailable. Research remains accessible.");
    await page.locator("#market-fit").scrollIntoViewIfNeeded();
    await expect(page.locator("#market-fit")).toContainText("Market feed unavailable. Research remains accessible. No prices are shown.");
    await expect(page.locator("#market-fit")).not.toContainText("YES ask");
    await expect(page.getByTestId("m-cash")).toContainText("$111.79");
  });

  test("malformed JSON → unavailable", async ({ page }) => {
    await page.route("**/api/market-snapshot", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{not json" }));
    await gotoHome(page);
    await expect(page.locator("#top")).toContainText("Market feed unavailable");
  });

  test("network failure / offline → unavailable", async ({ page }) => {
    await page.route("**/api/market-snapshot", (r) => r.abort());
    await gotoHome(page);
    await expect(page.locator("#top")).toContainText("Market feed unavailable");
  });

  test("API-level unavailable status is surfaced", async ({ page }) => {
    await page.route("**/api/market-snapshot", (r) => r.fulfill({ json: { fetchedAt: "2026-11-06T18:00:00Z", status: "unavailable", items: [], source: "x" } }));
    await gotoHome(page);
    await expect(page.locator("#top")).toContainText("Market feed unavailable");
  });

  test("valid snapshot: timestamp, closed = historical reference, empty book, not-found, no order UI", async ({ page }) => {
    await page.route("**/api/market-snapshot", (r) => r.fulfill({ json: mockSnap() }));
    await gotoHome(page);
    await expect(page.locator("#top")).toContainText("status checked at");
    await page.locator("#market-fit").scrollIntoViewIfNeeded();
    const mf = page.locator("#market-fit");
    await expect(mf).toContainText("Historical reference · status: closed");
    await expect(mf).toContainText("Order book is empty");
    await expect(mf).toContainText("Not found in the public market API");
    await expect(mf).toContainText("API status: active");
    await expect(mf).toContainText("Discovered contract · not verified live");
    await expect(mf.getByRole("button", { name: /buy|sell|trade|order/i })).toHaveCount(0);
    await expect(mf.locator("form")).toHaveCount(0);
    await expect(mf).toContainText("2026-11-06 18:00 UTC");
  });

  test("observed ask is opt-in and never silently replaces illustrative price", async ({ page }) => {
    await page.route("**/api/market-snapshot", (r) => r.fulfill({ json: mockSnap() }));
    await gotoHome(page);
    await page.locator("#lab").getByRole("button", { name: "Xentra Transport", exact: true, pressed: false }).click();
    await expect(page.getByTestId("price")).toHaveValue("0.38");
    const btn = page.getByRole("button", { name: /Use observed YES ask \$0\.20/ });
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.getByTestId("price")).toHaveValue("0.2");
    await expect(page.getByText(/Price taken from an observed ask/)).toBeVisible();
    await expect(page.getByTestId("p11")).toHaveValue("24");
  });

  test("real server route returns well-formed JSON (live or unavailable)", async ({ request }) => {
    const res = await request.get("/api/market-snapshot");
    expect(res.status()).toBe(200);
    const j = await res.json();
    expect(["ok", "partial", "unavailable"]).toContain(j.status);
    expect(new Date(j.fetchedAt).toString()).not.toBe("Invalid Date");
    expect(Array.isArray(j.items)).toBe(true);
    expect(JSON.stringify(j)).not.toMatch(/api[_-]?key|authorization/i);
  });
});

test.describe("concepts, pipeline, evidence", () => {
  test("three concepts are labelled as unlisted proposals", async ({ page }) => {
    await gotoHome(page);
    await expect(page.getByText("Not an actual Kalshi-listed contract")).toHaveCount(3);
    await expect(page.getByText("Unapproved research concept")).toHaveCount(3);
    const b = page.getByRole("button", { name: /NYC extreme rain/ });
    await b.click();
    await expect(b).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#concept-B")).toContainText("1.0 inch");
  });

  test("downloads exist and are byte-identical to the research files", async ({ page, request }) => {
    await gotoHome(page);
    const manifest: Record<string, string> = {
      "HedgeNYC_Executive_Research_Brief.pdf": "research/HedgeNYC_Executive_Research_Brief.pdf",
      "HedgeNYC_Three_Owner_Education_Briefs.pdf": "research/HedgeNYC_Three_Owner_Education_Briefs.pdf",
      "HedgeNYC_Formula_Driven_Hedging_Model.xlsx": "model/HedgeNYC_Formula_Driven_Hedging_Model.xlsx",
      "prospects.csv": "research/prospects.csv", "prospects.json": "research/prospects.json", "markets.json": "research/markets.json", "sources.csv": "research/sources.csv",
    };
    const links = await page.$$eval('a[href^="/downloads/"]', (as) => as.map((a) => a.getAttribute("href")!));
    expect(links.sort()).toEqual(Object.keys(manifest).map((f) => "/downloads/" + f).sort());
    for (const l of links) {
      const res = await request.get(l);
      expect(res.status(), l).toBe(200);
      const body = await res.body();
      expect(body.length).toBeGreaterThan(1000);
      expect(createHash("sha256").update(body).digest("hex"), l).toBe(createHash("sha256").update(readFileSync(manifest[l.split("/").pop()!]!)).digest("hex"));
    }
  });

  test("browser download event fires for the workbook and the report", async ({ page }) => {
    await gotoHome(page);
    for (const name of ["Formula-driven hedging model", "Executive research brief"]) {
      const link = page.getByRole("link", { name: new RegExp(name) });
      await link.scrollIntoViewIfNeeded();
      const [dl] = await Promise.all([page.waitForEvent("download"), link.click()]);
      expect(dl.suggestedFilename()).toMatch(/\.(xlsx|pdf)$/);
    }
  });

  test("source register lists 36 sources with anchors", async ({ page }) => {
    await gotoHome(page);
    await expect(page.locator("#evidence tbody tr[id^='S']")).toHaveCount(36);
  });
});

test.describe("navigation & motion", () => {
  test("skip link and nav anchors", async ({ page }) => {
    await gotoHome(page);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
    expect(page.url()).toContain("#main");
  });

  test("desktop nav scrolls to chapter and marks it current", async ({ page, isMobile }) => {
    test.skip(isMobile || (page.viewportSize()?.width ?? 0) < 1024, "desktop nav only");
    await gotoHome(page);
    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Hedge Lab" }).click();
    await expect(page.locator("#lab")).toBeInViewport();
    await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Hedge Lab" })).toHaveAttribute("aria-current", "location");
  });

  test("mobile menu: opens, traps focus, Escape closes and restores focus", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 1024, "mobile menu only");
    await gotoHome(page);
    const btn = page.getByRole("button", { name: "Open menu" });
    await btn.click();
    const menu = page.getByRole("dialog", { name: "Site menu" });
    await expect(menu).toBeVisible();
    const n = await menu.locator("a").count();
    expect(n).toBe(6);
    for (let i = 0; i < n + 3; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest("#mobile-menu") || document.activeElement?.getAttribute("aria-controls") === "mobile-menu")).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
    await page.getByRole("button", { name: "Open menu" }).click();
    await menu.getByRole("link", { name: /Hedge Lab/ }).click();
    await expect(menu).toBeHidden();
    await expect(page.locator("#lab")).toBeInViewport();
  });

  test("reduced motion: content visible, curtain and sticky choreography off", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await gotoHome(page);
    await expect(page.locator(".curtain")).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
    expect(await page.locator("[data-reveal]").first().evaluate((e) => getComputedStyle(e).opacity)).toBe("1");
    expect(await page.locator("#top > div").evaluate((e) => getComputedStyle(e).position)).toBe("static");
    await expect(page.getByText("Does the contract actually settle on?").or(page.getByText("What does the contract actually settle on?")).first()).toBeVisible();
    await ctx.close();
  });
});

test.describe("accessibility (axe)", () => {
  const scan = async (page: Page) =>
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);

  test("home page has no WCAG A/AA violations", async ({ page }) => {
    await gotoHome(page);
    await page.waitForTimeout(2500); // let the curtain and reveals settle
    await page.evaluate(async () => { for (const c of document.querySelectorAll("[data-reveal]")) c.classList.add("in"); });
    await page.waitForTimeout(1200);
    expect(await scan(page)).toEqual([]);
  });

  test("open drawer has no violations", async ({ page }) => {
    await gotoHome(page, "#business-HNY-002");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.waitForTimeout(800);
    expect(await scan(page)).toEqual([]);
  });

  test("invalid-lab state has no violations", async ({ page }) => {
    await gotoHome(page);
    await page.getByTestId("p11").fill("40");
    await page.evaluate(() => document.querySelectorAll("[data-reveal]").forEach((c) => c.classList.add("in")));
    await page.waitForTimeout(1200);
    expect(await scan(page)).toEqual([]);
  });
});
