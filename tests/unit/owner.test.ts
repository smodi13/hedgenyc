import { describe, expect, it } from "vitest";
import { analyze, buildSummary, defaultSelection, earlySettlementText, marketMonth, probStats, suitability, LIQUIDITY_MSG, type Selection } from "@/lib/owner/analysis";
import { caseDefault, defaultProfile, exampleProfile, exposure, exposureSentence, validateProfile, type Profile } from "@/lib/owner/business";
import {
  buildCostTable, ceilCenticent, cvarOf, evaluate, fillOrder, maxAffordable, meanOf, minContractsFor, netWin, optimize, outcomesFor, pnl, sweep, varianceOf, type Ctx, type Ladder,
} from "@/lib/owner/hedge";
import {
  defaultScenario, distRows, ILLUSTRATIVE_PROBS, illustrativeLossRows, probState, protectedLoss, resetScenario, validate, EARLY_SETTLEMENT, FEE_SOURCE, type Scenario,
} from "@/lib/owner/model";
import { contractEconomics } from "@/lib/finance/hedge";
import { buildContract, parseAskLadders, parseEvents, searchSeries, validTicker, parseSeriesList, type ContractInfo } from "@/lib/kalshi/contract";

const base = () => defaultScenario();
const limits = (s: Scenario, budget = 500, maxLoss = budget): Scenario => ({ ...s, budget, maxTradingLoss: maxLoss });
const withP = (s: Scenario, p = ILLUSTRATIVE_PROBS): Scenario => ({ ...s, probs: { ...p }, probSource: "illustrative" });
const prof = (s: Scenario, patch: Partial<Profile>): Scenario => ({ ...s, profile: { ...s.profile, ...patch } });
const ctxOf = (s: Scenario, ladder: Ladder = null, price = 0.22): Ctx => {
  const L = protectedLoss(s, exposure(s.profile));
  return { loss: L, table: buildCostTable(price, ladder, s.feeMult), dist: distRows(probState(s), L), budget: s.budget, maxTradingLoss: s.maxTradingLoss, positionLimit: s.positionLimit, maxCoverage: s.maxCoverage, variability: s.variability };
};
/** A manual-price selection (no market loaded) */
const man = (price = 0.22, side: "yes" | "no" = "no"): Selection => ({ ...defaultSelection(), loading: false, priceMode: "manual", price, side });
const MARKET_ROW = { ticker: "KXCHISNOWM-26DEC-2", event_ticker: "KXCHISNOWM-26DEC", title: "Snow in Chicago in Dec 2026?", yes_sub_title: "Above 2 inches", no_sub_title: "Above 2 inches", status: "active", strike_type: "greater", floor_strike: 2, close_time: "2027-01-01T06:00:00Z", rules_primary: "If the total snowfall in Chicago (O'Hare) in December 2026 is strictly greater than 2 inches, then the market resolves to Yes.", can_close_early: true, early_close_condition: "This market will close early if the event occurs." };
const BOOK = { orderbook_fp: { yes_dollars: [["0.6200", "13.02"], ["0.6300", "9.00"], ["0.0100", "0.50"]], no_dollars: [["0.2600", "7.75"], ["0.3000", "100"]] } };
const FEE = { feeType: "quadratic", feeMultiplier: 1, category: "Climate and Weather" };
const info = (over: Record<string, unknown> = {}, book: unknown = BOOK, fee: typeof FEE | null = FEE): ContractInfo => buildContract({ ...MARKET_ROW, ...over }, { seriesTicker: "KXCHISNOWM", fee, book, bookError: book ? null : "HTTP 500", now: new Date("2026-11-12T15:00:00Z") })!;
const live = (i: ContractInfo | null, over: Partial<Selection> = {}): Selection => ({ ...defaultSelection(), loading: false, info: i, ticker: i?.ticker ?? "X", priceMode: "live", ...over });

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
});

describe("chart sweep", () => {
  it("monotone cost, anchored at no hedge", () => {
    const pts = sweep(ctxOf(withP(limits(base()))));
    expect(pts[0]!.contracts).toBe(0);
    expect(pts[0]!.ifPays).toBe(-1200);
    for (let i = 1; i < pts.length; i++) expect(pts[i]!.cost!).toBeGreaterThanOrEqual(pts[i - 1]!.cost!);
  });
});


/* ===================== Business profile ===================== */

describe("Asset Operations Group profile (per-push only)", () => {
  it("is the default preset with public facts flagged and illustrative status", () => {
    const p = base().profile;
    expect([p.name, p.publicFacts, p.verification, p.city, p.state]).toEqual(["Asset Operations Group", true, "illustrative", "Chicago", "IL"]);
  });
  it("never assumes a seasonal contract, even if the flag and an amount are set", () => {
    const p = { ...defaultProfile(), seasonalEnabled: true, seasonalRevenue: 9999 };
    expect(exposure(p)).toEqual(exposure({ ...p, seasonalEnabled: false, seasonalRevenue: 0 }));
  });
  it("default quick numbers: independent reference calculation", () => {
    const e = exposure(defaultProfile());
    const lowRev = 20 * 1 * 60, normRev = 20 * 3 * 60;
    expect(e.low.revenue).toBe(lowRev);
    expect(e.normal.revenue).toBe(normRev);
    expect(e.shortfallLow).toBe((normRev - lowRev) * 0.5);
    expect(e.normal.revenue - e.low.revenue).toBe(2400); // lost revenue
    expect(e.shortfallLow).toBe(1200); // lost contribution, not lost revenue
  });
});

