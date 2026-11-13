/**
 * Owner Lab scenario model: inputs, defaults, exposure math and validation.
 * Methodology belongs to the research owner; this file only implements it.
 * Money is plain dollars (floats) rounded to cents at display boundaries.
 */

export type Method = "simple" | "buildup";
export type Verification = "illustrative" | "owner-reported" | "documented";
export type Objective = "variance" | "cvar" | "target";

export const MARKET = {
  ticker: "KXCHISNOWM-26DEC-2",
  event: "KXCHISNOWM-26DEC",
  url: "https://kalshi.com/markets/kxchisnowm/chicago-snowfall-monthly/kxchisnowm-26dec",
  series: "KXCHISNOWM",
  threshold: "more than 2 inches of snowfall at Chicago O'Hare during December 2026",
} as const;

/**
 * Kalshi general taker fee: round_up(M * 0.07 * C * P * (1 - P)), with fee + position cost rounded up to a centicent ($0.0001).
 * M is the market's fee multiplier. Schedule per the research owner's reference (kalshi.com/docs/kalshi-fee-schedule.pdf, eff. July 7, 2026).
 */
export const FEE_COEF = 0.07;
export const FEE_PRECISION = 1e4;

/** Probabilities in the four joint states. NaN = not provided. Fractions 0..1. */
export interface JointProbs { lossPays: number; lossLoses: number; noLossPays: number; noLossLoses: number }
export const STATE_KEYS = ["lossPays", "lossLoses", "noLossPays", "noLossLoses"] as const;
export type StateKey = (typeof STATE_KEYS)[number];

/** One business state in the multi-level loss model: operating loss in dollars, with joint probability of the contract paying / not paying. */
export interface LossRow { name: string; loss: number; pays: number; loses: number }
export const LOSS_ROW_NAMES = ["Normal operating month", "Slightly below normal revenue", "Moderately below normal revenue", "Severe revenue shortfall"] as const;
export const blankLossRows = (): LossRow[] => LOSS_ROW_NAMES.map((name) => ({ name, loss: NaN, pays: NaN, loses: NaN }));
/** Illustrative placeholder only: arbitrary shares of the modeled loss and arbitrary probabilities. Not history. */
export const illustrativeLossRows = (L: number): LossRow[] => {
  const f = [0, 0.25, 0.6, 1], pays = [0.05, 0.05, 0.08, 0.12], loses = [0.45, 0.1, 0.07, 0.08];
  return LOSS_ROW_NAMES.map((name, i) => ({ name, loss: Math.round(L * f[i]! * 100) / 100, pays: pays[i]!, loses: loses[i]! }));
};

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
  resCustomers: number; comCustomers: number; resRev: number; comRev: number;
  /** Generic companies only: seasonal contracts whose fixed December revenue is owner-entered and kept whatever the snowfall */
  seasonalEnabled: boolean; seasonalRevenue: number;
  labor: number; fuel: number; salt: number; otherAvoidable: number; saltingRevenue: number; retainedRevenue: number;
  /** Loss to protect: when useOverride, this replaces the modeled shortfall */
  useOverride: boolean; overrideLoss: number;
  /** Relative variability (CV) of the loss size, a fraction. Drives the stress test only. */
  variability: number;
  // hedge
  coverage: number; price: number; useLive: boolean;
  /** Kalshi fee multiplier M for illustrative pricing. Live pricing uses the market's published multiplier. */
  feeMult: number;
  // owner-entered limits. NaN = not provided (no personalized allocation is produced)
  budget: number; maxTradingLoss: number; positionLimit: number; maxCoverage: number; lowSnowProb: number;
  objective: Objective;
  lossModel: "simple" | "multi";
  probs: JointProbs; probSource: "owner" | "illustrative";
  lossRows: LossRow[];
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
    resCustomers: 20, comCustomers: 0, resRev: 60, comRev: 150, seasonalEnabled: false, seasonalRevenue: 0,
    labor: 18, fuel: 4, salt: 3, otherAvoidable: 0, saltingRevenue: 0, retainedRevenue: 0,
    useOverride: false, overrideLoss: 0, variability: 0.25,
    coverage: 0.25, price: 0.22, useLive: false, feeMult: 1,
    budget: NaN, maxTradingLoss: NaN, positionLimit: 0, maxCoverage: 1, lowSnowProb: NaN,
    objective: "target", lossModel: "simple",
    probs: { ...NAN_PROBS }, probSource: "owner", lossRows: blankLossRows(),
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
  // Cost build-up, per-push billing: revenue follows the visits actually made. Variable cost follows visits too.
  // Seasonal revenue exists only if the owner enters it (generic companies): it is fixed, kept in both states, never derived from visits.
  const c = s.labor + s.fuel + s.salt;
  const n = s.resCustomers + s.comCustomers;
  const seasonal = s.seasonalEnabled && !s.publicFacts ? s.seasonalRevenue : 0;
  const rev = (visits: number) => s.resCustomers * s.resRev * visits + s.comCustomers * s.comRev * visits;
  const normalRevenue = rev(s.normalVisits) + s.saltingRevenue + seasonal;
  const lowRevenue = rev(s.lowVisits) + s.retainedRevenue + seasonal;
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
    if (s.seasonalEnabled && !s.publicFacts) usd("seasonalRevenue", "Seasonal contract revenue");
    usd("labor", "Labor per visit"); usd("fuel", "Fuel per visit"); usd("salt", "Salt and materials per visit");
    usd("otherAvoidable", "Other avoidable costs"); usd("saltingRevenue", "Salting revenue"); usd("retainedRevenue", "Retained revenue");
  }
  num("normalVisits", 0, 100, "Visits must be a number between 0 and 100.");
  num("lowVisits", 0, 100, "Visits must be a number between 0 and 100.");
  if (s.useOverride) usd("overrideLoss", "Loss to protect");
  num("variability", 0, 3, "Variability must be between 0% and 300%.");
  num("coverage", 0, 1, "Target protection must be between 0% and 100%.");
  num("price", 0.01, 0.99, "Contract price must be between $0.01 and $0.99.");
  const opt = (k: keyof Scenario, label: string) => { const v = s[k] as number; if (!Number.isNaN(v) && !(v >= 0 && v <= 1e9)) e[k] = `${label} must be a dollar amount of $0 or more, or left blank.`; };
  opt("budget", "Maximum hedge spend"); opt("maxTradingLoss", "Maximum trading loss");
  num("maxCoverage", 0, 10, "Maximum coverage must be between 0% and 1000%.");
  if (Number.isFinite(s.coverage) && Number.isFinite(s.maxCoverage) && s.coverage > s.maxCoverage) e.coverage = "Target protection cannot exceed the maximum permitted coverage.";
  num("feeMult", 0, 10, "Fee multiplier must be between 0 and 10.");
  int("positionLimit", "Position limit must be a whole number of contracts (0 = none known).");
  if (!Number.isNaN(s.lowSnowProb) && !(s.lowSnowProb >= 0 && s.lowSnowProb <= 1)) e.lowSnowProb = "Probability must be between 0% and 100%.";
  return e;
}

