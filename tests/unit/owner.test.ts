import { describe, expect, it } from "vitest";
import { analyze, buildSummary, probStats } from "@/lib/owner/analysis";
import {
  buildCostTable, ceilCenticent, cvarOf, evaluate, fillOrder, meanOf, minContractsFor, netWin, NO_FEASIBLE, optimize, outcomesFor, pnl, sweep, varianceOf, type Ctx, type Ladder,
} from "@/lib/owner/hedge";
import {
  defaultScenario, distRows, exposure, ILLUSTRATIVE_PROBS, illustrativeLossRows, probState, protectedLoss, resetScenario, validate, type Scenario,
} from "@/lib/owner/model";
import { contractEconomics } from "@/lib/finance/hedge";
import { EARLY_SETTLEMENT, FEE_SOURCE } from "@/lib/owner/model";
import { buildOwnerMarket } from "@/lib/kalshi/owner-market";
import { parseNoAskLadder } from "@/lib/kalshi/parse";
import type { OwnerMarket } from "@/lib/kalshi/owner-market";

const base = () => defaultScenario();
const limits = (s: Scenario, budget = 500, maxLoss = budget): Scenario => ({ ...s, budget, maxTradingLoss: maxLoss });
const withP = (s: Scenario, p = ILLUSTRATIVE_PROBS): Scenario => ({ ...s, probs: { ...p }, probSource: "illustrative" });
const ctxOf = (s: Scenario, ladder: Ladder = null): Ctx => {
  const L = protectedLoss(s, exposure(s));
  return { loss: L, table: buildCostTable(s.price, ladder, s.feeMult), dist: distRows(probState(s), L), budget: s.budget, maxTradingLoss: s.maxTradingLoss, positionLimit: s.positionLimit, maxCoverage: s.maxCoverage, variability: s.variability };
};
const mkt = (levels: { price: number; size: number }[], over: Partial<OwnerMarket> = {}): OwnerMarket => ({
  fetchedAt: "2026-11-12T15:00:00Z", status: "ok", ticker: "KXCHISNOWM-26DEC-2", title: null, marketStatus: "active", closeTime: null, rulesPrimary: "x", rulesMatch: true,
  levels, feeType: "quadratic", feeMultiplier: 1, note: null, verified: true, ...over,
});

describe("Asset Operations Group business model (per-push)", () => {
  it("is the default preset, per-push only, with public facts flagged", () => {
    const s = base();
    expect(s.name).toBe("Asset Operations Group");
    expect(s.publicFacts).toBe(true);
    expect(s.verification).toBe("illustrative");
  });
  it("never invents a seasonal contract, even if the flag is set", () => {
    const aog: Scenario = { ...base(), method: "buildup", resCustomers: 10, comCustomers: 0, resRev: 60, labor: 20, fuel: 0, salt: 0, seasonalEnabled: true, seasonalRevenue: 9999 };
    const plain = exposure({ ...aog, seasonalEnabled: false });
    expect(exposure(aog)).toEqual(plain);
  });
  it("separate residential and commercial pricing, costs per visit, salting revenue", () => {
    const s: Scenario = { ...base(), method: "buildup", resCustomers: 10, comCustomers: 2, resRev: 60, comRev: 200, labor: 20, fuel: 5, salt: 5, normalVisits: 3, lowVisits: 1, saltingRevenue: 300, retainedRevenue: 100 };
    const e = exposure(s);
    // normal revenue 10*60*3 + 2*200*3 + 300 = 3300; cost 30*12*3 = 1080 -> 2220
    expect(e.normalRevenue).toBe(3300);
    expect(e.normalContribution).toBe(2220);
    // low revenue 600 + 400 + 100 = 1100; cost 30*12*1 = 360 -> 740
    expect(e.lowContribution).toBe(740);
    expect(e.lostContribution).toBe(1480);
  });
  it("lost sales are not automatically lost profit: contribution margin applies", () => {
    const e = exposure(base());
    expect(e.lostRevenue).toBe(2400);
    expect(e.lostContribution).toBe(1200);
    expect(e.lostContribution).toBeLessThan(e.lostRevenue);
  });
});

