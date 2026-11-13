import { describe, expect, it } from "vitest";
import { analyze, buildSummary } from "@/lib/owner/analysis";
import {
  buildCostTable, cvar, evaluate, fillOrder, minContractsFor, netWin, optimize, outcomesFor, sweep, variance, type Ctx,
} from "@/lib/owner/hedge";
import {
  defaultScenario, exposure, ILLUSTRATIVE_PROBS, probState, protectedLoss, resetScenario, validate, type Scenario,
} from "@/lib/owner/model";
import { buildOwnerMarket } from "@/lib/kalshi/owner-market";
import { parseNoAskLadder } from "@/lib/kalshi/parse";

const base = () => defaultScenario();
const withP = (s: Scenario, p = ILLUSTRATIVE_PROBS): Scenario => ({ ...s, probs: { ...p }, probSource: "illustrative" });
const ctxOf = (s: Scenario, ladder: { price: number; size: number }[] | null = null): Ctx => {
  const e = exposure(s), pr = probState(s);
  return { loss: protectedLoss(s, e), table: buildCostTable(s.price, ladder), probs: pr.kind === "ok" ? pr.p : null, budget: s.budget, maxTradingLoss: s.maxTradingLoss, positionLimit: s.positionLimit, tolerance: s.tolerance, variability: s.variability };
};

describe("exposure (specification defaults)", () => {
  const e = exposure(base());
  it("revenue and margin", () => {
    expect(e.normalRevenue).toBe(3600);
    expect(e.lowRevenue).toBe(1200);
    expect(e.lostRevenue).toBe(2400);
    expect(e.lostContribution).toBe(1200);
    expect(e.normalContribution).toBe(1800);
    expect(e.lowContribution).toBe(600);
  });
  it("lost revenue never negative when low-snow visits exceed normal", () => {
    expect(exposure({ ...base(), lowVisits: 5 }).lostContribution).toBe(0);
  });
  it("cost build-up: seasonal customers keep revenue, costs follow visits", () => {
    const s: Scenario = { ...base(), method: "buildup", resCustomers: 10, comCustomers: 0, resRev: 60, perPushShare: 0.5, labor: 20, fuel: 0, salt: 0, normalVisits: 3, lowVisits: 1 };
    const e2 = exposure(s);
    // normal: 10*60*3 = 1800 rev, cost 20*10*3 = 600 -> 1200. low: push 10*60*.5*1=300 + seasonal 10*60*.5*3=900 = 1200, cost 200 -> 1000
    expect(e2.normalContribution).toBe(1200);
    expect(e2.lowContribution).toBe(1000);
    expect(e2.lostContribution).toBe(200);
  });
});

describe("position sizing: spec defaults", () => {
  const s = base(), x = ctxOf(s);
  const c = minContractsFor([300], x.table)[0]!;
  const p = evaluate(c, x);
  it("391 contracts with the expected cash figures", () => {
    expect(c).toBe(391);
    expect(p.premium).toBe(86.02);
    expect(p.fee).toBe(4.7);
    expect(p.cost).toBe(90.72);
    expect(p.netWin).toBe(300.28);
    expect(p.breakEvenProb).toBeCloseTo(90.72 / 391, 10);
  });
  it("390 contracts is one short of the target", () => {
    expect(netWin(390, x.table)).toBeLessThan(300);
  });
  it("zero target means zero contracts", () => { expect(minContractsFor([0], x.table)[0]).toBe(0); });
  it("fee rounds up to the next cent for the whole order", () => {
    expect(fillOrder(391, 0.22, null).fee).toBe(4.7); // 4.6968
    expect(fillOrder(1, 0.5, null).fee).toBe(0.02); // 0.0175
    expect(fillOrder(100, 0.5, null).fee).toBe(1.75); // exact cent, float-safe
  });
});

describe("four outcomes", () => {
  const x = ctxOf(base());
  const o = outcomesFor(391, 1200, x.table);
  it("matches the specification formulas", () => {
    expect(o.lossPays).toBe(-1200 + 300.28);
    expect(o.lossLoses).toBe(-1200 - 90.72);
    expect(o.noLossPays).toBe(300.28);
    expect(o.noLossLoses).toBe(-90.72);
  });
  it("zero-loss edge case: any position is overhedged, optimizer picks zero", () => {
    const s = withP({ ...base(), useOverride: true, overrideLoss: 0 });
    const x0 = ctxOf(s);
    expect(evaluate(5, x0).overhedged).toBe(true);
    for (const obj of ["variance", "cvar", "target"] as const) expect(optimize(obj, x0, 0).position.contracts).toBe(0);
  });
});

