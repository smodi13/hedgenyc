/** Server-only Kalshi public-API fetchers. Only tickers / public query params leave this server. No keys, no orders. */
import { buildContract, categoriesOf, parseEvents, parseFeeInfo, parseSeriesList, searchSeries, validTicker, type ContractInfo, type EventRow, type SeriesRow } from "./contract";

const BASE = "https://external-api.kalshi.com/trade-api/v2";
const get = async (path: string, ms = 4000): Promise<unknown> => {
  const res = await fetch(BASE + path, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(ms), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "error");

let seriesCache: { at: number; list: SeriesRow[] } | null = null;
async function seriesList(): Promise<SeriesRow[]> {
  if (seriesCache && Date.now() - seriesCache.at < 3_600_000) return seriesCache.list;
  const list = parseSeriesList(await get("/series", 9000));
  if (!list) throw new Error("malformed series list");
  seriesCache = { at: Date.now(), list };
  return list;
}

export interface SearchResult { status: "ok" | "unavailable"; fetchedAt: string; categories: string[]; events: EventRow[]; truncated: boolean; note: string | null }

export async function searchEvents(q: string, category: string | null): Promise<SearchResult> {
  const fetchedAt = new Date().toISOString();
  try {
    const list = await seriesList();
    const categories = categoriesOf(list);
    if (!q.trim() && !category) return { status: "ok", fetchedAt, categories, events: [], truncated: false, note: null };
    const hits = searchSeries(list, q, category, 13);
    const truncated = hits.length > 12;
    const settled = await Promise.allSettled(hits.slice(0, 12).map(async (s) => parseEvents(await get(`/events?series_ticker=${encodeURIComponent(s.ticker)}&status=open&with_nested_markets=true&limit=10`))));
    const events = settled.flatMap((r, i) => (r.status === "fulfilled" && r.value ? r.value.map((e) => ({ ...e, category: hits[i]!.category })) : []));
    const failed = settled.filter((r) => r.status === "rejected").length;
    return { status: "ok", fetchedAt, categories, events: events.slice(0, 30), truncated: truncated || events.length > 30, note: failed ? `${failed} series could not be loaded; results may be incomplete.` : events.length ? null : "No open markets matched. Try other words, or enter a ticker directly." };
  } catch (e) {
    return { status: "unavailable", fetchedAt, categories: [], events: [], truncated: false, note: `Market search is unavailable (${errMsg(e)}). You can still enter a ticker, or use a manual price.` };
  }
}

export interface MarketResult { status: "ok" | "not_found" | "invalid" | "unavailable"; contract: ContractInfo | null; note: string | null; siblings: EventRow["markets"] }

export async function fetchContract(ticker: string): Promise<MarketResult> {
  if (!validTicker(ticker)) return { status: "invalid", contract: null, note: "Tickers use capital letters, numbers, dots, dashes and underscores only.", siblings: [] };
  try {
    const mj = (await get(`/markets?tickers=${encodeURIComponent(ticker)}`)) as { markets?: unknown[] } | null;
    const row = Array.isArray(mj?.markets) ? mj.markets.find((x) => (x as { ticker?: unknown } | null)?.ticker === ticker) : undefined; // exact ticker only
    if (!row) return { status: "not_found", contract: null, note: `No market with ticker ${ticker} was returned.`, siblings: [] };
    const eventTicker = (row as { event_ticker?: string }).event_ticker ?? ticker.replace(/-[^-]+$/, "");
    const [ev, book] = await Promise.allSettled([get(`/events/${encodeURIComponent(eventTicker)}`), get(`/markets/${encodeURIComponent(ticker)}/orderbook`)]);
    const evj = ev.status === "fulfilled" ? (ev.value as { event?: { series_ticker?: string } }) : null;
    const seriesTicker = evj?.event?.series_ticker ?? null;
    let fee = null;
    if (seriesTicker) { try { fee = parseFeeInfo(await get(`/series/${encodeURIComponent(seriesTicker)}`)); } catch { /* fee stays unconfirmed */ } }
    const contract = buildContract(row, { seriesTicker, fee, book: book.status === "fulfilled" ? book.value : null, bookError: book.status === "rejected" ? errMsg(book.reason) : null });
    if (!contract) return { status: "unavailable", contract: null, note: "Malformed market response.", siblings: [] };
    const sibs = evj ? (parseEvents({ events: [{ ...(evj.event as object), markets: (ev.status === "fulfilled" ? (ev.value as { markets?: unknown[] }).markets : []) ?? [] }] })?.[0]?.markets ?? []) : [];
    return { status: "ok", contract, note: null, siblings: sibs };
  } catch (e) {
    return { status: "unavailable", contract: null, note: `Market data unavailable (${errMsg(e)}).`, siblings: [] };
  }
}