describe("generic company with seasonal contracts", () => {
  const g = (over: Partial<Scenario> = {}): Scenario => ({ ...defaultScenario("New business"), method: "buildup", resCustomers: 10, resRev: 60, labor: 10, fuel: 0, salt: 0, normalVisits: 3, lowVisits: 1, ...over });
  it("uses only the owner-entered fixed revenue, kept in both states", () => {
    const no = exposure(g()), yes = exposure(g({ seasonalEnabled: true, seasonalRevenue: 5000 }));
    expect(yes.normalRevenue - no.normalRevenue).toBe(5000);
    expect(yes.lowRevenue - no.lowRevenue).toBe(5000);
    expect(yes.lostContribution).toBe(no.lostContribution);
  });
  it("is not derived from visits", () => {
    const a = exposure(g({ seasonalEnabled: true, seasonalRevenue: 5000, normalVisits: 3 }));
    const b = exposure(g({ seasonalEnabled: true, seasonalRevenue: 5000, normalVisits: 4 }));
    expect(b.normalRevenue - a.normalRevenue).toBe(10 * 60); // only per-push visit revenue moved
  });
  it("requires a valid owner-entered amount", () => {
    expect(validate(g({ seasonalEnabled: true, seasonalRevenue: -1 })).seasonalRevenue).toBeTruthy();
    expect(validate(g({ seasonalEnabled: true, seasonalRevenue: NaN })).seasonalRevenue).toBeTruthy();
  });
});

describe("Kalshi fee precision (centicent) and multiplier", () => {
  it("rounds fee + cost UP to $0.0001", () => {
    expect(ceilCenticent(188.909013)).toBe(188.9091);
    expect(ceilCenticent(188.9091)).toBe(188.9091); // exact centicent is not bumped by float noise
    expect(ceilCenticent(0.10001)).toBe(0.1001);
    expect(ceilCenticent(0.1000000001)).toBe(0.1); // float noise does not bump a centicent
  });
  it("spec regression: 489 contracts at $0.37, M=1", () => {
    const f = fillOrder(489, 0.37, null, 1);
    expect(f.premium).toBe(180.93);
    expect(f.cost).toBe(188.9091);
    expect(f.fee).toBeCloseTo(7.9791, 10);
    const t = buildCostTable(0.37, null, 1);
    expect(netWin(489, t)).toBeCloseTo(300.0909, 10);
    expect(minContractsFor([300], t)[0]).toBe(489);
    expect(netWin(488, t)).toBeLessThan(300);
  });
  it("default: 391 contracts, displayed 2dp values match the specification", () => {
    const t = buildCostTable(0.22, null, 1);
    expect(minContractsFor([300], t)[0]).toBe(391);
    const f = fillOrder(391, 0.22, null, 1);
    expect(f.cost).toBe(90.7167);
    expect(f.cost.toFixed(2)).toBe("90.72");
    expect(f.fee.toFixed(2)).toBe("4.70");
    expect(netWin(391, t).toFixed(2)).toBe("300.28");
    expect(f.premium.toFixed(2)).toBe("86.02");
  });
  it("multiplier scales the fee; zero multiplier means no fee", () => {
    const f1 = fillOrder(100, 0.5, null, 1), f2 = fillOrder(100, 0.5, null, 2), f0 = fillOrder(100, 0.5, null, 0);
    expect(f1.fee).toBe(1.75);
    expect(f2.fee).toBe(3.5);
    expect(f0.fee).toBe(0);
    expect(f0.cost).toBe(50);
    expect(fillOrder(100, 0.5, null, 0.5).fee).toBe(0.875);
  });
  it("a multiplier changes the contract count needed", () => {
    const c1 = minContractsFor([300], buildCostTable(0.22, null, 1))[0]!, c2 = minContractsFor([300], buildCostTable(0.22, null, 2))[0]!;
    expect(c2).toBeGreaterThan(c1);
  });
});

