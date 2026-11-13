/**
 * Position sizing, outcomes, optimizer. Pure and deterministic; nothing here is hardcoded to a result.
 * Orders are whole contracts of the NO side, multiplier 1.
 * Fee: round_up(M * 0.07 * C * P * (1 - P)); fee + position cost rounded up to a centicent ($0.0001).
 */
import { ceilCenticent, FEE_COEF, rawFee as sharedRawFee, round4 } from "../finance/fee";
import type { DistRow } from "./model";

/** Search ceiling: no more than this many contracts are ever evaluated. */
export const CEILING = 50_000;

export interface Level { price: number; size: number }
/** NO ask ladder, ascending price. null = illustrative single price with unlimited depth. */
export type Ladder = Level[] | null;

const r4 = round4;
export { ceilCenticent };
/** Unrounded fee in dollars for M = mult. */
export const rawFee = (qty: number, price: number, mult: number) => sharedRawFee(qty, price, mult * FEE_COEF);

export interface Fill { premium: number; fee: number; cost: number; avgPrice: number | null; filled: number; complete: boolean; levels: { price: number; qty: number }[] }

/** Walk the book: fee formula applied to each execution quantity, one centicent round-up on (premium + fees). */
export function fillOrder(qty: number, price: number, ladder: Ladder, mult = 1): Fill {
  if (qty <= 0) return { premium: 0, fee: 0, cost: 0, avgPrice: null, filled: 0, complete: true, levels: [] };
  const levels: { price: number; qty: number }[] = [];
  let left = qty;
  if (ladder === null) levels.push({ price, qty });
  else for (const l of ladder) { if (left <= 0) break; const q = Math.min(left, l.size); if (q > 0) { levels.push({ price: l.price, qty: q }); left -= q; } }
  const filled = levels.reduce((a, l) => a + l.qty, 0);
  const premium = r4(levels.reduce((a, l) => a + l.qty * l.price, 0));
  const fees = levels.reduce((a, l) => a + rawFee(l.qty, l.price, mult), 0);
  const cost = ceilCenticent(premium + fees);
  return { premium, fee: r4(cost - premium), cost, avgPrice: filled ? premium / filled : null, filled, complete: filled === qty, levels };
}

export interface CostTable { cost: Float64Array; max: number; ladder: Ladder; price: number; mult: number }

/** cost[C] = total entry cost for C contracts. Built once per price/ladder/multiplier; everything else is lookups. */
export function buildCostTable(price: number, ladder: Ladder, mult = 1): CostTable {
  const depth = ladder ? ladder.reduce((a, l) => a + l.size, 0) : Infinity;
  const max = Math.max(0, Math.min(CEILING, depth));
  const cost = new Float64Array(max + 1);
  for (let c = 1; c <= max; c++) cost[c] = fillOrder(c, price, ladder, mult).cost;
  return { cost, max, ladder, price, mult };
}

const costAt = (t: CostTable, c: number) => t.cost[c] as number;
export const netWin = (c: number, t: CostTable) => r4(c - costAt(t, c));

/** Smallest integer C whose net winning profit >= each target; null when unreachable within the table. Targets ascending. */
export function minContractsFor(targets: number[], t: CostTable): (number | null)[] {
  const out: (number | null)[] = targets.map((x) => (x <= 0 ? 0 : null));
  let k = 0;
  for (let c = 1; c <= t.max && k < targets.length; c++) {
    const w = netWin(c, t);
    while (k < targets.length && ((targets[k] as number) <= 0 || w >= (targets[k] as number) - 1e-9)) { if (out[k] === null) out[k] = c; k++; }
  }
  return out;
}

export interface Outcomes { lossPays: number; lossLoses: number; noLossPays: number; noLossLoses: number }

export function outcomesFor(c: number, loss: number, t: CostTable): Outcomes {
  const w = netWin(c, t), k = costAt(t, c);
  return { lossPays: r4(-loss + w), lossLoses: r4(-loss - k), noLossPays: w, noLossLoses: r4(-k) };
}

/** Combined business + trading P&L for every (business state, settlement) pair with its probability. */
export function pnl(c: number, t: CostTable, dist: DistRow[]): { o: number; p: number }[] {
  const w = netWin(c, t), k = costAt(t, c);
  return dist.flatMap((r) => [{ o: -r.loss + w, p: r.pays }, { o: -r.loss - k, p: r.loses }]);
}

export const meanOf = (xs: { o: number; p: number }[]) => xs.reduce((a, x) => a + x.p * x.o, 0);
export const varianceOf = (xs: { o: number; p: number }[]) => { const m = meanOf(xs); return xs.reduce((a, x) => a + x.p * (x.o - m) ** 2, 0); };

/**
 * CVaR of losses (loss = -P&L) at 90%: min over t of t + 10 * sum p * max(loss - t, 0).
 * The minimum is attained at one of the loss values, so scanning them is exact (partial tail mass handled by the formula).
 */
