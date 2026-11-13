import { readFileSync } from "node:fs";
import { ceilCenticent, rawFee } from "@/lib/finance/fee";
import { describe, expect, it } from "vitest";
import {
  computeHedge, contractEconomics, fuelLoss, rebalanceP00, sailLoss, stormAdverseLoss, stormNet, takerFee, type HedgeInputs,
} from "@/lib/finance/hedge";
import { CASES, EXPOSURE_DEFAULTS } from "@/lib/research/cases";
import wb from "./workbook-values.json";

const inputsFor = (id: "sail" | "xentra" | "arbor"): HedgeInputs => {
  const c = CASES.find((x) => x.id === id)!;
  const e = EXPOSURE_DEFAULTS;
  const loss =
    id === "sail" ? sailLoss((e.sail.bookingLow + e.sail.bookingHigh) / 2, e.sail.avoidable, e.sail.canceled)
    : id === "xentra" ? fuelLoss(e.xentra.gallons, e.xentra.shock, e.xentra.passThrough)
    : stormAdverseLoss(e.arbor.scheduledLoss, e.arbor.emergencyGain);
  return { loss, ...c.defaults };
};

describe("contract economics (acceptance: 250 × $0.43)", () => {
  const e = contractEconomics(250, 0.43, 0.07);
  it("premium $107.50", () => expect(e.premium).toBe(107.5));
  // Centicent schedule (Kalshi Fee Schedule eff. July 7, 2026): raw fee 4.28925 → fee + cost rounded up to $0.0001.
  // The supplied workbook rounds the fee to the cent ($4.29 / $111.79 / $138.21); the difference is under $0.001.
  it("fee: cost + fee rounds UP to the centicent → $4.2893", () => expect(e.fee).toBe(4.2893));
  it("cash at risk $111.7893 (displays $111.79)", () => { expect(e.cashAtRisk).toBe(111.7893); expect(e.cashAtRisk.toFixed(2)).toBe("111.79"); });
  it("net YES +$138.2107 (displays $138.21)", () => { expect(e.netYes).toBe(138.2107); expect(e.netYes.toFixed(2)).toBe("138.21"); });
  it("net NO −$111.7893", () => expect(e.netNo).toBe(-111.7893));
});

describe("fee centicent rounding (shared fee function)", () => {
  it("rounds up a fractional centicent", () => expect(takerFee(1, 0.5, 0.07)).toBe(0.0175)); // raw 0.0175 is exact to the centicent
  it("rounds up beyond the centicent", () => expect(takerFee(1, 0.43, 0.07)).toBe(0.0172)); // 0.017157 → 0.0172
  it("does not over-round exact values despite float noise", () => expect(takerFee(100, 0.5, 0.07)).toBe(1.75));
  it("zero contracts → zero fee", () => expect(takerFee(0, 0.43, 0.07)).toBe(0));
  it("high-priced contract (0.99): tiny fee, still rounded up", () => expect(takerFee(1, 0.99, 0.07)).toBe(0.0007)); // 0.000693
  it("scales with the multiplier (M = 2 → coef 0.14)", () => expect(takerFee(250, 0.43, 0.14)).toBe(8.5785));
  it("ceilCenticent ignores binary-float noise but rounds true excess up", () => {
    expect(ceilCenticent(0.1000000001)).toBe(0.1);
    expect(ceilCenticent(0.10001)).toBe(0.1001);
  });
  it("matches independent integer arithmetic over a grid (total cost, centicents)", () => {
    // p = c/100: premium = N*c*100 centicents; raw fee = 7*N*c*(100-c)/100 centicents (coef 0.07). total = ceil(sum).
    for (let n = 1; n <= 400; n += 37) for (let c = 1; c <= 99; c++) {
      const totalCc = n * c * 100 + Math.floor((7 * n * c * (100 - c) + 99) / 100);
      const e = contractEconomics(n, c / 100, 0.07);
      expect(Math.round(e.cashAtRisk * 1e4)).toBe(totalCc);
    }
  });
  it("rawFee is the unrounded formula", () => expect(rawFee(250, 0.43, 0.07)).toBeCloseTo(4.28925, 10));
});