describe("multi-level order-book fills and liquidity", () => {
  const ladder = [{ price: 0.37, size: 9 }, { price: 0.38, size: 13 }, { price: 0.4, size: 50 }];
  it("applies the fee formula per execution quantity with one final centicent round-up", () => {
    const f = fillOrder(30, 0.22, ladder, 1);
    expect(f.levels).toEqual([{ price: 0.37, qty: 9 }, { price: 0.38, qty: 13 }, { price: 0.4, qty: 8 }]);
    expect(f.premium).toBe(11.47);
    const raw = 0.07 * (9 * 0.37 * 0.63 + 13 * 0.38 * 0.62 + 8 * 0.4 * 0.6);
    expect(f.cost).toBe(ceilCenticent(11.47 + raw));
    expect(f.avgPrice).toBeCloseTo(11.47 / 30, 10);
  });
  it("insufficient depth is rejected; table stops at depth", () => {
    expect(fillOrder(100, 0.22, ladder).complete).toBe(false);
    expect(buildCostTable(0.22, ladder).max).toBe(72);
    expect(buildCostTable(0.22, []).max).toBe(0);
  });
  it("target unreachable within shallow depth: infeasible, zero contracts, depth check fails", () => {
    const a = analyze(limits({ ...base(), useLive: true }, 1000), mkt(ladder));
    expect(a.priceSource).toBe("live");
    expect(a.manualUnreachable).toBe(true);
    expect(a.opt!.status).toBe("infeasible");
    expect(a.opt!.why).toContain(NO_FEASIBLE);
    expect(a.checks.find((c) => c.id === "depth")!.status).toBe("fail");
  });
  it("live mode uses the published fee multiplier, not the user's", () => {
    const a = analyze({ ...base(), useLive: true, feeMult: 5 }, mkt(ladder, { feeMultiplier: 0 }));
    expect(a.feeMult).toBe(0);
    const b = analyze({ ...base(), feeMult: 5 }, null);
    expect(b.feeMult).toBe(5);
  });
  it("requested-but-unavailable live book never silently falls back to the illustrative quote", () => {
    const a = analyze(limits({ ...base(), useLive: true }), null);
    expect(a.priceSource).toBe("illustrative");
    expect(a.liveUnavailable).toBe(true);
    expect(a.manualUnreachable).toBe(true);
    expect(a.opt!.status).toBe("infeasible");
    expect(a.warnings.join(" ")).toMatch(/not substituted/);
    expect(analyze(limits({ ...base(), useLive: true }), mkt(ladder, { verified: false, note: "x" })).liveUnavailable).toBe(true);
  });
  it("illustrative fallback is labeled when live is not requested", () => {
    const a = analyze(base(), null);
    expect(a.scenarioLabel).toBe("Scenario-based optimization. Execution not verified.");
    expect(a.liveUnavailable).toBe(false);
    expect(a.checks.find((c) => c.id === "open")!.status).toBe("unavailable");
    expect(a.checks.find((c) => c.id === "source")!.status).toBe("fail");
  });
});

describe("budget and owner limits", () => {
  it("37-cent contract with a $150 budget is rejected as infeasible", () => {
    const s = limits({ ...base(), price: 0.37 }, 150);
    const a = analyze(s, null);
    expect(a.manual!.contracts).toBe(489);
    expect(a.manual!.cost).toBe(188.9091);
    expect(a.manual!.budgetOk).toBe(false);
    expect(a.opt!.status).toBe("infeasible");
    expect(a.opt!.why).toContain("No feasible hedge under current assumptions.");
    expect(a.opt!.position.contracts).toBe(0);
    expect(a.opt!.required!.contracts).toBe(489);
  });
  it("same position is accepted with a $200 budget", () => {
    const a = analyze(limits({ ...base(), price: 0.37 }, 200), null);
    expect(a.opt!.status).toBe("ok");
    expect(a.opt!.position.contracts).toBe(489);
  });
  it("both budget and maximum trading loss are enforced", () => {
    const a = analyze({ ...base(), budget: 500, maxTradingLoss: 50 }, null);
    expect(a.manual!.budgetOk).toBe(true);
    expect(a.manual!.lossCapOk).toBe(false);
    expect(a.opt!.status).toBe("infeasible");
  });
  it("no owner risk budget: no personalized allocation for any objective", () => {
    for (const objective of ["variance", "cvar", "target"] as const) {
      const r = analyze(withP({ ...base(), objective }), null).opt!;
      expect(r.status).toBe("insufficient");
      expect(r.position.contracts).toBe(0);
      expect(r.why).toMatch(/risk budget/);
    }
  });
  it("optimizer respects the budget", () => {
    const x = ctxOf(withP(limits(base(), 20)));
    const r = optimize("variance", x, 300);
    expect(r.position.cost).toBeLessThanOrEqual(20);
    expect(r.position.budgetOk).toBe(true);
  });
  it("budget too small for one contract: zero is the answer", () => {
    expect(optimize("cvar", ctxOf(withP(limits(base(), 0.1))), 0).position.contracts).toBe(0);
  });
  it("position limit and coverage cap constrain the search", () => {
    const s = withP(limits(base(), 1000));
    expect(optimize("variance", ctxOf({ ...s, positionLimit: 10 }), 300).position.contracts).toBeLessThanOrEqual(10);
    const r = optimize("variance", ctxOf({ ...s, maxCoverage: 0.1 }), 300);
    expect(r.position.netWin).toBeLessThanOrEqual(0.1 * 1200 + 1e-9);
  });
  it("target above the maximum permitted coverage is a validation error", () => {
    expect(validate({ ...base(), coverage: 0.5, maxCoverage: 0.4 }).coverage).toMatch(/cannot exceed/);
    expect(validate({ ...base(), coverage: 0.4, maxCoverage: 0.4 }).coverage).toBeUndefined();
  });
});

