/**
 * Owner Lab scenario model: inputs, defaults, exposure math and validation.
 * Methodology belongs to the research owner; this file only implements it.
 * Money is plain dollars (floats) rounded to cents at display boundaries.
 */

export type Method = "simple" | "buildup";
export type Verification = "illustrative" | "owner-reported" | "documented";
export type Tolerance = "low" | "moderate" | "high";
export type Objective = "variance" | "cvar" | "target";

export const MARKET = {
  ticker: "KXCHISNOWM-26DEC-2",
  event: "KXCHISNOWM-26DEC",
  url: "https://kalshi.com/markets/kxchisnowm/chicago-snowfall-monthly/kxchisnowm-26dec",
  threshold: "more than 2 inches of snowfall at Chicago O'Hare during December 2026",
} as const;

/** General taker coefficient from the Owner Lab specification. Not user-editable. */
export const FEE_COEF = 0.07;

/** Probabilities in the four joint states. NaN = not provided. Fractions 0..1. */
export interface JointProbs { lossPays: number; lossLoses: number; noLossPays: number; noLossLoses: number }
export const STATE_KEYS = ["lossPays", "lossLoses", "noLossPays", "noLossLoses"] as const;
export type StateKey = (typeof STATE_KEYS)[number];

export interface Scenario {
  id: string;
  name: string;
  location: string;
  notes: string;
  verification: Verification;
  publicFacts: boolean;
  method: Method;
  // quick-method business inputs
  customers: number; normalVisits: number; lowVisits: number; revPerVisit: number; margin: number;
  // cost build-up inputs
  resCustomers: number; comCustomers: number; resRev: number; comRev: number; perPushShare: number;
  labor: number; fuel: number; salt: number; otherAvoidable: number; saltingRevenue: number; retainedRevenue: number;
  /** Loss to protect: when useOverride, this replaces the modeled shortfall */
  useOverride: boolean; overrideLoss: number;
  /** Relative variability (CV) of the loss size, a fraction. Drives the stress test only. */
  variability: number;
  // hedge
  coverage: number; price: number; useLive: boolean;
  // owner risk preferences
  budget: number; maxTradingLoss: number; positionLimit: number; lowSnowProb: number;
  tolerance: Tolerance; objective: Objective;
  probs: JointProbs; probSource: "owner" | "illustrative";
}

export const NAN_PROBS: JointProbs = { lossPays: NaN, lossLoses: NaN, noLossPays: NaN, noLossLoses: NaN };
/** Analyst placeholder, NOT history: arbitrary numbers so the optimizer can be demonstrated. */
export const ILLUSTRATIVE_PROBS: JointProbs = { lossPays: 0.2, lossLoses: 0.1, noLossPays: 0.1, noLossLoses: 0.6 };

export const PRESET_NAMES = ["2 Aces Snow Plowing", "Brancato Snow & Ice Management", "New business"] as const;

let seq = 0;
export function defaultScenario(name = "Asset Operations Group", id?: string): Scenario {
  const aog = name === "Asset Operations Group";
  return {
    id: id ?? `s${++seq}-${Math.random().toString(36).slice(2, 7)}`,
    name, location: aog ? "Chicago, Illinois" : "", notes: "", verification: "illustrative", publicFacts: aog,
    method: "simple",
    customers: 20, normalVisits: 3, lowVisits: 1, revPerVisit: 60, margin: 0.5,
    resCustomers: 20, comCustomers: 0, resRev: 60, comRev: 150, perPushShare: 1,
    labor: 18, fuel: 4, salt: 3, otherAvoidable: 0, saltingRevenue: 0, retainedRevenue: 0,
    useOverride: false, overrideLoss: 0, variability: 0.25,
    coverage: 0.25, price: 0.22, useLive: false,
    budget: 150, maxTradingLoss: 150, positionLimit: 0, lowSnowProb: NaN,
    tolerance: "moderate", objective: "target",
    probs: { ...NAN_PROBS }, probSource: "owner",
  };
}

/** Reset inputs to defaults but keep the scenario's identity (name, location, notes). */
export function resetScenario(s: Scenario): Scenario {
  const d = defaultScenario(s.name);
  return { ...d, id: s.id, location: s.location, notes: s.notes, publicFacts: s.publicFacts };
}

export const cents = (x: number) => Math.round(x * 100) / 100;

export interface Exposure {
  normalRevenue: number; lowRevenue: number; lostRevenue: number;
  normalContribution: number; lowContribution: number;
  /** Modeled shortfall in contribution margin (>= 0) */
  lostContribution: number;
  impliedMargin: number | null;
  variableCostPerVisit: number;
}

