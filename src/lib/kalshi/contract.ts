/** Pure parsers + types for the generic Kalshi contract selector. Public data only; fail closed on malformed payloads. */

export interface Level { price: number; size: number }

export interface ContractInfo {
  ticker: string; eventTicker: string; seriesTicker: string | null;
  title: string; subtitle: string | null; yesSub: string | null; noSub: string | null;
  status: string; closeTime: string | null; expirationTime: string | null;
  strikeType: string | null; floorStrike: number | null; capStrike: number | null;
  rulesPrimary: string | null; rulesSecondary: string | null;
  canCloseEarly: boolean | null; earlyCloseCondition: string | null;
  category: string | null;
  feeType: string | null; feeMultiplier: number | null;
  /** Executable ask ladders, ascending by price. YES asks come from NO bids, NO asks from YES bids. */
  yesAsks: Level[]; noAsks: Level[]; bookOk: boolean; bookNote: string | null;
  fetchedAt: string; url: string;
}

export interface EventRow {
  eventTicker: string; seriesTicker: string; title: string; subTitle: string | null; category: string | null;
  markets: { ticker: string; label: string; status: string; strikeType: string | null; floorStrike: number | null; capStrike: number | null; closeTime: string | null }[];
}

export const TICKER_RE = /^[A-Z0-9._-]{3,80}$/;
export const validTicker = (t: unknown): t is string => typeof t === "string" && TICKER_RE.test(t);

const round4 = (x: number) => Math.round(x * 1e4) / 1e4;
const str = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);
const numv = (v: unknown) => { const x = typeof v === "string" ? Number(v) : v; return typeof x === "number" && Number.isFinite(x) ? x : null; };
const rec = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

export const marketUrl = (ticker: string, eventTicker: string, series: string | null) =>
  series ? `https://kalshi.com/markets/${series.toLowerCase()}/${eventTicker.toLowerCase()}` : `https://kalshi.com/markets/${eventTicker.toLowerCase()}`;

/** Order book -> both ask ladders. Null when malformed. */
export function parseAskLadders(json: unknown): { yesAsks: Level[]; noAsks: Level[] } | null {
  const fp = rec(rec(json)?.orderbook_fp);
  if (!fp || !Array.isArray(fp.yes_dollars) || !Array.isArray(fp.no_dollars)) return null;
  const conv = (rows: unknown[]): Level[] | null => {
    const out: Level[] = [];
    for (const r of rows) {
      if (!Array.isArray(r) || r.length < 2) return null;
      const b = numv(r[0]), q = numv(r[1]);
      if (b === null || q === null) return null;
      const price = round4(1 - b), size = Math.floor(q);
      if (size >= 1 && price > 0 && price < 1) out.push({ price, size });
    }
    return out.sort((a, b) => a.price - b.price);
  };
  const noAsks = conv(fp.yes_dollars as unknown[]), yesAsks = conv(fp.no_dollars as unknown[]);
  return noAsks && yesAsks ? { yesAsks, noAsks } : null;
}

export function parseFeeInfo(json: unknown): { feeType: string | null; feeMultiplier: number | null; category: string | null } {
  const s = rec(rec(json)?.series);
  const m = numv(s?.fee_multiplier);
  return { feeType: str(s?.fee_type), feeMultiplier: m !== null && m >= 0 ? m : null, category: str(s?.category) };
}