describe("price boundaries and validation", () => {
  it("rejects prices outside $0.01-$0.99 and NaN", () => {
    for (const price of [0, 0.005, 1, 1.2, NaN, -1]) expect(validate({ ...base(), price }).price).toBeTruthy();
    for (const price of [0.01, 0.5, 0.99]) expect(validate({ ...base(), price }).price).toBeUndefined();
  });
  it("rejects bad numeric inputs", () => {
    const e = validate({ ...base(), customers: 2.5, revPerVisit: -1, margin: 1.5, coverage: NaN });
    expect(e.customers && e.revPerVisit && e.margin && e.coverage).toBeTruthy();
  });
  it("a 99-cent price still yields a defined, larger position or is unreachable", () => {
    const x = ctxOf({ ...base(), price: 0.99 });
    const c = minContractsFor([300], x.table)[0] ?? null;
    expect(c === null || c > 391).toBe(true);
  });
  it("a 1-cent price needs far fewer contracts' cash", () => {
    const x = ctxOf({ ...base(), price: 0.01 });
    const c = minContractsFor([300], x.table)[0]!;
    expect(evaluate(c, x).cost).toBeLessThan(10);
  });
});

describe("probabilities", () => {
  it("missing -> insufficient information, not fabricated", () => {
    const a = analyze({ ...base(), objective: "variance" }, null);
    expect(a.probs.kind).toBe("missing");
    expect(a.opt!.status).toBe("insufficient");
    expect(a.opt!.why).toBe("Insufficient information for a personalized optimal hedge estimate.");
    expect(a.opt!.position.contracts).toBe(0);
  });
  it("validates nonnegative, <=100%, sum to 100%", () => {
    const mk = (p: number[]) => probState({ ...base(), probs: { lossPays: p[0]!, lossLoses: p[1]!, noLossPays: p[2]!, noLossLoses: p[3]! } }).kind;
    expect(mk([0.25, 0.25, 0.25, 0.25])).toBe("ok");
    expect(mk([0.3, 0.3, 0.3, 0.3])).toBe("invalid");
    expect(mk([-0.1, 0.6, 0.3, 0.2])).toBe("invalid");
    expect(mk([1.2, -0.1, -0.1, 0])).toBe("invalid");
    expect(mk([0.25, 0.25, 0.25, NaN])).toBe("invalid");
    expect(mk([0.1 + 0.2, 0.3, 0.2, 0.2])).toBe("ok"); // float noise tolerated
  });
  it("target objective needs no probabilities", () => {
    const a = analyze(base(), null);
    expect(a.opt!.status).toBe("ok");
    expect(a.opt!.position.contracts).toBe(391);
  });
});

