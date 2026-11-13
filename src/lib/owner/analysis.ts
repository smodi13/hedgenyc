/** One pure function that turns a scenario (+ optional live market) into everything the UI, copy summary and print view show. */
import type { OwnerMarket } from "../kalshi/owner-market";
import { pct as pctFmt, usd } from "../format";
import {
  buildCostTable, evaluate, fillOrder, minContractsFor, optimize, sweep,
  OBJECTIVE_TEXT, type ChartPoint, type Ctx, type Ladder, type OptResult, type Position,
} from "./hedge";
import {
  distRows, EARLY_SETTLEMENT, exposure, FEE_COEF, FEE_SOURCE, MARKET, probState, protectedLoss, validate,
  type DistRow, type Exposure, type FieldErrors, type ProbState, type Scenario,
} from "./model";

export interface Check { id: string; label: string; status: "pass" | "fail" | "manual" | "unavailable"; detail: string }
export interface CompareRow { id: string; label: string; pct: number | null; position: Position | null; unreachable: boolean }

/** Plain-English derived statistics of the joint distribution */
export interface ProbStats { pLoss: number; pPayout: number; pLossNoPay: number; pPayGivenLoss: number | null }
export function probStats(d: DistRow[]): ProbStats {
  const pLoss = d.filter((r) => r.loss > 0).reduce((a, r) => a + r.pays + r.loses, 0);
  const pLossNoPay = d.filter((r) => r.loss > 0).reduce((a, r) => a + r.loses, 0);
  const pLossPay = d.filter((r) => r.loss > 0).reduce((a, r) => a + r.pays, 0);
  return { pLoss, pPayout: d.reduce((a, r) => a + r.pays, 0), pLossNoPay, pPayGivenLoss: pLoss > 0 ? pLossPay / pLoss : null };
}

export interface Analysis {
  valid: boolean;
  errors: FieldErrors;
  exposure: Exposure;
  loss: number;
  target: number;
  probs: ProbState;
  priceSource: "illustrative" | "live";
  /** Live book requested but unconfirmed: no executable hedge is claimed and the illustrative price is NOT substituted */
  liveUnavailable: boolean;
  feeMult: number;
  scenarioLabel: string;
  /** "probability" only for variance/CVaR with valid probabilities; otherwise sizing */
  basis: "probability" | "sizing";
  stats: ProbStats | null;
  ctx: Ctx | null;
  manual: Position | null;
  manualUnreachable: boolean;
  opt: OptResult | null;
  compare: CompareRow[];
  chart: ChartPoint[];
  checks: Check[];
  warnings: string[];
}

export const SCENARIO_LABEL = "Scenario-based optimization. Execution not verified.";

