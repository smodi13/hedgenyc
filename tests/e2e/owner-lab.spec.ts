import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const EARLY = "If Chicago O'Hare records more than 2 inches of December snowfall, this contract can close and settle early. A NO position would then expire worthless, even if December has not ended. Official reporting and confirmation may take time.";
const RULES = "If the total snowfall in Chicago (O'Hare) in December 2026 is strictly greater than 2 inches, then the market resolves to Yes.";
const LIQ = "Insufficient displayed liquidity for this proposed position.";
const NO_ASKS = [{ price: 0.37, size: 9 }, { price: 0.38, size: 13 }, { price: 0.4, size: 50 }];
const YES_ASKS = [{ price: 0.7, size: 100 }];

const contract = (ticker: string, floor: number, over: Record<string, unknown> = {}) => ({
  ticker, eventTicker: "KXCHISNOWM-26DEC", seriesTicker: "KXCHISNOWM", title: "Snow in Chicago in Dec 2026?", subtitle: null,
  yesSub: `Above ${floor} inches`, noSub: `Above ${floor} inches`, status: "active", closeTime: "2027-01-01T06:00:00Z", expirationTime: "2027-01-08T06:00:00Z",
  strikeType: "greater", floorStrike: floor, capStrike: null, rulesPrimary: RULES.replace("2 inches", `${floor} inches`), rulesSecondary: "Secondary rule text.",
  canCloseEarly: true, earlyCloseCondition: "This market will close early if the event occurs.", category: "Climate and Weather", feeType: "quadratic", feeMultiplier: 1,
  yesAsks: YES_ASKS, noAsks: NO_ASKS, bookOk: true, bookNote: null, fetchedAt: "2026-11-12T15:00:00.000Z",
  url: "https://kalshi.com/markets/kxchisnowm/kxchisnowm-26dec", ...over,
});
const SIBS = [2, 4, 6].map((n) => ({ ticker: `KXCHISNOWM-26DEC-${n}`, label: `Above ${n} inches`, status: "active", strikeType: "greater", floorStrike: n, capStrike: null, closeTime: "2027-01-01T06:00:00Z" }));

interface Opts { down?: boolean; over?: Record<string, unknown> }
const requests: string[] = [];

async function open(page: Page, o: Opts = {}) {
  requests.length = 0;
  page.on("request", (r) => { if (r.url().includes("/api/")) requests.push(r.url() + (r.postData() ?? "")); });
  await page.route("**/api/kalshi/market**", (r) => {
    if (o.down) return r.abort();
    const t = new URL(r.request().url()).searchParams.get("ticker") ?? "";
    if (t === "NOPE-1") return r.fulfill({ json: { status: "not_found", contract: null, note: `No market with ticker ${t} was returned.`, siblings: [] } });
    const m = /-(\d+)$/.exec(t), floor = m ? Number(m[1]) : 2;
    return r.fulfill({ json: { status: "ok", contract: contract(t, floor, o.over), note: null, siblings: SIBS } });
  });
  await page.route("**/api/kalshi/search**", (r) => {
    if (o.down) return r.abort();
    const u = new URL(r.request().url());
    if (!u.searchParams.get("q") && !u.searchParams.get("category")) return r.fulfill({ json: { status: "ok", fetchedAt: "x", categories: ["Climate and Weather", "Sports"], events: [], truncated: false, note: null } });
    return r.fulfill({ json: { status: "ok", fetchedAt: "x", categories: ["Climate and Weather"], truncated: false, note: null, events: [{ eventTicker: "KXCHISNOWM-26DEC", seriesTicker: "KXCHISNOWM", title: "Snow in Chicago in Dec 2026?", subTitle: "In Dec 2026", category: "Climate and Weather", markets: SIBS }] } });
  });
  await page.goto("/owner-lab");
  await page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");
  if (!o.down) await expect(page.getByTestId("c-ticker-0")).toHaveText("KXCHISNOWM-26DEC-2");
}
const val = (page: Page, id: string) => page.getByTestId(id).getAttribute("data-value");
const set = async (page: Page, id: string, value: string) => { await page.getByTestId(id).fill(value); };
const full = (page: Page) => page.getByRole("button", { name: "Full detail" }).click();

