/**
 * Position sizing, outcomes, optimizer. Pure and deterministic; nothing here is hardcoded to a result.
 * Orders are whole contracts of the NO side, multiplier 1. Fee = ROUNDUP(0.07 * q * p * (1-p), cents) per price level filled.
 */
import { takerFee } from "../finance/hedge";
import { cents, FEE_COEF, TOLERANCE_CAP, type JointProbs, type Objective, type Tolerance } from "./model";

/** Search ceiling: no more than this many contracts are ever evaluated. */
export const CEILING = 50_000;

export interface Level { price: number; size: number }
/** NO ask ladder, ascending price. null = illustrative single price with unlimited depth. */
export type Ladder = Level[] | null;

export interface Fill { premium: number; fee: number; cost: number; avgPrice: number | null; filled: number; complete: boolean; levels: { price: number; qty: number }[] }

export function fillOrder(qty: number, price: number, ladder: Ladder): Fill {
  if (qty <= 0) return { premium: 0, fee: 0, cost: 0, avgPrice: null, filled: 0, complete: true, levels: [] };
  const levels: { price: number; qty: number }[] = [];
  let left = qty;
  if (ladder === null) levels.push({ price, qty });
  else for (const l of ladder) { if (left <= 0) break; const q = Math.min(left, l.size); if (q > 0) { levels.push({ price: l.price, qty: q }); left -= q; } }
  const filled = levels.reduce((a, l) => a + l.qty, 0);
  const premium = cents(levels.reduce((a, l) => a + l.qty * l.price, 0));
  const fee = cents(levels.reduce((a, l) => a + takerFee(l.qty, l.price, FEE_COEF), 0));
  return { premium, fee, cost: cents(premium + fee), avgPrice: filled ? premium / filled : null, filled, complete: filled === qty, levels };
}

export interface CostTable { cost: Float64Array; max: number; ladder: Ladder; price: number }

/** cost[C] = total entry cost for C contracts. Built once per price/ladder; everything else is lookups. */
export function buildCostTable(price: number, ladder: Ladder): CostTable {
  const depth = ladder ? ladder.reduce((a, l) => a + l.size, 0) : Infinity;
  const max = Math.max(0, Math.min(CEILING, depth));
  const cost = new Float64Array(max + 1);
  for (let c = 1; c <= max; c++) cost[c] = fillOrder(c, price, ladder).cost;
  return { cost, max, ladder, price };
}

const costAt = (t: CostTable, c: number) => t.cost[c] as number;
export const netWin = (c: number, t: CostTable) => cents(c - costAt(t, c));

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
  return { lossPays: cents(-loss + w), lossLoses: cents(-loss - k), noLossPays: w, noLossLoses: cents(-k) };
}

const ORDER = ["lossPays", "lossLoses", "noLossPays", "noLossLoses"] as const;
const mean = (o: Outcomes, p: JointProbs) => ORDER.reduce((a, k) => a + p[k] * o[k], 0);
export const variance = (o: Outcomes, p: JointProbs) => { const m = mean(o, p); return ORDER.reduce((a, k) => a + p[k] * (o[k] - m) ** 2, 0); };

/** CVaR of losses (= -outcome) at confidence alpha: mean loss over the worst (1-alpha) probability mass. */
export function cvar(o: Outcomes, p: JointProbs, alpha = 0.9): number {
  const pairs = ORDER.map((k) => ({ loss: -o[k], p: p[k] })).sort((a, b) => b.loss - a.loss);
  let left = 1 - alpha, acc = 0;
  for (const x of pairs) { const w = Math.min(x.p, left); acc += w * x.loss; left -= w; if (left <= 1e-15) break; }
  return acc / (1 - alpha);
}

export interface Ctx {
  loss: number; table: CostTable; probs: JointProbs | null;
  budget: number; maxTradingLoss: number; positionLimit: number; tolerance: Tolerance; variability: number;
}

export interface Position {
  contracts: number; cost: number; fee: number; premium: number; avgPrice: number | null;
  netWin: number; coverage: number | null; maxLoss: number;
  outcomes: Outcomes;
  expTrading: number | null; expCombined: number | null; expNoHedge: number | null;
  worst: number; stressWorst: number; variance: number | null; cvar90: number | null;
  breakEvenProb: number | null; basisMissProb: number | null;
  overhedged: boolean; budgetOk: boolean; lossCapOk: boolean; positionOk: boolean; expCostOk: boolean | null;
  allOk: boolean;
}

export function evaluate(c: number, x: Ctx): Position {
  const t = x.table, f = fillOrder(c, t.price, t.ladder);
  const o = outcomesFor(c, x.loss, t), w = netWin(c, t), p = x.probs;
  const expTrading = p ? (p.lossPays + p.noLossPays) * w - (p.lossLoses + p.noLossLoses) * costAt(t, c) : null;
  const expNoHedge = p ? -x.loss * (p.lossPays + p.lossLoses) : null;
  const expCombined = p ? mean(o, p) : null;
  const live = p ? ORDER.filter((k) => p[k] > 0) : [...ORDER];
  const overhedged = c > 0 && (x.loss <= 0 || netWin(c - 1, t) > x.loss + 1e-9);
  const budgetOk = costAt(t, c) <= x.budget + 1e-9;
  const lossCapOk = costAt(t, c) <= x.maxTradingLoss + 1e-9;
  const positionOk = x.positionLimit <= 0 || c <= x.positionLimit;
  const expCostOk = p && expTrading !== null && expNoHedge !== null ? -expTrading <= TOLERANCE_CAP[x.tolerance] * -expNoHedge + 1e-9 : null;
  return {
    contracts: c, cost: costAt(t, c), fee: f.fee, premium: f.premium, avgPrice: f.avgPrice, netWin: w,
    coverage: x.loss > 0 ? w / x.loss : null, maxLoss: costAt(t, c), outcomes: o,
    expTrading, expCombined, expNoHedge,
    worst: Math.min(...live.map((k) => o[k])), stressWorst: cents(-x.loss * (1 + x.variability) - costAt(t, c)),
    variance: p ? variance(o, p) : null, cvar90: p ? cvar(o, p) : null,
    breakEvenProb: c > 0 ? costAt(t, c) / c : null, basisMissProb: p ? p.lossLoses : null,
    overhedged, budgetOk, lossCapOk, positionOk, expCostOk,
    allOk: budgetOk && lossCapOk && positionOk && expCostOk !== false,
  };
}