export function analyze(s: Scenario, market: OwnerMarket | null): Analysis {
  const errors = validate(s);
  const ex = exposure(s);
  const valid = Object.keys(errors).length === 0;
  const loss = valid ? protectedLoss(s, ex) : 0;
  const target = loss * s.coverage;
  const probs = probState(s);
  const live = s.useLive && !!market?.verified;
  const liveUnavailable = s.useLive && !market?.verified;
  const feeMult = live ? (market!.feeMultiplier as number) : s.feeMult;
  const base: Analysis = {
    valid, errors, exposure: ex, loss, target, probs, priceSource: live ? "live" : "illustrative", liveUnavailable, feeMult, scenarioLabel: SCENARIO_LABEL,
    basis: "sizing", stats: null, ctx: null, manual: null, manualUnreachable: false, opt: null, compare: [], chart: [], checks: [], warnings: [],
  };
  if (!valid) return base;

  // A live book that cannot be confirmed means zero depth, never a silent fallback to the illustrative quote.
  const ladder: Ladder = live ? market!.levels : liveUnavailable ? [] : null;
  const table = buildCostTable(s.price, ladder, feeMult);
  const dist = distRows(probs, loss);
  const ctx: Ctx = { loss, table, dist, budget: s.budget, maxTradingLoss: s.maxTradingLoss, positionLimit: s.positionLimit, maxCoverage: s.maxCoverage, variability: s.variability };
  const mc = minContractsFor([target], table)[0] ?? null;
  const manual = evaluate(mc ?? 0, ctx);
  const opt = optimize(s.objective, ctx, target);

  const pcts = [0, 0.25, 0.5, 0.75, 1];
  const cs = minContractsFor(pcts.map((p) => p * loss), table);
  const compare: CompareRow[] = pcts.map((p, i) => ({
    id: `p${p * 100}`, label: p === 0 ? "No hedge" : `${p * 100}% target protection`, pct: p,
    position: cs[i] === null ? null : evaluate(cs[i]!, ctx), unreachable: cs[i] === null,
  }));
  compare.push({ id: "opt", label: "Automatically optimized", pct: null, position: opt.position, unreachable: false });

  const warnings: string[] = [];
  if (loss <= 0) warnings.push("No operating loss is modeled, so any contract would be pure speculation. Zero contracts is the only hedge-consistent position.");
  if (s.lowVisits > s.normalVisits) warnings.push("Low-snow visits exceed normal visits, so no revenue loss is modeled.");
  if (dist && !Number.isNaN(s.lowSnowProb) && Math.abs(s.lowSnowProb - probStats(dist).pLoss) > 0.005)
    warnings.push(`Your stated low-snow probability (${pctFmt(s.lowSnowProb, 1)}) differs from the business-loss probability implied by your states (${pctFmt(probStats(dist).pLoss, 1)}).`);
  if (probs.kind === "ok" && probs.source === "illustrative") warnings.push("Probabilities are an illustrative placeholder, not history. Results are a demonstration, not a personalized estimate.");
  if (manual.exceedsLoss) warnings.push(`Winning payout exceeds modeled loss. The targeted position's net winning profit is ${usd(manual.netWin)}, ${pctFmt(manual.coverage ?? 0, 1)} of the ${usd(loss)} loss. If the business has no loss but the contract pays, you keep ${usd(manual.outcomes.noLossPays)}.`);
  if (liveUnavailable) warnings.push("Live order-book pricing was selected but the book cannot be confirmed right now. No executable hedge is claimed and the illustrative price is not substituted.");

  const stats = dist ? probStats(dist) : null;
  const basis = (s.objective === "variance" || s.objective === "cvar") && opt.status === "ok" ? "probability" : "sizing";
  return { ...base, ctx, stats, basis, manual, manualUnreachable: mc === null, opt, compare, chart: sweep(ctx), checks: fixUnreachable(executionChecks(market, opt.status === "ok" && opt.position.contracts > 0 ? opt.position : manual, s, live, feeMult), mc === null && !(opt.status === "ok" && opt.position.contracts > 0)), warnings };
}

/** When the target is unreachable the proposed size is 0, which would wrongly look fine; say so. */
const fixUnreachable = (checks: Check[], unreachable: boolean): Check[] =>
  unreachable ? checks.map((c) => (c.id === "depth" ? { ...c, status: "fail" as const, detail: "The target protection cannot be filled with the available price and depth." } : c)) : checks;