describe("minimum variance", () => {
  const s = withP(limits(base(), 500));
  const x = ctxOf(s);
  const brute = () => {
    let best = 0, bs = varianceOf(pnl(0, x.table, x.dist!));
    for (let c = 1; c <= x.table.max; c++) {
      const p = evaluate(c, x);
      if (p.cost > 500 || !p.coverageOk) continue;
      const v = varianceOf(pnl(c, x.table, x.dist!));
      if (v < bs - 1e-9 * Math.max(1, Math.abs(bs))) { bs = v; best = c; }
    }
    return best;
  };
  it("equals brute force, beats no hedge, includes zero in the search", () => {
    const r = optimize("variance", x, 300);
    expect(r.position.contracts).toBe(brute());
    expect(r.position.contracts).toBeGreaterThan(0);
    expect(r.position.variance!).toBeLessThan(r.baseline.variance!);
    expect(r.beatsZero).toBe(true);
    expect(r.why).toMatch(/Optimal only under your modeled distribution/);
  });
  it("variance formula: sum p (o - mean)^2", () => {
    const xs = [{ o: 100, p: 0.5 }, { o: 0, p: 0.5 }];
    expect(meanOf(xs)).toBe(50);
    expect(varianceOf(xs)).toBe(2500);
    const o = pnl(10, x.table, x.dist!);
    const m = o.reduce((a, z) => a + z.p * z.o, 0);
    expect(varianceOf(o)).toBeCloseTo(o.reduce((a, z) => a + z.p * (z.o - m) ** 2, 0), 9);
  });
  it("is deterministic", () => { expect(optimize("variance", x, 300)).toEqual(optimize("variance", x, 300)); });
  it("a contract that never pays leaves variance unchanged: zero contracts, explained", () => {
    const sx = withP(limits(base(), 500), { lossPays: 0, lossLoses: 0.3, noLossPays: 0, noLossLoses: 0.7 });
    const r = optimize("variance", ctxOf(sx), 300);
    expect(r.position.contracts).toBe(0);
    expect(r.beatsZero).toBe(false);
    expect(r.why).toMatch(/zero contracts/);
  });
  it("noncorrelated business and contract outcomes: hedge is not rewarded", () => {
    const sx = withP(limits(base(), 500), { lossPays: 0.09, lossLoses: 0.21, noLossPays: 0.21, noLossLoses: 0.49 });
    const r = optimize("variance", ctxOf(sx), 300);
    expect(r.position.contracts).toBe(0);
  });
  it("optimized differs from manual percentage sizing", () => {
    const a = analyze({ ...s, objective: "variance", coverage: 1 }, null);
    expect(a.opt!.position.contracts).not.toBe(a.manual!.contracts);
  });
});

