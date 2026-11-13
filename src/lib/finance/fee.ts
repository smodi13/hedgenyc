/**
 * Kalshi general taker fee, one implementation shared by the homepage Hedge Lab and the Owner Lab.
 * Source: Kalshi Fee Schedule, effective July 7, 2026 (https://kalshi.com/docs/kalshi-fee-schedule.pdf).
 *
 *   fee = round_up(M * 0.07 * C * P * (1 - P))
 *
 * Rounding is applied so that fee + position cost reaches the next centicent ($0.0001).
 */
export const FEE_COEF = 0.07;
export const FEE_PRECISION = 1e4;
export const FEE_SOURCE = { label: "Kalshi Fee Schedule, effective July 7, 2026", url: "https://kalshi.com/docs/kalshi-fee-schedule.pdf" } as const;

export const round4 = (x: number) => Math.round(x * FEE_PRECISION) / FEE_PRECISION + 0; // + 0 turns -0 into 0

/** Round UP to a centicent; the epsilon absorbs binary-float noise on values that are already exact centicents. */
export const ceilCenticent = (x: number) => Math.ceil(x * FEE_PRECISION - 1e-6) / FEE_PRECISION + 0;

/** Unrounded fee in dollars. `coef` is M * 0.07 (0.07 when M = 1). */
export const rawFee = (qty: number, price: number, coef: number) => (qty <= 0 || coef <= 0 ? 0 : coef * qty * price * (1 - price));

/** Total cash for an order: position cost plus fee(s), rounded up once to a centicent. */
export const orderCost = (premium: number, rawFees: number) => ceilCenticent(premium + rawFees);