describe("Low / Normal / High scenario builder", () => {
  const ex = exampleProfile(defaultProfile());
  it("illustrative example: 150x1, 250x3, 350x5 at $60", () => {
    const e = exposure(ex), m = 0.5;
    const rev = (c: number, v: number) => c * v * 60;
    expect([e.low.revenue, e.normal.revenue, e.high.revenue]).toEqual([rev(150, 1), rev(250, 3), rev(350, 5)]);
    expect(e.low.contribution).toBe(rev(150, 1) * m);
    expect(e.shortfallLow).toBe((rev(250, 3) - rev(150, 1)) * m);
    expect(e.shortfallHigh).toBe(0); // more work at a flat margin is never a shortfall
    expect(ex.verification).toBe("illustrative");
  });
  it("shortfall formulas clamp at zero and compare against NORMAL", () => {
    const p = { ...defaultProfile(), low: caseDefault(20, 4), normal: caseDefault(20, 3) };
    expect(exposure(p).shortfallLow).toBe(0);
    expect(exposure(p).low.contributionVsNormal).toBeGreaterThan(0);
  });
  it("high activity can reduce contribution when it adds costs (detailed mode)", () => {
    const p: Profile = { ...defaultProfile(), mode: "detailed", labor: 22, fuel: 5, salt: 3, high: { ...caseDefault(20, 5), otherCosts: 3000 } };
    const e = exposure(p);
    const perVisit = 22 + 5 + 3;
    const normalC = 20 * 3 * 60 - 20 * 3 * perVisit, highC = 20 * 5 * 60 - 20 * 5 * perVisit - 3000;
    expect(e.normal.contribution).toBe(normalC);
    expect(e.high.contribution).toBe(highC);
    expect(e.shortfallHigh).toBe(Math.max(0, normalC - highC));
    expect(e.shortfallHigh).toBeGreaterThan(0);
  });
  it("residential and commercial are separate, with separate visits and prices", () => {
    const c = { ...caseDefault(10, 3), comCustomers: 2, comVisits: 4, comRev: 200 };
    const p: Profile = { ...defaultProfile(), mode: "detailed", labor: 20, fuel: 5, salt: 5, normal: c, low: { ...c, resVisits: 1, comVisits: 1 } };
    const e = exposure(p);
    const revN = 10 * 3 * 60 + 2 * 4 * 200, visitsN = 10 * 3 + 2 * 4;
    expect(e.normal.revenue).toBe(revN);
    expect(e.normal.variableCosts).toBe(visitsN * 30);
    expect(e.low.revenue).toBe(10 * 1 * 60 + 2 * 1 * 200);
  });
  it("variable costs move with visits; fixed costs change income but never the shortfall", () => {
    const p: Profile = { ...defaultProfile(), mode: "detailed" };
    const withFixed: Profile = { ...p, fixedOverhead: 1000, fixedEquipment: 500, fixedInsurance: 250, fixedFacilities: 100, fixedOther: 50 };
    const a = exposure(p), b = exposure(withFixed);
    expect(b.shortfallLow).toBe(a.shortfallLow);
    expect(b.normal.contribution).toBe(a.normal.contribution);
    expect(b.normal.fixedCosts).toBe(1900);
    expect(b.normal.operatingIncome).toBe(a.normal.contribution - 1900);
    expect(b.low.operatingIncomeVsNormal).toBe(b.low.contributionVsNormal);
    expect(a.low.variableCosts).toBe(20 * 1 * 30);
  });
  it("margin is consistent: quick uses the entered margin, detailed derives it, and they never stack", () => {
    const q = exposure({ ...defaultProfile(), low: { ...caseDefault(20, 1), margin: 0.4, otherCosts: 99999 } });
    expect(q.low.marginPct).toBeCloseTo(0.4, 12);
    expect(q.low.variableCosts).toBeCloseTo(20 * 60 * 0.6, 9); // otherCosts ignored in quick
    const d = exposure({ ...defaultProfile(), mode: "detailed", labor: 10, fuel: 0, salt: 0, low: { ...caseDefault(20, 1), margin: 0.99 } });
    expect(d.low.marginPct).toBeCloseTo((1200 - 200) / 1200, 12); // margin input ignored in detailed
  });
  it("minimum service charge lifts the per-visit price; salting and ice add revenue", () => {
    const p: Profile = { ...defaultProfile(), minCharge: 75, saltRev: 40, iceRev: 90, normal: { ...caseDefault(10, 2), saltOcc: 3, iceOcc: 2, otherRevenue: 100 } };
    expect(exposure(p).normal.revenue).toBe(10 * 2 * 75 + 3 * 40 + 2 * 90 + 100);
  });
  it("generic seasonal revenue is kept in every case and does not change the shortfall", () => {
    const g = { ...defaultProfile("New / Custom Business") };
    const a = exposure(g), b = exposure({ ...g, seasonalEnabled: true, seasonalRevenue: 5000 });
    for (const k of ["low", "normal", "high"] as const) expect(b[k].revenue - a[k].revenue).toBe(5000);
    expect(b.shortfallLow).toBe(a.shortfallLow);
    expect(exposure({ ...g, seasonalEnabled: true, seasonalRevenue: 5000, normal: caseDefault(20, 4) }).normal.revenue - 5000).toBe(20 * 4 * 60);
  });
  it("owner-facing conditional sentence names the period and the amount", () => {
    const p = defaultProfile(), t = exposureSentence(p, exposure(p));
    expect(t).toBe("Based on the information entered, an unusually light-activity 2026-12 could reduce your contribution by approximately $1,200 compared with a normal 2026-12.");
  });
  it("validates inputs, period format and fractions", () => {
    const bad = validateProfile({ ...defaultProfile(), period: "December", normal: { ...caseDefault(20, 3), resCustomers: 2.5, resRev: -1, margin: 1.5 } });
    expect(bad.period && bad["normal.resCustomers"] && bad["normal.resRev"] && bad["normal.margin"]).toBeTruthy();
    expect(validateProfile({ ...defaultProfile(), seasonalEnabled: true, seasonalRevenue: -1 }).seasonalRevenue).toBeUndefined(); // AOG ignores seasonal
    expect(validateProfile({ ...defaultProfile("New / Custom Business"), seasonalEnabled: true, seasonalRevenue: NaN }).seasonalRevenue).toBeTruthy();
    expect(Object.keys(validateProfile(defaultProfile()))).toHaveLength(0);
  });
});