describe("90% CVaR (discrete, partial tail mass)", () => {
  it("known distribution: worst 10% = 0.05@100 + 0.05@50 -> 75", () => {
    expect(cvarOf([{ o: -100, p: 0.05 }, { o: -50, p: 0.35 }, { o: 0, p: 0.6 }])).toBeCloseTo(75, 9);
  });
  it("partial mass at the 90th percentile: 0.04@100 + 0.06@50 -> 70", () => {
    expect(cvarOf([{ o: -100, p: 0.04 }, { o: -50, p: 0.2 }, { o: 0, p: 0.76 }])).toBeCloseTo(70, 9);
  });
  it("is not the largest loss unless that state holds 10%+ of the mass", () => {
    const xs = [{ o: -100, p: 0.02 }, { o: -10, p: 0.98 }];
    expect(cvarOf(xs)).toBeLessThan(100);
    expect(cvarOf(xs)).toBeCloseTo((0.02 * 100 + 0.08 * 10) / 0.1, 9);
    expect(cvarOf([{ o: -100, p: 0.2 }, { o: 0, p: 0.8 }])).toBe(100);
  });
  it("matches an independent sorted-tail calculation", () => {
    const xs = [{ o: -80, p: 0.07 }, { o: -30, p: 0.13 }, { o: 5, p: 0.5 }, { o: 40, p: 0.3 }];
    const sorted = xs.map((z) => ({ l: -z.o, p: z.p })).sort((a, b) => b.l - a.l);
    let left = 0.1, acc = 0;
    for (const z of sorted) { const w = Math.min(z.p, left); acc += w * z.l; left -= w; }
    expect(cvarOf(xs)).toBeCloseTo(acc / 0.1, 9);
  });
  it("optimizer equals brute force over all feasible positions, includes zero, deterministic", () => {
    const x = ctxOf(withP(limits(base(), 500)));
    let best = 0, bs = cvarOf(pnl(0, x.table, x.dist!));
    for (let c = 1; c <= x.table.max; c++) {
      const p = evaluate(c, x);
      if (p.cost > 500 || !p.coverageOk) continue;
      const v = cvarOf(pnl(c, x.table, x.dist!));
      if (v < bs - 1e-9 * Math.max(1, Math.abs(bs))) { bs = v; best = c; }
    }
    const r = optimize("cvar", x, 300);
    expect(r.position.contracts).toBe(best);
    expect(optimize("cvar", x, 300)).toEqual(r);
    expect(r.position.cvar90!).toBeLessThanOrEqual(r.baseline.cvar90!);
  });
  it("zero contracts when the contract never pays", () => {
    const sx = withP(limits(base(), 500), { lossPays: 0, lossLoses: 0.3, noLossPays: 0, noLossLoses: 0.7 });
    expect(optimize("cvar", ctxOf(sx), 0).position.contracts).toBe(0);
  });
});

describe("target-based sizing", () => {
  it("smallest feasible position meeting the target; compared with zero", () => {
    const r = analyze(limits(base(), 150), null).opt!;
    expect(r.status).toBe("ok");
    expect(r.position.contracts).toBe(391);
    expect(r.baseline.contracts).toBe(0);
    expect(r.why).toMatch(/not an expected-value claim/);
  });
  it("zero target means zero contracts", () => {
    expect(minContractsFor([0], buildCostTable(0.22, null))[0]).toBe(0);
    expect(analyze(limits({ ...base(), coverage: 0 }), null).opt!.position.contracts).toBe(0);
  });
  it("target needs no probabilities and is labeled illustrative sizing", () => {
    const a = analyze(limits(base()), null);
    expect(a.opt!.status).toBe("ok");
    expect(a.basis).toBe("sizing");
  });
  it("probability-based label only for variance/CVaR with valid probabilities", () => {
    expect(analyze(withP(limits({ ...base(), objective: "variance" })), null).basis).toBe("probability");
    expect(analyze(limits({ ...base(), objective: "variance" }), null).basis).toBe("sizing");
    expect(analyze(withP(limits({ ...base(), objective: "target" })), null).basis).toBe("sizing");
  });
});

describe("winning payout versus modeled loss", () => {
  const x = ctxOf(withP(limits(base(), 5000)));
  it("is flagged only when net winning profit exceeds the modeled loss", () => {
    expect(evaluate(391, x).exceedsLoss).toBe(false);
    expect(evaluate(1600, x).exceedsLoss).toBe(true);
    expect(evaluate(0, x).exceedsLoss).toBe(false);
  });
  it("reports coverage explicitly and the no-loss-but-pays outcome", () => {
    const p = evaluate(391, x);
    expect(p.coverage).toBeCloseTo(0.25, 2);
    expect(p.outcomes.noLossPays).toBeCloseTo(300.2833, 4);
  });
  it("coverage limit blocks positions that pay more than allowed", () => {
    expect(evaluate(800, x).coverageOk).toBe(true);
    expect(evaluate(1600, x).coverageOk).toBe(false);
  });
  it("zero modeled loss: any position pays more than the loss; optimizer picks zero", () => {
    const s = withP(limits({ ...base(), useOverride: true, overrideLoss: 0 }));
    const x0 = ctxOf(s);
    expect(evaluate(5, x0).exceedsLoss).toBe(true);
    for (const o of ["variance", "cvar", "target"] as const) expect(optimize(o, x0, 0).position.contracts).toBe(0);
  });
});

describe("four joint outcomes", () => {
  const x = ctxOf(base());
  const o = outcomesFor(391, 1200, x.table);
  it("matches the specification formulas", () => {
    expect(o.lossPays).toBeCloseTo(-1200 + 300.2833, 4);
    expect(o.lossLoses).toBeCloseTo(-1200 - 90.7167, 4);
    expect(o.noLossPays).toBeCloseTo(300.2833, 4);
    expect(o.noLossLoses).toBeCloseTo(-90.7167, 4);
  });
});

