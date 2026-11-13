/** One pure function turning a scenario + a selected contract into everything the UI, copy summary and print view show. */
import type { ContractInfo, EventRow, Level } from "../kalshi/contract";
import { pct as pctFmt, usd } from "../format";
import {
  buildCostTable, evaluate, fillOrder, maxAffordable, minContractsFor, optimize, sweep, breaches,
  OBJECTIVE_TEXT, type ChartPoint, type Ctx, type Ladder, type OptResult, type Position,
} from "./hedge";
import { CASE_LABEL, exposure, type CaseKey, type Exposure } from "./business";
import {
  distRows, EARLY_SETTLEMENT, FEE_COEF, FEE_SOURCE, MARKET, probState, protectedLoss, validate,
  type DistRow, type FieldErrors, type ProbState, type Scenario, type Side,
} from "./model";

export interface Selection {
  /** Ticker the owner chose; info is its latest public snapshot (null until loaded / on failure) */
  ticker: string; side: Side; info: ContractInfo | null; infoNote: string | null; loading: boolean;
  /** Other strikes of the same event, for the strike picker */
  siblings: EventRow["markets"];
  priceMode: "live" | "manual"; price: number;
  /** Highest price per contract the owner will pay in live mode. NaN = none. */
  priceCap: number;
}

export const defaultSelection = (): Selection => ({ ticker: MARKET.ticker, side: "no", info: null, infoNote: null, loading: true, siblings: [], priceMode: "manual", price: 0.22, priceCap: NaN });

export interface Check { id: string; label: string; status: "pass" | "fail" | "manual" | "unavailable"; detail: string }
export type SuitLabel = "Potentially aligned" | "Needs more information" | "Material mismatch" | "Insufficient information";
export interface Suitability { label: SuitLabel; items: { ok: boolean | null; text: string }[] }

export interface ProbStats { pLoss: number; pPayout: number; pLossNoPay: number; pPayGivenLoss: number | null }
export function probStats(d: DistRow[]): ProbStats {
  const L = d.filter((r) => r.loss > 0);
  const pLossNoPay = L.reduce((a, r) => a + r.loses, 0), pLossPay = L.reduce((a, r) => a + r.pays, 0), pLoss = pLossNoPay + pLossPay;
  return { pLoss, pPayout: d.reduce((a, r) => a + r.pays, 0), pLossNoPay, pPayGivenLoss: pLoss > 0 ? pLossPay / pLoss : null };
}

export const SCENARIO_LABEL = "Scenario-based optimization. Execution not verified.";
export const LIQUIDITY_MSG = "Insufficient displayed liquidity for this proposed position.";
export const MANUAL_LABEL = "Illustrative only. Not an executable quote.";

/* ---------- contract helpers ---------- */

export const sideName = (side: Side) => (side === "no" ? "NO" : "YES");
export const asksFor = (info: ContractInfo, side: Side): Level[] => (side === "yes" ? info.yesAsks : info.noAsks);

/** The calendar month a market settles for: close time minus a day (markets close just after the period ends). */
export function marketMonth(info: ContractInfo): string | null {
  const t = Date.parse(info.closeTime ?? info.expirationTime ?? "");
  if (!Number.isFinite(t)) return null;
  return new Date(t - 86_400_000).toISOString().slice(0, 7);
}

export function strikeText(info: ContractInfo): string {
  const f = info.floorStrike, c = info.capStrike;
  const t = info.strikeType;
  if (t === "greater" && f !== null) return `above ${f}`;
  if (t === "greater_or_equal" && f !== null) return `${f} or more`;
  if (t === "less" && c !== null) return `below ${c}`;
  if (t === "less_or_equal" && c !== null) return `${c} or less`;
  if (t === "between" && f !== null && c !== null) return `between ${f} and ${c}`;
  return info.yesSub ?? "see official rules";
}