export interface DistRow { loss: number; pays: number; loses: number }

export type ProbState =
  | { kind: "missing" }
  | { kind: "invalid"; error: string }
  | { kind: "ok"; model: "simple"; p: JointProbs; source: "owner" | "illustrative" }
  | { kind: "ok"; model: "multi"; rows: LossRow[]; source: "owner" | "illustrative" };

export const PROB_TOLERANCE = 1e-8;

function checkSum(v: number[]): string | null {
  if (v.some((x) => x < 0)) return "Probabilities cannot be negative.";
  if (v.some((x) => x > 1)) return "A probability cannot exceed 100%.";
  const sum = v.reduce((a, b) => a + b, 0);
  return Math.abs(sum - 1) > PROB_TOLERANCE ? `The probabilities sum to ${(sum * 100).toFixed(2)}%, not 100%.` : null;
}

export function probState(s: Scenario): ProbState {
  if (s.lossModel === "multi") {
    const v = s.lossRows.flatMap((r) => [r.pays, r.loses]);
    if (v.every((x) => Number.isNaN(x))) return { kind: "missing" };
    if (v.some((x) => Number.isNaN(x))) return { kind: "invalid", error: "Enter every probability (use 0% where a combination cannot happen)." };
    if (s.lossRows.some((r) => !Number.isFinite(r.loss) || r.loss < 0)) return { kind: "invalid", error: "Enter a loss amount of $0 or more for every business state." };
    const err = checkSum(v);
    return err ? { kind: "invalid", error: err } : { kind: "ok", model: "multi", rows: s.lossRows, source: s.probSource };
  }
  const v = STATE_KEYS.map((k) => s.probs[k]);
  if (v.every((x) => Number.isNaN(x))) return { kind: "missing" };
  if (v.some((x) => Number.isNaN(x))) return { kind: "invalid", error: "Enter all four probabilities (or use Fill remainder)." };
  const err = checkSum(v);
  return err ? { kind: "invalid", error: err } : { kind: "ok", model: "simple", p: s.probs, source: s.probSource };
}

/** The joint distribution as business states with a loss amount. Simplified model = {no loss, modeled loss L}. */
export function distRows(ps: ProbState, L: number): DistRow[] | null {
  if (ps.kind !== "ok") return null;
  if (ps.model === "multi") return ps.rows.map(({ loss, pays, loses }) => ({ loss, pays, loses }));
  return [{ loss: L, pays: ps.p.lossPays, loses: ps.p.lossLoses }, { loss: 0, pays: ps.p.noLossPays, loses: ps.p.noLossLoses }];
}