describe("probability validation and derived statistics", () => {
  const mk = (p: number[]) => probState({ ...base(), probs: { lossPays: p[0]!, lossLoses: p[1]!, noLossPays: p[2]!, noLossLoses: p[3]! } }).kind;
  it("nonnegative, <=100%, sum to 100%", () => {
    expect(mk([0.25, 0.25, 0.25, 0.25])).toBe("ok");
    expect(mk([0.3, 0.3, 0.3, 0.3])).toBe("invalid");
    expect(mk([-0.1, 0.6, 0.3, 0.2])).toBe("invalid");
    expect(mk([1.2, -0.1, -0.1, 0])).toBe("invalid");
    expect(mk([0.25, 0.25, 0.25, NaN])).toBe("invalid");
    expect(mk([0.1 + 0.2, 0.3, 0.2, 0.2])).toBe("ok");
  });
  it("missing probabilities block variance and CVaR with the required message", () => {
    for (const objective of ["variance", "cvar"] as const) {
      const a = analyze(limits({ ...base(), objective }), null);
      expect(a.probs.kind).toBe("missing");
      expect(a.opt!.status).toBe("insufficient");
      expect(a.opt!.why).toBe("Insufficient information for a personalized optimal hedge estimate.");
    }
  });
  it("invalid probabilities block optimization too", () => {
    const s = limits({ ...base(), objective: "variance", probs: { lossPays: 0.5, lossLoses: 0.5, noLossPays: 0.5, noLossLoses: 0.5 } });
    expect(analyze(s, null).opt!.status).toBe("insufficient");
  });
  it("derived statistics: A+B, A+C, B, A/(A+B)", () => {
    const st = probStats(distRows(probState(withP(base(), { lossPays: 0.2, lossLoses: 0.1, noLossPays: 0.1, noLossLoses: 0.6 })), 1200)!);
    expect(st.pLoss).toBeCloseTo(0.3, 12);
    expect(st.pPayout).toBeCloseTo(0.3, 12);
    expect(st.pLossNoPay).toBeCloseTo(0.1, 12);
    expect(st.pPayGivenLoss).toBeCloseTo(2 / 3, 12);
  });
  it("conditional payout is undefined when no business loss is modeled", () => {
    const st = probStats(distRows(probState(withP(base(), { lossPays: 0, lossLoses: 0, noLossPays: 0.3, noLossLoses: 0.7 })), 1200)!);
    expect(st.pPayGivenLoss).toBeNull();
  });
  it("entered probabilities survive other edits (no silent reset)", () => {
    const s = withP(base());
    const t = { ...s, customers: 30 };
    expect(t.probs).toEqual(s.probs);
    expect(resetScenario(t).probs.lossPays).toBeNaN(); // only an explicit reset clears them
  });
});

describe("multiple loss levels", () => {
  const L = 1200;
  const rows = () => illustrativeLossRows(L);
  const sm = (): Scenario => ({ ...limits(base(), 500), lossModel: "multi", lossRows: rows(), probSource: "illustrative" });
  it("validates every row and the 100% total", () => {
    expect(probState(sm()).kind).toBe("ok");
    expect(probState({ ...sm(), lossRows: sm().lossRows.map((r, i) => (i === 0 ? { ...r, pays: 0.5 } : r)) }).kind).toBe("invalid");
    expect(probState({ ...sm(), lossRows: sm().lossRows.map((r, i) => (i === 1 ? { ...r, loss: -5 } : r)) }).kind).toBe("invalid");
    expect(probState({ ...sm(), lossRows: sm().lossRows.map((r, i) => (i === 2 ? { ...r, loses: NaN } : r)) }).kind).toBe("invalid");
  });
  it("each business-loss state accounts for the contract settlement", () => {
    const x = ctxOf(sm());
    const xs = pnl(100, x.table, x.dist!);
    expect(xs).toHaveLength(8);
    const w = netWin(100, x.table), k = x.table.cost[100]!;
    expect(xs[2]!.o).toBeCloseTo(-300 + w, 6); // slightly below normal, contract pays
    expect(xs[3]!.o).toBeCloseTo(-300 - k, 6); // slightly below normal, contract does not pay
  });
  it("different loss severities change the optimum", () => {
    const small = optimize("variance", ctxOf({ ...sm(), lossRows: illustrativeLossRows(200) }), 300);
    const big = optimize("variance", ctxOf(sm()), 300);
    expect(small.position.contracts).not.toBe(big.position.contracts);
  });
  it("derived stats count only loss states", () => {
    const st = probStats(distRows(probState(sm()), L)!);
    expect(st.pLoss).toBeCloseTo(0.05 + 0.1 + 0.08 + 0.07 + 0.12 + 0.08, 12);
    expect(st.pLossNoPay).toBeCloseTo(0.1 + 0.07 + 0.08, 12);
  });
  it("end-to-end analysis labels the model and is assumption-dependent", () => {
    const a = analyze({ ...sm(), objective: "cvar" }, null);
    expect(a.basis).toBe("probability");
    expect(buildSummary({ ...sm(), objective: "cvar" }, a, null).text).toMatch(/multi-level loss model/);
  });
});

