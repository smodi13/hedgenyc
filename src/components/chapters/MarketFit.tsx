"use client";
import { RefreshCw } from "lucide-react";
import type { SnapshotItem } from "@/lib/kalshi/client";
import { useMarketSnapshot } from "@/lib/useMarketSnapshot";
import { dollars4, fmtTime } from "@/lib/format";
import { Badge, Eyebrow, Ext, Section, BigNum } from "../ui";

const DOCS = [
  ["GET /markets", "https://docs.kalshi.com/api-reference/market/get-markets"],
  ["GET /markets/{ticker}/orderbook", "https://docs.kalshi.com/api-reference/market/get-market-orderbook"],
  ["Fee schedule (PDF)", "https://kalshi.com/docs/kalshi-fee-schedule.pdf"],
] as const;

function Stat({ k, v }: { k: string; v: string }) {
  return <div><dt className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-steel">{k}</dt><dd className="tnum mt-0.5 font-mono text-sm">{v}</dd></div>;
}

function ApiBlock({ it, at }: { it: SnapshotItem; at: string }) {
  if (it.state === "error") return <p className="border border-copper/60 p-4 text-sm text-copper">Unavailable for this record ({it.error}). No substitute value is shown.</p>;
  if (it.state === "not_found") return <p className="border border-line p-4 text-sm text-chalk/80">Not found in the public market API at {fmtTime(at)}. It may have closed, been delisted, or the research identifier may have changed.</p>;
  if (it.state === "group" && it.group) {
    const st = Object.entries(it.group.statuses).map(([k, v]) => `${v} ${k}`).join(", ");
    return <p className="border border-line p-4 text-sm leading-relaxed text-chalk/80">This record is an {it.group.by} identifier, not a single contract. The public API lists {it.group.count}{it.group.capped ? "+" : ""} markets under it ({st}) as of {fmtTime(at)}. No individual strike is selected and no price is shown.</p>;
  }
  const m = it.market!;
  const active = m.status === "active";
  return (
    <div className="border border-line p-4">
      <div className="flex flex-wrap items-center gap-2">
        {active ? <Badge tone="mint">API status: active</Badge> : <Badge tone="copper">Historical reference · status: {m.status}</Badge>}
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-steel">fetched {fmtTime(at)}</span>
      </div>
      <p className="mt-3 text-sm text-chalk/85">{m.title ?? m.ticker}</p>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat k="YES bid" v={dollars4(m.yesBid)} /><Stat k="YES ask" v={dollars4(m.yesAsk)} /><Stat k="Last" v={dollars4(m.last)} />
        <Stat k="Volume (contracts)" v={m.volume?.toLocaleString() ?? "—"} /><Stat k="Open interest" v={m.openInterest?.toLocaleString() ?? "—"} />
        <Stat k="Closes" v={fmtTime(m.closeTime)} /><Stat k="Market updated" v={fmtTime(m.updatedTime)} /><Stat k="Result" v={m.result ?? "pending"} />
      </dl>
      <div className="mt-5 border-t border-line pt-4">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-mint">Order book (public)</p>
        {it.book && !it.book.empty ? (
          <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat k="Best YES bid" v={`${dollars4(it.book.bestYesBid)} × ${it.book.bestYesBidSize ?? "—"}`} />
            <Stat k="Implied YES ask" v={`${dollars4(it.book.impliedYesAsk)} × ${it.book.impliedYesAskSize ?? "—"}`} />
            <Stat k="Spread" v={dollars4(it.book.spread)} /><Stat k="Levels (YES / NO)" v={`${it.book.yesLevels} / ${it.book.noLevels}`} />
          </dl>
        ) : <p className="mt-2 text-sm text-copper">{it.bookNote ?? "Order book unavailable."}</p>}
        <p className="mt-3 text-xs leading-relaxed text-steel">Depth at the touch is not a guaranteed fill; larger sizes may move the price. Fees and rounding are additional.</p>
      </div>
      {m.rulesPrimary && (
        <details className="mt-4 text-sm"><summary className="cursor-pointer font-mono text-[0.62rem] uppercase tracking-[0.16em] text-mint">Settlement rule (from API)</summary><p className="mt-2 leading-relaxed text-chalk/80">{m.rulesPrimary}</p></details>
      )}
    </div>
  );
}