describe("optimizer", () => {
  const s = withP({ ...base(), budget: 500, maxTradingLoss: 500, tolerance: "low" });
  const x = ctxOf(s);
  const brute = (score: (o: ReturnType<typeof outcomesFor>) => number) => {
    let best = 0, bs = score(outcomesFor(0, x.loss, x.table));
    for (let c = 1; c <= x.table.max; c++) {
      const p = evaluate(c, x);
      if (p.cost > 500 || p.overhedged || p.expCostOk === false) continue;
      const v = score(p.outcomes);
      if (v < bs - 1e-9 * Math.max(1, Math.abs(bs))) { bs = v; best = c; }
    }
    return best;
  };
  it("minimum-variance quantity equals brute force and beats no hedge", () => {
    const r = optimize("variance", x, 300);
    expect(r.position.contracts).toBe(brute((o) => variance(o, x.probs!)));
    expect(r.position.contracts).toBeGreaterThan(0);
    expect(r.position.variance!).toBeLessThan(r.baseline.variance!);
    expect(r.beatsZero).toBe(true);
  });
  it("90% CVaR quantity equals brute force and is deterministic", () => {
    const r1 = optimize("cvar", x, 300), r2 = optimize("cvar", x, 300);
    expect(r1.position.contracts).toBe(brute((o) => cvar(o, x.probs!)));
    expect(r2).toEqual(r1);
  });
  it("cvar of a known distribution", () => {
    // losses 100 (p=.05), 50 (p=.35), 0 (p=.6); worst 10% = .05*100 + .05*50 = 7.5 -> /0.1 = 75
    const o = { lossPays: -100, lossLoses: -50, noLossPays: 0, noLossLoses: 0 };
    expect(cvar(o, { lossPays: 0.05, lossLoses: 0.35, noLossPays: 0.3, noLossLoses: 0.3 })).toBeCloseTo(75, 9);
  });
  it("respects the budget", () => {
    const tight = { ...x, budget: 20, maxTradingLoss: 20 };
    const r = optimize("variance", tight, 300);
    expect(r.position.cost).toBeLessThanOrEqual(20);
    expect(r.position.budgetOk).toBe(true);
  });
  it("budget too small for even one contract -> zero", () => {
    expect(optimize("cvar", { ...x, budget: 0.1, maxTradingLoss: 0.1 }, 0).position.contracts).toBe(0);
  });
  it("negative expected trading value can make zero optimal under a tight tolerance", () => {
    // contract never pays yet costs 22c: expected trading is very negative
    const p = { lossPays: 0, lossLoses: 0.3, noLossPays: 0, noLossLoses: 0.7 };
    const sx = { ...s, probs: p, tolerance: "high" as const };
    const r = optimize("variance", ctxOf(sx), 300);
    expect(r.position.contracts).toBe(0);
    expect(r.beatsZero).toBe(false);
    expect(r.why).toMatch(/zero contracts/);
  });
  it("target objective: infeasible when budget cannot fund the target", () => {
    const r = optimize("target", { ...x, budget: 50, maxTradingLoss: 50 }, 300);
    expect(r.status).toBe("infeasible");
    expect(r.position.contracts).toBe(0);
  });
  it("overhedging is flagged and never chosen by variance minimization", () => {
    const r = optimize("variance", x, 300);
    expect(r.position.overhedged).toBe(false);
    expect(r.position.netWin).toBeLessThanOrEqual(x.loss + 1e-9);
    expect(evaluate(2000, x).overhedged).toBe(true);
  });
  it("noncorrelated business and contract outcomes: hedge is not rewarded", () => {
    // independent: P(loss)=.3, P(pays)=.3 -> joint .09/.21/.21/.49
    const sx = { ...s, probs: { lossPays: 0.09, lossLoses: 0.21, noLossPays: 0.21, noLossLoses: 0.49 } };
    const r = optimize("variance", ctxOf(sx), 300);
    expect(r.position.contracts).toBeLessThanOrEqual(optimize("variance", x, 300).position.contracts);
    expect(r.position.variance!).toBeLessThanOrEqual(r.baseline.variance! + 1e-9);
  });
  it("optimizer differs from manual percentage sizing", () => {
    const a = analyze({ ...s, objective: "variance", coverage: 1 }, null);
    expect(a.opt!.position.contracts).not.toBe(a.manual!.contracts);
  });
  it("basis-miss exposure equals the loss-but-no-payout probability", () => {
    expect(evaluate(100, x).basisMissProb).toBe(ILLUSTRATIVE_PROBS.lossLoses);
  });
});

describe("market liquidity and live ladders", () => {
  const ladder = [{ price: 0.37, size: 9 }, { price: 0.38, size: 13 }, { price: 0.4, size: 50 }];
  it("fills across levels and recomputes fees per fill", () => {
    const f = fillOrder(30, 0.22, ladder);
    expect(f.complete).toBe(true);
    expect(f.levels).toEqual([{ price: 0.37, qty: 9 }, { price: 0.38, qty: 13 }, { price: 0.4, qty: 8 }]);
    expect(f.premium).toBeCloseTo(0.37 * 9 + 0.38 * 13 + 0.4 * 8, 10);
    expect(f.avgPrice!).toBeGreaterThan(0.37);
  });
  it("order larger than depth is incomplete; table stops at depth", () => {
    expect(fillOrder(100, 0.22, ladder).complete).toBe(false);
    expect(buildCostTable(0.22, ladder).max).toBe(72);
  });
  it("target unreachable within shallow depth", () => {
    const a = analyze({ ...base(), useLive: true }, { fetchedAt: "t", status: "ok", ticker: "KXCHISNOWM-26DEC-2", title: null, marketStatus: "active", closeTime: null, rulesPrimary: "x", rulesMatch: true, levels: ladder, note: null, verified: true });
    expect(a.priceSource).toBe("live");
    expect(a.manualUnreachable).toBe(true);
    expect(a.opt!.status).toBe("infeasible");
    expect(a.checks.find((c) => c.id === "depth")!.status).toBe("fail");
  });
  it("missing live pricing falls back to the labeled illustrative price", () => {
    const a = analyze({ ...base(), useLive: true }, null);
    expect(a.priceSource).toBe("illustrative");
    expect(a.scenarioLabel).toBe("Scenario-based optimization. Execution not verified.");
    expect(a.checks.find((c) => c.id === "open")!.status).toBe("unavailable");
    expect(a.checks.find((c) => c.id === "source")!.status).toBe("fail");
  });
  it("position limit constrains the optimizer", () => {
    const r = optimize("variance", ctxOf(withP({ ...base(), positionLimit: 10, budget: 500, maxTradingLoss: 500, tolerance: "low" })), 300);
    expect(r.position.contracts).toBeLessThanOrEqual(10);
  });
});

