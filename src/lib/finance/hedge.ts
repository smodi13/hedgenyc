/**
 * Pure, deterministic hedge model. Mirrors the supplied workbook
 * (Sail Hedge / Transport Hedge / Tree Hedge sheets) except fee precision: the workbook rounds the fee to the cent,
 * this model follows the Kalshi schedule effective July 7, 2026 (centicent). Differences are under one cent per cell.
 * Every number the simulator shows is derived from here; nothing is typed in.
 */

import { orderCost, rawFee, round4 } from "./fee";

export interface JointProbs {
  /** P(business loss AND contract settles YES) */
  p11: number;
  /** P(business loss AND contract settles NO) — the basis-miss state */
  p10: number;
  /** P(no business loss AND contract settles YES) */
  p01: number;
  /** P(no business loss AND contract settles NO) */
  p00: number;
}

export interface HedgeInputs {
  /** Adverse operating contribution-margin loss L (dollars, >= 0) */
  loss: number;
  /** YES contracts N (whole contracts, >= 0) */
  contracts: number;
  /** YES limit price p in dollars per $1 payout, 0 < p < 1 */
  price: number;
  /** General taker coefficient m (default 0.07) */
  feeCoef: number;
  probs: JointProbs;
}

export const PROB_TOLERANCE = 1e-8;

export type StateKey = keyof JointProbs;

export interface StateOutcome {
  key: StateKey;
  label: string;
  businessLoss: boolean;
  contractYes: boolean;
  probability: number;
  businessDelta: number;
  contractDelta: number;
  combinedDelta: number;
}

export interface ContractEconomics {
  premium: number;
  fee: number;
  cashAtRisk: number;
  grossPayoutYes: number;
  netYes: number;
  netNo: number;
}

export interface HedgeResult {
  valid: boolean;
  errors: string[];
  /** Present when price/contracts/fee inputs are individually valid */
  contract: ContractEconomics | null;
  /** Present when the contract is computable */
  states: StateOutcome[] | null;
  probTotal: number;
  /** Null (blocked) unless every input, including probabilities, is valid */
  expectedUnhedged: number | null;
  expectedHedged: number | null;
  expectedIncremental: number | null;
  basisMissProbability: number | null;
  nonLossPayoutProbability: number | null;
  /** Contract pays although the business has no loss (p01). Positive = contract signal, negative = no business loss. */
  falsePositiveProbability: number | null;
  /** Business loses but the contract does not pay (p10): the basis miss. */
  falseNegativeProbability: number | null;
  worstCombined: number | null;
  /** Combined outcome in the loss-but-contract-NO state */
  adverseNoPayoff: number | null;
}

const cents = (x: number) => Math.round(x * 100) / 100;

/**
 * General taker fee component under the Kalshi schedule effective July 7, 2026 (shared implementation in ./fee):
 * fee = round_up(m * N * p * (1 - p)) with fee + position cost rounded up to a centicent ($0.0001).
 * `coef` is M * 0.07 (0.07 at M = 1).
 */
export function takerFee(contracts: number, price: number, coef: number): number {
  if (contracts <= 0 || coef <= 0) return 0;
  const premium = round4(contracts * price);
  return round4(orderCost(premium, rawFee(contracts, price, coef)) - premium);
}

export function contractEconomics(contracts: number, price: number, coef: number): ContractEconomics {
  const premium = round4(contracts * price);
  const cashAtRisk = orderCost(premium, rawFee(contracts, price, coef));
  return {
    premium,
    fee: round4(cashAtRisk - premium),
    cashAtRisk,
    grossPayoutYes: contracts,
    netYes: round4(contracts - cashAtRisk),
    netNo: round4(-cashAtRisk),
  };
}

export const STATE_LABELS: Record<StateKey, { label: string; businessLoss: boolean; contractYes: boolean }> = {
  p11: { label: "Business loss + contract pays (YES)", businessLoss: true, contractYes: true },
  p10: { label: "Business loss + contract does NOT pay (basis miss)", businessLoss: true, contractYes: false },
  p01: { label: "No business loss + contract pays (windfall)", businessLoss: false, contractYes: true },
  p00: { label: "No business loss + contract does NOT pay", businessLoss: false, contractYes: false },
};