describe("exposure converters use contribution margin", () => {
  it("Brooklyn Sail L = 550 × (1−0.40) = $330", () => expect(sailLoss(550, 0.4, 1)).toBe(330));
  it("Xentra L = 1200 × 0.40 × (1−0) = $480", () => expect(fuelLoss(1200, 0.4, 0)).toBe(480));
  it("pass-through reduces fuel loss", () => expect(fuelLoss(1200, 0.4, 0.5)).toBe(240));
  it("Arborpolitan default net storm = +$400, no adverse loss", () => {
    expect(stormNet(1000, 1400)).toBe(400);
    expect(stormAdverseLoss(1000, 1400)).toBe(0);
  });
  it("Arborpolitan $500 emergency → $500 adverse loss", () => {
    expect(stormNet(1000, 500)).toBe(-500);
    expect(stormAdverseLoss(1000, 500)).toBe(500);
  });
});

describe("four-state outcomes — Brooklyn Sail defaults", () => {
  const r = computeHedge(inputsFor("sail"));
  it("is valid with probabilities totaling 1", () => { expect(r.valid).toBe(true); expect(r.probTotal).toBeCloseTo(1, 12); });
  it("has exactly four states, including loss + NO", () => {
    expect(r.states).toHaveLength(4);
    expect(r.states!.find((s) => s.key === "p10")).toMatchObject({ businessLoss: true, contractYes: false });
  });
  it("loss + NO = −330 − 111.79 = −441.79", () => expect(r.adverseNoPayoff).toBeCloseTo(-441.79, 2));
  it("loss + YES = −191.79", () => expect(r.states![0]!.combinedDelta).toBeCloseTo(-191.79, 2));
  it("expected incremental is NEGATIVE and is not coerced", () => {
    expect(r.expectedIncremental!).toBeCloseTo(-24.29, 2);
    expect(r.expectedIncremental!).toBeLessThan(0);
  });
  it("basis-miss probability = p10", () => expect(r.basisMissProbability).toBe(0.08));
  it("non-loss payout probability = p01", () => expect(r.nonLossPayoutProbability).toBe(0.23));
});

describe("workbook parity (cached values from supplied XLSX)", () => {
  for (const [id, key] of [["sail", "sail"], ["xentra", "xentra"], ["arbor", "arbor"]] as const) {
    it(`${id} matches every checked workbook cell`, () => {
      const w = wb[key];
      const r = computeHedge(inputsFor(id));
      expect(r.valid).toBe(true);
      // The workbook rounds fees to the cent; the site uses the centicent schedule (eff. July 7, 2026).
      // Fee-dependent cells must agree to within one cent; fee-independent cells stay exact.
      const within = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(0.0100001);
      expect(r.contract!.premium).toBeCloseTo(w.premium, 6);
      within(r.contract!.fee, w.fee);
      within(r.contract!.cashAtRisk, w.cashAtRisk);
      within(r.contract!.netYes, w.netYes);
      within(r.contract!.netNo, w.netNo);
      expect(r.expectedUnhedged!).toBeCloseTo(w.expectedUnhedged, 6);
      within(r.expectedHedged!, w.expectedHedged);
      within(r.expectedIncremental!, w.expectedIncremental);
      within(r.worstCombined!, w.worst);
      r.states!.forEach((s, i) => {
        expect(s.probability).toBeCloseTo(w.states[i]![0]!, 8);
        expect(s.businessDelta).toBeCloseTo(w.states[i]![1]!, 6);
        within(s.contractDelta, w.states[i]![2]!);
        within(s.combinedDelta, w.states[i]![3]!);
      });
    });
  }
  it("Xentra: centicent fee $5.7722, cash at risk $138.7722 (workbook cents: $5.78 / $138.78)", () => {
    const r = computeHedge(inputsFor("xentra"));
    expect(r.contract!.fee).toBe(5.7722);
    expect(r.contract!.cashAtRisk).toBe(138.7722);
    expect(r.contract!.netYes).toBe(211.2278);
  });
});

describe("Arborpolitan: analyst pass, zero contracts", () => {
  it("zero contracts → zero premium, fee and zero incremental P&L", () => {
    const r = computeHedge(inputsFor("arbor"));
    expect(r.contract).toMatchObject({ premium: 0, fee: 0, cashAtRisk: 0 });
    expect(r.expectedIncremental!).toBeCloseTo(0, 12);
    expect(r.expectedHedged!).toBeCloseTo(0, 12);
  });
  it("with $500 emergency margin the adverse loss is $500 and no hedge is implied (N still 0)", () => {
    const r = computeHedge({ ...inputsFor("arbor"), loss: stormAdverseLoss(1000, 500) });
    expect(r.expectedUnhedged!).toBeCloseTo(-150, 6); // 0.5 × (p11+p10 = 0.3) → −500 × 0.3
    expect(r.expectedIncremental!).toBeCloseTo(0, 12);
  });
});

