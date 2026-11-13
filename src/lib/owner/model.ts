/**
 * Owner Lab scenario model: inputs, defaults, exposure math and validation.
 * Methodology belongs to the research owner; this file only implements it.
 * Money is plain dollars (floats) rounded to cents at display boundaries.
 */

import { defaultProfile, validateProfile, type Exposure, type Profile } from "./business";

export const MARKET = {
  ticker: "KXCHISNOWM-26DEC-2",
  event: "KXCHISNOWM-26DEC",
  url: "https://kalshi.com/markets/kxchisnowm/chicago-snowfall-monthly/kxchisnowm-26dec",
  series: "KXCHISNOWM",
  threshold: "more than 2 inches of snowfall at Chicago O'Hare during December 2026",
} as const;

export { FEE_COEF, FEE_PRECISION, FEE_SOURCE } from "../finance/fee";

/** Required early-settlement disclosure for KXCHISNOWM-26DEC-2. */
export const EARLY_SETTLEMENT =
  "If Chicago O'Hare records more than 2 inches of December snowfall, this contract can close and settle early. A NO position would then expire worthless, even if December has not ended. Official reporting and confirmation may take time.";

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

export type Objective = "variance" | "cvar" | "target";
export type Side = "yes" | "no";
export type SizeMode = "budget" | "protect" | "risk";
export { PRESET_NAMES } from "./business";
export type { Verification } from "./business";

export interface Scenario {
  id: string;
  profile: Profile;
  /** Loss to protect: when useOverride, this replaces the modeled shortfall */
  useOverride: boolean; overrideLoss: number;
  /** Relative variability (CV) of the loss size, a fraction. Drives the stress test only. */
  variability: number;
  // hedge sizing
  sizeMode: SizeMode;
  /** Mode B: target share of the modeled loss repaid by net winning profit */
  coverage: number;
  /** Kalshi fee multiplier M for manual-price pricing. Live pricing uses the market's published multiplier. */
  feeMult: number;
  // owner-entered limits. NaN = not provided
  budget: number; maxTradingLoss: number; positionLimit: number; maxCoverage: number; lowSnowProb: number;
  /** Mode C objective */
  objective: Objective;
  lossModel: "simple" | "multi";
  probs: JointProbs; probSource: "owner" | "illustrative";
  lossRows: LossRow[];
  /** Owner confirmations used by the contract screen */
  confirmLocation: boolean; confirmThreshold: boolean;
}

export const NAN_PROBS: JointProbs = { lossPays: NaN, lossLoses: NaN, noLossPays: NaN, noLossLoses: NaN };
/** Analyst placeholder, NOT history: arbitrary numbers so the optimizer can be demonstrated. */
export const ILLUSTRATIVE_PROBS: JointProbs = { lossPays: 0.2, lossLoses: 0.1, noLossPays: 0.1, noLossLoses: 0.6 };

let seq = 0;
export function defaultScenario(name: string = "Asset Operations Group", id?: string): Scenario {
  return {
    id: id ?? `s${++seq}-${Math.random().toString(36).slice(2, 7)}`,
    profile: defaultProfile(name),
    useOverride: false, overrideLoss: 0, variability: 0.25,
    sizeMode: "protect", coverage: 0.25, feeMult: 1,
    budget: NaN, maxTradingLoss: NaN, positionLimit: 0, maxCoverage: 1, lowSnowProb: NaN,
    objective: "variance", lossModel: "simple",
    probs: { ...NAN_PROBS }, probSource: "owner", lossRows: blankLossRows(),
    confirmLocation: false, confirmThreshold: false,
  };
}

/** Reset inputs to illustrative defaults but keep the scenario's identity (name, location, notes). */
export function resetScenario(s: Scenario): Scenario {
  const d = defaultScenario(s.profile.name, s.id);
  return { ...d, profile: { ...d.profile, city: s.profile.city, state: s.profile.state, notes: s.profile.notes, publicFacts: s.profile.publicFacts, industry: s.profile.industry, period: s.profile.period } };
}

export const cents = (x: number) => Math.round(x * 100) / 100;

/** The dollar loss L the hedge is sized against. */
export const protectedLoss = (s: Scenario, e: Exposure) => (s.useOverride ? s.overrideLoss : e.shortfall);

export type FieldErrors = Record<string, string>;

export function validate(s: Scenario): FieldErrors {
  const e: FieldErrors = { ...validateProfile(s.profile) };
  const num = (k: keyof Scenario, lo: number, hi: number, msg: string) => { const v = s[k] as number; if (!Number.isFinite(v) || v < lo || v > hi) e[k] = msg; };
  if (s.useOverride) num("overrideLoss", 0, 1e9, "Loss to protect must be a dollar amount of $0 or more.");
  num("variability", 0, 3, "Variability must be between 0% and 300%.");
  num("coverage", 0, 1, "Target protection must be between 0% and 100%.");
  const opt = (k: keyof Scenario, label: string) => { const v = s[k] as number; if (!Number.isNaN(v) && !(v >= 0 && v <= 1e9)) e[k] = `${label} must be a dollar amount of $0 or more, or left blank.`; };
  opt("budget", "Maximum hedge spend"); opt("maxTradingLoss", "Maximum trading loss");
  num("maxCoverage", 0, 10, "Maximum coverage must be between 0% and 1000%.");
  if (s.sizeMode === "protect" && Number.isFinite(s.coverage) && Number.isFinite(s.maxCoverage) && s.coverage > s.maxCoverage) e.coverage = "Target protection cannot exceed the maximum permitted coverage.";
  num("feeMult", 0, 10, "Fee multiplier must be between 0 and 10.");
  if (!Number.isInteger(s.positionLimit) || s.positionLimit < 0) e.positionLimit = "Position limit must be a whole number of contracts (0 = none known).";
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