export function cvarOf(xs: { o: number; p: number }[]): number {
  const L = xs.filter((x) => x.p > 0).map((x) => ({ l: -x.o, p: x.p }));
  let best = Infinity;
  for (const { l: t } of L) {
    const v = t + 10 * L.reduce((a, x) => a + x.p * Math.max(x.l - t, 0), 0);
    if (v < best) best = v;
  }
  return best;
}

export interface Ctx {
  loss: number; table: CostTable;
  /** Joint distribution; null when probabilities are missing/invalid */
  dist: DistRow[] | null;
  /** NaN/null = owner has not entered a limit */
  budget: number | null; maxTradingLoss: number | null; positionLimit: number; maxCoverage: number; variability: number;
}

export interface Position {
  contracts: number; cost: number; fee: number; premium: number; avgPrice: number | null;
  netWin: number; coverage: number | null; maxLoss: number;
  outcomes: Outcomes;
  expTrading: number | null; expCombined: number | null; expNoHedge: number | null;
  worst: number; stressWorst: number; variance: number | null; cvar90: number | null;
  breakEvenProb: number | null; basisMissProb: number | null;
  /** Winning payout exceeds the modeled loss (informational) */
  exceedsLoss: boolean;
  budgetOk: boolean | null; lossCapOk: boolean | null; positionOk: boolean; coverageOk: boolean;
  /** Every owner limit entered, and all satisfied */
  allOk: boolean;
}

const ORDER = ["lossPays", "lossLoses", "noLossPays", "noLossLoses"] as const;
const lim = (v: number | null) => (v === null || Number.isNaN(v) ? null : v);

export function evaluate(c: number, x: Ctx): Position {
  const t = x.table, f = fillOrder(c, t.price, t.ladder, t.mult), k = costAt(t, c);
  const o = outcomesFor(c, x.loss, t), w = netWin(c, t), d = x.dist;
  const xs = d ? pnl(c, t, d) : null, base = d ? pnl(0, t, d) : null;
  const expTrading = d ? d.reduce((a, r) => a + r.pays * w - r.loses * k, 0) : null;
  const expNoHedge = base ? meanOf(base) : null;
  const live = xs ? xs.filter((z) => z.p > 0).map((z) => z.o) : ORDER.map((q) => o[q]);
  const B = lim(x.budget), M = lim(x.maxTradingLoss);
  const budgetOk = B === null ? null : k <= B + 1e-9, lossCapOk = M === null ? null : k <= M + 1e-9;
  const positionOk = x.positionLimit <= 0 || c <= x.positionLimit;
  const coverageOk = w <= x.maxCoverage * x.loss + 1e-9;
  return {
    contracts: c, cost: k, fee: f.fee, premium: f.premium, avgPrice: f.avgPrice, netWin: w,
    coverage: x.loss > 0 ? w / x.loss : null, maxLoss: k, outcomes: o,
    expTrading, expCombined: xs ? meanOf(xs) : null, expNoHedge,
    worst: Math.min(...live), stressWorst: r4(-x.loss * (1 + x.variability) - k),
    variance: xs ? varianceOf(xs) : null, cvar90: xs ? cvarOf(xs) : null,
    breakEvenProb: c > 0 ? k / c : null, basisMissProb: d ? d.filter((r) => r.loss > 0).reduce((a, r) => a + r.loses, 0) : null,
    exceedsLoss: c > 0 && w > x.loss + 1e-9,
    budgetOk, lossCapOk, positionOk, coverageOk, allOk: budgetOk === true && lossCapOk === true && positionOk && coverageOk,
  };
}

export interface OptResult {
  objective: Objective;
  status: "ok" | "insufficient" | "infeasible";
  /** The selected position (zero contracts is a valid answer) */
  position: Position;
  baseline: Position;
  /** For the target objective: the position the target would need, even when it is not feasible */
  required: Position | null;
  /** True when the position is strictly better than buying zero under the objective's measure */
  beatsZero: boolean;
  why: string;
}
type Objective = "variance" | "cvar" | "target";

export const NO_FEASIBLE = "No feasible hedge under current assumptions.";
export const NEED_LIMITS = "Enter a maximum hedge spend and a maximum acceptable trading loss. Without an owner risk budget no personalized allocation is produced.";

export const OBJECTIVE_TEXT: Record<Objective, { name: string; math: string }> = {
  variance: { name: "Minimize variability", math: "Chooses the whole-contract quantity (zero included) that minimizes the variance of combined business + trading P&L under your modeled probability distribution." },
  cvar: { name: "Minimize downside risk", math: "Chooses the whole-contract quantity (zero included) that minimizes the 90% CVaR: the probability-weighted average loss in the worst 10% of your modeled distribution." },
  target: { name: "Target protection at minimum cost", math: "Finds the smallest whole-contract position whose net winning profit meets your target coverage. This is target sizing, not proof of positive expected value." },
};

