"use client";
import { AlertTriangle, Check, CircleHelp, Gift, Minus, ShieldCheck, X } from "lucide-react";
import { pct as pctFmt, signedUsd, usd } from "@/lib/format";
import { sideName, strikeText, type Analysis, type Check as CheckT, type Selection, type Suitability } from "@/lib/owner/analysis";
import { OBJECTIVE_TEXT } from "@/lib/owner/hedge";
import { FEE_COEF, FEE_SOURCE, ILLUSTRATIVE_PROBS, NAN_PROBS, blankLossRows, illustrativeLossRows, type Objective, type Scenario, type SizeMode, type StateKey } from "@/lib/owner/model";
import { Num } from "./Num";
import { OwnerChart } from "./OwnerChart";
import { Card, Chip, F, Seg, Stat } from "./ui";

type Up = (patch: Partial<Scenario>) => void;
const fmt = (n: number) => n.toLocaleString("en-US");

/* ---------- sizing ---------- */

export function SizingPanel({ s, up, a, openAnalyst }: { s: Scenario; up: Up; a: Analysis; openAnalyst: () => void }) {
  const err = (k: string) => a.errors[k];
  const modes: { v: SizeMode; label: string; sub: string }[] = [
    { v: "budget", label: "I know how much I want to spend", sub: "Find the most contracts my budget buys." },
    { v: "protect", label: "Protect a specific percentage", sub: "Find the contracts needed to repay a share of my loss." },
    { v: "risk", label: "Find a risk-reducing hedge", sub: "Use my own probabilities to compare risk." },
  ];
  return (
    <Card title="How should the hedge be sized?" tag="owner">
      <div role="group" aria-label="Sizing mode" className="grid gap-3 lg:grid-cols-3">
        {modes.map((m) => (
          <button key={m.v} type="button" data-testid={`mode-${m.v}`} aria-pressed={s.sizeMode === m.v} onClick={() => up({ sizeMode: m.v })}
            className={`border p-4 text-left transition-colors ${s.sizeMode === m.v ? "border-mint bg-mint/5" : "border-line hover:border-chalk/40"}`}>
            <span className="block text-chalk">{m.label}</span><span className="mt-1 block text-xs text-steel">{m.sub}</span>
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        <F label={s.sizeMode === "budget" ? "Most I will spend up front" : "Most I will spend up front (optional)"} prefix="$" name="Budget" value={s.budget} onChange={(v) => up({ budget: v })} min={0} max={2000} step={10} testId="in-budget" err={err("budget")} hint={s.sizeMode === "budget" || s.sizeMode === "risk" ? "Required for this mode. Includes principal and fees." : "A position above this is rejected."} />
        <F label="Most I could accept losing on the contract (optional)" prefix="$" name="Max trading loss" value={s.maxTradingLoss} onChange={(v) => up({ maxTradingLoss: v })} min={0} max={2000} step={10} testId="in-maxloss" err={err("maxTradingLoss")} hint="A bought contract can lose at most its entry cost. Blank means no extra cap." />
        {s.sizeMode === "protect" && <F label="Share of my loss to protect" pct name="Target protection" value={s.coverage} onChange={(v) => up({ coverage: v })} min={0} max={100} step={1} testId="in-coverage" err={err("coverage")} hint="A target you choose, not an optimum." />}
        <F label="Coverage cap (optional)" pct name="Max coverage" value={s.maxCoverage} onChange={(v) => up({ maxCoverage: v })} min={0} max={200} step={5} testId="in-maxcov" err={err("maxCoverage")} hint="Net winning profit may not exceed this share of the modeled loss." />
      </div>
      {s.sizeMode === "risk" && (
        <div className="mt-5 border border-line p-4 text-sm text-chalk/85">
          {a.probs.kind === "ok" ? <p>Using the probabilities in the Analyst View. Objective: <strong>{OBJECTIVE_TEXT[s.objective].name}</strong>.</p>
            : <><p data-testid="need-info">More information is needed to estimate a personalized risk-reducing hedge.</p><p className="mt-1 text-steel">This mode needs probabilities you can support. None are filled in for you.</p><button type="button" data-testid="open-analyst" onClick={openAnalyst} className="mt-3 border border-line px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.12em] hover:border-chalk/40">Open Analyst View to enter them</button></>}
        </div>
      )}
    </Card>
  );
}

/* ---------- dashboard ---------- */

const OUTCOMES: { k: "lossPays" | "lossLoses" | "noLossPays" | "noLossLoses"; text: string; icon: typeof Check; tone: string; base: (l: number) => number }[] = [
  { k: "lossPays", text: "Your business loses revenue, and the contract pays.", icon: ShieldCheck, tone: "border-mint/60 text-mint", base: (l) => -l },
  { k: "lossLoses", text: "Your business loses revenue, and the contract does not pay.", icon: AlertTriangle, tone: "border-copper/70 text-copper", base: (l) => -l },
  { k: "noLossPays", text: "Your business is fine, and the contract pays.", icon: Gift, tone: "border-chalk/50 text-chalk", base: () => 0 },
  { k: "noLossLoses", text: "Your business is fine, and the contract does not pay.", icon: Minus, tone: "border-steel/70 text-steel", base: () => 0 },
];

export function Dashboard({ s, a, sel }: { s: Scenario; a: Analysis; sel: Selection }) {
  const z = a.sizing!, p = z.position, ok = z.status === "ok" || z.status === "none", L = a.liquidity;
  const has = ok && p.contracts > 0;
  const nv = (v: number) => (has ? v : null);
  return (
    <Card title="What this means for your business" tag="hypo" id="results">
      <p className="font-display text-xl text-chalk sm:text-2xl" data-testid="headline">{z.headline}</p>
      <p className="mt-1 max-w-3xl text-sm text-chalk/80" data-testid="headline-reason">{z.reason}</p>
      {L?.message && <p role="status" data-testid="liquidity-msg" className="mt-3 border-l-2 border-copper pl-3 text-sm text-copper">{L.message}{L.requested > L.available && L.available >= 0 ? ` ${fmt(L.requested)} contracts would be needed; ${fmt(L.available)} are displayed${Number.isNaN(sel.priceCap) ? "" : " within your price limit"}.` : ""}</p>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat k="1. Possible loss" big sub="Contribution you could lose"><Num value={a.loss} testId="out-loss2" /></Stat>
        <Stat k="4. Contracts you can buy" big sub="Whole contracts only"><Num value={ok ? p.contracts : null} kind="int" testId="out-contracts" /></Stat>
        <Stat k="5. Total cost, fees included" tone="copper" big sub="The most you can lose on it"><Num value={nv(p.cost)} testId="out-cash" /></Stat>
        <Stat k="6. Profit if the contract wins" tone="mint" big sub="After cost and fees"><Num value={nv(p.netWin)} testId="out-netwin" /></Stat>
        <Stat k="Principal"><Num value={nv(p.premium)} testId="out-principal" /></Stat>
        <Stat k="Estimated fees"><Num value={nv(p.fee)} testId="out-fee" /></Stat>
        <Stat k="8. Share of the loss offset" sub="Net winning profit ÷ modeled loss"><Num value={nv(p.coverage ?? 0)} kind="pct" testId="out-offset" /></Stat>
        <Stat k="7. If the contract expires worthless"><span data-testid="out-worthless">{has ? `You lose ${usd(p.cost)}` : "n/a"}</span></Stat>
      </div>
      <dl className="mt-5 grid gap-x-10 gap-y-2 text-sm md:grid-cols-2">
        <div><dt className="text-steel">2. Risk you said you can afford</dt><dd className="text-chalk">{Number.isFinite(s.budget) ? `${usd(s.budget)} up front${Number.isFinite(s.maxTradingLoss) ? `, ${usd(s.maxTradingLoss)} maximum trading loss` : ""}` : "No budget entered"}</dd></div>
        <div><dt className="text-steel">3. Contract</dt><dd className="text-chalk">{sel.info ? `${sel.info.ticker}, ${sideName(sel.side)} (${strikeText(sel.info)})` : sel.ticker}</dd></div>
        <div><dt className="text-steel">9. Does the market support this size?</dt><dd className="text-chalk" data-testid="liquidity-line">{L ? (L.complete ? `Yes: ${fmt(L.available)} contracts displayed${L.bestAsk !== null ? `, best offer ${usd(L.bestAsk, 2)}` : ""}${L.avgPrice !== null ? `, average fill ${usd(L.avgPrice, 4)}` : ""}.` : L.message ?? "Unknown") : "Unknown. A manual price is not checked against the order book."}</dd></div>
        <div><dt className="text-steel">10. Does the contract match your risk?</dt><dd className="text-chalk" data-testid="suit-line">{a.suit.label} (screening only, not a recommendation)</dd></div>
      </dl>
      {ok && (
        <div className="mt-6">
          <p className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-steel">The four outcomes, with and without the hedge</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2" data-testid="outcomes">
            {OUTCOMES.map((o) => {
              const Ic = o.icon, v = p.outcomes[o.k], b = o.base(a.loss);
              return (
                <div key={o.k} data-testid={`oc-${o.k}`} className={`border bg-ink/40 p-4 ${o.tone.split(" ")[0]}`}>
                  <p className={`flex items-start gap-2 text-sm ${o.tone.split(" ")[1]}`}><Ic className="mt-0.5 size-4 shrink-0" aria-hidden />{o.text}</p>
                  <p className="font-display mt-2 text-2xl text-chalk"><Num value={v} testId={`oc-${o.k}-v`} /></p>
                  <p className="text-xs text-steel">No hedge: <span className="tnum">{usd(b)}</span> · difference <span className="tnum">{signedUsd(v - b)}</span></p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {a.warnings.map((w) => <p key={w} className="mt-4 border-l-2 border-copper pl-3 text-sm text-copper">{w}</p>)}
    </Card>
  );
}

/* ---------- suitability ---------- */

const SUIT_TONE: Record<Suitability["label"], string> = { "Potentially aligned": "text-mint border-mint/60", "Needs more information": "text-copper border-copper/60", "Material mismatch": "text-copper border-copper", "Insufficient information": "text-steel border-steel/70" };

export function SuitabilityCard({ s, up, a }: { s: Scenario; up: Up; a: Analysis }) {
  return (
    <Card title="Does this contract match your risk?" tag="analyst">
      <p className={`inline-block border px-3 py-1.5 font-mono text-xs uppercase tracking-[0.12em] ${SUIT_TONE[a.suit.label]}`} data-testid="suit-label">{a.suit.label}</p>
      <p className="mt-2 text-xs text-steel">A screening of public details only. It is not a trading recommendation and carries no score.</p>
      <ul className="mt-4 space-y-2" data-testid="suit-items">
        {a.suit.items.map((it, i) => (
          <li key={i} className="flex gap-3 text-sm text-chalk/90">
            {it.ok === true ? <Check className="mt-0.5 size-4 shrink-0 text-mint" aria-label="Pass" /> : it.ok === false ? <X className="mt-0.5 size-4 shrink-0 text-copper" aria-label="Flag" /> : <CircleHelp className="mt-0.5 size-4 shrink-0 text-steel" aria-label="Open" />}<span>{it.text}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm text-chalk/90">
        <label className="flex items-center gap-2"><input type="checkbox" data-testid="confirm-location" checked={s.confirmLocation} onChange={(e) => up({ confirmLocation: e.target.checked })} />I confirm the contract&apos;s location represents my service area</label>
        <label className="flex items-center gap-2"><input type="checkbox" data-testid="confirm-threshold" checked={s.confirmThreshold} onChange={(e) => up({ confirmThreshold: e.target.checked })} />I confirm this threshold matters for my revenue</label>
      </div>
    </Card>
  );
}

/* ---------- compare ---------- */

export function Compare({ entries }: { entries: { sel: Selection; a: Analysis }[] }) {
  if (entries.length < 2) return null;
  const rows: [string, (e: { sel: Selection; a: Analysis }) => string][] = [
    ["Contract", ({ sel }) => sel.info?.title ?? sel.ticker], ["Exact ticker", ({ sel }) => sel.ticker], ["Side", ({ sel }) => sideName(sel.side)],
    ["Threshold", ({ sel }) => (sel.info ? strikeText(sel.info) : "n/a")], ["Settlement period", ({ sel }) => sel.info?.closeTime ?? "n/a"],
    ["Best price to buy", ({ a }) => (a.liquidity?.bestAsk != null ? usd(a.liquidity.bestAsk, 2) : a.priceSource === "manual" ? "Manual price" : "n/a")],
    ["Depth shown", ({ a }) => (a.liquidity ? `${fmt(a.liquidity.available)} contracts` : "Unknown (manual)")],
    ["Contracts for this plan", ({ a }) => fmt(a.sizing!.position.contracts)],
    ["Entry cost incl. fees", ({ a }) => usd(a.sizing!.position.cost)], ["Profit if it pays", ({ a }) => usd(a.sizing!.position.netWin)],
    ["Business loses, contract pays", ({ a }) => usd(a.sizing!.position.outcomes.lossPays)], ["Business loses, contract does not pay", ({ a }) => usd(a.sizing!.position.outcomes.lossLoses)],
    ["Fit with your risk", ({ a }) => a.suit.label], ["Why", ({ a }) => a.suit.items.filter((i) => i.ok === false).map((i) => i.text).join(" ") || "No mismatch flagged."],
    ["Basis risk", () => "The business can lose money while this contract expires worthless."],
    ["Can the plan be executed?", ({ a }) => (a.liquidity ? (a.liquidity.complete ? "Within displayed depth (snapshot)" : a.liquidity.message ?? "No") : "Unknown: manual price")],
    ["Early close", ({ a }) => a.early],
  ];
  return (
    <Card title="Compare contracts" tag="market">
      <p className="mb-3 text-sm text-steel">Contracts are listed side by side, not ranked. The cheapest is not the best fit.</p>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Contract comparison">
        <table className="w-full min-w-[560px] text-sm" data-testid="compare">
          <thead><tr><th className="sr-only">Measure</th>{entries.map((e, i) => <th key={i} scope="col" className="pb-2 pr-3 text-left font-display text-base text-chalk">Contract {i + 1}</th>)}</tr></thead>
          <tbody>{rows.map(([k, f]) => <tr key={k} className="border-t border-line/60 align-top"><th scope="row" className="w-40 py-2 pr-3 text-left font-normal text-steel">{k}</th>{entries.map((e, i) => <td key={i} className="py-2 pr-3 text-chalk/90">{f(e)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------- analyst view ---------- */

const STATES: { k: StateKey; id: string; title: string }[] = [
  { k: "lossPays", id: "A", title: "Business loses, contract pays" }, { k: "lossLoses", id: "B", title: "Business loses, contract does not pay" },
  { k: "noLossPays", id: "C", title: "Business fine, contract pays" }, { k: "noLossLoses", id: "D", title: "Business fine, contract does not pay" },
];

export function AnalystView({ s, up, a, sel, open, setOpen }: { s: Scenario; up: Up; a: Analysis; sel: Selection; open: boolean; setOpen: (o: boolean) => void }) {
  const setProb = (k: StateKey, v: number) => up({ probs: { ...s.probs, [k]: v }, probSource: "owner" });
  const fillRemainder = () => {
    const o = (["lossPays", "lossLoses", "noLossPays"] as const).map((k) => s.probs[k]);
    if (o.some((x) => Number.isNaN(x))) return;
    up({ probs: { ...s.probs, noLossLoses: Math.round((1 - o.reduce((p, q) => p + q, 0)) * 1e8) / 1e8 }, probSource: "owner" });
  };
  const err = (k: string) => a.errors[k];
  const o = a.opt, m = a.sizing?.position;
  return (
    <details open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)} className="border border-line bg-navy/40" data-testid="analyst">
      <summary className="cursor-pointer px-5 py-4 font-display text-xl text-chalk sm:px-7">Analyst View <span className="ml-2 font-mono text-[0.64rem] uppercase tracking-[0.14em] text-steel">probabilities · variance · CVaR · fees · depth</span></summary>
      <div className="space-y-6 px-5 pb-7 sm:px-7">
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <F label="Position limit (contracts, 0 = none known)" name="Position limit" value={s.positionLimit} onChange={(v) => up({ positionLimit: v })} min={0} max={10000} step={10} slider={false} err={err("positionLimit")} />
          <F label="Loss-size variability" name="Variability" pct value={s.variability} onChange={(v) => up({ variability: v })} min={0} max={100} step={5} err={err("variability")} badge="Stress test" hint="Stress only: worst case = modeled loss × (1 + variability). It does not change the optimizer." />
          <F label="Expected chance of a low-activity period" pct name="Low-activity probability" value={s.lowSnowProb} onChange={(v) => up({ lowSnowProb: v })} min={0} max={100} step={1} slider={false} err={err("lowSnowProb")} hint="Optional. Compared with the states below." />
          {sel.priceMode === "manual" && <F label="Fee multiplier (M)" name="Fee multiplier" value={s.feeMult} onChange={(v) => up({ feeMult: v })} min={0} max={2} step={0.05} slider={false} testId="in-feemult" err={err("feeMult")} badge="Analyst assumption" hint="Used for manual prices. Live prices use the multiplier the market's series publishes." />}
        </div>

        <fieldset>
          <legend className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-chalk/80">Optimization objective (risk-reducing mode)</legend>
          <div className="mt-2 grid gap-3 lg:grid-cols-3">
            {(["variance", "cvar", "target"] as Objective[]).map((x) => (
              <label key={x} className={`block cursor-pointer border p-4 ${s.objective === x ? "border-mint bg-mint/5" : "border-line"}`}>
                <input type="radio" name="objective" className="mr-2" checked={s.objective === x} onChange={() => up({ objective: x })} />
                <span className="text-chalk">{OBJECTIVE_TEXT[x].name}</span><span className="mt-1 block text-xs leading-snug text-steel">{OBJECTIVE_TEXT[x].math}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h4 className="font-display text-lg text-chalk">{s.lossModel === "simple" ? "Simplified four-state model" : "Multiple loss levels"}</h4>
            <Seg label="Loss model" value={s.lossModel} onChange={(v) => up({ lossModel: v })} options={[{ v: "simple", label: "Four-state" }, { v: "multi", label: "Loss levels" }]} />
          </div>
          <p className="mb-4 max-w-3xl text-sm text-chalk/80">Only enter probabilities you can support. None are filled in for you, and entered values are never reset silently. All probabilities together must sum to 100%.</p>
          {s.lossModel === "simple" ? (
            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
              {STATES.map((st) => <F key={st.k} label={`${st.id}. ${st.title}`} pct name={st.title} value={s.probs[st.k]} onChange={(v) => setProb(st.k, v)} min={0} max={100} step={1} slider={false} testId={`prob-${st.k}`} />)}
            </div>
          ) : (
            <div className="space-y-4" data-testid="loss-rows">
              {s.lossRows.map((r, i) => {
                const setRow = (patch: Partial<typeof r>) => up({ lossRows: s.lossRows.map((x, j) => (j === i ? { ...x, ...patch } : x)), probSource: "owner" });
                return (
                  <div key={r.name} className="grid gap-x-4 gap-y-3 border border-line p-4 sm:grid-cols-3">
                    <p className="text-chalk sm:col-span-3">{r.name}</p>
                    <F label="Operating loss" prefix="$" name={`${r.name} loss`} value={r.loss} onChange={(v) => setRow({ loss: v })} min={0} max={50000} step={50} slider={false} testId={`row-${i}-loss`} />
                    <F label="Chance, contract pays" pct name={`${r.name} pays`} value={r.pays} onChange={(v) => setRow({ pays: v })} min={0} max={100} step={1} slider={false} testId={`row-${i}-pays`} />
                    <F label="Chance, contract does not pay" pct name={`${r.name} does not pay`} value={r.loses} onChange={(v) => setRow({ loses: v })} min={0} max={100} step={1} slider={false} testId={`row-${i}-loses`} />
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {s.lossModel === "simple" && <button type="button" onClick={fillRemainder} className="border border-line px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.12em] hover:border-chalk/40">Fill D with remainder</button>}
            <button type="button" data-testid="load-illustrative" onClick={() => up(s.lossModel === "simple" ? { probs: { ...ILLUSTRATIVE_PROBS }, probSource: "illustrative" } : { lossRows: illustrativeLossRows(a.loss), probSource: "illustrative" })} className="border border-line px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.12em] hover:border-chalk/40">Load illustrative placeholder</button>
            <button type="button" onClick={() => up({ probs: { ...NAN_PROBS }, lossRows: blankLossRows(), probSource: "owner" })} className="px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-steel underline">Clear</button>
          </div>
          <div role="status" data-testid="prob-status" className="mt-3 text-sm">
            {a.probs.kind === "ok" && a.stats ? (
              <div className="space-y-1">
                <p className="text-mint">Sum 100%.{a.probs.source === "illustrative" && <span className="text-copper"> Illustrative placeholder, not history: results are assumption-dependent.</span>}</p>
                <ul className="grid gap-1 text-chalk/85 sm:grid-cols-2">
                  <li data-testid="stat-loss"><strong>Chance of a business loss:</strong> {pctFmt(a.stats.pLoss, 1)}{s.lossModel === "simple" ? " (A + B)" : ""}</li>
                  <li data-testid="stat-payout"><strong>Chance the contract pays:</strong> {pctFmt(a.stats.pPayout, 1)}{s.lossModel === "simple" ? " (A + C)" : ""}</li>
                  <li data-testid="stat-miss"><strong>Chance of a loss with no payout:</strong> {pctFmt(a.stats.pLossNoPay, 1)}{s.lossModel === "simple" ? " (B)" : ""}. This is basis risk.</li>
                  <li data-testid="stat-cond"><strong>Payout when the business loses:</strong> {a.stats.pPayGivenLoss === null ? "n/a" : pctFmt(a.stats.pPayGivenLoss, 1)}</li>
                </ul>
              </div>
            ) : a.probs.kind === "invalid" ? <p className="text-copper" data-testid="prob-error">{a.probs.error}</p>
              : <p className="text-steel">Not provided. Variance and CVaR optimization are blocked. More information is needed to estimate a personalized risk-reducing hedge.</p>}
          </div>
        </div>

        {o && a.valid && (
          <div data-testid="opt-result" className="border border-line p-4">
            <h4 className="font-display text-lg text-chalk">{OBJECTIVE_TEXT[o.objective].name}</h4>
            <p className="mt-1 text-sm text-chalk/85" data-testid="opt-why">{o.why}</p>
            {o.status === "ok" && (
              <dl className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                {([["Contracts", fmt(o.position.contracts)], ["Total cost", usd(o.position.cost)], ["Expected trading P&L", o.position.expTrading === null ? "n/a" : usd(o.position.expTrading)], ["Expected combined P&L", o.position.expCombined === null ? "n/a" : usd(o.position.expCombined)], ["Variance", o.position.variance === null ? "n/a" : o.position.variance.toFixed(2)], ["90% CVaR before → after", o.position.cvar90 === null || o.baseline.cvar90 === null ? "n/a" : `${usd(o.baseline.cvar90)} → ${usd(o.position.cvar90)}`], ["Basis-miss probability", o.position.basisMissProb === null ? "n/a" : pctFmt(o.position.basisMissProb, 1)], ["Worst modeled outcome", usd(o.position.worst)]] as [string, string][]).map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-line/60 py-1"><dt className="text-steel">{k}</dt><dd className="tnum text-chalk">{v}</dd></div>)}
              </dl>
            )}
          </div>
        )}

        {a.valid && <div><h4 className="mb-3 font-display text-lg text-chalk">Coverage vs. financial impact</h4><OwnerChart points={a.chart} loss={a.loss} hasProbs={a.probs.kind === "ok"} optimized={m && m.coverage !== null && m.contracts > 0 ? { pct: m.coverage * 100, position: m } : null} /></div>}

        <div>
          <h4 className="mb-3 font-display text-lg text-chalk">Fees, depth and rule checks</h4>
          <p className="mb-3 text-sm text-steel">Fee = M × {FEE_COEF} × contracts × P × (1 − P), with fee plus position cost rounded up once to $0.0001. Source: <a className="text-mint underline" target="_blank" rel="noopener noreferrer" href={FEE_SOURCE.url}>{FEE_SOURCE.label}<span className="sr-only"> (opens in a new tab)</span></a>.</p>
          <ul className="space-y-2" data-testid="checks">
            {a.checks.map((c: CheckT) => (
              <li key={c.id} className="flex gap-3 border border-line/60 p-3 text-sm">
                <span className={`font-mono text-[0.6rem] uppercase tracking-[0.1em] ${c.status === "pass" ? "text-mint" : c.status === "fail" ? "text-copper" : "text-steel"}`}>{c.status}</span>
                <span><strong className="text-chalk">{c.label}.</strong> <span className="text-chalk/80">{c.detail}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-steel">{Chip && <Chip tag="analyst" />} Probability-based results are assumption-dependent and are not a prediction. Scenario-based. Execution not verified.</p>
      </div>
    </details>
  );
}