/* ===================== Kalshi contract layer ===================== */

describe("Kalshi contract parsing", () => {
  it("YES asks come from NO bids and NO asks from YES bids, ascending, whole contracts", () => {
    const l = parseAskLadders(BOOK)!;
    expect(l.noAsks).toEqual([{ price: 0.37, size: 9 }, { price: 0.38, size: 13 }]);
    expect(l.yesAsks).toEqual([{ price: 0.7, size: 100 }, { price: 0.74, size: 7 }]);
  });
  it("never reads bids, last trades or midpoints as asks", () => {
    const c = info({ yes_bid_dollars: "0.62", last_price_dollars: "0.50", yes_ask_dollars: "0.01" });
    expect(c.noAsks[0]!.price).toBe(0.37);
    expect(c.yesAsks.every((x) => x.price > 0.5)).toBe(true);
  });
  it("malformed book fails closed with a note", () => {
    const c = info({}, { orderbook_fp: { yes_dollars: "x" } });
    expect(c.bookOk).toBe(false);
    expect(c.noAsks).toEqual([]);
    expect(c.bookNote).toMatch(/malformed/);
    expect(info({}, null).bookNote).toMatch(/unavailable/);
  });
  it("keeps exact official terms and early-close fields", () => {
    const c = info();
    expect(c.rulesPrimary).toBe(MARKET_ROW.rules_primary);
    expect([c.canCloseEarly, c.earlyCloseCondition]).toEqual([true, "This market will close early if the event occurs."]);
    expect([c.strikeType, c.floorStrike, c.feeType, c.feeMultiplier, c.url]).toEqual(["greater", 2, "quadratic", 1, "https://kalshi.com/markets/kxchisnowm/kxchisnowm-26dec"]);
    expect(buildContract({ ticker: "", status: "active" }, { seriesTicker: null, fee: null, book: null, bookError: null })).toBeNull();
  });
  it("validates tickers", () => {
    for (const t of ["KXCHISNOWM-26DEC-2", "ABC", "A.B_C-1"]) expect(validTicker(t)).toBe(true);
    for (const t of ["", "ab", "kx lower", "A".repeat(81), "A/B", "A?x=1", 5]) expect(validTicker(t)).toBe(false);
  });
  it("search filters by tokens and category; events parse with nested markets", () => {
    const series = parseSeriesList({ series: [{ ticker: "KXCHISNOWM", title: "Chicago Snowfall Monthly", category: "Climate and Weather", tags: ["Snow"] }, { ticker: "KXNYCRAIN", title: "NYC Rain", category: "Climate and Weather", tags: [] }, { ticker: "KXNBA", title: "NBA", category: "Sports" }, { bad: 1 }] })!;
    expect(series).toHaveLength(3);
    expect(searchSeries(series, "chicago snow", null, 10).map((x) => x.ticker)).toEqual(["KXCHISNOWM"]);
    expect(searchSeries(series, "", "Climate and Weather", 10)).toHaveLength(2);
    expect(searchSeries(series, "rain", "Sports", 10)).toEqual([]);
    const ev = parseEvents({ events: [{ event_ticker: "E1", series_ticker: "S", title: "T", markets: [{ ticker: "E1-2", status: "active", yes_sub_title: "Above 2", strike_type: "greater", floor_strike: 2 }, { nope: 1 }] }, { event_ticker: "E2", markets: [] }] })!;
    expect(ev).toHaveLength(1);
    expect(ev[0]!.markets).toHaveLength(1);
    expect(parseEvents({})).toBeNull();
  });
  it("derives the settlement month and strike text", () => {
    expect(marketMonth(info())).toBe("2026-12");
    expect(marketMonth(info({ close_time: undefined, expiration_time: undefined }))).toBeNull();
  });
});