export function executionChecks(m: OwnerMarket | null, p: Position, s: Scenario, live: boolean, feeMult = 1): Check[] {
  const none = !m || m.status !== "ok";
  const un = (id: string, label: string): Check => ({ id, label, status: "unavailable", detail: m?.note ?? "Live market data has not loaded." });
  const out: Check[] = [];
  out.push(none ? un("open", "Market is open") : m.marketStatus === "active"
    ? { id: "open", label: "Market is open", status: "pass", detail: `Status "active" at ${m.fetchedAt}.` }
    : { id: "open", label: "Market is open", status: "fail", detail: `Status is "${m.marketStatus}".` });
  out.push(none ? un("side", "Correct contract and side") : { id: "side", label: "Correct contract and side", status: "pass", detail: `Exact ticker ${m.ticker}; modeled side is NO (pays $1 if the YES condition is false).` });
  out.push(none ? un("rules", "Settlement rules") : m.rulesMatch
    ? { id: "rules", label: "Settlement rules", status: "manual", detail: `Rule text matches the modeled event. Read the full rules (including secondary rules and the data source) yourself before relying on this.` }
    : { id: "rules", label: "Settlement rules", status: "fail", detail: "Rule text does not match the modeled event." });
  if (none || m.levels.length === 0) out.push(un("depth", "Order-book depth for the proposed size"));
  else {
    const f = fillOrder(p.contracts, s.price, m.levels, m.feeMultiplier ?? feeMult);
    const best = m.levels[0]!.price;
    out.push(p.contracts === 0
      ? { id: "depth", label: "Order-book depth for the proposed size", status: "manual", detail: "Proposed size is 0 contracts." }
      : f.complete
        ? { id: "depth", label: "Order-book depth for the proposed size", status: "pass", detail: `${p.contracts.toLocaleString("en-US")} contracts fill across ${f.levels.length} price level(s) at an average ${usd(f.avgPrice!, 4)}; best ask ${usd(best, 2)}.` }
        : { id: "depth", label: "Order-book depth for the proposed size", status: "fail", detail: `Only ${f.filled.toLocaleString("en-US")} of ${p.contracts.toLocaleString("en-US")} contracts are available in the visible book (best ask ${usd(best, 2)}).` });
    if (p.contracts > 0 && f.complete) {
      out.push({ id: "slip", label: "Slippage and fees on actual fills", status: "manual", detail: `Average fill ${usd(f.avgPrice!, 4)} vs best ask ${usd(best, 2)} (slippage ${usd(f.avgPrice! - best, 4)} per contract). Fee on these fills ${usd(f.fee, 4)}; total cash ${usd(f.cost, 4)}; net settlement profit if it pays ${usd(p.contracts - f.cost)}. A snapshot, not a guaranteed fill.` });
    }
  }
  out.push(none || m.feeMultiplier === null
    ? { id: "fee", label: "Fee schedule", status: "manual", detail: `Using multiplier M = ${feeMult} that you entered; confirm it for this market. Live fee data unavailable.` }
    : { id: "fee", label: "Fee schedule", status: m.feeType === "quadratic" ? "pass" : "fail", detail: `Series fee type "${m.feeType}", multiplier ${m.feeMultiplier}. Fee = M × ${FEE_COEF} × C × P × (1−P), with fee + cost rounded up to $0.0001.` });
  out.push({ id: "budget", label: "Risk budget", status: p.budgetOk === null || p.lossCapOk === null ? "manual" : p.budgetOk && p.lossCapOk ? "pass" : "fail",
    detail: p.budgetOk === null || p.lossCapOk === null ? "No maximum spend or maximum trading loss entered, so no position is called affordable." : p.budgetOk && p.lossCapOk ? `Cost ${usd(p.cost)} fits your limits.` : `Cost ${usd(p.cost)} exceeds your limits. Position rejected.` });
  out.push({ id: "limits", label: "Minimums and position limits", status: s.positionLimit > 0 ? (p.positionOk ? "pass" : "fail") : "manual",
    detail: s.positionLimit > 0 ? `Your entered limit is ${s.positionLimit.toLocaleString("en-US")} contracts.` : "Account-specific minimums and limits are not available from public data. Not verified." });
  out.push({ id: "source", label: "Price source", status: live ? "manual" : "fail",
    detail: live ? "Using the order-book snapshot. Still not a guaranteed price." : "Using the illustrative price you entered. This is not a verified executable price." });
  return out;
}

type Row = [string, string];
export interface Summary { title: string; sections: { heading: string; rows: Row[] }[]; text: string }

const d = (n: number) => usd(n);
const none = "Not provided";