const usd = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Why a position breaks the owner's limits, in words. */
export function breaches(p: Position, x: Ctx): string[] {
  const out: string[] = [];
  if (p.budgetOk === false) out.push(`costs ${usd(p.cost)}, above your ${usd(x.budget as number)} budget`);
  if (p.lossCapOk === false) out.push(`could lose ${usd(p.maxLoss)}, above your ${usd(x.maxTradingLoss as number)} maximum trading loss`);
  if (!p.positionOk) out.push(`exceeds your ${x.positionLimit.toLocaleString("en-US")}-contract position limit`);
  if (!p.coverageOk) out.push(`pays ${usd(p.netWin)} if it wins, above your ${(x.maxCoverage * 100).toFixed(0)}% coverage limit`);
  return out;
}

export function optimize(objective: Objective, x: Ctx, target: number): OptResult {
  const base = evaluate(0, x);
  const mk = (c: number, status: OptResult["status"], beats: boolean, why: string, required: Position | null = null): OptResult =>
    ({ objective, status, position: evaluate(c, x), baseline: base, required, beatsZero: beats, why });
  const B = lim(x.budget), M = lim(x.maxTradingLoss);
  if (objective !== "target" && !x.dist) return mk(0, "insufficient", false, "Insufficient information for a personalized optimal hedge estimate.");
  if (B === null || M === null) return mk(0, "insufficient", false, NEED_LIMITS);

  if (objective === "target") {
    const c = minContractsFor([target], x.table)[0] ?? null;
    if (c === null) return mk(0, "infeasible", false, `${NO_FEASIBLE} No whole-contract position reaches the target with the available price and depth.`);
    if (c === 0) return mk(0, "ok", false, "The target protection is $0, so zero contracts is the answer.");
    const p = evaluate(c, x), why = breaches(p, x);
    if (why.length) return mk(0, "infeasible", false, `${NO_FEASIBLE} The smallest position meeting the target is ${c.toLocaleString("en-US")} contracts, which ${why.join(" and ")}.`, p);
    return mk(c, "ok", true, `Smallest whole-contract position whose net winning profit is at least ${usd(target)}. This is target sizing, not an expected-value claim.`, p);
  }

  const d = x.dist as DistRow[], t = x.table, cap = Math.min(B, M);
  const score = (c: number) => (objective === "variance" ? varianceOf(pnl(c, t, d)) : cvarOf(pnl(c, t, d)));
  let bestC = 0, best = score(0), feasibleCount = 0;
  for (let c = 1; c <= t.max; c++) {
    if (costAt(t, c) > cap + 1e-9) break; // cost only rises with size
    if (x.positionLimit > 0 && c > x.positionLimit) break;
    if (netWin(c, t) > x.maxCoverage * x.loss + 1e-9) break; // coverage cap
    feasibleCount++;
    const s = score(c);
    // strict improvement only: ties keep the cheaper (and smaller) position found first
    if (s < best - 1e-9 * Math.max(1, Math.abs(best))) { best = s; bestC = c; }
  }
  const measure = objective === "variance" ? "variance" : "90% CVaR";
  const caveat = " Optimal only under your modeled distribution and limits.";
  if (bestC === 0) return mk(0, "ok", false, feasibleCount === 0
    ? "No whole-contract position fits inside your budget, maximum trading loss, position limit and coverage limit, so zero contracts is the answer."
    : `No whole-contract position lowers ${measure} below buying none under these probabilities and prices (fees and basis risk outweigh the offset), so zero contracts is the answer.${caveat}`);
  return mk(bestC, "ok", true, `Lowest ${measure} among ${(feasibleCount + 1).toLocaleString("en-US")} feasible whole-contract positions including zero.${caveat}`);
}

export interface ChartPoint { pct: number; contracts: number | null; cost: number | null; ifPays: number | null; ifNotPays: number | null; expected: number | null; cvarChange: number | null }

/** Sweep target coverage 0..100% and record the financial consequence at each. */
export function sweep(x: Ctx, steps = 100): ChartPoint[] {
  const targets = Array.from({ length: steps + 1 }, (_, i) => (i / steps) * x.loss);
  const cs = minContractsFor(targets, x.table);
  const base = x.dist ? cvarOf(pnl(0, x.table, x.dist)) : null;
  return cs.map((c, i) => {
    const pct = (i / steps) * 100;
    if (c === null) return { pct, contracts: null, cost: null, ifPays: null, ifNotPays: null, expected: null, cvarChange: null };
    const o = outcomesFor(c, x.loss, x.table), xs = x.dist ? pnl(c, x.table, x.dist) : null;
    return { pct, contracts: c, cost: costAt(x.table, c), ifPays: o.lossPays, ifNotPays: o.lossLoses, expected: xs ? meanOf(xs) : null, cvarChange: xs && base !== null ? cvarOf(xs) - base : null };
  });
}