/* ===================== Hedge sizing ===================== */

describe("Mode A: budget-first sizing", () => {
  const brute = (budget: number, price: number, ladder: Ladder = null, mult = 1) => { let c = 0; for (let n = 1; n <= 50_000; n++) { const f = fillOrder(n, price, ladder, mult); if (!f.complete || f.cost > budget + 1e-9) break; c = n; } return c; };
  const sc = (budget: number, extra: Partial<Scenario> = {}): Scenario => ({ ...base(), sizeMode: "budget", budget, maxCoverage: 10, ...extra });
  it("buys the most whole contracts inside the budget, matching a brute-force scan", () => {
    for (const [b, p] of [[100, 0.22], [250, 0.37], [37.5, 0.5], [0.5, 0.9]] as const) {
      const a = analyze(sc(b), man(p)), z = a.sizing!;
      expect(z.mode).toBe("budget");
      expect(z.position.contracts).toBe(brute(b, p));
      expect(z.position.cost).toBeLessThanOrEqual(b);
      expect(fillOrder(z.position.contracts + 1, p, null, 1).cost).toBeGreaterThan(b);
    }
  });
  it("does not force a 25% hedge", () => {
    const a = analyze(sc(40), man(0.22)); // small budget, far below 25% of $1,200
    expect(a.sizing!.position.coverage!).toBeLessThan(0.25);
    expect(a.sizing!.position.contracts).toBeGreaterThan(0);
  });
  it("reports principal, fees, cash, payout, net profit, worthless loss, coverage and remaining loss", () => {
    const p = analyze(sc(100), man(0.22)).sizing!.position, c = p.contracts;
    expect(p.premium).toBeCloseTo(fillOrder(c, 0.22, null, 1).premium, 9);
    expect(p.cost).toBeCloseTo(p.premium + p.fee, 9);
    expect(p.netWin).toBeCloseTo(c - p.cost, 9);
    expect(p.maxLoss).toBe(p.cost);
    expect(p.coverage!).toBeCloseTo(p.netWin / 1200, 12);
    expect(1200 - p.netWin).toBeCloseTo(-p.outcomes.lossPays, 9);
  });
  it("max trading loss, position limit and coverage cap each bind", () => {
    const tight = analyze(sc(500, { maxTradingLoss: 30 }), man(0.22)).sizing!.position;
    expect(tight.cost).toBeLessThanOrEqual(30);
    expect(tight.contracts).toBe(brute(30, 0.22));
    expect(analyze(sc(500, { positionLimit: 25 }), man(0.22)).sizing!.position.contracts).toBe(25);
    const cap = analyze(sc(2000, { maxCoverage: 0.1 }), man(0.22)).sizing!.position;
    expect(cap.netWin).toBeLessThanOrEqual(120 + 1e-9);
    expect(maxAffordable(ctxOf(sc(2000, { maxCoverage: 0.1 }))).binding).toBe("coverage");
    expect(maxAffordable(ctxOf(sc(10))).binding).toBe("budget");
  });
  it("needs a budget; a budget too small for one contract buys none", () => {
    expect(analyze(sc(NaN), man()).sizing!.status).toBe("needs-input");
    const z = analyze(sc(0.1), man()).sizing!;
    expect([z.position.contracts, z.status]).toEqual([0, "none"]);
  });
  it("limited by depth when the live book is thin, and says liquidity, not budget", () => {
    const c = info();
    const a = analyze(sc(5000), live(c));
    expect(a.sizing!.position.contracts).toBe(22); // 9 + 13 displayed
    expect(a.liquidity!.available).toBe(22);
    expect(a.liquidity!.message).toBe(LIQUIDITY_MSG);
    expect(a.sizing!.theoretical!).toBeGreaterThan(22);
  });
});

