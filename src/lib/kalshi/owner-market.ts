/** Server-side builder for the Owner Lab market reference. Read-only public data; no keys, no orders. */
import { MARKET } from "../owner/model";
import { parseMarkets, parseNoAskLadder } from "./parse";

export interface OwnerMarket {
  fetchedAt: string;
  status: "ok" | "unavailable" | "not_found";
  ticker: string;
  title: string | null;
  marketStatus: string | null;
  closeTime: string | null;
  rulesPrimary: string | null;
  /** Rule text matches the modeled event ("strictly greater than 2 inches") */
  rulesMatch: boolean;
  levels: { price: number; size: number }[];
  /** Published series fee schedule type and multiplier (null if unavailable) */
  feeType: string | null;
  feeMultiplier: number | null;
  note: string | null;
  /** Ticker, status, rules and a non-empty NO ask ladder all check out */
  verified: boolean;
}

const BASE = "https://external-api.kalshi.com/trade-api/v2";
const get = async (path: string): Promise<unknown> => {
  const res = await fetch(BASE + path, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(3000), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/** Series fee schedule from GET /series/{ticker}. Only the quadratic general schedule is modeled. */
export function parseFee(json: unknown): { feeType: string | null; feeMultiplier: number | null } {
  const sr = (json as { series?: { fee_type?: unknown; fee_multiplier?: unknown } } | null)?.series;
  const m = sr?.fee_multiplier;
  return { feeType: typeof sr?.fee_type === "string" ? sr.fee_type : null, feeMultiplier: typeof m === "number" && Number.isFinite(m) && m >= 0 ? m : null };
}

export function buildOwnerMarket(marketJson: unknown, bookJson: unknown | null, bookError: string | null, seriesJson: unknown | null = null, now = new Date()): OwnerMarket {
  const base = { fetchedAt: now.toISOString(), ticker: MARKET.ticker, title: null, marketStatus: null, closeTime: null, rulesPrimary: null, rulesMatch: false, levels: [], feeType: null, feeMultiplier: null, note: null, verified: false };
  const list = parseMarkets(marketJson);
  if (list === null) return { ...base, status: "unavailable", note: "Malformed response from the market endpoint." };
  const m = list.find((x) => x.ticker === MARKET.ticker); // exact ticker only
  if (!m) return { ...base, status: "not_found", note: `No market with ticker ${MARKET.ticker} was returned.` };
  const rulesMatch = !!m.rulesPrimary && /strictly greater than 2 inches/i.test(m.rulesPrimary) && /O'Hare/i.test(m.rulesPrimary) && /December 2026/i.test(m.rulesPrimary);
  const fee = parseFee(seriesJson);
  const out = { ...base, ...fee, status: "ok" as const, title: m.title, marketStatus: m.status, closeTime: m.closeTime, rulesPrimary: m.rulesPrimary, rulesMatch };
  if (m.status !== "active") return { ...out, note: `Market status is "${m.status}", not open for trading.` };
  if (bookJson === null) return { ...out, note: `Order book unavailable (${bookError ?? "error"}).` };
  const levels = parseNoAskLadder(bookJson);
  if (levels === null) return { ...out, note: "Order book response was malformed; depth unavailable." };
  if (!levels.length) return { ...out, note: "No NO-side offers are resting in the order book." };
  if (fee.feeType !== "quadratic" || fee.feeMultiplier === null) return { ...out, levels, note: "Fee schedule for this series could not be confirmed as the general (quadratic) schedule, so fees cannot be modeled from live data." };
  return { ...out, levels, verified: rulesMatch };
}

export async function fetchOwnerMarket(): Promise<OwnerMarket> {
  try {
    const marketJson = await get(`/markets?tickers=${encodeURIComponent(MARKET.ticker)}`);
    let book: unknown | null = null, err: string | null = null;
    try { book = await get(`/markets/${encodeURIComponent(MARKET.ticker)}/orderbook`); } catch (e) { err = e instanceof Error ? e.message : "error"; }
    let series: unknown | null = null;
    try { series = await get(`/series/${encodeURIComponent(MARKET.series)}`); } catch { /* fee schedule stays unconfirmed */ }
    return buildOwnerMarket(marketJson, book, err, series);
  } catch (e) {
    return { fetchedAt: new Date().toISOString(), status: "unavailable", ticker: MARKET.ticker, title: null, marketStatus: null, closeTime: null, rulesPrimary: null, rulesMatch: false, levels: [], feeType: null, feeMultiplier: null, note: `Market data unavailable (${e instanceof Error ? e.message : "error"}).`, verified: false };
  }
}