export function MarketFit() {
  const { state, refresh } = useMarketSnapshot();
  const snap = state.phase === "ready" ? state.snap : null;
  const exact = snap?.items.filter((i) => i.state === "market") ?? [];
  const withBook = exact.filter((i) => i.book && !i.book.empty);
  const steps = [
    ["01", "Read the rule", "Does the settlement station, index, window and revision policy match the loss trigger?", snap ? `${exact.length} of ${snap.items.length} research records resolve to an exact listed contract.` : "Waiting on the public API."],
    ["02", "Inspect the book", "Is there a firm bid and offer, at what spread, and for how many contracts?", snap ? `${withBook.length} of ${exact.length} exact contracts have a non-empty order book.` : "Waiting on the public API."],
    ["03", "Price the miss", "Run the four states in the Hedge Lab: what happens when the business loses and the contract does not pay?", "Always required, whatever the book shows."],
  ] as const;

  return (
    <Section id="market-fit" label="Market fit">
      <header className="grid gap-8 md:grid-cols-12" data-reveal>
        <BigNum n="05" className="md:col-span-2" />
        <div className="md:col-span-10">
          <Eyebrow>Market fit · public Kalshi API</Eyebrow>
          <h2 id="market-fit-h" className="font-display mt-4 max-w-4xl text-[clamp(2rem,4.6vw,4rem)] leading-[1.04] tracking-[-0.015em] text-balance">A listed market is not a matched market.</h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-chalk/75">Five contracts and families were discovered on November 6, 2026. Below, each is checked against the exchange&rsquo;s read-only public API by our server. Nothing here is an order form, a recommendation, or a live trading screen.</p>
        </div>
      </header>

      <div className="mt-12 grid gap-px border border-line bg-line md:grid-cols-3" data-reveal>
        {steps.map(([n, t, d, live], i) => (
          <div key={n} data-reveal style={{ ["--d" as string]: `${i * 120}ms` }} className="bg-ink p-6">
            <p className="font-mono text-xs text-copper">{n}</p><h3 className="font-display mt-2 text-2xl">{t}</h3>
            <p className="mt-3 text-sm leading-relaxed text-chalk/70">{d}</p><p className="mt-4 border-t border-line pt-3 font-mono text-[0.66rem] uppercase leading-relaxed tracking-[0.1em] text-mint">{live}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border border-line bg-navy/50 px-5 py-4" role="status" aria-live="polite">
        <p className="font-mono text-[0.7rem] uppercase leading-relaxed tracking-[0.12em]">
          {state.phase === "loading" && <span className="text-steel">Checking the public market API…</span>}
          {state.phase === "ready" && <span className="text-mint">Public market data · source: external-api.kalshi.com · status checked at {fmtTime(state.snap.fetchedAt)}{state.snap.status === "partial" ? " · some records failed" : ""}</span>}
          {state.phase === "unavailable" && <span className="text-copper">Market feed unavailable. Research remains accessible. No prices are shown.</span>}
        </p>
        <button type="button" onClick={refresh} className="flex items-center gap-2 border border-line px-3 py-2 font-mono text-[0.64rem] uppercase tracking-[0.16em] hover:border-mint hover:text-mint"><RefreshCw className="size-3.5" aria-hidden /> Re-check</button>
      </div>

      <ul className="mt-8 space-y-6">
        {(snap?.items ?? []).map((it) => (
          <li key={it.researchId} className="border border-line bg-navy/40 p-5 sm:p-8" data-reveal>
            <div className="grid gap-8 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <Badge tone="steel">Discovered contract · not verified live · Nov 6, 2026</Badge>
                <h3 className="font-display mt-4 text-2xl leading-snug">{it.event}</h3>
                <p className="mt-1 font-mono text-xs text-steel">{it.researchId}</p>
                <dl className="mt-5 space-y-4 text-sm leading-relaxed">
                  <div><dt className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-mint">Settlement proxy</dt><dd className="mt-1 text-chalk/80">{it.settlementProxy}</dd></div>
                  <div className="border-l-2 border-copper pl-4"><dt className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-copper">Basis mismatch</dt><dd className="mt-1 text-chalk/80">{it.basisMismatch}</dd></div>
                </dl>
                <p className="mt-5"><Ext href={it.sourceUrl}>View on Kalshi</Ext></p>
              </div>
              <div className="lg:col-span-7">{snap ? <ApiBlock it={it} at={snap.fetchedAt} /> : state.phase === "loading" ? <div className="h-40 animate-pulse border border-line bg-line/30" aria-hidden /> : <p className="border border-copper/60 p-4 text-sm text-copper">Market feed unavailable. Research remains accessible. No quote is shown.</p>}</div>
            </div>
          </li>
        ))}
        {!snap && state.phase !== "loading" && <li className="border border-line p-6 text-sm text-chalk/75">The dated discovery records are listed in the research files (markets.json) and linked from the evidence library. They carry no prices.</li>}
      </ul>

      <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <span className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-steel">API documentation</span>
        {DOCS.map(([l, u]) => <Ext key={u} href={u}>{l}</Ext>)}
      </div>
      <p className="mt-6 max-w-3xl text-xs leading-relaxed text-steel">Displayed fields are what the exchange&rsquo;s public API returned at the stated time. They are not offers, executable quotes, or implied probabilities of any business loss. Liquidity changes continuously. Verify rules and fee schedules directly before any transaction; this site places no orders.</p>
    </Section>
  );
}