describe("Mode B: protect a specific percentage", () => {
  const sc = (cov: number, extra: Partial<Scenario> = {}): Scenario => ({ ...base(), sizeMode: "protect", coverage: cov, ...extra });
  const bruteMin = (target: number, price: number) => { for (let n = 0; n <= 50_000; n++) { const f = fillOrder(n, price, null, 1); if (n - f.cost >= target - 1e-9) return n; } return null; };
  it("finds the minimum whole-contract quantity whose NET winning profit meets coverage x loss", () => {
    for (const cov of [0.1, 0.25, 0.5, 0.8]) {
      const z = analyze(sc(cov), man(0.22)).sizing!, target = 1200 * cov;
      expect(z.position.contracts).toBe(bruteMin(target, 0.22));
      expect(z.position.netWin).toBeGreaterThanOrEqual(target - 1e-9);
      expect(evaluate(z.position.contracts - 1, ctxOf(sc(cov))).netWin).toBeLessThan(target);
    }
  });
  it("matches the spec regression: 25% at $0.22 is 391 contracts, $90.72 cash, $300.28 profit", () => {
    const p = analyze(sc(0.25), man(0.22)).sizing!.position;
    expect([p.contracts, p.cost.toFixed(2), p.fee.toFixed(2), p.premium.toFixed(2), p.netWin.toFixed(2)]).toEqual([391, "90.72", "4.70", "86.02", "300.28"]);
  });
  it("rejects a position above budget or max trading loss: 'No valid position.', with what it would need", () => {
    const z = analyze(sc(0.25, { budget: 50 }), man(0.22)).sizing!;
    expect(z.status).toBe("infeasible");
    expect(z.headline).toBe("No valid position.");
    expect(z.position.contracts).toBe(0);
    expect(z.required!.contracts).toBe(391);
    expect(z.reason).toMatch(/budget/);
    expect(analyze(sc(0.25, { budget: 500, maxTradingLoss: 50 }), man(0.22)).sizing!.status).toBe("infeasible");
    expect(analyze(sc(0.25, { budget: 150 }), man(0.37)).sizing!.status).toBe("infeasible"); // 489 contracts, $188.91
    expect(analyze(sc(0.25, { budget: 200 }), man(0.37)).sizing!.position.contracts).toBe(489);
  });
  it("calls the entered percentage a target, never optimal", () => {
    expect(analyze(sc(0.25), man()).sizing!.reason).toMatch(/target, not an optimum/);
    expect(analyze(sc(0.25), man()).sizing!.headline).not.toMatch(/optimal/i);
  });
  it("zero target needs zero contracts; no modeled loss means nothing to protect", () => {
    expect(analyze(sc(0), man()).sizing!.position.contracts).toBe(0);
    expect(analyze({ ...sc(0.5), useOverride: true, overrideLoss: 0 }, man()).sizing!.status).toBe("none");
  });
  it("live depth shortfall is distinct from a budget shortfall", () => {
    const a = analyze(sc(0.25, { budget: 1000 }), live(info()));
    expect(a.sizing!.status).toBe("infeasible");
    expect(a.liquidity!.message).toBe(LIQUIDITY_MSG);
    expect(a.sizing!.reason).toBe(LIQUIDITY_MSG);
    expect(a.sizing!.theoretical!).toBeGreaterThan(a.liquidity!.available);
  });
});

describe("Mode C: risk-reducing hedge", () => {
  const sc = (extra: Partial<Scenario> = {}): Scenario => ({ ...limits(base(), 500), sizeMode: "risk", ...extra });
  it("needs owner probabilities, with the required message", () => {
    for (const objective of ["variance", "cvar"] as const) {
      const a = analyze(sc({ objective }), man());
      expect(a.probs.kind).toBe("missing");
      expect(a.sizing!.status).toBe("needs-input");
      expect(a.sizing!.reason).toBe("More information is needed to estimate a personalized risk-reducing hedge.");
      expect(a.sizing!.position.contracts).toBe(0);
    }
    expect(analyze(sc({ objective: "variance", probs: { lossPays: 0.5, lossLoses: 0.5, noLossPays: 0.5, noLossLoses: 0.5 } }), man()).sizing!.status).toBe("needs-input");
  });
  it("needs a budget; max trading loss alone is optional", () => {
    expect(analyze(withP(sc({ budget: NaN })), man()).sizing!.status).toBe("needs-input");
    expect(analyze(withP(sc({ maxTradingLoss: NaN })), man()).sizing!.status).toBe("ok");
  });
  it("matches the existing optimizer and honours every limit", () => {
    const s = withP(sc({ objective: "variance" }));
    const a = analyze(s, man()), direct = optimize("variance", ctxOf(s), 300);
    expect(a.sizing!.position.contracts).toBe(direct.position.contracts);
    expect(a.sizing!.position.cost).toBeLessThanOrEqual(500);
    expect(a.sizing!.position.variance!).toBeLessThanOrEqual(a.sizing!.position.variance === null ? 0 : direct.baseline.variance!);
  });
  it("zero contracts is a valid answer when the contract is unrelated to the loss", () => {
    const s = withP(sc({ objective: "cvar" }), { lossPays: 0.09, lossLoses: 0.21, noLossPays: 0.21, noLossLoses: 0.49 });
    expect(analyze(s, man()).sizing!.position.contracts).toBe(0);
  });
  it("respects a tighter budget and trading-loss cap", () => {
    const s = withP(sc({ objective: "variance", budget: 20 }));
    expect(analyze(s, man()).sizing!.position.cost).toBeLessThanOrEqual(20);
    expect(analyze({ ...s, budget: 500, maxTradingLoss: 10 }, man()).sizing!.position.cost).toBeLessThanOrEqual(10);
  });
  it("only claims probability-based results with valid entered probabilities (basic scenario math works without them)", () => {
    const a = analyze(sc(), man());
    expect(a.valid).toBe(true);
    expect(a.exposure.shortfallLow).toBe(1200);
  });
});

