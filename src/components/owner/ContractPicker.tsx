"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { usd } from "@/lib/format";
import type { EventRow } from "@/lib/kalshi/contract";
import { asksFor, MANUAL_LABEL, sideName, strikeText, type Analysis, type Selection } from "@/lib/owner/analysis";
import type { Side } from "@/lib/owner/model";
import { Card, F, Seg } from "./ui";

interface SearchState { phase: "idle" | "loading" | "done" | "error"; events: EventRow[]; categories: string[]; note: string | null; truncated: boolean }

export function ContractPicker({ sel, a, onChange, onLoad, title = "Choose a contract", idx = 0 }: { sel: Selection; a: Analysis; onChange: (p: Partial<Selection>) => void; onLoad: (ticker: string) => void; title?: string; idx?: number }) {
  const [q, setQ] = useState(""), [cat, setCat] = useState(""), [tick, setTick] = useState("");
  const [st, setSt] = useState<SearchState>({ phase: "idle", events: [], categories: [], note: null, truncated: false });
  // categories only (empty query): cheap, cached server-side
  useEffect(() => {
    let live = true;
    fetch("/api/kalshi/search").then((r) => r.json()).then((j: { categories?: string[] }) => { if (live && j.categories) setSt((x) => ({ ...x, categories: j.categories! })); }).catch(() => {});
    return () => { live = false; };
  }, []);
  const search = () => {
    setSt((x) => ({ ...x, phase: "loading", note: null }));
    fetch(`/api/kalshi/search?q=${encodeURIComponent(q.trim())}&category=${encodeURIComponent(cat)}`)
      .then((r) => r.json() as Promise<{ status: string; events: EventRow[]; categories: string[]; note: string | null; truncated: boolean }>)
      .then((j) => setSt({ phase: j.status === "ok" ? "done" : "error", events: j.events ?? [], categories: j.categories?.length ? j.categories : st.categories, note: j.note, truncated: !!j.truncated }))
      .catch(() => setSt((x) => ({ ...x, phase: "error", note: "Market search is unavailable. You can still enter a ticker, or use a manual price." })));
  };
  const i = sel.info, id = `c${idx}`;
  const asks = i ? asksFor(i, sel.side) : [];
  const strikes = sel.siblings.length ? sel.siblings : [];
  return (
    <Card title={title} tag="market" id={idx === 0 ? "contract" : undefined}>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <form onSubmit={(e) => { e.preventDefault(); search(); }} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end" role="search" aria-label="Search Kalshi markets">
            <div>
              <label htmlFor={`${id}-q`} className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-chalk/80">Search markets</label>
              <input id={`${id}-q`} data-testid={`search-q-${idx}`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="snow chicago, rain, temperature…" className="mt-1.5 w-full border border-line bg-ink px-3 py-2.5 text-base text-chalk outline-none focus:border-mint" />
            </div>
            <div>
              <label htmlFor={`${id}-cat`} className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-chalk/80">Category</label>
              <select id={`${id}-cat`} value={cat} onChange={(e) => setCat(e.target.value)} className="mt-1.5 w-full border border-line bg-ink px-3 py-2.5 text-base text-chalk">
                <option value="">All categories</option>
                {st.categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="submit" data-testid={`search-go-${idx}`} className="inline-flex items-center justify-center gap-2 bg-mint px-4 py-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-ink"><Search className="size-4" aria-hidden />Search</button>
          </form>
          <div role="status" aria-live="polite" className="mt-2 min-h-5 text-sm text-steel">{st.phase === "loading" ? "Searching open markets…" : st.note}</div>
          {st.events.length > 0 && (
            <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto border border-line p-2" data-testid={`results-${idx}`}>
              {st.events.map((ev) => (
                <li key={ev.eventTicker} className="border border-line/60 p-3">
                  <p className="text-sm text-chalk">{ev.title}{ev.subTitle ? <span className="text-steel"> · {ev.subTitle}</span> : null}</p>
                  <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-steel">{ev.category ?? ev.seriesTicker} · {ev.eventTicker}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ev.markets.slice(0, 12).map((m) => (
                      <button key={m.ticker} type="button" onClick={() => onLoad(m.ticker)} aria-pressed={sel.ticker === m.ticker} className={`border px-2.5 py-1.5 text-xs ${sel.ticker === m.ticker ? "border-mint text-mint" : "border-line text-chalk/85 hover:border-chalk/40"}`}>{m.label}</button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {st.truncated && <p className="mt-1 text-xs text-steel">More markets matched than are shown. Narrow the search.</p>}
          <form onSubmit={(e) => { e.preventDefault(); if (tick.trim()) onLoad(tick.trim().toUpperCase()); }} className="mt-4 flex items-end gap-3">
            <div className="flex-1">
              <label htmlFor={`${id}-t`} className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-chalk/80">Or enter a ticker</label>
              <input id={`${id}-t`} data-testid={`ticker-in-${idx}`} value={tick} onChange={(e) => setTick(e.target.value)} placeholder="KXCHISNOWM-26DEC-2" className="tnum mt-1.5 w-full border border-line bg-ink px-3 py-2.5 font-mono text-base text-chalk outline-none focus:border-mint" />
            </div>
            <button type="submit" data-testid={`ticker-go-${idx}`} className="border border-line px-4 py-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] hover:border-chalk/40">Load</button>
          </form>
        </div>

        <div className="space-y-4">
          <Seg label="Side" value={sel.side} onChange={(v: Side) => onChange({ side: v })} options={[{ v: "no", label: "NO" }, { v: "yes", label: "YES" }]} />
          <Seg label="Price source" value={sel.priceMode} onChange={(v) => onChange({ priceMode: v })} options={[{ v: "live", label: "Live prices" }, { v: "manual", label: "Manual price" }]} />
          {sel.priceMode === "manual"
            ? <F label={`${sideName(sel.side)} price per contract`} prefix="$" name="Manual price" value={sel.price} onChange={(v) => onChange({ price: v })} min={0.01} max={0.99} step={0.01} testId={`in-price-${idx}`} err={a.errors.price} badge="Illustrative" hint={MANUAL_LABEL} />
            : <F label="Highest price I would pay (optional)" prefix="$" name="Price cap" value={sel.priceCap} onChange={(v) => onChange({ priceCap: v })} min={0.01} max={0.99} step={0.01} slider={false} testId={`in-cap-${idx}`} err={a.errors.priceCap} hint="Only offers at or below this price are counted. Blank means no cap." />}
        </div>
      </div>

      <div className="mt-6 border-t border-line pt-5" data-testid={`contract-${idx}`} aria-live="polite">
        {sel.loading && <p className="text-steel">Loading {sel.ticker}…</p>}
        {!sel.loading && !i && <p className="text-copper" data-testid={`contract-note-${idx}`}>{sel.infoNote ?? "No contract loaded."} You can still use a manual price below, but nothing here is verified.</p>}
        {i && (
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <p className="font-display text-xl text-chalk">{i.title}</p>
              <p className="mt-1 text-chalk/85">{sel.side === "yes" ? i.yesSub : i.noSub} <span className="text-steel">({strikeText(i)})</span></p>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-steel">Ticker</dt><dd className="tnum font-mono text-chalk" data-testid={`c-ticker-${idx}`}>{i.ticker}</dd>
                <dt className="text-steel">Status</dt><dd className={i.status === "active" ? "text-mint" : "text-copper"} data-testid={`c-status-${idx}`}>{i.status === "active" ? "Open for trading" : i.status}</dd>
                <dt className="text-steel">Closes</dt><dd className="text-chalk">{i.closeTime ?? "n/a"}</dd>
                <dt className="text-steel">Fee schedule</dt><dd className="text-chalk">{i.feeType ?? "unconfirmed"}{i.feeMultiplier !== null ? ` · multiplier ${i.feeMultiplier}` : ""}</dd>
                <dt className="text-steel">Retrieved</dt><dd className="tnum text-chalk" data-testid={`c-time-${idx}`}>{i.fetchedAt}</dd>
              </dl>
              <p className="mt-3 text-sm"><a className="text-mint underline" target="_blank" rel="noopener noreferrer" href={i.url}>Official market page<span className="sr-only"> (opens in a new tab)</span></a></p>
              <button type="button" onClick={() => onLoad(sel.ticker)} className="mt-3 inline-flex items-center gap-2 border border-line px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.12em] hover:border-chalk/40"><RefreshCw className="size-3.5" aria-hidden />Refresh prices</button>
              {strikes.length > 1 && (
                <div className="mt-4"><p className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-chalk/80">Strike</p>
                  <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Strike">
                    {strikes.map((m) => <button key={m.ticker} type="button" aria-pressed={m.ticker === sel.ticker} onClick={() => onLoad(m.ticker)} className={`border px-2.5 py-1.5 text-xs ${m.ticker === sel.ticker ? "border-mint text-mint" : "border-line text-chalk/85 hover:border-chalk/40"}`}>{m.label}</button>)}
                  </div></div>
              )}
            </div>
            <div>
              <p className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-chalk/80">{sideName(sel.side)} offers (lowest price first)</p>
              {!i.bookOk ? <p className="mt-2 text-sm text-copper">{i.bookNote}</p> : asks.length === 0 ? <p className="mt-2 text-sm text-steel">No {sideName(sel.side)} offers are resting in the order book.</p> : (
                <table className="mt-2 w-full text-sm" data-testid={`ladder-${idx}`}>
                  <thead><tr className="text-left text-steel"><th className="font-normal">Price</th><th className="text-right font-normal">Contracts</th></tr></thead>
                  <tbody>{asks.slice(0, 6).map((l) => <tr key={l.price} className="border-t border-line/60"><td className="tnum py-1 text-chalk">{usd(l.price, 2)}</td><td className="tnum py-1 text-right text-chalk">{l.size.toLocaleString("en-US")}</td></tr>)}</tbody>
                </table>
              )}
              <p className="mt-2 text-xs text-steel">A resting {sel.side === "no" ? "YES" : "NO"} bid at P is an offer to sell {sideName(sel.side)} at 1 − P. Bids, last trades and midpoints are never treated as prices you can buy at. This is a snapshot, not a guaranteed fill.</p>
            </div>
          </div>
        )}
        {i && (
          <details className="mt-4 border border-line p-3">
            <summary className="cursor-pointer text-sm text-chalk">Official settlement rules</summary>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-chalk/85" data-testid={`rules-${idx}`}>{i.rulesPrimary ?? "Rules were not returned."}</p>
            {i.rulesSecondary && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-chalk/85">{i.rulesSecondary}</p>}
          </details>
        )}
        <p className="mt-3 border-l-2 border-copper pl-3 text-sm text-chalk/90" data-testid={`early-${idx}`}><strong>Early settlement.</strong> {a.early}</p>
      </div>
    </Card>
  );
}