describe("price boundaries and validation", () => {
  it("rejects prices outside $0.01-$0.99 and NaN", () => {
    for (const price of [0, 0.005, 1, 1.2, NaN, -1]) expect(validate({ ...base(), price }).price).toBeTruthy();
    for (const price of [0.01, 0.5, 0.99]) expect(validate({ ...base(), price }).price).toBeUndefined();
  });
  it("rejects bad numeric inputs; blank limits are allowed, negative are not", () => {
    const e = validate({ ...base(), customers: 2.5, revPerVisit: -1, margin: 1.5, coverage: NaN, budget: -5, feeMult: -1 });
    expect(e.customers && e.revPerVisit && e.margin && e.coverage && e.budget && e.feeMult).toBeTruthy();
    expect(validate(base()).budget).toBeUndefined();
  });
  it("99-cent price is unreachable or needs far more contracts; 1-cent is cheap", () => {
    const c = minContractsFor([300], buildCostTable(0.99, null))[0] ?? null;
    expect(c === null || c > 391).toBe(true);
    const t = buildCostTable(0.01, null), c1 = minContractsFor([300], t)[0]!;
    expect(t.cost[c1]!).toBeLessThan(10);
  });
});

describe("exposure defaults and reset", () => {
  it("spec defaults", () => {
    const e = exposure(base());
    expect([e.normalRevenue, e.lowRevenue, e.lostRevenue, e.lostContribution]).toEqual([3600, 1200, 2400, 1200]);
    expect(exposure({ ...base(), lowVisits: 5 }).lostContribution).toBe(0);
  });
  it("scenarios are isolated; reset keeps identity and clears inputs", () => {
    const a = base(), b = defaultScenario("New business");
    expect(a.id).not.toBe(b.id);
    expect(b.probs).not.toBe(a.probs);
    const s = { ...a, customers: 77, price: 0.5, name: "X", notes: "keep me", location: "Loop", budget: 10, maxCoverage: 0.5 };
    const r = resetScenario(s);
    expect([r.customers, r.price, r.maxCoverage]).toEqual([20, 0.22, 1]);
    expect(r.budget).toBeNaN();
    expect([r.id, r.name, r.notes, r.location]).toEqual([s.id, "X", "keep me", "Loop"]);
  });
});

describe("kalshi owner market parsing", () => {
  const market = (over: object = {}) => ({ markets: [{ ticker: "KXCHISNOWM-26DEC-2", status: "active", title: "t", rules_primary: "If the total snowfall in Chicago (O'Hare) in December 2026 is strictly greater than 2 inches, then the market resolves to Yes.", ...over }] });
  const book = { orderbook_fp: { yes_dollars: [["0.6200", "13.02"], ["0.6300", "9.00"], ["0.0100", "0.50"]], no_dollars: [["0.2600", "7.75"]] } };
  const series = { series: { fee_type: "quadratic", fee_multiplier: 1 } };
  it("NO ask ladder = 1 - YES bids, ascending, whole contracts", () => {
    expect(parseNoAskLadder(book)).toEqual([{ price: 0.37, size: 9 }, { price: 0.38, size: 13 }]);
  });
  it("verified needs exact ticker, active status, matching rules, depth and a confirmed fee schedule", () => {
    const m = buildOwnerMarket(market(), book, null, series);
    expect(m.verified).toBe(true);
    expect(m.feeMultiplier).toBe(1);
    expect(buildOwnerMarket(market({ ticker: "OTHER" }), book, null, series).status).toBe("not_found");
    expect(buildOwnerMarket(market({ status: "closed" }), book, null, series).verified).toBe(false);
    expect(buildOwnerMarket(market({ rules_primary: "something else" }), book, null, series).verified).toBe(false);
    expect(buildOwnerMarket(market(), null, "HTTP 500", series).verified).toBe(false);
    expect(buildOwnerMarket({ nope: 1 }, book, null, series).status).toBe("unavailable");
    expect(buildOwnerMarket(market(), book, null, null).verified).toBe(false);
    expect(buildOwnerMarket(market(), book, null, { series: { fee_type: "flat", fee_multiplier: 1 } }).verified).toBe(false);
  });
});