/* ===================== Live vs manual pricing ===================== */

describe("live pricing, depth and fees", () => {
  const sc = (extra: Partial<Scenario> = {}): Scenario => ({ ...base(), sizeMode: "budget", budget: 15, maxCoverage: 10, ...extra });
  it("walks the correct ask side with weighted-average entry and the shared multi-level fee", () => {
    const a = analyze(sc({ budget: 15 }), live(info()));
    const p = a.sizing!.position;
    const ladder = [{ price: 0.37, size: 9 }, { price: 0.38, size: 13 }];
    const f = fillOrder(p.contracts, 0, ladder, 1);
    expect(p.cost).toBe(f.cost);
    expect(a.liquidity!.avgPrice).toBeCloseTo(f.premium / p.contracts, 12);
    expect(a.liquidity!.bestAsk).toBe(0.37);
    expect(a.liquidity!.fetchedAt).toBe("2026-11-12T15:00:00.000Z");
    expect(a.priceSource).toBe("live");
  });
  it("YES side prices from the YES ask ladder (NO bids), not the NO ladder", () => {
    const a = analyze(sc({ budget: 40 }), live(info(), { side: "yes" }));
    expect(a.liquidity!.bestAsk).toBe(0.7);
    expect(a.sizing!.position.contracts).toBe(brute(40, [{ price: 0.7, size: 100 }, { price: 0.74, size: 7 }]));
    function brute(b: number, l: { price: number; size: number }[]) { let c = 0; for (let n = 1; n <= 107; n++) { const f = fillOrder(n, 0, l, 1); if (!f.complete || f.cost > b) break; c = n; } return c; }
  });
  it("uses the market's published fee multiplier, not the user's", () => {
    const a = analyze(sc({ feeMult: 5 }), live(info({}, BOOK, { ...FEE, feeMultiplier: 0 })));
    expect(a.feeMult).toBe(0);
    expect(a.sizing!.position.fee).toBe(0);
    expect(analyze(sc({ feeMult: 5 }), man()).feeMult).toBe(5);
  });
  it("price cap removes offers above it", () => {
    const a = analyze(sc({ budget: 500 }), live(info(), { priceCap: 0.37 }));
    expect(a.liquidity!.available).toBe(9);
    expect(a.sizing!.position.contracts).toBe(9);
    expect(analyze(sc(), live(info(), { priceCap: 1.5 })).errors.priceCap).toBeTruthy();
  });
  it("unavailable live data never falls back to the manual price", () => {
    for (const sel of [live(null, { infoNote: "HTTP 500" }), live(info({}, null))]) {
      const a = analyze(sc(), { ...sel, price: 0.22 });
      expect(a.liveOk).toBe(false);
      expect(a.sizing!.position.contracts).toBe(0);
      expect(a.warnings.join(" ")).toMatch(/not substituted/);
      expect(a.execution).toBe("unavailable");
    }
  });
  it("closed or settled markets, unknown fee types and empty books are not live-executable", () => {
    expect(analyze(sc(), live(info({ status: "closed" }))).liveNote).toMatch(/not open/);
    expect(analyze(sc(), live(info({}, BOOK, { ...FEE, feeType: "flat" }))).liveNote).toMatch(/quadratic/);
    expect(analyze(sc(), live(info({}, BOOK, null))).liveOk).toBe(false);
    const empty = { orderbook_fp: { yes_dollars: [], no_dollars: [] } };
    const a = analyze(sc(), live(info({}, empty)));
    expect(a.liveNote).toMatch(/No NO offers/);
    expect(a.sizing!.position.contracts).toBe(0);
    expect(a.liquidity!.available).toBe(0);
  });
  it("manual prices are labeled illustrative and execution is unknown", () => {
    const a = analyze(sc(), man(0.3));
    expect([a.execution, a.liquidity, a.priceSource]).toEqual(["unknown", null, "manual"]);
    expect(a.warnings.join(" ")).toMatch(/Illustrative only\. Not an executable quote\./);
    expect(analyze(sc(), man(0)).errors.price).toBeTruthy();
    expect(analyze(sc(), man(1)).errors.price).toBeTruthy();
    expect(analyze(sc(), man(NaN)).errors.price).toBeTruthy();
  });
  it("slippage: the average fill exceeds the best ask when the order walks the book", () => {
    const a = analyze(sc({ budget: 1000 }), live(info()));
    expect(a.liquidity!.avgPrice!).toBeGreaterThan(a.liquidity!.bestAsk!);
    expect(a.checks.find((c) => c.id === "slip")!.detail).toMatch(/slippage|Average fill/i);
  });
});

/* ===================== Suitability ===================== */

