import { describe, expect, it } from "vitest";
import { isActive, parseMarkets, parseOrderbook } from "@/lib/kalshi/parse";

const market = {
  ticker: "KXRAINWKND-26NOV07-NYC", status: "active", yes_bid_dollars: "0.1900", yes_ask_dollars: "0.2000",
  yes_ask_size_fp: "100.00", last_price_dollars: "0.2000", volume_fp: "10.5", open_interest_fp: "1715.79", close_time: "2026-11-09T05:00:00Z",
};

describe("parseMarkets", () => {
  it("parses documented dollar-string fields into numbers", () => {
    const [m] = parseMarkets({ markets: [market] })!;
    expect(m).toMatchObject({ ticker: "KXRAINWKND-26NOV07-NYC", yesAsk: 0.2, yesBid: 0.19, openInterest: 1715.79 });
  });
  it("empty list is valid (not found), distinct from malformed", () => expect(parseMarkets({ markets: [] })).toEqual([]));
  it.each([null, undefined, "x", {}, { markets: "no" }, { markets: [{ ticker: "A" }] }, { markets: [{ ...market, yes_ask_dollars: "abc" }] }])(
    "malformed payload %# → null (fail closed)", (bad) => expect(parseMarkets(bad)).toBeNull());
  it("only 'active' is treated as having a live book", () => {
    expect(isActive("active")).toBe(true);
    ["closed", "determined", "finalized", "inactive", "initialized"].forEach((s) => expect(isActive(s)).toBe(false));
  });
});

describe("parseOrderbook (orderbook_fp)", () => {
  it("derives best bid, implied ask = 1 − best NO bid, and spread", () => {
    const b = parseOrderbook({ orderbook_fp: { yes_dollars: [["0.1000", "10"], ["0.1900", "5"]], no_dollars: [["0.7800", "15"], ["0.2000", "3"]] } })!;
    expect(b.bestYesBid).toBe(0.19);
    expect(b.impliedYesAsk).toBe(0.22);
    expect(b.spread).toBe(0.03);
    expect(b.bestYesBidSize).toBe(5);
    expect(b.impliedYesAskSize).toBe(15);
    expect(b.empty).toBe(false);
  });
  it("empty book is flagged, not fabricated", () => {
    const b = parseOrderbook({ orderbook_fp: { yes_dollars: [], no_dollars: [] } })!;
    expect(b).toMatchObject({ empty: true, bestYesBid: null, impliedYesAsk: null, spread: null });
  });
  it("one-sided book has no spread", () => {
    const b = parseOrderbook({ orderbook_fp: { yes_dollars: [["0.5", "2"]], no_dollars: [] } })!;
    expect(b.bestYesBid).toBe(0.5);
    expect(b.impliedYesAsk).toBeNull();
    expect(b.spread).toBeNull();
  });
  it("ignores zero-size levels", () => {
    const b = parseOrderbook({ orderbook_fp: { yes_dollars: [["0.9", "0"], ["0.4", "1"]], no_dollars: [] } })!;
    expect(b.bestYesBid).toBe(0.4);
  });
  it.each([null, {}, { orderbook_fp: {} }, { orderbook_fp: { yes_dollars: [["x", "1"]], no_dollars: [] } }, { orderbook_fp: { yes_dollars: [["0.1"]], no_dollars: [] } }])(
    "malformed book %# → null", (bad) => expect(parseOrderbook(bad)).toBeNull());
});