// independent reference: cost of C contracts at a single price, M = 1, fee + cost rounded up to $0.0001
const refCost = (c: number, p: number) => Math.ceil(Math.round((c * p + 0.07 * c * p * (1 - p)) * 1e8) / 1e4 - 1e-6) / 1e4;
const refMax = (budget: number, p: number) => { let c = 0; while (refCost(c + 1, p) <= budget + 1e-9) c++; return c; };

test.describe("owner lab: business profile and hedge builder", () => {
  test("loads with the four steps, notices and the spec defaults", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Business Hedge Builder");
    await expect(page.getByTestId("disclaimer")).toHaveText("Independent research. Not affiliated with or endorsed by Kalshi. No trade execution.");
    const nav = page.getByRole("navigation", { name: "Steps" });
    for (const t of ["Understand your business", "Understand your financial exposure", "Explore available Kalshi contracts", "Compare potential hedging strategies"]) await expect(nav.getByText(t)).toBeVisible();
    await expect(page.getByTestId("out-loss")).toHaveAttribute("data-value", "1200");
    await expect(page.getByTestId("out-contracts")).toHaveAttribute("data-value", "391");
    expect(Number(await val(page, "out-cash"))).toBeCloseTo(90.7167, 4);
    expect(Number(await val(page, "out-netwin"))).toBeCloseTo(300.2833, 4);
    await expect(page.getByText("Recruit", { exact: false })).toHaveCount(0);
    await expect(page.getByText("This business bills per push")).toBeVisible();
    await expect(page.getByTestId("seasonal-on")).toHaveCount(0);
  });

  test("illustrative example fills Low / Normal / High and computes exact figures", async ({ page }) => {
    await open(page);
    await page.getByTestId("load-example").click();
    const rev = (c: number, v: number) => c * v * 60;
    await expect(page.getByTestId("rev-low")).toHaveText(`$${rev(150, 1).toLocaleString("en-US")}.00`);
    await expect(page.getByTestId("rev-normal")).toHaveText(`$${rev(250, 3).toLocaleString("en-US")}.00`);
    await expect(page.getByTestId("rev-high")).toHaveText(`$${rev(350, 5).toLocaleString("en-US")}.00`);
    await expect(page.getByTestId("contrib-low")).toHaveText("$4,500.00");
    await expect(page.getByTestId("dvs-low")).toHaveText("−$18,000.00");
    await expect(page.getByTestId("out-short-low")).toHaveAttribute("data-value", "18000");
    await expect(page.getByTestId("out-short-high")).toHaveAttribute("data-value", "0");
    await expect(page.getByTestId("exposure-sentence")).toHaveText("Based on the information entered, an unusually light-activity 2026-12 could reduce your contribution by approximately $18,000 compared with a normal 2026-12.");
    await expect(page.getByTestId("scenario-chart")).toBeVisible();
    await expect(page.getByTestId("verif")).toHaveValue("illustrative");
  });

  test("exact entry and slider both update outputs; commercial and fixed costs behave", async ({ page }) => {
    await open(page);
    await set(page, "low-resvis", "0");
    await expect(page.getByTestId("out-loss")).toHaveAttribute("data-value", "1800");
    await page.getByLabel("low residential visits slider").fill("1");
    await expect(page.getByTestId("low-resvis")).toHaveValue("1");
    await expect(page.getByTestId("out-loss")).toHaveAttribute("data-value", "1200");
    await set(page, "normal-comcust", "2"); await set(page, "normal-comrev", "200");
    // normal: 20*3*60 + 2*3*200 = 4800 revenue, quick 50% -> 2400; low: 1200*0.5 = 600 (no commercial in low)
    await expect(page.getByTestId("rev-normal")).toHaveText("$4,800.00");
    await expect(page.getByTestId("out-loss")).toHaveAttribute("data-value", "1800");
    const short = await val(page, "out-short-low");
    await page.getByTestId("fixed-costs").getByLabel("Overhead", { exact: true }).first().fill("1000");
    await expect(page.getByTestId("fixed-normal")).toHaveText("$1,000.00");
    await expect(page.getByTestId("noi-normal")).toHaveText("$1,400.00");
    expect(await val(page, "out-short-low")).toBe(short);
  });

  test("quick and detailed modes never stack margin and costs", async ({ page }) => {
    await open(page);
    await expect(page.getByTestId("variable-costs")).toHaveCount(0);
    await page.getByRole("button", { name: /Detailed: revenue minus costs/ }).click();
    await expect(page.getByTestId("variable-costs")).toBeVisible();
    await expect(page.getByTestId("low-margin")).toHaveCount(0);
    await expect(page.getByTestId("var-low")).toHaveText("$600.00"); // 20 visits x (22+5+3)
    await expect(page.getByTestId("marg-low")).toHaveText("50.0%");
    await set(page, "high-othercost", "3000");
    await expect(page.getByTestId("contrib-high")).toHaveText("$0.00"); // revenue 6000 - visit costs 3000 - incremental 3000
  });

  test("generic business may enter actual seasonal revenue; AOG never can", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "+ New / Custom Business" }).click();
    await page.getByTestId("seasonal-on").check();
    await set(page, "in-seasonal", "5000");
    await expect(page.getByTestId("rev-low")).toHaveText("$6,200.00");
    await expect(page.getByTestId("rev-normal")).toHaveText("$8,600.00");
    await expect(page.getByTestId("out-loss")).toHaveAttribute("data-value", "1200");
    await page.getByRole("button", { name: "Asset Operations Group" }).click();
    await expect(page.getByTestId("seasonal-on")).toHaveCount(0);
  });

  test("invalid business inputs block results with messages, then recover", async ({ page }) => {
    await open(page);
    await set(page, "in-period", "December");
    await expect(page.getByTestId("invalid")).toContainText("Modeling period");
    await expect(page.getByTestId("out-loss")).toHaveCount(0);
    await set(page, "in-period", "2026-12");
    await set(page, "normal-resrev", "-5");
    await expect(page.getByTestId("invalid")).toContainText("dollar amount");
    await set(page, "normal-resrev", "60");
    await set(page, "normal-rescust", "2.5");
    await expect(page.getByTestId("invalid")).toContainText("whole number");
    await set(page, "normal-rescust", "20");
    await expect(page.getByTestId("out-contracts")).toHaveAttribute("data-value", "391");
  });

  test("contract selector: search, pick a strike, look up a ticker, handle not-found; business data survives", async ({ page }) => {
    await open(page);
    await set(page, "low-rescust", "33");
    await page.getByTestId("search-q-0").fill("snow chicago");
    await page.getByTestId("search-go-0").click();
    await page.getByTestId("results-0").getByRole("button", { name: "Above 4 inches" }).click();
    await expect(page.getByTestId("c-ticker-0")).toHaveText("KXCHISNOWM-26DEC-4");
    await expect(page.getByTestId("c-status-0")).toHaveText("Open for trading");
    await expect(page.getByTestId("c-time-0")).toHaveText("2026-11-12T15:00:00.000Z");
    await page.getByTestId("ticker-in-0").fill("kxchisnowm-26dec-6");
    await page.getByTestId("ticker-go-0").click();
    await expect(page.getByTestId("c-ticker-0")).toHaveText("KXCHISNOWM-26DEC-6");
    await page.getByTestId("ticker-in-0").fill("NOPE-1");
    await page.getByTestId("ticker-go-0").click();
    await expect(page.getByTestId("contract-note-0")).toContainText("No market with ticker NOPE-1");
    await expect(page.getByTestId("low-rescust")).toHaveValue("33"); // no reset
    await page.getByTestId("ticker-in-0").fill("KXCHISNOWM-26DEC-2");
    await page.getByTestId("ticker-go-0").click();
    await expect(page.getByTestId("rules-0")).toHaveText(RULES);
    await expect(page.getByTestId("early-0")).toContainText(EARLY);
  });

  test("YES / NO side changes the offers shown and the suitability screen", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Live prices" }).click();
    await expect(page.getByTestId("ladder-0")).toContainText("$0.37");
    await page.getByRole("button", { name: "YES", exact: true }).click();
    await expect(page.getByTestId("ladder-0")).toContainText("$0.70");
    await page.getByTestId("confirm-threshold").check();
    await expect(page.getByTestId("suit-label")).toHaveText("Material mismatch");
    await page.getByRole("button", { name: "NO", exact: true }).click();
    await expect(page.getByTestId("suit-label")).toHaveText("Potentially aligned");
    await page.getByTestId("confirm-threshold").uncheck();
    await expect(page.getByTestId("suit-label")).toHaveText("Needs more information");
  });

  test("budget-first sizing: most whole contracts inside the budget, no forced 25%", async ({ page }) => {
    await open(page);
    await page.getByTestId("mode-budget").click();
    await expect(page.getByTestId("headline")).toHaveText("Enter the most you want to spend.");
    await set(page, "in-budget", "100");
    const want = refMax(100, 0.22);
    await expect(page.getByTestId("out-contracts")).toHaveAttribute("data-value", String(want));
    expect(Number(await val(page, "out-cash"))).toBeLessThanOrEqual(100);
    expect(Number(await val(page, "out-cash"))).toBeCloseTo(refCost(want, 0.22), 4);
    await expect(page.getByTestId("headline")).toContainText(`${want.toLocaleString("en-US")} whole contracts`);
    await set(page, "in-maxloss", "30");
    await expect(page.getByTestId("out-contracts")).toHaveAttribute("data-value", String(refMax(30, 0.22)));
  });

  test("protection-first sizing: 37-cent price with a $150 budget has no valid position", async ({ page }) => {
    await open(page);
    await page.getByTestId("in-price-0").fill("0.37");
    await expect(page.getByTestId("out-contracts")).toHaveAttribute("data-value", "489");
    await set(page, "in-budget", "150");
    await expect(page.getByTestId("headline")).toHaveText("No valid position.");
    await expect(page.getByTestId("headline-reason")).toContainText("489 contracts");
    await set(page, "in-budget", "200");
    await expect(page.getByTestId("out-contracts")).toHaveAttribute("data-value", "489");
    await set(page, "in-coverage", "50");
    await expect(page.getByTestId("headline")).toHaveText("No valid position."); // ~977 contracts exceed $200
    await set(page, "in-budget", "500");
    expect(Number(await val(page, "out-netwin"))).toBeGreaterThanOrEqual(600);
    await expect(page.getByTestId("headline-reason")).toContainText("target, not an optimum");
  });

  test("risk-reducing mode needs probabilities, then optimizes; zero contracts is allowed", async ({ page }) => {
    await open(page);
    await page.getByTestId("mode-risk").click();
    await expect(page.getByTestId("need-info")).toHaveText("More information is needed to estimate a personalized risk-reducing hedge.");
    await set(page, "in-budget", "500");
    await page.getByTestId("open-analyst").click();
    await expect(page.getByTestId("analyst")).toBeVisible();
    await page.getByTestId("load-illustrative").click();
    await expect(page.getByTestId("prob-status")).toContainText("Sum 100%");
    await expect(page.getByTestId("stat-loss")).toContainText("30.0%");
    await expect(page.getByTestId("stat-cond")).toContainText("66.7%");
    await expect(page.getByTestId("opt-result")).toContainText("Minimize variability");
    expect(Number(await val(page, "out-contracts"))).toBeGreaterThan(0);
    for (const [id, v] of [["lossPays", "0"], ["lossLoses", "30"], ["noLossPays", "0"], ["noLossLoses", "70"]] as [string, string][]) await set(page, `prob-${id}`, v);
    await expect(page.getByTestId("out-contracts")).toHaveAttribute("data-value", "0");
    await expect(page.getByTestId("opt-why")).toContainText("zero contracts");
  });

  test("live pricing: depth, price cap, liquidity message; manual price is labeled illustrative", async ({ page }) => {
    await open(page);
    await expect(page.getByText("Illustrative only. Not an executable quote.").first()).toBeVisible();
    await expect(page.getByTestId("liquidity-line")).toContainText("not checked against the order book");
    await page.getByRole("button", { name: "Live prices" }).click();
    await expect(page.getByTestId("liquidity-msg")).toContainText(LIQ);
    await expect(page.getByTestId("liquidity-msg")).toContainText("contracts would be needed");
    await page.getByTestId("mode-budget").click();
    await set(page, "in-budget", "5000");
    await expect(page.getByTestId("out-contracts")).toHaveAttribute("data-value", "72"); // 9 + 13 + 50 displayed
    await expect(page.getByTestId("liquidity-msg")).toContainText(LIQ);
    await set(page, "in-cap-0", "0.38");
    await expect(page.getByTestId("out-contracts")).toHaveAttribute("data-value", "22");
    await set(page, "in-budget", "5");
    await expect(page.getByTestId("liquidity-line")).toContainText("Yes: 22 contracts displayed");
    await expect(page.getByTestId("liquidity-line")).toContainText("best offer $0.37");
    await expect(page.getByTestId("c-time-0")).toHaveText("2026-11-12T15:00:00.000Z");
  });

  test("live market unavailable never substitutes the manual price", async ({ page }) => {
    await open(page, { down: true });
    await expect(page.getByTestId("contract-note-0")).toContainText("unavailable");
    await expect(page.getByTestId("out-contracts")).toHaveAttribute("data-value", "391"); // manual still works
    await page.getByRole("button", { name: "Live prices" }).click();
    await expect(page.getByTestId("liquidity-msg")).toBeVisible();
    await expect(page.getByTestId("headline")).toHaveText("No valid position.");
    await expect(page.getByTestId("out-contracts")).toHaveAttribute("data-value", "");
    await expect(page.getByTestId("liquidity-line")).not.toContainText("Yes:");
  });

  test("closed market is flagged as a mismatch and not executable", async ({ page }) => {
    await open(page, { over: { status: "closed" } });
    await expect(page.getByTestId("c-status-0")).toHaveText("closed");
    await page.getByRole("button", { name: "Live prices" }).click();
    await expect(page.getByTestId("liquidity-msg")).toContainText("not open for trading");
    await expect(page.getByTestId("suit-label")).toHaveText("Material mismatch");
  });

  test("results show four outcomes in owner language, compared with no hedge", async ({ page }) => {
    await open(page);
    const oc = page.getByTestId("outcomes");
    await expect(oc).toContainText("Your business loses revenue, and the contract pays.");
    await expect(oc).toContainText("Your business loses revenue, and the contract does not pay.");
    await expect(oc).toContainText("Your business is fine, and the contract pays.");
    await expect(oc).toContainText("Your business is fine, and the contract does not pay.");
    expect(Number(await val(page, "oc-lossPays-v"))).toBeCloseTo(-1200 + 300.2833, 4);
    expect(Number(await val(page, "oc-lossLoses-v"))).toBeCloseTo(-1200 - 90.7167, 4);
    expect(Number(await val(page, "oc-noLossPays-v"))).toBeCloseTo(300.2833, 4);
    expect(Number(await val(page, "oc-noLossLoses-v"))).toBeCloseTo(-90.7167, 4);
    await expect(oc).toContainText("No hedge:");
    await expect(page.getByTestId("out-worthless")).toHaveText("You lose $90.72");
    await expect(page.getByTestId("suit-line")).toContainText("screening only");
  });

  test("compare up to three contracts side by side without ranking", async ({ page }) => {
    await open(page);
    await expect(page.getByTestId("compare")).toHaveCount(0);
    await page.getByTestId("add-contract").click();
    await page.getByTestId("ticker-in-1").fill("KXCHISNOWM-26DEC-4");
    await page.getByTestId("ticker-go-1").click();
    await expect(page.getByTestId("c-ticker-1")).toHaveText("KXCHISNOWM-26DEC-4");
    const t = page.getByTestId("compare");
    await expect(t).toContainText("KXCHISNOWM-26DEC-2");
    await expect(t).toContainText("KXCHISNOWM-26DEC-4");
    await expect(t).toContainText("Basis risk");
    await expect(t).toContainText("Early close");
    await expect(page.getByText("The cheapest is not the best fit.")).toBeVisible();
    await page.getByTestId("add-contract").click();
    await expect(page.getByTestId("add-contract")).toHaveCount(0); // max three
  });

  test("Owner Call Mode keeps data when switching; Full detail reveals the Analyst View", async ({ page }) => {
    await open(page);
    await expect(page.getByTestId("analyst")).toBeHidden();
    await expect(page.getByTestId("sticky-summary")).toBeVisible();
    await set(page, "normal-resrev", "70");
    await full(page);
    await expect(page.getByTestId("analyst")).toBeVisible();
    await page.getByTestId("analyst").locator("summary").click();
    await expect(page.getByTestId("checks")).toContainText("Settlement rules");
    await expect(page.getByTestId("checks")).toContainText("Fee schedule");
    await page.getByRole("button", { name: "Owner Call Mode" }).click();
    await expect(page.getByTestId("normal-resrev")).toHaveValue("70");
    const size = await page.getByTestId("normal-resrev").evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(size).toBeGreaterThanOrEqual(17);
  });

  test("scenarios are isolated; Reset Illustrative Scenario restores defaults", async ({ page }) => {
    await open(page);
    await set(page, "normal-rescust", "33"); await set(page, "low-rescust", "33");
    await page.getByRole("button", { name: "+ 2 Aces Snow Plowing" }).click();
    await expect(page.getByTestId("normal-rescust")).toHaveValue("20");
    await expect(page.getByTestId("scenario-name")).toHaveValue("2 Aces Snow Plowing");
    await expect(page.getByTestId("c-ticker-0")).toHaveText("KXCHISNOWM-26DEC-2"); // contract choice is independent
    await page.getByRole("button", { name: "Asset Operations Group" }).click();
    await expect(page.getByTestId("normal-rescust")).toHaveValue("33");
    await page.getByTestId("reset").click();
    await expect(page.getByTestId("normal-rescust")).toHaveValue("20");
    await expect(page.getByText("not this company's verified financials", { exact: false })).toBeVisible();
  });

  test("copy summary and print include business, contract, early settlement and fee source", async ({ page, context, browserName }) => {
    await open(page);
    if (browserName === "chromium") {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.getByTestId("copy").click();
      await expect(page.getByTestId("copy-status")).toHaveText("Summary copied to clipboard.");
      const txt = await page.evaluate(() => navigator.clipboard.readText());
      for (const t of ["Asset Operations Group", "2026-12", "Pay-per-push", "Unverified assumptions", "KXCHISNOWM-26DEC-2", "Side: NO", "391", "$90.72", "$300.28", EARLY, "Kalshi Fee Schedule, effective July 7, 2026", "Illustrative only. Not an executable quote.", "not a recommendation to trade", "Your business loses revenue, and the contract pays"]) expect(txt).toContain(t);
      expect(page.url()).not.toMatch(/customers|1200|391/);
    }
    await page.emulateMedia({ media: "print" });
    await expect(page.getByTestId("print-view")).toBeVisible();
    await expect(page.getByTestId("print-view")).toContainText(EARLY);
    await expect(page.getByTestId("print-view")).toContainText("$300.28");
    await expect(page.getByTestId("copy")).toBeHidden();
  });

  test("privacy: business inputs never leave the browser, and nothing is saved", async ({ page }) => {
    await open(page);
    await set(page, "scenario-name", "ZzSecretCoQq");
    await set(page, "in-city", "Chicago");
    await page.getByRole("textbox", { name: "Notes" }).fill("ZzPrivateNoteQq 987654");
    await set(page, "normal-resrev", "73.17");
    await page.getByTestId("mode-budget").click();
    await set(page, "in-budget", "424242");
    await page.getByTestId("search-q-0").fill("snow");
    await page.getByTestId("search-go-0").click();
    await page.getByTestId("ticker-in-0").fill("KXCHISNOWM-26DEC-4");
    await page.getByTestId("ticker-go-0").click();
    await expect(page.getByTestId("c-ticker-0")).toHaveText("KXCHISNOWM-26DEC-4");
    for (const r of requests) {
      for (const secret of ["ZzSecretCoQq", "ZzPrivateNoteQq", "987654", "73.17", "424242"]) expect(r).not.toContain(secret);
      expect(r).toMatch(/\/api\/kalshi\/(market\?ticker=[A-Z0-9._-]+|search(\?(q=[^&]*)?&?(category=[^&]*)?)?)$/);
    }
    const stored = await page.evaluate(() => JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage }, c: document.cookie }));
    for (const secret of ["ZzSecretCoQq", "ZzPrivateNoteQq", "424242", "73.17"]) expect(stored).not.toContain(secret);
  });

  test("reduced motion: numbers jump to final values immediately", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page);
    await set(page, "low-resvis", "0");
    await expect(page.getByTestId("out-loss")).toHaveText("$1,800.00");
    const dur = await page.evaluate(() => getComputedStyle(document.querySelector(".bar-fill") ?? document.body).transitionDuration);
    expect(["0s", ""].includes(dur)).toBe(true);
  });

  test("no horizontal overflow at 320px in both views", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await open(page);
    await page.getByTestId("load-example").click();
    for (const v of ["Owner Call Mode", "Full detail"]) {
      await page.getByRole("button", { name: v }).click();
      await page.getByTestId("add-contract").click().catch(() => {});
      await page.waitForTimeout(400);
      const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      expect(w.sw).toBeLessThanOrEqual(w.cw);
    }
  });

  test("accessibility: no axe violations in Owner Call Mode and Full detail", async ({ page }) => {
    await open(page);
    await page.getByTestId("load-example").click();
    await page.getByTestId("search-q-0").fill("snow");
    await page.getByTestId("search-go-0").click();
    await expect(page.getByTestId("results-0")).toBeVisible();
    for (const v of ["Owner Call Mode", "Full detail"]) {
      await page.getByRole("button", { name: v }).click();
      if (v === "Full detail") { await page.getByTestId("mode-risk").click(); await page.getByTestId("analyst").locator("summary").click(); await page.getByTestId("load-illustrative").click(); await set(page, "in-budget", "500"); }
      await page.waitForTimeout(1300);
      const r = await new AxeBuilder({ page }).include("main").analyze();
      expect(r.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    }
  });

  test("no console errors during use", async ({ page }) => {
    const errs: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    page.on("pageerror", (e) => errs.push(e.message));
    await open(page);
    await full(page);
    await page.getByTestId("load-example").click();
    await page.getByRole("button", { name: "Live prices" }).click();
    await page.getByTestId("mode-budget").click();
    await set(page, "in-budget", "50");
    await page.getByTestId("add-contract").click();
    expect(errs).toEqual([]);
  });

  test("existing home page still works", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto("/owner-lab");
    await expect(page.getByRole("link", { name: "Research site" })).toBeVisible();
  });
});