describe("contract suitability screening", () => {
  const s = base();
  it("is 'Potentially aligned' only when topic, place, period, direction, status and the owner's threshold all check out", () => {
    expect(suitability({ ...s, confirmThreshold: true }, live(info())).label).toBe("Potentially aligned");
    expect(suitability(s, live(info())).label).toBe("Needs more information");
  });
  it("direction: YES on a 'greater' snowfall contract pays in the high-snow outcome, a mismatch for a low-activity hedge", () => {
    const r = suitability({ ...s, confirmThreshold: true }, live(info(), { side: "yes" }));
    expect(r.label).toBe("Material mismatch");
    expect(r.items.some((i) => i.ok === false && /not the low-activity/.test(i.text))).toBe(true);
    expect(suitability(prof({ ...s, confirmThreshold: true }, { hedgeCase: "high" }), live(info(), { side: "yes" })).label).toBe("Potentially aligned");
  });
  it("mismatches: period, location, topic and market status", () => {
    const ok = { ...s, confirmThreshold: true };
    expect(suitability(prof(ok, { period: "2026-11" }), live(info())).label).toBe("Material mismatch");
    expect(suitability(prof(ok, { city: "Boston" }), live(info())).label).toBe("Material mismatch");
    expect(suitability({ ...prof(ok, { city: "Boston" }), confirmLocation: true }, live(info())).label).toBe("Potentially aligned");
    expect(suitability(ok, live(info({ title: "NBA champion", rules_primary: "Team wins the title", yes_sub_title: "Lakers" }))).label).toBe("Material mismatch");
    expect(suitability(ok, live(info({ status: "closed" }))).label).toBe("Material mismatch");
  });
  it("insufficient information without a contract or its rules; early close and basis risk are always flagged", () => {
    expect(suitability(s, live(null)).label).toBe("Insufficient information");
    expect(suitability(s, live(info({ rules_primary: undefined }))).label).toBe("Insufficient information");
    const items = suitability(s, live(info())).items.map((i) => i.text).join(" ");
    expect(items).toMatch(/close early/);
    expect(items).toMatch(/lose money while this contract expires worthless/);
  });
  it("mismatched contracts can still be analyzed, with the flag", () => {
    const a = analyze(prof({ ...base(), sizeMode: "protect", coverage: 0.25 }, { period: "2026-11" }), live(info(), { priceMode: "manual", price: 0.22 }));
    expect(a.sizing!.position.contracts).toBe(391);
    expect(a.suit.label).toBe("Material mismatch");
  });
  it("has no numeric score", () => {
    const r = suitability(s, live(info())) as unknown as Record<string, unknown>;
    expect(Object.keys(r).sort()).toEqual(["items", "label"]);
  });
});

/* ===================== Independence, summary, disclosure ===================== */

describe("contract changes do not touch business data", () => {
  it("analyzing different contracts and sides leaves the scenario and exposure untouched", () => {
    const s = Object.freeze({ ...limits(base(), 300), profile: Object.freeze({ ...base().profile }) }) as Scenario;
    const before = JSON.stringify(s);
    const e = exposure(s.profile);
    for (const sel of [man(0.2), man(0.5, "yes"), live(info()), live(info({ ticker: "KXCHISNOWM-26DEC-4", floor_strike: 4 }), { side: "yes" })]) {
      const a = analyze(s, sel);
      expect(a.exposure).toEqual(e);
      expect(a.loss).toBe(1200);
    }
    expect(JSON.stringify(s)).toBe(before);
  });
  it("different strikes produce different contract details and prices for the same business", () => {
    const four = info({ ticker: "KXCHISNOWM-26DEC-4", floor_strike: 4, yes_sub_title: "Above 4 inches" }, { orderbook_fp: { yes_dollars: [["0.8000", "500"]], no_dollars: [] } });
    const s = { ...base(), sizeMode: "budget" as const, budget: 50, maxCoverage: 10 };
    const a2 = analyze(s, live(info())), a4 = analyze(s, live(four));
    expect(a4.liquidity!.bestAsk).toBe(0.2);
    expect(a4.sizing!.position.contracts).not.toBe(a2.sizing!.position.contracts);
  });
  it("reset restores illustrative inputs but keeps the identity, and entered probabilities survive other edits", () => {
    const s = withP(limits({ ...base(), id: "keep" }, 123));
    expect(prof(s, { notes: "x" }).probs).toEqual(s.probs);
    const r = resetScenario({ ...prof(s, { notes: "call notes", city: "Evanston" }), coverage: 0.9 });
    expect([r.id, r.profile.notes, r.profile.city, r.coverage]).toEqual(["keep", "call notes", "Evanston", 0.25]);
    expect(r.budget).toBeNaN();
    expect(r.probs.lossPays).toBeNaN();
  });
});