describe("kalshi owner market parsing", () => {
  const market = (over: object = {}) => ({ markets: [{ ticker: "KXCHISNOWM-26DEC-2", status: "active", title: "t", rules_primary: "If the total snowfall in Chicago (O'Hare) in December 2026 is strictly greater than 2 inches, then the market resolves to Yes.", ...over }] });
  const book = { orderbook_fp: { yes_dollars: [["0.6200", "13.02"], ["0.6300", "9.00"], ["0.0100", "0.50"]], no_dollars: [["0.2600", "7.75"]] } };
  it("NO ask ladder = 1 - YES bids, ascending, whole contracts", () => {
    expect(parseNoAskLadder(book)).toEqual([{ price: 0.37, size: 9 }, { price: 0.38, size: 13 }]);
  });
  it("verified only with exact ticker, active status, matching rules and depth", () => {
    expect(buildOwnerMarket(market(), book, null).verified).toBe(true);
    expect(buildOwnerMarket(market({ ticker: "OTHER" }), book, null).status).toBe("not_found");
    expect(buildOwnerMarket(market({ status: "closed" }), book, null).verified).toBe(false);
    expect(buildOwnerMarket(market({ rules_primary: "something else" }), book, null).verified).toBe(false);
    expect(buildOwnerMarket(market(), null, "HTTP 500").verified).toBe(false);
    expect(buildOwnerMarket({ nope: 1 }, book, null).status).toBe("unavailable");
  });
});

describe("scenario isolation and reset", () => {
  it("scenarios are independent objects with unique ids", () => {
    const a = defaultScenario(), b = defaultScenario("New business");
    expect(a.id).not.toBe(b.id);
    const a2 = { ...a, customers: 99 };
    expect(b.customers).toBe(20);
    expect(a.customers).toBe(20);
    expect(a2.customers).toBe(99);
    expect(b.probs).not.toBe(a.probs);
  });
  it("reset restores inputs but keeps identity", () => {
    const s = { ...base(), customers: 77, price: 0.5, name: "X", notes: "keep me", location: "Loop" };
    const r = resetScenario(s);
    expect(r.customers).toBe(20);
    expect(r.price).toBe(0.22);
    expect([r.id, r.name, r.notes, r.location]).toEqual([s.id, "X", "keep me", "Loop"]);
  });
  it("no company-specific figures are prepopulated as verified", () => {
    expect(base().verification).toBe("illustrative");
  });
});

describe("copy summary accuracy", () => {
  const s = withP({ ...base(), objective: "variance", budget: 500, maxTradingLoss: 500, notes: "call notes" });
  const a = analyze(s, null);
  const sum = buildSummary(s, a, null, new Date("2026-11-12T12:00:00Z"));
  it("contains every spec default figure and label", () => {
    for (const t of ["$2,400.00", "$1,200.00", "$300.00", "391", "$86.02", "$4.70", "$90.72", "$300.28", "ILLUSTRATIVE", "call notes", "2026-11-12T12:00:00.000Z"]) expect(sum.text).toContain(t);
  });
  it("states the optimizer result consistently with the analysis", () => {
    expect(sum.text).toContain(`Calculated contracts: ${a.opt!.position.contracts.toLocaleString("en-US")}`);
  });
  it("includes risk language and no guarantee", () => {
    expect(sum.text).toMatch(/expire worthless/);
    expect(sum.text).toMatch(/Basis risk/);
    expect(sum.text).toMatch(/not a recommendation to trade/);
    expect(sum.text).toMatch(/Not affiliated with or endorsed by Kalshi/);
    expect(sum.text).not.toMatch(/guaranteed (savings|profit)/i);
  });
  it("invalid inputs produce no financial results", () => {
    const bad = analyze({ ...base(), price: 2 }, null);
    expect(bad.valid).toBe(false);
    expect(buildSummary({ ...base(), price: 2 }, bad, null).text).toMatch(/invalid/);
  });
});

describe("chart sweep", () => {
  it("is monotone in cost and anchored at no-hedge", () => {
    const pts = sweep(ctxOf(withP(base())));
    expect(pts[0]!.contracts).toBe(0);
    expect(pts[0]!.ifPays).toBe(-1200);
    for (let i = 1; i < pts.length; i++) expect(pts[i]!.cost!).toBeGreaterThanOrEqual(pts[i - 1]!.cost!);
    expect(pts[100]!.ifPays!).toBeGreaterThanOrEqual(-1);
  });
});