export function earlySettlementText(info: ContractInfo | null): string {
  if (!info) return "Early-close terms are unavailable until a contract loads. Read the official rules.";
  if (info.ticker === MARKET.ticker) return EARLY_SETTLEMENT;
  if (info.canCloseEarly === false) return "The market data does not indicate an early close. Read the official rules for the exact settlement terms.";
  if (info.canCloseEarly === null) return "Whether this contract can close early is not stated in the market data. Read the official rules.";
  return `This contract can close before its scheduled end${info.earlyCloseCondition ? `: ${info.earlyCloseCondition}` : ""}. A position can settle earlier than expected, and a losing side can expire worthless before the period ends.`;
}

/** Which business case a side of the contract pays in, assuming activity moves with the underlying amount (snow). null = cannot tell. */
function paysInLowActivity(info: ContractInfo, side: Side): boolean | null {
  const t = info.strikeType;
  const yesWhenHigh = t === "greater" || t === "greater_or_equal" ? true : t === "less" || t === "less_or_equal" ? false : null;
  if (yesWhenHigh === null) return null;
  return side === "no" ? yesWhenHigh : !yesWhenHigh;
}

export function suitability(s: Scenario, sel: Selection): Suitability {
  const info = sel.info, p = s.profile, items: Suitability["items"] = [];
  if (!info) return { label: "Insufficient information", items: [{ ok: null, text: "No contract is loaded, so nothing can be screened." }] };
  let mismatch = false, need = false, insufficient = false;
  const text = `${info.title} ${info.subtitle ?? ""} ${info.yesSub ?? ""} ${info.rulesPrimary ?? ""} ${info.rulesSecondary ?? ""}`.toLowerCase();
  if (!info.rulesPrimary) { insufficient = true; items.push({ ok: null, text: "Official settlement rules were not returned, so the contract cannot be screened." }); }
  // topic
  if (/snow/i.test(p.industry)) {
    const t = /snow|snowfall/.test(text);
    items.push({ ok: t, text: t ? "The contract settles on snowfall, which is related to a snow-removal business." : "The contract is not about snowfall, so it is unrelated to a snow-removal business's activity." });
    if (!t) mismatch = true;
  } else { need = true; items.push({ ok: null, text: "The link between this contract and your industry has not been checked. Confirm it moves with your revenue." }); }
  // location
  const city = p.city.trim().toLowerCase();
  const locHit = !!city && text.includes(city);
  if (locHit || s.confirmLocation) items.push({ ok: true, text: locHit ? `The contract text names ${p.city}.` : "You confirmed the contract's location represents your service area." });
  else { mismatch = !!city; need = true; items.push({ ok: false, text: city ? `The contract text does not name ${p.city}. Confirm its location represents your service area, or choose another contract.` : "Enter your city so the contract's location can be compared." }); }
  // period
  const mm = marketMonth(info);
  if (!mm) { need = true; items.push({ ok: null, text: "The contract's settlement period could not be determined." }); }
  else if (mm === p.period) items.push({ ok: true, text: `The contract settles for ${mm}, matching your modeling period.` });
  else { mismatch = true; items.push({ ok: false, text: `The contract settles for ${mm}, but your modeling period is ${p.period}.` }); }
  // direction
  const pl = paysInLowActivity(info, sel.side);
  if (pl === null) { need = true; items.push({ ok: null, text: "This contract's payout direction could not be read from its structure. Check which outcome pays against your loss." }); }
  else {
    const hedgesLow = p.hedgeCase === "low", aligned = pl === hedgesLow;
    items.push({ ok: aligned, text: aligned ? `${sideName(sel.side)} pays in the ${hedgesLow ? "low" : "high"}-activity outcome you are hedging.` : `${sideName(sel.side)} pays in the ${hedgesLow ? "high" : "low"}-activity outcome, not the ${hedgesLow ? "low" : "high"}-activity outcome you are hedging.` });
    if (!aligned) mismatch = true;
  }
  // threshold
  if (s.confirmThreshold) items.push({ ok: true, text: `You confirmed the threshold (${strikeText(info)}) is meaningful for your business.` });
  else { need = true; items.push({ ok: null, text: `Threshold: ${strikeText(info)}. Confirm this is a level that matters for your revenue.` }); }
  // status
  if (info.status !== "active") { mismatch = true; items.push({ ok: false, text: `The market's status is "${info.status}", not open for trading.` }); }
  else items.push({ ok: true, text: "The market is open." });
  // always-on
  items.push({ ok: info.canCloseEarly === true ? false : info.canCloseEarly === false ? true : null, text: info.canCloseEarly ? "This contract can close early. The side you hold can end before the period does." : "No early close is indicated in the market data. Confirm in the official rules." });
  items.push({ ok: false, text: "Your business can lose money while this contract expires worthless. A contract is not a match to your actual revenue." });
  return { label: insufficient ? "Insufficient information" : mismatch ? "Material mismatch" : need ? "Needs more information" : "Potentially aligned", items };
}