export interface OptResult {
  objective: Objective;
  status: "ok" | "insufficient" | "infeasible";
  position: Position;
  baseline: Position;
  /** True when the chosen position strictly beats buying zero under the objective */
  beatsZero: boolean;
  why: string;
}

export const OBJECTIVE_TEXT: Record<Objective, { name: string; math: string }> = {
  variance: { name: "Minimize variability", math: "Minimizes Var(combined business + trading outcome) over whole-contract quantities, under your four-state probabilities." },
  cvar: { name: "Minimize downside risk", math: "Minimizes the 90% CVaR of combined losses (average of the worst 10% probability mass), under your four-state probabilities." },
  target: { name: "Target protection at minimum cost", math: "Finds the smallest whole-contract position whose net winning-contract profit meets your target protection, at the lowest upfront cost." },
};

export function optimize(objective: Objective, x: Ctx, target: number): OptResult {
  const base = evaluate(0, x);
  const mk = (c: number, status: OptResult["status"], beats: boolean, why: string): OptResult => ({ objective, status, position: evaluate(c, x), baseline: base, beatsZero: beats, why });
  const feasible = (p: Position) => p.budgetOk && p.lossCapOk && p.positionOk && p.expCostOk !== false;

  if (objective === "target") {
    const c = minContractsFor([target], x.table)[0] ?? null;
    if (c === null) return mk(0, "infeasible", false, "No whole-contract position reaches the target with the available price and depth, so zero contracts is shown.");
    if (c === 0) return mk(0, "ok", false, "The target protection is $0, so zero contracts is the answer.");
    const p = evaluate(c, x);
    if (!feasible(p)) return mk(0, "infeasible", false, `The cheapest position that meets the target (${c.toLocaleString("en-US")} contracts, $${p.cost.toFixed(2)}) breaks a budget, loss, position or tolerance limit, so zero contracts is shown.`);
    return mk(c, "ok", true, `Smallest whole-contract position whose net winning profit is at least $${target.toFixed(2)}.`);
  }

  if (!x.probs) return mk(0, "insufficient", false, "Insufficient information for a personalized optimal hedge estimate.");
  const p = x.probs;
  const score = (o: Outcomes) => (objective === "variance" ? variance(o, p) : cvar(o, p));
  let bestC = 0, best = score(base.outcomes), feasibleCount = 0;
  const t = x.table, cap = Math.min(x.budget, x.maxTradingLoss), noHedge = -x.loss * (p.lossPays + p.lossLoses);
  for (let c = 1; c <= t.max; c++) {
    const k = costAt(t, c), w = netWin(c, t);
    if (k > cap + 1e-9) break; // cost only rises with size
    if (x.loss <= 0 || netWin(c - 1, t) > x.loss + 1e-9) break; // overhedged from here on
    if (x.positionLimit > 0 && c > x.positionLimit) break;
    const expTrading = (p.lossPays + p.noLossPays) * w - (p.lossLoses + p.noLossLoses) * k;
    if (-expTrading > TOLERANCE_CAP[x.tolerance] * -noHedge + 1e-9) continue;
    feasibleCount++;
    const s = score(outcomesFor(c, x.loss, t));
    if (s < best - 1e-9 * Math.max(1, Math.abs(best))) { best = s; bestC = c; }
  }
  if (bestC === 0) {
    return mk(0, "ok", false, feasibleCount === 0
      ? "No whole-contract position fits inside your budget, loss cap, position limit and tolerance, so zero contracts is the answer."
      : `No whole-contract position lowers ${objective === "variance" ? "variability" : "90% CVaR"} below buying none under these probabilities and prices (fees and basis risk outweigh the offset), so zero contracts is the answer.`);
  }
  return mk(bestC, "ok", true, `Lowest ${objective === "variance" ? "variance" : "90% CVaR"} among ${feasibleCount.toLocaleString("en-US")} feasible whole-contract positions.`);
}

export interface ChartPoint { pct: number; contracts: number | null; cost: number | null; ifPays: number | null; ifNotPays: number | null; expected: number | null; cvarChange: number | null }

/** Sweep target coverage 0..100% and record the financial consequence at each. */
export function sweep(x: Ctx, steps = 100): ChartPoint[] {
  const targets = Array.from({ length: steps + 1 }, (_, i) => (i / steps) * x.loss);
  const cs = minContractsFor(targets, x.table);
  const base = x.probs ? cvar(outcomesFor(0, x.loss, x.table), x.probs) : null;
  return cs.map((c, i) => {
    const pct = (i / steps) * 100;
    if (c === null) return { pct, contracts: null, cost: null, ifPays: null, ifNotPays: null, expected: null, cvarChange: null };
    const o = outcomesFor(c, x.loss, x.table);
    return {
      pct, contracts: c, cost: costAt(x.table, c), ifPays: o.lossPays, ifNotPays: o.lossLoses,
      expected: x.probs ? mean(o, x.probs) : null, cvarChange: x.probs && base !== null ? cvar(o, x.probs) - base : null,
    };
  });
}