describe("copy summary accuracy", () => {
  const s = withP({ ...limits(base(), 500), objective: "variance", notes: "call notes" });
  const a = analyze(s, null);
  const sum = buildSummary(s, a, null, new Date("2026-11-12T12:00:00Z"));
  it("contains the spec figures (2dp) and labels", () => {
    for (const t of ["$2,400.00", "$1,200.00", "$300.00", "391", "$86.02", "$4.70", "$90.72", "$300.28", "ILLUSTRATIVE", "call notes", "2026-11-12T12:00:00.000Z", "Per-push only", "simplified four-state model"]) expect(sum.text).toContain(t);
  });
  it("states the result type, optimizer result and fee rule consistently", () => {
    expect(sum.text).toContain(`Calculated contracts: ${a.opt!.position.contracts.toLocaleString("en-US")}`);
    expect(sum.text).toContain("Probability-based optimization (assumption-dependent)");
    expect(sum.text).toMatch(/\$0\.0001/);
    expect(sum.text).toMatch(/90% CVaR before \/ after/);
  });
  it("target sizing is labeled illustrative", () => {
    const t = buildSummary(limits(base()), analyze(limits(base()), null), null);
    expect(t.text).toContain("Illustrative hedge sizing");
  });
  it("includes risk language and no guarantee", () => {
    expect(sum.text).toMatch(/expire worthless/);
    expect(sum.text).toMatch(/Basis risk/);
    expect(sum.text).toMatch(/not a recommendation to trade/);
    expect(sum.text).toMatch(/Not affiliated with or endorsed by Kalshi/);
    expect(sum.text).toMatch(/stress case/);
    expect(sum.text).not.toMatch(/guaranteed (savings|profit)/i);
  });
  it("invalid inputs produce no financial results", () => {
    const bad = analyze({ ...base(), price: 2 }, null);
    expect(bad.valid).toBe(false);
    expect(buildSummary({ ...base(), price: 2 }, bad, null).text).toMatch(/invalid/);
  });
});

describe("chart sweep", () => {
  it("monotone cost, anchored at no hedge", () => {
    const pts = sweep(ctxOf(withP(limits(base()))));
    expect(pts[0]!.contracts).toBe(0);
    expect(pts[0]!.ifPays).toBe(-1200);
    for (let i = 1; i < pts.length; i++) expect(pts[i]!.cost!).toBeGreaterThanOrEqual(pts[i - 1]!.cost!);
  });
});

describe("early-settlement disclosure and fee source", () => {
  const s = limits(base());
  const sum = buildSummary(s, analyze(s, null), null, new Date("2026-11-12T12:00:00Z"));
  it("exact required wording", () => {
    expect(EARLY_SETTLEMENT).toBe("If Chicago O'Hare records more than 2 inches of December snowfall, this contract can close and settle early. A NO position would then expire worthless, even if December has not ended. Official reporting and confirmation may take time.");
    expect(EARLY_SETTLEMENT).not.toMatch(/instant/i);
  });
  it("is in the copied summary and the print sections", () => {
    expect(sum.text).toContain(EARLY_SETTLEMENT);
    expect(sum.sections.flatMap((x) => x.rows).some(([k, v]) => k === "Early settlement" && v === EARLY_SETTLEMENT)).toBe(true);
  });
  it("fee source is cited with the schedule date and URL", () => {
    expect(FEE_SOURCE.url).toBe("https://kalshi.com/docs/kalshi-fee-schedule.pdf");
    expect(sum.text).toContain("Kalshi Fee Schedule, effective July 7, 2026");
    expect(sum.text).toContain("https://kalshi.com/docs/kalshi-fee-schedule.pdf");
  });
  it("homepage Hedge Lab and Owner Lab share one fee implementation", () => {
    for (const [n, p] of [[391, 0.22], [489, 0.37], [250, 0.43], [350, 0.38], [1, 0.5]] as const) {
      expect(contractEconomics(n, p, 0.07).cashAtRisk).toBe(fillOrder(n, p, null, 1).cost);
    }
  });
});