/* ---------- main analysis ---------- */

export interface Sizing {
  mode: Scenario["sizeMode"];
  position: Position;
  status: "ok" | "none" | "needs-input" | "infeasible";
  headline: string; reason: string;
  /** Contracts the plan would need ignoring displayed depth (for the liquidity message) */
  theoretical: number | null;
  required: Position | null;
}

export interface Liquidity {
  requested: number; available: number; bestAsk: number | null; avgPrice: number | null; complete: boolean; maxSupported: number;
  fetchedAt: string | null; message: string | null;
}

export interface Analysis {
  valid: boolean; errors: FieldErrors; exposure: Exposure; loss: number; target: number;
  probs: ProbState; stats: ProbStats | null;
  priceSource: "live" | "manual"; liveOk: boolean; liveNote: string | null; feeMult: number | null;
  ctx: Ctx | null; sizing: Sizing | null; opt: OptResult | null;
  liquidity: Liquidity | null; execution: "verified-snapshot" | "unavailable" | "unknown";
  chart: ChartPoint[]; checks: Check[]; suit: Suitability; warnings: string[]; early: string;
  /** Position the owner would see (sizing mode) and the baseline of doing nothing */
  baseline: Position | null;
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function analyze(s: Scenario, sel: Selection): Analysis {
  const errors = { ...validate(s) };
  const manual = sel.priceMode === "manual";
  if (manual && !(sel.price >= 0.01 && sel.price <= 0.99)) errors.price = "Price must be between $0.01 and $0.99.";
  if (!manual && !Number.isNaN(sel.priceCap) && !(sel.priceCap > 0 && sel.priceCap < 1)) errors.priceCap = "Price cap must be between $0.01 and $0.99, or blank.";
  const ex = exposure(s.profile), valid = Object.keys(errors).length === 0;
  const loss = valid ? protectedLoss(s, ex) : 0, target = loss * s.coverage;
  const probs = probState(s), suit = suitability(s, sel), early = earlySettlementText(sel.info);
  const info = sel.info;
  // live price eligibility: open market, good book, a recognised quadratic fee schedule, some asks
  let liveNote: string | null = null;
  if (!manual) {
    if (!info) liveNote = sel.infoNote ?? (sel.loading ? "Loading the contract's order book…" : "Live market data has not loaded.");
    else if (info.status !== "active") liveNote = `Market status is "${info.status}", not open for trading.`;
    else if (!info.bookOk) liveNote = info.bookNote ?? "Order book unavailable.";
    else if (info.feeType !== "quadratic" || info.feeMultiplier === null) liveNote = "The fee schedule for this series could not be confirmed as the general (quadratic) schedule, so fees cannot be modeled from live data.";
    else if (!asksFor(info, sel.side).length) liveNote = `No ${sideName(sel.side)} offers are resting in the order book.`;
  }
  const liveOk = !manual && liveNote === null;
  const feeMult = manual ? s.feeMult : info?.feeType === "quadratic" ? info.feeMultiplier : null;
  const base: Analysis = {
    valid, errors, exposure: ex, loss, target, probs, stats: null, priceSource: manual ? "manual" : "live", liveOk, liveNote, feeMult,
    ctx: null, sizing: null, opt: null, liquidity: null, execution: manual ? "unknown" : liveOk ? "verified-snapshot" : "unavailable",
    chart: [], checks: [], suit, warnings: [], early, baseline: null,
  };
  if (!valid) return base;

  const capped = (l: Level[]) => (Number.isNaN(sel.priceCap) ? l : l.filter((x) => x.price <= sel.priceCap + 1e-9));
  // Live without a verified book means zero depth. The manual price is never substituted.
  const fullAsks = info && !manual ? asksFor(info, sel.side) : [];
  const ladder: Ladder = manual ? null : liveOk ? capped(fullAsks) : [];
  const mult = feeMult ?? 0;
  const bestAsk = fullAsks[0]?.price ?? null;
  const table = buildCostTable(manual ? sel.price : (ladder?.[0]?.price ?? 0.5), ladder, mult);
  const dist = distRows(probs, loss);
  const ctx: Ctx = { loss, table, dist, budget: s.budget, maxTradingLoss: s.maxTradingLoss, positionLimit: s.positionLimit, maxCoverage: s.maxCoverage, variability: s.variability };
  // same limits, unlimited depth at the best ask: tells depth shortfalls apart from budget shortfalls
  const free = !manual && liveOk && bestAsk !== null ? { ...ctx, table: buildCostTable(bestAsk, null, mult) } : null;
  const stats = dist ? probStats(dist) : null;
  const baseline = evaluate(0, ctx);
  const warn: string[] = [];
  let sizing: Sizing, opt: OptResult | null = null;
  const none = (mode: Scenario["sizeMode"], status: Sizing["status"], headline: string, reason: string): Sizing => ({ mode, position: baseline, status, headline, reason, theoretical: null, required: null });
  const lowLoss = loss <= 0;

  if (s.sizeMode === "budget") {
    if (!Number.isFinite(s.budget)) sizing = none("budget", "needs-input", "Enter the most you want to spend.", "Enter a maximum upfront spend to see how many whole contracts it buys.");
    else {
      const m = maxAffordable(ctx), th = free ? maxAffordable(free).contracts : null;
      const p = evaluate(m.contracts, ctx);
      const why: Record<typeof m.binding, string> = { budget: "your upfront budget", loss: "your maximum trading loss", position: "your position limit", coverage: "your coverage cap", depth: "the displayed order-book depth", ceiling: "the calculator's size ceiling" };
      sizing = { mode: "budget", position: p, status: m.contracts > 0 ? "ok" : "none", theoretical: th, required: null,
        headline: m.contracts > 0 ? `Your budget supports up to ${fmt(m.contracts)} whole contracts.` : "Your limits do not allow even one contract at this price.",
        reason: m.contracts > 0 ? `The most whole contracts inside every limit you entered. Size is limited by ${why[m.binding]}. No target protection level was forced.` : `Not even one contract fits inside ${why[m.binding]}.` };
    }
  } else if (s.sizeMode === "protect") {
    const need = minContractsFor([target], table)[0] ?? null;
    const thNeed = free ? (minContractsFor([target], free.table)[0] ?? null) : null;
    if (lowLoss) sizing = none("protect", "none", "No modeled loss to protect.", "The entered information models no loss, so no hedge is needed. Zero contracts.");
    else if (need === null) sizing = { ...none("protect", "infeasible", "No valid position.", !manual && !liveOk ? (liveNote ?? "Live pricing is unavailable.") : thNeed !== null ? LIQUIDITY_MSG : "No whole-contract position reaches this target with the available price and depth."), theoretical: thNeed };
    else if (need === 0) sizing = none("protect", "none", "A 0% target needs no contracts.", "Target protection of $0 is met with zero contracts.");
    else {
      const p = evaluate(need, ctx), br = breaches(p, ctx);
      sizing = br.length
        ? { mode: "protect", position: baseline, status: "infeasible", headline: "No valid position.", reason: `Protecting ${pctFmt(s.coverage, 0)} of the modeled loss needs ${fmt(need)} contracts, which ${br.join(" and ")}.`, theoretical: need, required: p }
        : { mode: "protect", position: p, status: "ok", headline: `${fmt(need)} contracts reach your ${pctFmt(s.coverage, 0)} protection target.`, reason: `The smallest whole-contract position whose net winning profit is at least ${usd(target)} (${pctFmt(s.coverage, 0)} of the modeled loss). Your entered percentage is a target, not an optimum.`, theoretical: need, required: p };
    }
  } else {
    opt = optimize(s.objective, ctx, target);
    sizing = { mode: "risk", position: opt.position, status: opt.status === "ok" ? (opt.position.contracts > 0 ? "ok" : "none") : opt.status === "infeasible" ? "infeasible" : "needs-input", theoretical: null, required: opt.required,
      headline: opt.status === "ok" ? (opt.position.contracts > 0 ? `${fmt(opt.position.contracts)} contracts minimize risk under your probabilities.` : "Buying nothing minimizes risk under your probabilities.") : opt.status === "infeasible" ? "No feasible hedge." : "More information is needed.", reason: opt.why };
  }
  if (s.sizeMode !== "risk" && dist) opt = optimize(s.objective, ctx, target);

  const p = sizing.position;
  let liq: Liquidity | null = null;
  if (!manual) {
    const avail = (ladder ?? []).reduce((a, l) => a + l.size, 0);
    const requested = sizing.theoretical ?? p.contracts;
    const complete = liveOk && requested <= avail;
    const f = p.contracts > 0 ? fillOrder(p.contracts, 0, ladder, mult) : null;
    liq = { requested, available: avail, bestAsk, avgPrice: f?.avgPrice ?? null, complete, maxSupported: Math.min(requested, avail), fetchedAt: info?.fetchedAt ?? null,
      message: !liveOk ? liveNote : complete ? null : LIQUIDITY_MSG };
  }
  if (lowLoss) warn.push("No loss is modeled from the entered information, so a contract would be speculation rather than a hedge.");
  if (probs.kind === "ok" && probs.source === "illustrative") warn.push("Probabilities are an illustrative placeholder, not history. Results demonstrate the method; they are not a personalized estimate.");
  if (dist && !Number.isNaN(s.lowSnowProb) && Math.abs(s.lowSnowProb - probStats(dist).pLoss) > 0.005) warn.push(`Your stated low-activity probability (${pctFmt(s.lowSnowProb, 1)}) differs from the business-loss probability implied by your states (${pctFmt(probStats(dist).pLoss, 1)}).`);
  if (p.exceedsLoss) warn.push(`Winning payout exceeds modeled loss: net winning profit is ${usd(p.netWin)} against a ${usd(loss)} loss. If the business has no loss but the contract pays, you keep ${usd(p.outcomes.noLossPays)}.`);
  if (manual) warn.push(`${MANUAL_LABEL} Contract counts are theoretical; execution feasibility is unknown.`);
  if (!manual && liveNote) warn.push(`Live pricing is unavailable: ${liveNote} The manual price is not substituted.`);

  return { ...base, stats, ctx, sizing, opt, liquidity: liq, chart: sweep(ctx), checks: executionChecks(s, sel, ladder, mult, p, liveOk, liveNote), warnings: warn, baseline };
}

export function executionChecks(s: Scenario, sel: Selection, ladder: Ladder, mult: number, p: Position, liveOk: boolean, liveNote: string | null): Check[] {
  const info = sel.info, out: Check[] = [];
  const un = (id: string, label: string, detail = sel.infoNote ?? "Contract data has not loaded."): Check => ({ id, label, status: "unavailable", detail });
  out.push(!info ? un("open", "Market is open") : info.status === "active" ? { id: "open", label: "Market is open", status: "pass", detail: `Status "active" at ${info.fetchedAt}.` } : { id: "open", label: "Market is open", status: "fail", detail: `Status is "${info.status}".` });
  out.push(!info ? un("side", "Contract and side") : { id: "side", label: "Contract and side", status: "pass", detail: `Exact ticker ${info.ticker}; side ${sideName(sel.side)} (${sel.side === "yes" ? info.yesSub ?? "the YES condition" : info.noSub ?? "the YES condition is false"}).` });
  out.push(!info?.rulesPrimary ? un("rules", "Settlement rules", "The official rules were not returned.") : { id: "rules", label: "Settlement rules", status: "manual", detail: "Official rules are shown verbatim. Read them, including secondary rules and the data source, before relying on this." });
  if (sel.priceMode === "manual") out.push({ id: "depth", label: "Order-book depth", status: "manual", detail: "Manual price selected. Depth is not checked against the book." });
  else if (!liveOk || !ladder || !ladder.length) out.push(un("depth", "Order-book depth", liveNote ?? "No asks are available."));
  else if (p.contracts === 0) out.push({ id: "depth", label: "Order-book depth", status: "manual", detail: "Proposed size is 0 contracts." });
  else {
    const f = fillOrder(p.contracts, 0, ladder, mult), best = ladder[0]!.price;
    out.push(f.complete
      ? { id: "depth", label: "Order-book depth", status: "pass", detail: `${fmt(p.contracts)} contracts fill across ${f.levels.length} price level(s) at an average ${usd(f.avgPrice!, 4)}; best ask ${usd(best, 2)}.` }
      : { id: "depth", label: "Order-book depth", status: "fail", detail: `Only ${fmt(f.filled)} of ${fmt(p.contracts)} contracts are available (best ask ${usd(best, 2)}).` });
    if (f.complete) out.push({ id: "slip", label: "Slippage and fees on fills", status: "manual", detail: `Average fill ${usd(f.avgPrice!, 4)} vs best ask ${usd(best, 2)}; fee ${usd(f.fee, 4)}; total cash ${usd(f.cost, 4)}. A snapshot, not a guaranteed fill.` });
  }
  out.push(!info || info.feeMultiplier === null || sel.priceMode === "manual"
    ? { id: "fee", label: "Fee schedule", status: "manual", detail: `Using multiplier M = ${mult} entered by you; confirm it for this market. Fee = M × ${FEE_COEF} × C × P × (1−P), fee + cost rounded up to $0.0001 (${FEE_SOURCE.label}).` }
    : { id: "fee", label: "Fee schedule", status: info.feeType === "quadratic" ? "pass" : "fail", detail: `Series fee type "${info.feeType}", multiplier ${info.feeMultiplier}. Fee = M × ${FEE_COEF} × C × P × (1−P), rounded up to $0.0001.` });
  out.push({ id: "budget", label: "Owner limits", status: p.budgetOk === null ? "manual" : p.budgetOk && p.lossCapOk !== false ? "pass" : "fail", detail: p.budgetOk === null ? "No budget entered." : p.budgetOk && p.lossCapOk !== false ? `Cost ${usd(p.cost)} fits your limits.` : `Cost ${usd(p.cost)} exceeds your limits.` });
  out.push({ id: "limits", label: "Account minimums and position limits", status: s.positionLimit > 0 ? (p.positionOk ? "pass" : "fail") : "manual", detail: s.positionLimit > 0 ? `Your entered limit is ${fmt(s.positionLimit)} contracts.` : "Account-specific minimums and limits are not available from public data. Not verified." });
  out.push({ id: "source", label: "Price source", status: liveOk ? "manual" : "fail", detail: liveOk ? "Order-book snapshot. Still not a guaranteed price." : MANUAL_LABEL });
  return out;
}

/* ---------- copy / print summary ---------- */

type Row = [string, string];
export interface Summary { title: string; sections: { heading: string; rows: Row[] }[]; text: string }
const d = (n: number) => usd(n);
const none = "Not provided";
const TITLE = "HedgeNYC Business Hedge Builder: research summary";

export function buildSummary(s: Scenario, a: Analysis, sel: Selection, now: Date | null = new Date()): Summary {
  const p = s.profile, e = a.exposure, sec: Summary["sections"] = [];
  const ver = { illustrative: "Illustrative defaults (not verified)", "owner-reported": "Owner-reported, not independently verified", documented: "Documented by owner records" }[p.verification];
  sec.push({ heading: "Business", rows: [["Name", p.name], ["Location", [p.city, p.state].filter(Boolean).join(", ") || none], ["Industry", p.industry || none], ["Modeling period", p.period], ["Assumption verification", ver], ...(now ? [["Generated", now.toISOString()] as Row] : []), ["Notes", p.notes || "None"]] });
  sec.push({ heading: "Public facts and unverified assumptions", rows: [
    ["Public facts", p.publicFacts ? "Pay-per-push billing; residential service from $60; no flat seasonal snow contracts; commercial, salting/ice and property-maintenance services. (From the company's public information.)" : "None attached to this profile"],
    ["Unverified assumptions", "Every customer count, visit count, price, margin, cost and limit below is owner-entered or illustrative and is not independently verified."],
    ["Billing", p.seasonalEnabled && !p.publicFacts ? `Per-visit plus owner-entered fixed seasonal revenue of ${d(p.seasonalRevenue)} kept regardless of activity` : "Per-visit only (no seasonal contracts assumed)"],
  ] });
  if (!a.valid) { sec.push({ heading: "Status", rows: [["Result", "Inputs are invalid, so no financial results are shown."], ...Object.entries(a.errors).map(([k, v]) => [k, String(v)] as Row)] }); return fin(sec); }
  sec.push({ heading: `Activity cases (${p.mode === "quick" ? "quick: owner-entered margin" : "detailed: revenue minus variable costs"})`, rows: (["low", "normal", "high"] as CaseKey[]).map((k) => [CASE_LABEL[k], `revenue ${d(e[k].revenue)}, variable costs ${d(e[k].variableCosts)}, contribution ${d(e[k].contribution)}${e[k].marginPct === null ? "" : ` (${pctFmt(e[k].marginPct!, 1)})`}, fixed costs ${d(e[k].fixedCosts)}, operating income ${d(e[k].operatingIncome)}, contribution vs normal ${d(e[k].contributionVsNormal)}`] as Row) });
  sec.push({ heading: "Financial exposure (hypothetical)", rows: [["Low-activity shortfall", d(e.shortfallLow)], ["High-activity shortfall", d(e.shortfallHigh)], ["Loss being protected against", d(a.loss) + (s.useOverride ? " (owner override)" : ` (${p.hedgeCase} case)`)]] });
  const i = sel.info, sz = a.sizing!, pos = sz.position;
  sec.push({ heading: "Contract", rows: [
    ["Contract", i ? `${i.ticker}: ${i.title} (${strikeText(i)})` : sel.ticker], ["Side", sideName(sel.side)], ["Official URL", i?.url ?? none],
    ["Settlement rules", i?.rulesPrimary ?? "Unavailable"], ...(i?.rulesSecondary ? [["Secondary rules", i.rulesSecondary] as Row] : []),
    ["Early settlement", a.early],
    ["Pricing source", a.priceSource === "live" ? `Live order-book snapshot, retrieved ${i?.fetchedAt ?? "n/a"} (not guaranteed)` : MANUAL_LABEL + ` Price entered: ${usd(sel.price, 2)}`],
    ["Fee rule", `round_up(M x ${FEE_COEF} x contracts x price x (1 - price)); fee + cost rounded up to $0.0001; M = ${a.feeMult ?? "unknown"}. ${FEE_SOURCE.label}: ${FEE_SOURCE.url}`],
  ] });
  const sizeName = { budget: "Budget-first: how much can I afford", protect: `Protection-first: ${pctFmt(s.coverage, 0)} of modeled loss`, risk: "Risk-reducing hedge (probability-based)" }[s.sizeMode];
  const res: Row[] = [["Sizing mode", sizeName], ["Result", `${sz.headline} ${sz.reason}`]];
  if (sz.status === "ok" || sz.status === "none") res.push(
    ["Contracts", fmt(pos.contracts)], ["Principal", d(pos.premium)], ["Estimated fees", d(pos.fee)], ["Total cash at risk", d(pos.cost)], ["Winning payout (gross)", d(pos.contracts)], ["Net profit if the contract wins", d(pos.netWin)],
    ["Loss if the contract expires worthless", d(pos.cost)], ["Share of modeled loss offset", pos.coverage === null ? "n/a" : pctFmt(pos.coverage, 1)],
    ["Your business loses revenue, and the contract pays", `${d(pos.outcomes.lossPays)} (no hedge ${d(-a.loss)})`], ["Your business loses revenue, and the contract does not pay", `${d(pos.outcomes.lossLoses)} (no hedge ${d(-a.loss)})`],
    ["Your business is fine, and the contract pays", `${d(pos.outcomes.noLossPays)} (no hedge $0.00)`], ["Your business is fine, and the contract does not pay", `${d(pos.outcomes.noLossLoses)} (no hedge $0.00)`]);
  if (a.liquidity) res.push(["Liquidity", a.liquidity.message ?? `${fmt(a.liquidity.available)} contracts displayed within your price limit; best ask ${a.liquidity.bestAsk === null ? "n/a" : usd(a.liquidity.bestAsk, 2)}`]);
  sec.push({ heading: "Hedge result", rows: res });
  sec.push({ heading: "Suitability screening (not a recommendation)", rows: [["Screen", a.suit.label], ...a.suit.items.map((x) => [x.ok === true ? "Check" : x.ok === false ? "Flag" : "Open", x.text] as Row)] });
  if (a.opt && a.opt.status === "ok" && a.stats) {
    const o = a.opt;
    sec.push({ heading: "Analyst: probability-based optimization", rows: [["Objective", `${OBJECTIVE_TEXT[o.objective].name}: ${OBJECTIVE_TEXT[o.objective].math}`], ["Contracts", fmt(o.position.contracts)], ["Why", o.why], ["Chance of business loss / payout / loss without payout", `${pctFmt(a.stats.pLoss, 1)} / ${pctFmt(a.stats.pPayout, 1)} / ${pctFmt(a.stats.pLossNoPay, 1)}`]] });
  }
  sec.push({ heading: "Limits and warnings", rows: [...a.warnings.map((w) => ["Warning", w] as Row),
    ["Basis risk", "Your business losses and the contract's settlement are not perfectly linked. The business can lose money while the contract pays nothing."],
    ["Not advice", "Independent research. Hypothetical outcomes, no guarantee of protection or profit, and not a recommendation to trade. Not affiliated with or endorsed by Kalshi. No trade execution."]] });
  return fin(sec);
}

function fin(sections: Summary["sections"]): Summary {
  const text = [TITLE, ...sections.flatMap((x) => ["", x.heading.toUpperCase(), ...x.rows.map(([k, v]) => `- ${k}: ${v}`)])].join("\n");
  return { title: TITLE, sections, text };
}