export function validateInputs(i: HedgeInputs): string[] {
  const e: string[] = [];
  const finite = (n: number) => Number.isFinite(n);
  if (!finite(i.loss) || i.loss < 0) e.push("Business margin loss must be a number ≥ 0.");
  if (!finite(i.contracts) || i.contracts < 0 || !Number.isInteger(i.contracts)) e.push("Contracts must be a whole number ≥ 0.");
  if (!finite(i.price) || i.price <= 0 || i.price >= 1) e.push("YES price must be strictly between $0.00 and $1.00.");
  if (!finite(i.feeCoef) || i.feeCoef < 0) e.push("Taker fee coefficient must be ≥ 0.");
  (Object.keys(STATE_LABELS) as StateKey[]).forEach((k) => {
    const v = i.probs[k];
    if (!finite(v) || v < 0 || v > 1) e.push(`Probability for "${STATE_LABELS[k].label}" must be between 0% and 100%.`);
  });
  const total = sumProbs(i.probs);
  if (finite(total) && Math.abs(total - 1) > PROB_TOLERANCE) {
    e.push(`Joint probabilities sum to ${(total * 100).toFixed(2)}%, not 100%. Expected values are blocked until they sum to exactly 100%.`);
  }
  return e;
}

export const sumProbs = (p: JointProbs) => p.p11 + p.p10 + p.p01 + p.p00;

export function computeHedge(i: HedgeInputs): HedgeResult {
  const errors = validateInputs(i);
  const contractOk = Number.isFinite(i.contracts) && i.contracts >= 0 && Number.isInteger(i.contracts) &&
    Number.isFinite(i.price) && i.price > 0 && i.price < 1 && Number.isFinite(i.feeCoef) && i.feeCoef >= 0;
  const lossOk = Number.isFinite(i.loss) && i.loss >= 0;
  const contract = contractOk ? contractEconomics(i.contracts, i.price, i.feeCoef) : null;
  const probTotal = sumProbs(i.probs);
  const empty: HedgeResult = {
    valid: false, errors, contract, states: null, probTotal,
    expectedUnhedged: null, expectedHedged: null, expectedIncremental: null,
    basisMissProbability: null, nonLossPayoutProbability: null, falsePositiveProbability: null, falseNegativeProbability: null, worstCombined: null, adverseNoPayoff: null,
  };
  if (!contract || !lossOk) return empty;

  const states: StateOutcome[] = (Object.keys(STATE_LABELS) as StateKey[]).map((key) => {
    const meta = STATE_LABELS[key];
    const businessDelta = meta.businessLoss ? -i.loss : 0;
    const contractDelta = meta.contractYes ? contract.netYes : contract.netNo;
    return { key, ...meta, probability: i.probs[key], businessDelta, contractDelta, combinedDelta: round4(businessDelta + contractDelta) };
  });
  const worstCombined = Math.min(...states.map((s) => s.combinedDelta));
  const adverseNoPayoff = states.find((s) => s.key === "p10")!.combinedDelta;
  if (errors.length > 0) return { ...empty, states, worstCombined, adverseNoPayoff };

  const expectedHedged = states.reduce((a, s) => a + s.probability * s.combinedDelta, 0);
  const expectedUnhedged = -i.loss * (i.probs.p11 + i.probs.p10);
  return {
    valid: true, errors, contract, states, probTotal,
    expectedUnhedged, expectedHedged, expectedIncremental: expectedHedged - expectedUnhedged,
    basisMissProbability: i.probs.p10, nonLossPayoutProbability: i.probs.p01, falsePositiveProbability: i.probs.p01, falseNegativeProbability: i.probs.p10, worstCombined, adverseNoPayoff,
  };
}

/* ---- Business-exposure converters (contribution margin, never gross receipts) ---- */

/** Brooklyn Sail: L = booking price × (1 − avoidable cost fraction) × canceled bookings */
export const sailLoss = (bookingPrice: number, avoidableFraction: number, canceled: number) =>
  cents(bookingPrice * (1 - avoidableFraction) * canceled);

/** Xentra: L = gallons × shock per gallon × (1 − pass-through) */
export const fuelLoss = (gallons: number, shockPerGallon: number, passThrough: number) =>
  cents(gallons * shockPerGallon * (1 - passThrough));

/** Arborpolitan: net storm contribution = emergency gain − scheduled loss; adverse loss = max(0, −net) */
export const stormNet = (scheduledLoss: number, emergencyGain: number) => cents(emergencyGain - scheduledLoss);
export const stormAdverseLoss = (scheduledLoss: number, emergencyGain: number) => Math.max(0, cents(scheduledLoss - emergencyGain));

/** Rebalance helper: sets the "no loss + NO" state so the four sum to 100%. */
export function rebalanceP00(p: JointProbs): JointProbs {
  const p00 = Math.round((1 - (p.p11 + p.p10 + p.p01)) * 1e8) / 1e8;
  return { ...p, p00 };
}
