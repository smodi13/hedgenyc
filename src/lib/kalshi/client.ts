/** Server-side only. Read-only public endpoints; no keys, no private data, no order placement. */
import { marketsFile } from "../research/load";
import { parseMarkets, parseOrderbook, isActive, type ParsedBook, type ParsedMarket } from "./parse";

const BASE = "https://external-api.kalshi.com/trade-api/v2";
const DEADLINE_MS = 3000;

export type RecordState = "market" | "group" | "not_found" | "error";

export interface SnapshotItem {
  researchId: string;
  event: string;
  sourceUrl: string;
  settlementProxy: string;
  basisMismatch: string;
  state: RecordState;
  market: ParsedMarket | null;
  book: ParsedBook | null;
  bookNote: string | null;
  group: { by: "event" | "series"; count: number; capped: boolean; statuses: Record<string, number> } | null;
  error: string | null;
}

export interface Snapshot {
  fetchedAt: string;
  status: "ok" | "partial" | "unavailable";
  items: SnapshotItem[];
  source: string;
}

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(BASE + path, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(DEADLINE_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const q = encodeURIComponent;

async function resolve(rec: (typeof marketsFile.markets)[number]): Promise<SnapshotItem> {
  const base: SnapshotItem = {
    researchId: rec.id, event: rec.event, sourceUrl: rec.source_url, settlementProxy: rec.settlement_proxy,
    basisMismatch: rec.basis_mismatch, state: "not_found", market: null, book: null, bookNote: null, group: null, error: null,
  };
  try {
    const exact = parseMarkets(await getJson(`/markets?tickers=${q(rec.id)}`));
    if (exact === null) return { ...base, state: "error", error: "Malformed response from market endpoint." };
    const hit = exact.find((m) => m.ticker === rec.id);
    if (hit) {
      let book: ParsedBook | null = null;
      let bookNote: string | null = null;
      if (isActive(hit.status)) {
        try {
          book = parseOrderbook(await getJson(`/markets/${q(hit.ticker)}/orderbook`));
          if (!book) bookNote = "Order book response was malformed; depth unavailable.";
          else if (book.empty) bookNote = "Order book is empty: no resting bids or offers.";
        } catch (e) {
          bookNote = `Order book unavailable (${e instanceof Error ? e.message : "error"}).`;
        }
      } else bookNote = `Market status is "${hit.status}"; treated as a historical reference, no order book requested.`;
      return { ...base, state: "market", market: hit, book, bookNote };
    }
    for (const by of ["event", "series"] as const) {
      const list = parseMarkets(await getJson(`/markets?${by}_ticker=${q(rec.id)}&limit=100`));
      if (list && list.length) {
        const statuses: Record<string, number> = {};
        list.forEach((m) => (statuses[m.status] = (statuses[m.status] ?? 0) + 1));
        return { ...base, state: "group", group: { by, count: list.length, capped: list.length >= 100, statuses } };
      }
    }
    return base;
  } catch (e) {
    return { ...base, state: "error", error: e instanceof Error ? e.message : "Request failed." };
  }
}

export async function fetchSnapshot(): Promise<Snapshot> {
  const items = await Promise.all(marketsFile.markets.map(resolve));
  const errs = items.filter((i) => i.state === "error").length;
  return {
    fetchedAt: new Date().toISOString(),
    status: errs === items.length ? "unavailable" : errs > 0 ? "partial" : "ok",
    items,
    source: `${BASE}/markets`,
  };
}