/** Build a ContractInfo from /markets row + optional extras. Returns null when the market row is unusable. */
export function buildContract(m: unknown, ctx: { seriesTicker: string | null; fee: ReturnType<typeof parseFeeInfo> | null; book: unknown | null; bookError: string | null; now?: Date }): ContractInfo | null {
  const r = rec(m);
  const ticker = str(r?.ticker), status = str(r?.status);
  if (!r || !ticker || !status) return null;
  const eventTicker = str(r.event_ticker) ?? ticker.replace(/-[^-]+$/, "");
  const ladders = ctx.book === null ? null : parseAskLadders(ctx.book);
  const bookNote = ctx.book === null ? `Order book unavailable (${ctx.bookError ?? "error"}).` : ladders === null ? "Order book response was malformed; depth unavailable." : null;
  const ec = r.can_close_early;
  return {
    ticker, eventTicker, seriesTicker: ctx.seriesTicker, title: str(r.title) ?? ticker, subtitle: str(r.subtitle),
    yesSub: str(r.yes_sub_title), noSub: str(r.no_sub_title), status,
    closeTime: str(r.close_time), expirationTime: str(r.expiration_time),
    strikeType: str(r.strike_type), floorStrike: numv(r.floor_strike), capStrike: numv(r.cap_strike),
    rulesPrimary: str(r.rules_primary), rulesSecondary: str(r.rules_secondary),
    canCloseEarly: typeof ec === "boolean" ? ec : null, earlyCloseCondition: str(r.early_close_condition),
    category: ctx.fee?.category ?? null, feeType: ctx.fee?.feeType ?? null, feeMultiplier: ctx.fee?.feeMultiplier ?? null,
    yesAsks: ladders?.yesAsks ?? [], noAsks: ladders?.noAsks ?? [], bookOk: ladders !== null, bookNote,
    fetchedAt: (ctx.now ?? new Date()).toISOString(), url: marketUrl(ticker, eventTicker, ctx.seriesTicker),
  };
}

/** Event rows from /events?with_nested_markets=true. Rows without usable markets are dropped. */
export function parseEvents(json: unknown): EventRow[] | null {
  const ev = rec(json)?.events;
  if (!Array.isArray(ev)) return null;
  const out: EventRow[] = [];
  for (const e of ev) {
    const r = rec(e); const et = str(r?.event_ticker);
    if (!r || !et) continue;
    const ms = Array.isArray(r.markets) ? r.markets : [];
    const markets = ms.flatMap((x) => { const m = rec(x); const t = str(m?.ticker), st = str(m?.status); return m && t && st ? [{ ticker: t, label: str(m.yes_sub_title) ?? str(m.subtitle) ?? t, status: st, strikeType: str(m.strike_type), floorStrike: numv(m.floor_strike), capStrike: numv(m.cap_strike), closeTime: str(m.close_time) }] : []; });
    if (!markets.length) continue;
    out.push({ eventTicker: et, seriesTicker: str(r.series_ticker) ?? et.split("-")[0]!, title: str(r.title) ?? et, subTitle: str(r.sub_title), category: str(r.category), markets });
  }
  return out;
}

export interface SeriesRow { ticker: string; title: string; category: string; tags: string[] }
export function parseSeriesList(json: unknown): SeriesRow[] | null {
  const a = rec(json)?.series;
  if (!Array.isArray(a)) return null;
  return a.flatMap((x) => { const r = rec(x); const t = str(r?.ticker), ti = str(r?.title); return r && t && ti ? [{ ticker: t, title: ti, category: str(r.category) ?? "Other", tags: Array.isArray(r.tags) ? r.tags.filter((g): g is string => typeof g === "string") : [] }] : []; });
}

/** Token search over series title/ticker/category/tags. Every query token must match. */
export function searchSeries(list: SeriesRow[], q: string, category: string | null, limit: number): SeriesRow[] {
  const toks = q.toLowerCase().split(/\s+/).filter(Boolean);
  const out: SeriesRow[] = [];
  for (const s of list) {
    if (category && s.category !== category) continue;
    const hay = `${s.title} ${s.ticker} ${s.category} ${s.tags.join(" ")}`.toLowerCase();
    if (toks.every((t) => hay.includes(t))) { out.push(s); if (out.length >= limit) break; }
  }
  return out;
}

export const categoriesOf = (list: SeriesRow[]) => {
  const c = new Map<string, number>();
  for (const s of list) c.set(s.category, (c.get(s.category) ?? 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1]).map(([name]) => name);
};