export function exposure(s: Scenario): Exposure {
  if (s.method === "simple") {
    const normalRevenue = s.customers * s.normalVisits * s.revPerVisit;
    const lowRevenue = s.customers * s.lowVisits * s.revPerVisit;
    const lostRevenue = Math.max(0, normalRevenue - lowRevenue);
    return {
      normalRevenue: cents(normalRevenue), lowRevenue: cents(lowRevenue), lostRevenue: cents(lostRevenue),
      normalContribution: cents(normalRevenue * s.margin), lowContribution: cents(lowRevenue * s.margin),
      lostContribution: cents(lostRevenue * s.margin), impliedMargin: s.margin, variableCostPerVisit: 0,
    };
  }
  // Cost build-up. Per-push customers pay per visit actually made; seasonal customers pay a flat fee equal to
  // normal-December visits x price whatever the snowfall. Variable cost follows visits actually made.
  const c = s.labor + s.fuel + s.salt;
  const n = s.resCustomers + s.comCustomers;
  const push = s.perPushShare;
  const segRev = (cust: number, price: number, visits: number) =>
    cust * price * (push * visits + (1 - push) * s.normalVisits);
  const normalRevenue = segRev(s.resCustomers, s.resRev, s.normalVisits) + segRev(s.comCustomers, s.comRev, s.normalVisits) + s.saltingRevenue;
  const lowRevenue = segRev(s.resCustomers, s.resRev, s.lowVisits) + segRev(s.comCustomers, s.comRev, s.lowVisits) + s.retainedRevenue;
  const normalContribution = normalRevenue - c * n * s.normalVisits - s.otherAvoidable;
  const lowContribution = lowRevenue - c * n * s.lowVisits;
  return {
    normalRevenue: cents(normalRevenue), lowRevenue: cents(lowRevenue), lostRevenue: cents(Math.max(0, normalRevenue - lowRevenue)),
    normalContribution: cents(normalContribution), lowContribution: cents(lowContribution),
    lostContribution: cents(Math.max(0, normalContribution - lowContribution)),
    impliedMargin: normalRevenue > 0 ? normalContribution / normalRevenue : null, variableCostPerVisit: c,
  };
}

/** The dollar loss L the hedge is sized against. */
export const protectedLoss = (s: Scenario, e: Exposure) => (s.useOverride ? s.overrideLoss : e.lostContribution);

export type FieldErrors = Partial<Record<keyof Scenario, string>>;

export function validate(s: Scenario): FieldErrors {
  const e: FieldErrors = {};
  const num = (k: keyof Scenario, lo: number, hi: number, msg: string) => {
    const v = s[k] as number;
    if (!Number.isFinite(v) || v < lo || v > hi) e[k] = msg;
  };
  const int = (k: keyof Scenario, msg: string) => { const v = s[k] as number; if (!Number.isInteger(v) || v < 0) e[k] = msg; };
  const usd = (k: keyof Scenario, label: string) => num(k, 0, 1e9, `${label} must be a dollar amount of $0 or more.`);
  if (s.method === "simple") {
    int("customers", "Customers must be a whole number, 0 or more.");
    usd("revPerVisit", "Revenue per visit");
    num("margin", 0, 1, "Contribution margin must be between 0% and 100%.");
  } else {
    int("resCustomers", "Residential customers must be a whole number, 0 or more.");
    int("comCustomers", "Commercial customers must be a whole number, 0 or more.");
    usd("resRev", "Residential revenue per visit"); usd("comRev", "Commercial revenue per visit");
    num("perPushShare", 0, 1, "Share paying per push must be between 0% and 100%.");
    usd("labor", "Labor per visit"); usd("fuel", "Fuel per visit"); usd("salt", "Salt and materials per visit");
    usd("otherAvoidable", "Other avoidable costs"); usd("saltingRevenue", "Salting revenue"); usd("retainedRevenue", "Retained revenue");
  }
  num("normalVisits", 0, 100, "Visits must be a number between 0 and 100.");
  num("lowVisits", 0, 100, "Visits must be a number between 0 and 100.");
  if (s.useOverride) usd("overrideLoss", "Loss to protect");
  num("variability", 0, 3, "Variability must be between 0% and 300%.");
  num("coverage", 0, 1, "Target protection must be between 0% and 100%.");
  num("price", 0.01, 0.99, "Contract price must be between $0.01 and $0.99.");
  usd("budget", "Hedge budget"); usd("maxTradingLoss", "Maximum trading loss");
  int("positionLimit", "Position limit must be a whole number of contracts (0 = none known).");
  if (!Number.isNaN(s.lowSnowProb) && !(s.lowSnowProb >= 0 && s.lowSnowProb <= 1)) e.lowSnowProb = "Probability must be between 0% and 100%.";
  return e;
}

export type ProbState =
  | { kind: "missing" }
  | { kind: "invalid"; error: string }
  | { kind: "ok"; p: JointProbs; source: "owner" | "illustrative" };

export const PROB_TOLERANCE = 1e-8;

export function probState(s: Scenario): ProbState {
  const v = STATE_KEYS.map((k) => s.probs[k]);
  if (v.every((x) => Number.isNaN(x))) return { kind: "missing" };
  if (v.some((x) => Number.isNaN(x))) return { kind: "invalid", error: "Enter all four probabilities (or use Fill remainder)." };
  if (v.some((x) => x < 0)) return { kind: "invalid", error: "Probabilities cannot be negative." };
  if (v.some((x) => x > 1)) return { kind: "invalid", error: "A probability cannot exceed 100%." };
  const sum = v.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > PROB_TOLERANCE) return { kind: "invalid", error: `The four probabilities sum to ${(sum * 100).toFixed(2)}%, not 100%.` };
  return { kind: "ok", p: s.probs, source: s.probSource };
}

/** Explicit mapping of risk tolerance to a constraint: the most expected trading cost the owner will accept, as a share of expected unhedged loss. */
export const TOLERANCE_CAP: Record<Tolerance, number> = { low: 0.5, moderate: 0.25, high: 0.1 };
export const TOLERANCE_LABEL: Record<Tolerance, string> = { low: "Low (risk-averse)", moderate: "Moderate", high: "High (risk-tolerant)" };
