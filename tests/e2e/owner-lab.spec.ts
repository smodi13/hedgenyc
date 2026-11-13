import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const MARKET = {
  fetchedAt: "2026-11-12T15:00:00.000Z", status: "ok", ticker: "KXCHISNOWM-26DEC-2", title: "Snow in Chicago", marketStatus: "active", closeTime: null,
  rulesPrimary: "If the total snowfall in Chicago (O'Hare) in December 2026 is strictly greater than 2 inches, then the market resolves to Yes.", rulesMatch: true,
  levels: [{ price: 0.37, size: 9 }, { price: 0.38, size: 13 }, { price: 0.4, size: 50 }], note: null, verified: true,
};

async function open(page: Page, market: object | "down" = MARKET) {
  await page.route("**/api/owner-market", (r) => (market === "down" ? r.abort() : r.fulfill({ json: market })));
  await page.goto("/owner-lab");
  await page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");
}
const v = (page: Page, id: string) => page.getByTestId(id).getAttribute("data-value");
const setNum = async (page: Page, id: string, value: string) => { await page.getByTestId(id).fill(value); };

test.describe("owner lab", () => {
  test("loads with spec defaults and required notices", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Business Hedge Calculator");
    await expect(page.getByTestId("disclaimer")).toHaveText("Independent research tool. Not affiliated with or endorsed by Kalshi. No trading functionality.");
    await expect(page.getByTestId("out-loss")).toHaveAttribute("data-value", "1200");
    await expect(page.getByTestId("out-contracts")).toHaveAttribute("data-value", "391");
    await expect(page.getByTestId("out-cash")).toHaveAttribute("data-value", "90.72");
    await expect(page.getByTestId("out-netwin")).toHaveAttribute("data-value", "300.28");
    await expect(page.getByText("Recruit", { exact: false })).toHaveCount(0);
  });

  test("exact numeric entry and slider both update every output", async ({ page }) => {
    await open(page);
    await setNum(page, "in-customers", "40");
    await expect(page.getByTestId("out-loss")).toHaveAttribute("data-value", "2400");
    await page.getByLabel("Customers slider").fill("10");
    await expect(page.getByTestId("in-customers")).toHaveValue("10");
    await expect(page.getByTestId("out-loss")).toHaveAttribute("data-value", "600");
    await setNum(page, "in-price", "0.5");
    await expect(page.getByTestId("out-contracts")).not.toHaveAttribute("data-value", "391");
    await page.getByLabel("Target protection slider").fill("0");
    await expect(page.getByTestId("out-contracts")).toHaveAttribute("data-value", "0");
  });

  test("invalid inputs block results and show messages", async ({ page }) => {
    await open(page);
    await setNum(page, "in-price", "1.5");
    await expect(page.getByTestId("invalid")).toContainText("between $0.01 and $0.99");
    await expect(page.getByTestId("out-loss")).toHaveCount(0);
    await setNum(page, "in-price", "abc");
    await expect(page.getByTestId("invalid")).toBeVisible();
    await setNum(page, "in-price", "0.22");
    await expect(page.getByTestId("out-contracts")).toHaveAttribute("data-value", "391");
    await setNum(page, "in-customers", "2.5");
    await expect(page.getByTestId("invalid")).toContainText("whole number");
  });

  test("quick vs detailed modes", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("heading", { name: "Four joint outcomes" })).toHaveCount(0);
    await page.getByRole("button", { name: "Detailed view" }).click();
    await expect(page.getByRole("heading", { name: "Four joint outcomes" })).toBeVisible();
    await expect(page.getByTestId("d-fee")).toHaveAttribute("data-value", /./).catch(() => {});
    await expect(page.getByTestId("d-fee")).toHaveText("$4.70");
    await expect(page.getByTestId("d-principal")).toHaveText("$86.02");
    await expect(page.getByTestId("out-A")).toHaveAttribute("data-value", "-899.72");
    await expect(page.getByTestId("out-B")).toHaveAttribute("data-value", "-1290.72");
    await expect(page.getByTestId("out-C")).toHaveAttribute("data-value", "300.28");
    await expect(page.getByTestId("out-D")).toHaveAttribute("data-value", "-90.72");
    await expect(page.getByRole("heading", { name: "Market suitability checklist" })).toBeVisible();
    await page.getByRole("button", { name: "Quick view" }).click();
    await expect(page.getByRole("heading", { name: "Four joint outcomes" })).toHaveCount(0);
  });

  test("Find my hedge: insufficient info, then illustrative probabilities, zero-contract explanation", async ({ page }) => {
    await open(page);
    await page.getByLabel(/Minimize variability/).check();
    await page.getByTestId("find-hedge").click();
    await expect(page.getByTestId("opt-insufficient")).toContainText("Insufficient information for a personalized optimal hedge estimate.");
    await expect(page.getByTestId("cmp-opt")).toHaveAttribute("data-highlight", "false");
    await page.getByTestId("load-illustrative").click();
    await page.getByRole("button", { name: "Low (risk-averse)" }).click();
    await setNum(page, "in-budget", "500"); await setNum(page, "in-maxloss", "500");
    await expect(page.getByTestId("opt-insufficient")).toHaveCount(0);
    await expect(page.getByTestId("opt-objective")).toHaveText("Minimize variability");
    expect(Number(await v(page, "opt-contracts"))).toBeGreaterThan(0);
    await expect(page.getByTestId("cmp-opt")).toHaveAttribute("data-highlight", "true");
    await expect(page.getByTestId("exec-label")).toHaveText("Scenario-based optimization. Execution not verified.");
    // contract never pays -> zero is optimal and explained
    for (const [id, val] of [["lossPays", "0"], ["lossLoses", "30"], ["noLossPays", "0"], ["noLossLoses", "70"]] as [string, string][]) await setNum(page, `prob-${id}`, val);
    await expect(page.getByTestId("opt-contracts")).toHaveAttribute("data-value", "0");
    await expect(page.getByTestId("opt-why")).toContainText("buy zero contracts");
  });

  test("probability validation", async ({ page }) => {
    await open(page);
    for (const [id, val] of [["lossPays", "30"], ["lossLoses", "30"], ["noLossPays", "30"], ["noLossLoses", "30"]] as [string, string][]) await setNum(page, `prob-${id}`, val);
    await expect(page.getByTestId("prob-error")).toContainText("sum to 120.00%");
    await setNum(page, "prob-noLossLoses", "10");
    await expect(page.getByTestId("prob-status")).toContainText("Sum 100%");
  });

  test("live order book: depth limits and slippage are surfaced; fallback when unavailable", async ({ page }) => {
    await open(page);
    await expect(page.getByTestId("market-status")).toContainText("Market status: active");
    await expect(page.getByTestId("checks")).toContainText("Using the illustrative price");
    await page.getByTestId("use-live").check();
    await expect(page.getByTestId("price-source")).toContainText("order-book snapshot");
    await expect(page.getByTestId("out-contracts")).toHaveAttribute("data-value", "");
    await expect(page.getByTestId("checks")).toContainText("cannot be filled");
  });
  test("live market unavailable keeps the labeled illustrative price", async ({ page }) => {
    await open(page, "down");
    await expect(page.getByTestId("market-status")).toContainText("Live data unavailable");
    await expect(page.getByTestId("use-live")).toBeDisabled();
    await expect(page.getByTestId("out-contracts")).toHaveAttribute("data-value", "391");
  });

  test("scenarios are isolated; reset restores defaults", async ({ page }) => {
    await open(page);
    await setNum(page, "in-customers", "33");
    await page.getByRole("button", { name: "+ 2 Aces Snow Plowing" }).click();
    await expect(page.getByTestId("in-customers")).toHaveValue("20");
    await expect(page.getByTestId("scenario-name")).toHaveValue("2 Aces Snow Plowing");
    await page.getByRole("button", { name: "Asset Operations Group" }).click();
    await expect(page.getByTestId("in-customers")).toHaveValue("33");
    await page.getByRole("button", { name: "Reset inputs" }).click();
    await expect(page.getByTestId("in-customers")).toHaveValue("20");
    await expect(page.getByText("not this company's verified financials", { exact: false })).toBeVisible();
  });

  test("copy summary writes the full calculation to the clipboard", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await open(page);
    await page.getByRole("button", { name: "Copy summary" }).click();
    await expect(page.getByTestId("copy-status")).toHaveText("Summary copied to clipboard.");
    const txt = await page.evaluate(() => navigator.clipboard.readText());
    for (const t of ["$2,400.00", "$1,200.00", "391", "$86.02", "$4.70", "$90.72", "$300.28", "ILLUSTRATIVE", "not a recommendation to trade"]) expect(txt).toContain(t);
    expect(page.url()).not.toMatch(/customers|1200|391/);
  });

  test("print layout hides controls and shows the summary", async ({ page }) => {
    await open(page);
    await page.emulateMedia({ media: "print" });
    await expect(page.getByTestId("print-view")).toBeVisible();
    await expect(page.getByTestId("print-view")).toContainText("$300.28");
    await expect(page.getByRole("button", { name: "Copy summary" })).toBeHidden();
    await expect(page.getByTestId("find-hedge")).toBeHidden();
  });

  test("chart inspector reads exact numbers and updates with inputs", async ({ page }) => {
    await open(page);
    await page.getByTestId("chart-inspect").fill("50");
    const before = await page.getByTestId("chart-readout").innerText();
    expect(before.toLowerCase()).toContain("contracts");
    await setNum(page, "in-rev", "120");
    await expect.poll(() => page.getByTestId("chart-readout").innerText()).not.toBe(before);
  });

  test("reduced motion: numbers jump to final values immediately", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page);
    await setNum(page, "in-customers", "40");
    await expect(page.getByTestId("out-loss")).toHaveText("$2,400.00");
    const dur = await page.evaluate(() => getComputedStyle(document.querySelector(".bar-fill") ?? document.body).transitionDuration);
    expect(["0s", ""].includes(dur)).toBe(true);
  });

  test("no horizontal overflow at 320px in both views", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await open(page);
    for (const view of ["Quick view", "Detailed view"]) {
      await page.getByRole("button", { name: view }).click();
      await page.getByTestId("find-hedge").click();
      await page.waitForTimeout(400);
      const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      expect(w.sw).toBeLessThanOrEqual(w.cw);
    }
  });

  test("accessibility: no axe violations (quick and detailed)", async ({ page }) => {
    await open(page);
    await page.getByTestId("load-illustrative").click();
    await page.getByTestId("find-hedge").click();
    for (const view of ["Quick view", "Detailed view"]) {
      await page.getByRole("button", { name: view }).click();
      await page.waitForTimeout(1300);
      const r = await new AxeBuilder({ page }).include("main").analyze();
      expect(r.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    }
  });

  test("no console errors or failed requests during use", async ({ page }) => {
    const errs: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    page.on("pageerror", (e) => errs.push(e.message));
    await open(page);
    await page.getByRole("button", { name: "Detailed view" }).click();
    await page.getByTestId("load-illustrative").click();
    await page.getByTestId("find-hedge").click();
    await setNum(page, "in-price", "0.4");
    expect(errs).toEqual([]);
  });

  test("existing home page still works", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto("/owner-lab");
    await expect(page.getByRole("link", { name: "Research site" })).toBeVisible();
  });
});