export function buildSummary(s: Scenario, a: Analysis, market: OwnerMarket | null, now: Date | null = new Date()): Summary {
  const e = a.exposure, sec: Summary["sections"] = [];
  const ver = { illustrative: "Illustrative defaults (not verified)", "owner-reported": "Owner-reported, not independently verified", documented: "Documented by owner records" }[s.verification];
  sec.push({ heading: "Scenario", rows: [
    ["Name", s.name], ["Location", s.location || none], ["Assumption verification", ver], ...(now ? [["Generated", now.toISOString()] as Row] : []), ["Notes", s.notes || "None"],
  ] });
  const billing: Row = ["Billing", s.method === "buildup" && s.seasonalEnabled && !s.publicFacts ? `Per-push plus owner-entered fixed seasonal revenue of ${d(s.seasonalRevenue)} (kept regardless of snowfall)` : "Per-push only (no seasonal snow contracts assumed)"];
  sec.push({ heading: "Business inputs (owner-entered or illustrative, see verification status)", rows: s.method === "simple" ? [billing,
    ["Customers", String(s.customers)], ["Normal December visits per customer", String(s.normalVisits)], ["Low-snow December visits per customer", String(s.lowVisits)],
    ["Revenue per visit", d(s.revPerVisit)], ["Contribution margin", pctFmt(s.margin, 1)],
  ] : [
    ["Residential / commercial customers", `${s.resCustomers} / ${s.comCustomers}`], ["Revenue per visit (residential / commercial)", `${d(s.resRev)} / ${d(s.comRev)}`],
    billing, ["Visits per customer (normal / low snow)", `${s.normalVisits} / ${s.lowVisits}`],
    ["Variable cost per visit (labor + fuel + salt)", d(e.variableCostPerVisit)], ["Other avoidable costs", d(s.otherAvoidable)],
    ["Salting/ice add-on revenue (normal December)", d(s.saltingRevenue)], ["Revenue retained in low-snow December", d(s.retainedRevenue)],
  ] });
  if (!a.valid) {
    sec.push({ heading: "Status", rows: [["Result", "Inputs are invalid, so no financial results are shown."], ...Object.entries(a.errors).map(([k, v]) => [k, String(v)] as Row)] });
    return finish("HedgeNYC Business Hedge Calculator: research summary", sec);
  }
  sec.push({ heading: "Financial exposure (hypothetical)", rows: [
    ["Normal December revenue", d(e.normalRevenue)], ["Low-snow December revenue", d(e.lowRevenue)], ["Lost revenue", d(e.lostRevenue)],
    ["Normal contribution margin", d(e.normalContribution)], ["Low-snow contribution margin", d(e.lowContribution)],
    ["Contribution-margin shortfall (modeled)", d(e.lostContribution)], ["Loss being protected against", d(a.loss) + (s.useOverride ? " (owner override)" : "")],
    ["Historical variability of loss size", pctFmt(s.variability, 0)],
  ] });
  sec.push({ heading: "Contract reference (market data and analyst assumption)", rows: [
    ["Contract", `${MARKET.ticker}: ${MARKET.threshold}`], ["Modeled side", "NO (pays $1 per contract if the YES condition is false), multiplier 1"],
    ["Price used", `${usd(s.price, 2)} per contract, ${a.priceSource === "live" ? "from an order-book snapshot (not guaranteed)" : "ILLUSTRATIVE input, not a verified executable price"}`],
    ["Fee rule", `round_up(M x ${FEE_COEF} x contracts x price x (1 - price)); fee + position cost rounded up to $0.0001. M = ${a.feeMult} (${a.priceSource === "live" ? "published for the series" : "entered by user; confirm for this market"})`],
    ["Early settlement", EARLY_SETTLEMENT],
    ["Fee source", `${FEE_SOURCE.label}: ${FEE_SOURCE.url}`],
    ["Live market", market ? `${market.status}; ${market.marketStatus ?? "n/a"} as of ${market.fetchedAt}` : "Not loaded"],
  ] });
  const m = a.manual!;
  sec.push({ heading: `Manual sizing: ${pctFmt(s.coverage, 0)} target protection`, rows: a.manualUnreachable ? [["Result", "No whole-contract position reaches this target with the available price and depth."]] : [
    ["Target protection if the contract pays", d(a.target)], ["Contracts (whole number)", m.contracts.toLocaleString("en-US")],
    ["Contract principal", d(m.premium)], ["Estimated fee", d(m.fee)], ["Total cash at risk (maximum amount lost)", d(m.cost)],
    ["Potential payout (gross)", d(m.contracts)], ["Net profit if the contract pays", d(m.netWin)],
    ["Break-even probability for trading alone", m.breakEvenProb === null ? "n/a" : pctFmt(m.breakEvenProb, 2)],
    ["A. Loss + contract pays", d(m.outcomes.lossPays)], ["B. Loss + contract does not pay", d(m.outcomes.lossLoses)],
    ["C. No loss + contract pays", d(m.outcomes.noLossPays)], ["D. No loss + contract does not pay", d(m.outcomes.noLossLoses)],
  ] });
  const o = a.opt!;
  const lim = (v: number) => (Number.isNaN(v) ? "not entered" : d(v));
  const optRows: Row[] = [["Result type", a.basis === "probability" ? "Probability-based optimization (assumption-dependent)" : "Illustrative hedge sizing (not a probability-based optimization)"],
    ["Objective", `${OBJECTIVE_TEXT[o.objective].name}: ${OBJECTIVE_TEXT[o.objective].math}`],
    ["Owner limits", `max spend ${lim(s.budget)}; max trading loss ${lim(s.maxTradingLoss)}; max coverage ${pctFmt(s.maxCoverage, 0)}; position limit ${s.positionLimit > 0 ? s.positionLimit : "none entered"}`]];
  if (o.status === "insufficient") optRows.push(["Result", o.why]);
  else if (o.status === "infeasible") optRows.push(["Result", o.why], ["Zero contracts shown", "Zero contracts is the only position inside your limits"]);
  else {
    const p = o.position, b = o.baseline;
    const st = a.stats;
    optRows.push(["Probabilities", a.probs.kind !== "ok" ? "Not provided" : `${a.probs.source === "illustrative" ? "ILLUSTRATIVE placeholder" : "Owner-supplied"}, ${a.probs.model === "multi" ? "multi-level loss model" : "simplified four-state model"}${s.lossModel === "simple" ? `: loss+pays ${pctFmt(s.probs.lossPays, 1)}, loss+not ${pctFmt(s.probs.lossLoses, 1)}, no loss+pays ${pctFmt(s.probs.noLossPays, 1)}, no loss+not ${pctFmt(s.probs.noLossLoses, 1)}` : ""}`],
      ...(st ? [["Chance of business loss / contract payout / loss without payout", `${pctFmt(st.pLoss, 1)} / ${pctFmt(st.pPayout, 1)} / ${pctFmt(st.pLossNoPay, 1)}`] as Row, ["Chance of payout given a business loss", st.pPayGivenLoss === null ? "n/a" : pctFmt(st.pPayGivenLoss, 1)] as Row] : []),
      ["Calculated contracts", p.contracts.toLocaleString("en-US")], ["Effective winning-payout coverage", p.coverage === null ? "n/a" : pctFmt(p.coverage, 1)],
      ["Upfront capital", d(p.cost)], ["Maximum contract loss", d(p.maxLoss)],
      ["Expected trading P&L", p.expTrading === null ? "n/a" : d(p.expTrading)], ["Expected combined P&L (no hedge: " + (b.expCombined === null ? "n/a" : d(b.expCombined)) + ")", p.expCombined === null ? "n/a" : d(p.expCombined)],
      ["Worst modeled combined outcome (no hedge: " + d(b.worst) + ")", d(p.worst)],
      ["90% CVaR before / after hedging", p.cvar90 === null || b.cvar90 === null ? "n/a" : `${d(b.cvar90)} / ${d(p.cvar90)}`],
      ["Winning payout vs modeled loss", p.exceedsLoss ? "Winning payout exceeds modeled loss." : "Winning payout does not exceed the modeled loss."],
      ["Business fine, contract pays", d(p.outcomes.noLossPays)],
      ["Basis-miss probability (loss but contract does not pay)", p.basisMissProb === null ? "n/a" : pctFmt(p.basisMissProb, 1)],
      ["All owner limits entered and satisfied", p.allOk ? "Yes" : "No"], ["Compared with zero contracts", o.beatsZero ? "Beats zero under this objective" : "No position beats zero under this objective"],
      ["Why", o.why], ["Status", a.priceSource === "live" ? "Order-book snapshot, not a guaranteed fill" : a.scenarioLabel]);
  }
  sec.push({ heading: "Optimizer", rows: optRows });
  sec.push({ heading: "Hedge size comparison", rows: a.compare.map((r) => [r.label, r.position ? `${r.position.contracts.toLocaleString("en-US")} contracts, cost ${d(r.position.cost)}, net if pays ${d(r.position.netWin)}, loss remaining if pays ${d(Math.max(0, a.loss - r.position.netWin))}, loss if not pays ${d(a.loss + r.position.cost)}${r.position.expCombined === null ? "" : `, expected ${d(r.position.expCombined)}`}` : "Not reachable with available depth"] as Row) });
  sec.push({ heading: "Warnings and limits", rows: [
    ...a.warnings.map((w) => ["Warning", w] as Row),
    ["Variability", "The historical-variability input drives only the stress case. It does not model the distribution of operating losses; the multi-level loss model does."],
    ["Basis risk", "Your business losses and the contract's settlement are not perfectly linked. The business can lose money while the contract pays nothing."],
    ["Worthless expiry", `The contract can expire worthless, losing the full ${d(m.cost)} entry cost.`],
    ["Not advice", "Independent research tool. Hypothetical outcomes, no guarantee of protection or profit, and not a recommendation to trade. Not affiliated with or endorsed by Kalshi. No trading functionality."],
  ] });
  return finish("HedgeNYC Business Hedge Calculator: research summary", sec);
}

function finish(title: string, sections: Summary["sections"]): Summary {
  const text = [title, ...sections.flatMap((x) => ["", x.heading.toUpperCase(), ...x.rows.map(([k, v]) => `- ${k}: ${v}`)])].join("\n");
  return { title, sections, text };
}