describe("validation: invalid probabilities block expected value", () => {
  const base = inputsFor("sail");
  it("sum ≠ 1 blocks EV with a legible message", () => {
    const r = computeHedge({ ...base, probs: { p11: 0.3, p10: 0.3, p01: 0.3, p00: 0.3 } });
    expect(r.valid).toBe(false);
    expect(r.expectedHedged).toBeNull();
    expect(r.errors.join(" ")).toMatch(/sum to 120\.00%/);
  });
  it("negative probability is rejected", () => {
    const r = computeHedge({ ...base, probs: { p11: -0.1, p10: 0.1, p01: 0.5, p00: 0.5 } });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/between 0% and 100%/);
  });
  it("probability > 1 is rejected", () => expect(computeHedge({ ...base, probs: { p11: 1.5, p10: 0, p01: 0, p00: -0.5 } }).valid).toBe(false));
  it("tolerance 1e-8 accepts float noise", () => {
    const r = computeHedge({ ...base, probs: { p11: 0.1, p10: 0.2, p01: 0.3, p00: 0.4 } });
    expect(r.valid).toBe(true);
  });
  it("invalid probs still expose the contract economics and the adverse state", () => {
    const r = computeHedge({ ...base, probs: { p11: 0.3, p10: 0.3, p01: 0.3, p00: 0.3 } });
    expect(r.contract!.cashAtRisk).toBe(111.7893);
    expect(r.adverseNoPayoff).toBeCloseTo(-441.79, 2);
  });
  it("price 0 or 1, fractional contracts, negative loss are rejected", () => {
    expect(computeHedge({ ...base, price: 1 }).valid).toBe(false);
    expect(computeHedge({ ...base, price: 0 }).valid).toBe(false);
    expect(computeHedge({ ...base, contracts: 2.5 }).valid).toBe(false);
    expect(computeHedge({ ...base, loss: -1 }).valid).toBe(false);
    expect(computeHedge({ ...base, loss: NaN }).valid).toBe(false);
  });
  it("rebalanceP00 restores a valid 100% total", () => {
    const p = rebalanceP00({ p11: 0.2, p10: 0.1, p01: 0.1, p00: 0 });
    expect(p.p00).toBeCloseTo(0.6, 8);
    expect(computeHedge({ ...base, probs: p }).valid).toBe(true);
  });
});

describe("no inferred probability from price", () => {
  it("changing YES price never changes the supplied probabilities or the unhedged expectation", () => {
    const a = computeHedge({ ...inputsFor("sail"), price: 0.2 });
    const b = computeHedge({ ...inputsFor("sail"), price: 0.8 });
    expect(a.expectedUnhedged).toBe(b.expectedUnhedged);
    expect(a.basisMissProbability).toBe(b.basisMissProbability);
  });
});

describe("false positive / false negative terminology (regression)", () => {
  const cases: [("sail" | "xentra" | "arbor"), number, number][] = [["sail", 0.23, 0.08], ["xentra", 0.15, 0.16], ["arbor", 0.3, 0.1]];
  for (const [id, fp, fn] of cases) {
    it(`${id}: false positive = P(no loss, contract pays); false negative = P(loss, no payout)`, () => {
      const i = inputsFor(id);
      const r = computeHedge(i);
      expect(r.falsePositiveProbability).toBeCloseTo(fp, 10);
      expect(r.falseNegativeProbability).toBeCloseTo(fn, 10);
      expect(r.falsePositiveProbability).toBe(i.probs.p01);
      expect(r.falseNegativeProbability).toBe(i.probs.p10);
      expect(r.falseNegativeProbability).toBe(r.basisMissProbability);
    });
  }
  it("the simulator source never labels the loss-without-payout state as a false positive", () => {
    const src = readFileSync("src/components/simulator/Lab.tsx", "utf8");
    expect(src).toMatch(/falsePositiveProbability!, 1\)\} \/ \$\{pct\(r\.falseNegativeProbability/);
    expect(src).not.toMatch(/basisMissProbability!, 1\)\} \/ /);
  });
});
