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
  it("fee rounds UP to $4.29", () => expect(e.fee).toBe(4.29));
  it("cash at risk $111.79", () => expect(e.cashAtRisk).toBe(111.79));
  it("net YES +$138.21", () => expect(e.netYes).toBe(138.21));
  it("net NO −$111.79", () => expect(e.netNo).toBe(-111.79));
});

describe("fee cent rounding", () => {
  it("rounds up a fractional cent", () => expect(takerFee(1, 0.5, 0.07)).toBe(0.02)); // 0.0175 → 0.02
  it("does not over-round exact cents despite float noise", () => expect(takerFee(100, 0.5, 0.07)).toBe(1.75));
  it("zero contracts → zero fee", () => expect(takerFee(0, 0.43, 0.07)).toBe(0));
  it("high-priced contract (0.99) fee is tiny but ≥ 1c", () => expect(takerFee(1, 0.99, 0.07)).toBe(0.01));
  it("scales with coefficient", () => expect(takerFee(250, 0.43, 0.14)).toBe(8.58));
  it("matches independent integer arithmetic over a grid", () => {
    for (let n = 1; n <= 400; n += 37) for (let c = 1; c <= 99; c++) {
      // integer form: m*N*c*(100−c)/10000 dollars, ×100 → cents = 7*N*c*(100−c)/10000 with m=0.07
      const centsExact = Math.ceil((7 * n * c * (100 - c)) / 10000);
      expect(Math.round(takerFee(n, c / 100, 0.07) * 100)).toBe(centsExact);
    }
  });
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
      expect(r.contract!.premium).toBeCloseTo(w.premium, 6);
      expect(r.contract!.fee).toBeCloseTo(w.fee, 6);
      expect(r.contract!.cashAtRisk).toBeCloseTo(w.cashAtRisk, 6);
      expect(r.contract!.netYes).toBeCloseTo(w.netYes, 6);
      expect(r.contract!.netNo).toBeCloseTo(w.netNo, 6);
      expect(r.expectedUnhedged!).toBeCloseTo(w.expectedUnhedged, 6);
      expect(r.expectedHedged!).toBeCloseTo(w.expectedHedged, 6);
      expect(r.expectedIncremental!).toBeCloseTo(w.expectedIncremental, 6);
      expect(r.worstCombined!).toBeCloseTo(w.worst, 6);
      r.states!.forEach((s, i) => {
        expect(s.probability).toBeCloseTo(w.states[i]![0]!, 8);
        expect(s.businessDelta).toBeCloseTo(w.states[i]![1]!, 6);
        expect(s.contractDelta).toBeCloseTo(w.states[i]![2]!, 6);
        expect(s.combinedDelta).toBeCloseTo(w.states[i]![3]!, 6);
      });
    });
  }
  it("Xentra fee is $5.78 and cash at risk $138.78", () => {
    const r = computeHedge(inputsFor("xentra"));
    expect(r.contract!.fee).toBe(5.78);
    expect(r.contract!.cashAtRisk).toBe(138.78);
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
    expect(r.contract!.cashAtRisk).toBe(111.79);
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
