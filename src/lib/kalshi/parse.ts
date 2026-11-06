/**
 * Pure parsers for Kalshi public API responses (fields per docs.kalshi.com:
 * GET /markets and GET /markets/{ticker}/orderbook → orderbook_fp). Returns null on malformed input —
 * callers must then show "unavailable", never a substitute value.
 */
import { z } from "zod";

const money = z.string().regex(/^\d+(\.\d+)?$/).transform(Number);

const MarketSchema = z.object({
  ticker: z.string().min(1),
  event_ticker: z.string().optional(),
  title: z.string().optional(),
  yes_sub_title: z.string().optional(),
  status: z.string().min(1),
  close_time: z.string().optional(),
  updated_time: z.string().optional(),
  result: z.string().optional(),
  yes_bid_dollars: money.optional(),
  yes_ask_dollars: money.optional(),
  yes_bid_size_fp: money.optional(),
  yes_ask_size_fp: money.optional(),
  last_price_dollars: money.optional(),
  volume_fp: money.optional(),
  open_interest_fp: money.optional(),
  rules_primary: z.string().optional(),
});

export interface ParsedMarket {
  ticker: string;
  eventTicker: string | null;
  title: string | null;
  status: string;
  closeTime: string | null;
  updatedTime: string | null;
  result: string | null;
  yesBid: number | null;
  yesAsk: number | null;
  yesBidSize: number | null;
  yesAskSize: number | null;
  last: number | null;
  volume: number | null;
  openInterest: number | null;
  rulesPrimary: string | null;
}

const n = (v: number | undefined) => (v === undefined ? null : v);
const s = (v: string | undefined) => (v === undefined || v === "" ? null : v);

export function parseMarkets(json: unknown): ParsedMarket[] | null {
  if (!json || typeof json !== "object" || !Array.isArray((json as { markets?: unknown }).markets)) return null;
  const out: ParsedMarket[] = [];
  for (const raw of (json as { markets: unknown[] }).markets) {
    const r = MarketSchema.safeParse(raw);
    if (!r.success) return null; // one malformed row invalidates the payload: fail closed
    const m = r.data;
    out.push({
      ticker: m.ticker, eventTicker: s(m.event_ticker), title: s(m.title), status: m.status,
      closeTime: s(m.close_time), updatedTime: s(m.updated_time), result: s(m.result),
      yesBid: n(m.yes_bid_dollars), yesAsk: n(m.yes_ask_dollars),
      yesBidSize: n(m.yes_bid_size_fp), yesAskSize: n(m.yes_ask_size_fp),
      last: n(m.last_price_dollars), volume: n(m.volume_fp), openInterest: n(m.open_interest_fp),
      rulesPrimary: s(m.rules_primary),
    });
  }
  return out;
}

const Level = z.tuple([money, money]);
const BookSchema = z.object({ orderbook_fp: z.object({ yes_dollars: z.array(Level), no_dollars: z.array(Level) }) });

export interface ParsedBook {
  empty: boolean;
  bestYesBid: number | null;
  bestYesBidSize: number | null;
  /** Implied YES ask = 1 − best NO bid (a NO bid is a YES offer) */
  impliedYesAsk: number | null;
  impliedYesAskSize: number | null;
  spread: number | null;
  yesLevels: number;
  noLevels: number;
}

const best = (levels: [number, number][]) => {
  const pos = levels.filter(([, q]) => q > 0);
  if (!pos.length) return null;
  return pos.reduce((a, b) => (b[0] > a[0] ? b : a));
};
const round4 = (x: number) => Math.round(x * 1e4) / 1e4;

export function parseOrderbook(json: unknown): ParsedBook | null {
  const r = BookSchema.safeParse(json);
  if (!r.success) return null;
  const { yes_dollars, no_dollars } = r.data.orderbook_fp;
  const y = best(yes_dollars);
  const nn = best(no_dollars);
  const ask = nn ? round4(1 - nn[0]) : null;
  return {
    empty: !y && !nn,
    bestYesBid: y ? y[0] : null,
    bestYesBidSize: y ? y[1] : null,
    impliedYesAsk: ask,
    impliedYesAskSize: nn ? nn[1] : null,
    spread: y && ask !== null ? round4(ask - y[0]) : null,
    yesLevels: yes_dollars.length,
    noLevels: no_dollars.length,
  };
}

/** Only an "active" market can have a live book; everything else is a historical reference. */
export const isActive = (status: string) => status === "active";