describe("validation", () => {
  it("rejects bad limits and coverage while allowing blank optional limits", () => {
    const e = validate({ ...base(), coverage: NaN, budget: -5, feeMult: -1, maxCoverage: -1, positionLimit: 1.5 });
    expect(e.coverage && e.budget && e.feeMult && e.maxCoverage && e.positionLimit).toBeTruthy();
    expect(validate(base()).budget).toBeUndefined();
    expect(validate({ ...base(), sizeMode: "protect", coverage: 0.5, maxCoverage: 0.4 }).coverage).toMatch(/cannot exceed/);
  });
  it("invalid business inputs block every result", () => {
    const a = analyze(prof(base(), { period: "bad" }), man());
    expect(a.valid).toBe(false);
    expect(a.sizing).toBeNull();
    expect(buildSummary(prof(base(), { period: "bad" }), a, man(), null).text).toMatch(/invalid/);
  });
});

describe("copy summary", () => {
  const s: Scenario = { ...limits(base(), 500), sizeMode: "protect", coverage: 0.25, profile: { ...base().profile, notes: "call notes" } };
  const sel = live(info());
  const a = analyze(s, sel), sum = buildSummary(s, a, sel, new Date("2026-11-12T12:00:00Z"));
  it("lists business, period, inputs, public facts, assumptions, contract, side, timestamps and pricing source", () => {
    for (const t of ["Asset Operations Group", "2026-12", "Chicago, IL", "call notes", "2026-11-12T12:00:00.000Z", "Pay-per-push", "from $60", "no flat seasonal", "Unverified assumptions", "KXCHISNOWM-26DEC-2", "Side: NO", "Live order-book snapshot", "2026-11-12T15:00:00.000Z", "https://kalshi.com/markets/kxchisnowm/kxchisnowm-26dec"]) expect(sum.text).toContain(t);
  });
  it("includes costs, payout, all four outcomes in owner language, and the suitability warnings", () => {
    const ms = man(0.22), ma = analyze(s, ms), p = ma.sizing!.position;
    expect(a.sizing!.status).toBe("infeasible"); // the thin live book cannot support 25%: no figures are claimed
    expect(sum.text).toContain(LIQUIDITY_MSG);
    const sum2 = buildSummary(s, ma, ms, null);
    expect(sum2.text).toContain(`Contracts: ${p.contracts.toLocaleString("en-US")}`);
    for (const t of ["Total cash at risk", "Winning payout (gross)", "Your business loses revenue, and the contract pays", "Your business loses revenue, and the contract does not pay", "Your business is fine, and the contract pays", "Your business is fine, and the contract does not pay", "Suitability screening", "Basis risk", "Early settlement"]) expect(sum2.text.toLowerCase()).toContain(t.toLowerCase());
  });
  it("manual pricing is labeled, and there are no guarantees or trading claims", () => {
    const m = buildSummary(s, analyze(s, man(0.3)), man(0.3), null).text;
    expect(m).toContain("Illustrative only. Not an executable quote.");
    expect(m).not.toMatch(/guaranteed (savings|profit)/i);
    expect(m).toMatch(/not a recommendation to trade/);
    expect(m).toMatch(/Not affiliated with or endorsed by Kalshi/);
    expect(m).not.toMatch(/Generated:/); // no timestamp when none is supplied (SSR-safe print view)
  });
  it("never echoes data the owner did not enter", () => {
    expect(sum.text).not.toMatch(/@|password|apikey/i);
  });
});

describe("early-settlement disclosure and fee source", () => {
  it("exact required wording for the default contract", () => {
    expect(EARLY_SETTLEMENT).toBe("If Chicago O'Hare records more than 2 inches of December snowfall, this contract can close and settle early. A NO position would then expire worthless, even if December has not ended. Official reporting and confirmation may take time.");
    expect(earlySettlementText(info())).toBe(EARLY_SETTLEMENT);
  });
  it("other markets use their own early-close terms, never the Chicago wording", () => {
    const t = earlySettlementText(info({ ticker: "OTHER-1", can_close_early: true, early_close_condition: "Closes if X happens." }));
    expect(t).toContain("Closes if X happens.");
    expect(t).not.toContain("O'Hare");
    expect(earlySettlementText(info({ ticker: "OTHER-2", can_close_early: false }))).toMatch(/does not indicate an early close/);
    expect(earlySettlementText(null)).toMatch(/unavailable/);
  });
  it("is in the copied summary and print sections, with the fee source", () => {
    const sel = live(info()), s = limits(base()), sum = buildSummary(s, analyze(s, sel), sel, null);
    expect(sum.sections.flatMap((x) => x.rows).some(([k, v]) => k === "Early settlement" && v === EARLY_SETTLEMENT)).toBe(true);
    expect(FEE_SOURCE.url).toBe("https://kalshi.com/docs/kalshi-fee-schedule.pdf");
    expect(sum.text).toContain("Kalshi Fee Schedule, effective July 7, 2026");
  });
  it("homepage Hedge Lab and Owner Lab share one fee implementation", () => {
    for (const [n, p] of [[391, 0.22], [489, 0.37], [250, 0.43], [350, 0.38], [1, 0.5]] as const) expect(contractEconomics(n, p, 0.07).cashAtRisk).toBe(fillOrder(n, p, null, 1).cost);
  });
});
