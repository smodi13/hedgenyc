"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CircleHelp, Copy, Gift, Minus, Printer, RefreshCw, RotateCcw, ShieldCheck, X } from "lucide-react";
import type { OwnerMarket } from "@/lib/kalshi/owner-market";
import { pct as pctFmt, signedUsd, usd } from "@/lib/format";
import { analyze, buildSummary, type Analysis, type Check as CheckT } from "@/lib/owner/analysis";
import { OBJECTIVE_TEXT } from "@/lib/owner/hedge";
import { EARLY_SETTLEMENT, FEE_SOURCE } from "@/lib/owner/model";
import {
  defaultScenario, FEE_COEF, ILLUSTRATIVE_PROBS, MARKET, NAN_PROBS, PRESET_NAMES, resetScenario,
  illustrativeLossRows, blankLossRows, type Objective, type Scenario, type StateKey, type Verification,
} from "@/lib/owner/model";
import { Num } from "./Num";
import { OwnerChart } from "./OwnerChart";
import { Card, Chip, F, Seg, Stat } from "./ui";

type View = "quick" | "detailed";
type MarketState = { phase: "loading" } | { phase: "ready"; m: OwnerMarket } | { phase: "unavailable" };

function useOwnerMarket() {
  const [state, setState] = useState<MarketState>({ phase: "loading" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    fetch("/api/owner-market", { cache: "no-store" })
      .then((r) => r.json() as Promise<OwnerMarket>)
      .then((m) => { if (live) setState(m && m.fetchedAt ? { phase: "ready", m } : { phase: "unavailable" }); })
      .catch(() => { if (live) setState({ phase: "unavailable" }); });
    return () => { live = false; };
  }, [tick]);
  return { state, reload: () => { setState({ phase: "loading" }); setTick((t) => t + 1); } };
}

const STATES: { k: StateKey; id: string; title: string; plain: string; icon: typeof Check; tone: string }[] = [
  { k: "lossPays", id: "A", title: "Business loses, contract pays", plain: "Low snow hurts your business and the contract pays. The payout offsets part of the loss.", icon: ShieldCheck, tone: "border-mint/60 text-mint" },
  { k: "lossLoses", id: "B", title: "Business loses, contract does not pay", plain: "Low snow hurts your business but the contract pays nothing (basis risk). You absorb the loss and the contract cost.", icon: AlertTriangle, tone: "border-copper/70 text-copper" },
  { k: "noLossPays", id: "C", title: "Business fine, contract pays", plain: "Your business is not hurt but the contract pays anyway. A gain you did not need.", icon: Gift, tone: "border-chalk/50 text-chalk" },
  { k: "noLossLoses", id: "D", title: "Business fine, contract does not pay", plain: "Your business is fine and the contract expires worthless. You are out only the contract cost.", icon: Minus, tone: "border-steel/70 text-steel" },
];

export function OwnerLab() {
  const [list, setList] = useState<Scenario[]>(() => [defaultScenario("Asset Operations Group", "s-initial")]);
  const [activeId, setActiveId] = useState("s-initial");
  const [view, setView] = useState<View>("quick");
  const [ran, setRan] = useState(false);
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");
  const { state: ms, reload } = useOwnerMarket();
  const market = ms.phase === "ready" ? ms.m : null;

  const s = list.find((x) => x.id === activeId) ?? list[0]!;
  const up = useCallback((patch: Partial<Scenario>) => setList((l) => l.map((x) => (x.id === activeId ? { ...x, ...patch } : x))), [activeId]);
  const a = useMemo(() => analyze(s, market), [s, market]);
  const [stamp, setStamp] = useState<Date | null>(null);
  const printSummary = useMemo(() => buildSummary(s, a, market, stamp), [s, a, market, stamp]);
  useEffect(() => { const f = () => setStamp(new Date()); window.addEventListener("beforeprint", f); return () => window.removeEventListener("beforeprint", f); }, []);
  const err = (k: keyof Scenario) => a.errors[k];
  const detailed = view === "detailed";

  const add = (name: string) => { const n = defaultScenario(name); setList((l) => [...l, n]); setActiveId(n.id); setRan(false); };
  const remove = () => { if (list.length < 2) return; const rest = list.filter((x) => x.id !== s.id); setList(rest); setActiveId(rest[0]!.id); };
  const missingPresets = PRESET_NAMES.filter((n) => n === "New business" || !list.some((x) => x.name === n));

  const copy = async () => {
    try { await navigator.clipboard.writeText(buildSummary(s, a, market, new Date()).text); setCopied("ok"); } catch { setCopied("fail"); }
    setTimeout(() => setCopied(""), 4000);
  };

  const onMove = (e: React.PointerEvent) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>(".glow");
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty("--mx", `${e.clientX - r.left}px`); c.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  const setProb = (k: StateKey, v: number) => up({ probs: { ...s.probs, [k]: v }, probSource: "owner" });
  const fillRemainder = () => {
    const others = (["lossPays", "lossLoses", "noLossPays"] as const).map((k) => s.probs[k]);
    if (others.some((x) => Number.isNaN(x))) return;
    up({ probs: { ...s.probs, noLossLoses: Math.round((1 - others.reduce((p, q) => p + q, 0)) * 1e8) / 1e8 }, probSource: "owner" });
  };

  return (
    <div onPointerMove={onMove} className="mx-auto max-w-[1180px] px-5 pb-24 pt-32 sm:px-8">
      <div className="no-print">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-copper">Owner Lab</p>
        <h1 className="font-display mt-3 text-4xl leading-[1.05] text-chalk sm:text-6xl">Business Hedge Calculator</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-chalk/80">Explore how event-based financial contracts could offset specific operating risks.</p>
        <p className="mt-5 inline-block border border-line bg-navy/70 px-4 py-3 text-sm text-chalk/90" data-testid="disclaimer">
          Independent research tool. Not affiliated with or endorsed by Kalshi. No trading functionality.
        </p>

        {/* scenario bar */}
        <div className="mt-8 flex flex-wrap items-center gap-3 border-y border-line py-4">
          <div role="group" aria-label="Scenarios" className="flex flex-wrap gap-2">
            {list.map((x) => (
              <button key={x.id} type="button" aria-pressed={x.id === s.id} onClick={() => { setActiveId(x.id); setRan(false); }}
                className={`border px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.1em] ${x.id === s.id ? "border-mint bg-mint/10 text-mint" : "border-line text-chalk/80 hover:border-chalk/40"}`}>{x.name || "Untitled"}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Add scenario">
            {missingPresets.map((n) => (
              <button key={n} type="button" onClick={() => add(n)} className="border border-dashed border-line px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.1em] text-steel hover:text-chalk">+ {n}</button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Seg label="View mode" value={view} onChange={setView} options={[{ v: "quick", label: "Quick view" }, { v: "detailed", label: "Detailed view" }]} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => { setList((l) => l.map((x) => (x.id === s.id ? resetScenario(x) : x))); setRan(false); }} className="inline-flex items-center gap-2 border border-line px-3 py-2.5 font-mono text-[0.68rem] uppercase tracking-[0.12em] hover:border-chalk/40"><RotateCcw className="size-3.5" aria-hidden />Reset inputs</button>
            <button type="button" onClick={copy} className="inline-flex items-center gap-2 border border-line px-3 py-2.5 font-mono text-[0.68rem] uppercase tracking-[0.12em] hover:border-chalk/40"><Copy className="size-3.5" aria-hidden />Copy summary</button>
            <button type="button" onClick={() => { setStamp(new Date()); setTimeout(() => window.print(), 60); }} className="inline-flex items-center gap-2 border border-line px-3 py-2.5 font-mono text-[0.68rem] uppercase tracking-[0.12em] hover:border-chalk/40"><Printer className="size-3.5" aria-hidden />Print / Save as PDF</button>
          </div>
        </div>
        <p role="status" data-testid="copy-status" className="mt-2 min-h-5 font-mono text-xs text-mint">{copied === "ok" ? "Summary copied to clipboard." : ""}</p>
        {copied === "fail" && (
          <div className="mb-4 border border-copper/60 p-3">
            <p className="text-sm text-copper">Clipboard unavailable. Select and copy the summary below.</p>
            <textarea readOnly aria-label="Calculation summary" value={buildSummary(s, a, market, new Date()).text} onFocus={(e) => e.currentTarget.select()} className="mt-2 h-40 w-full bg-ink p-2 font-mono text-xs" />
          </div>
        )}

        <nav aria-label="Steps" className="mb-8 grid gap-px border border-line bg-line sm:grid-cols-3">
          {[["step1", "1", "Tell us about your business"], ["step2", "2", "Understand your financial exposure"], ["step3", "3", "Compare potential hedging strategies"]].map(([id, n, t]) => (
            <a key={id} href={`#${id}`} className="bg-ink px-4 py-3 text-sm text-chalk/90 hover:bg-navy"><span className="mr-2 font-mono text-copper">{n}</span>{t}</a>
          ))}
        </nav>
        <ul className="mb-8 flex flex-wrap gap-2" aria-label="Data legend">
          {(["fact", "owner", "analyst", "market", "hypo"] as const).map((t) => <li key={t}><Chip tag={t} /></li>)}
        </ul>

        <div className="space-y-6">
          {/* ---------------- STEP 1 ---------------- */}
          <StepHead id="step1" n="1" t="Tell us about your business" />
          <Card title="Scenario" tag="owner">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Scenario name" value={s.name} onChange={(v) => up({ name: v })} testId="scenario-name" />
              <div>
                <label htmlFor="verif" className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-chalk/80">Assumption verification status</label>
                <select id="verif" value={s.verification} onChange={(e) => up({ verification: e.target.value as Verification })} className="mt-1.5 w-full border border-line bg-ink px-3 py-2.5 text-base text-chalk">
                  <option value="illustrative">Illustrative defaults, not verified</option>
                  <option value="owner-reported">Owner-reported, not independently verified</option>
                  <option value="documented">Documented from owner records</option>
                </select>
              </div>
              {detailed && <TextField label="Location" value={s.location} onChange={(v) => up({ location: v })} />}
              {detailed && <TextField label="Notes" value={s.notes} onChange={(v) => up({ notes: v })} multiline />}
            </div>
            {s.verification === "illustrative" && <p className="mt-3 text-sm text-copper">All figures below are generic illustrative defaults. They are not this company&apos;s verified financials.</p>}
            {s.publicFacts && (
              <div className="mt-4 border border-line p-4 text-sm leading-relaxed text-chalk/85">
                <Chip tag="fact" />
                <p className="mt-2">Public facts from the company&apos;s own site: snow removal is pay-per-push with no flat seasonal snow-removal contracts; the residential base price is $60 per push; services also include commercial snow removal, salting, ice management and property maintenance. <a className="text-mint underline" target="_blank" rel="noopener noreferrer" href="https://assetoperationsgroup.com/chicagoland-snow-plowing-ice-management">Source<span className="sr-only"> (opens in a new tab)</span></a></p>
                <p className="mt-2 text-steel">Not public, and not assumed: customer counts, operating margins, historical revenue and contract mix. The business is not assumed to depend entirely on snow. Only revenue and margin that actually fall in a low-snow December are modeled as lost.</p>
              </div>
            )}
            {list.length > 1 && <button type="button" onClick={remove} className="mt-4 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-steel underline hover:text-copper">Delete this scenario</button>}
          </Card>

          <Card title="Your snow-removal operation" tag="owner" aside={detailed ? <Seg label="Exposure method" value={s.method} onChange={(v) => up({ method: v })} options={[{ v: "simple", label: "Quick margin" }, { v: "buildup", label: "Cost build-up" }]} /> : null}>
            {s.method === "simple" || !detailed ? (
              <>
                {s.method === "buildup" && <p className="mb-4 border border-line p-3 text-sm text-steel">This scenario uses the cost build-up method (shown in Detailed view). Loss to protect: <strong className="text-chalk">{usd(a.loss)}</strong>.</p>}
                {s.method === "simple" && (
                  <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                    <F label="Customers" name="Customers" value={s.customers} onChange={(v) => up({ customers: v })} min={0} max={500} step={1} testId="in-customers" err={err("customers")} />
                    <F label="Normal December visits per customer" name="Normal visits" value={s.normalVisits} onChange={(v) => up({ normalVisits: v })} min={0} max={12} step={0.5} testId="in-normal" err={err("normalVisits")} />
                    <F label="Low-snow December visits per customer" name="Low-snow visits" value={s.lowVisits} onChange={(v) => up({ lowVisits: v })} min={0} max={12} step={0.5} testId="in-low" err={err("lowVisits")} />
                    <F label="Revenue per visit" name="Revenue per visit" prefix="$" value={s.revPerVisit} onChange={(v) => up({ revPerVisit: v })} min={0} max={500} step={1} testId="in-rev" err={err("revPerVisit")} />
                    <F label="Contribution margin" name="Contribution margin" pct value={s.margin} onChange={(v) => up({ margin: v })} min={0} max={100} step={1} testId="in-margin" err={err("margin")} hint="Revenue left after the costs that change with each visit." />
                  </div>
                )}
              </>
            ) : <Buildup s={s} up={up} err={err} a={a} />}
            {detailed && (
              <div className="mt-6 grid gap-x-6 gap-y-5 border-t border-line pt-6 sm:grid-cols-2">
                <div>
                  <label className="flex items-center gap-2 text-sm text-chalk/90"><input type="checkbox" checked={s.useOverride} onChange={(e) => up({ useOverride: e.target.checked, overrideLoss: e.target.checked && !s.overrideLoss ? a.exposure.lostContribution : s.overrideLoss })} />Use my own figure for the loss I want to protect</label>
                </div>
                {s.useOverride && <F label="Loss to protect" prefix="$" name="Loss to protect" value={s.overrideLoss} onChange={(v) => up({ overrideLoss: v })} min={0} max={50000} step={50} testId="in-override" err={err("overrideLoss")} />}
                <F label="Historical variability of loss size" name="Variability" pct value={s.variability} onChange={(v) => up({ variability: v })} min={0} max={100} step={5} err={err("variability")} badge="Stress test" hint="Stress test only: worst case = modeled loss × (1 + variability). It does NOT make the optimizer model a distribution of loss sizes; use the multi-level loss model for that." />
              </div>
            )}
          </Card>

          <Card title="Hedge inputs" tag="analyst">
            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <F label="Target protection if contract pays" name="Target protection" pct value={s.coverage} onChange={(v) => up({ coverage: v })} min={0} max={100} step={1} testId="in-coverage" err={err("coverage")} hint="Share of the loss the contract's net winning profit should repay." />
              <F label="NO contract purchase price" name="Contract price" prefix="$" value={s.price} onChange={(v) => up({ price: v })} min={0.01} max={0.99} step={0.01} testId="in-price" err={err("price")} badge="Illustrative" hint={a.priceSource === "live" ? "Ignored while the live order book is selected." : "An illustrative input, not a verified executable price."} />
              {detailed && <F label="Fee multiplier (M)" name="Fee multiplier" value={s.feeMult} onChange={(v) => up({ feeMult: v })} min={0} max={2} step={0.05} slider={false} testId="in-feemult" err={err("feeMult")} badge="Analyst assumption" hint={a.priceSource === "live" ? "Ignored: live mode uses the multiplier Kalshi publishes for the series." : "General taker multiplier. Confirm it for this market; live mode reads the published value."} />}
            </div>
          </Card>

          {/* ---------------- STEP 2 ---------------- */}
          <StepHead id="step2" n="2" t="Understand your financial exposure" />
          <p className="max-w-3xl text-chalk/85">Your business may earn less when snowfall is low. This contract may pay under certain low-snow conditions, but it can also expire worthless or fail to match your actual losses.</p>
          {!a.valid ? <InvalidCard a={a} /> : (
            <>
              <Card title="Headline numbers" tag="hypo">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat k="Estimated exposure (lost contribution)" big><Num value={a.loss} testId="out-loss" /></Stat>
                  <Stat k="Contracts for target" big sub={a.manualUnreachable ? "Not reachable with available depth" : "Whole contracts only"}><Num value={a.manualUnreachable ? null : a.manual!.contracts} kind="int" testId="out-contracts" /></Stat>
                  <Stat k="Total cash at risk" tone="copper" big sub="Maximum amount lost if it expires worthless"><Num value={a.manualUnreachable ? null : a.manual!.cost} testId="out-cash" /></Stat>
                  <Stat k="Net profit if contract pays" tone="mint" big sub={`Target ${usd(a.target)}`}><Num value={a.manualUnreachable ? null : a.manual!.netWin} testId="out-netwin" /></Stat>
                </div>
                {a.warnings.map((w) => <p key={w} className="mt-4 border-l-2 border-copper pl-3 text-sm text-copper">{w}</p>)}
              </Card>
              <SizingResult a={a} s={s} />
              <Card title="Payout comparison" tag="hypo">
                <Bars a={a} />
              </Card>
              {detailed && <DetailBlocks a={a} s={s} />}
            </>
          )}

          {/* ---------------- STEP 3 ---------------- */}
          <StepHead id="step3" n="3" t="Compare potential hedging strategies" />
          {a.valid && (
            <>
              <Card title="Your risk preferences" tag="owner">
                <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                  <F label="Maximum upfront hedge spend" prefix="$" name="Budget" value={s.budget} onChange={(v) => up({ budget: v })} min={0} max={2000} step={10} testId="in-budget" err={err("budget")} hint="Required for any personalized allocation. Left blank, none is produced." />
                  <F label="Maximum acceptable trading loss" prefix="$" name="Max trading loss" value={s.maxTradingLoss} onChange={(v) => up({ maxTradingLoss: v })} min={0} max={2000} step={10} testId="in-maxloss" err={err("maxTradingLoss")} hint="A bought contract can lose at most its entry cost." />
                  <div>
                    <p className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-chalk/80">Desired protection</p>
                    <p className="mt-2 text-chalk"><span className="tnum">{pctFmt(s.coverage, 0)}</span> <span className="text-sm text-steel">(set in Hedge inputs)</span></p>
                  </div>
                  <F label="Expected chance of a low-snow December" pct name="Low-snow probability" value={s.lowSnowProb} onChange={(v) => up({ lowSnowProb: v })} min={0} max={100} step={1} slider={false} err={err("lowSnowProb")} hint="Optional. Compared with the four-state probabilities below." />
                  {detailed && <F label="Position limit (contracts, 0 = none known)" name="Position limit" value={s.positionLimit} onChange={(v) => up({ positionLimit: v })} min={0} max={10000} step={10} slider={false} err={err("positionLimit")} />}
                  <F label="Maximum permitted winning-payout coverage" pct name="Max coverage" value={s.maxCoverage} onChange={(v) => up({ maxCoverage: v })} min={0} max={200} step={5} testId="in-maxcov" err={err("maxCoverage")} hint="Net profit if the contract pays may not exceed this share of the modeled loss. 100% means never more than the loss." />
                </div>
                <fieldset className="mt-6">
                  <legend className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-chalk/80">Optimization objective</legend>
                  <div className="mt-2 grid gap-3 lg:grid-cols-3">
                    {(["variance", "cvar", "target"] as Objective[]).map((o) => (
                      <label key={o} className={`block cursor-pointer border p-4 ${s.objective === o ? "border-mint bg-mint/5" : "border-line"}`}>
                        <input type="radio" name="objective" className="mr-2" checked={s.objective === o} onChange={() => up({ objective: o })} />
                        <span className="text-chalk">{OBJECTIVE_TEXT[o].name}</span>
                        <span className="mt-1 block text-xs leading-snug text-steel">{OBJECTIVE_TEXT[o].math}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </Card>

              <Card title={s.lossModel === "simple" ? "Simplified four-state model" : "Multiple loss levels"} tag="owner" aside={<Seg label="Loss model" value={s.lossModel} onChange={(v) => up({ lossModel: v })} options={[{ v: "simple", label: "Four-state" }, { v: "multi", label: "Loss levels" }]} />}>
                <p className="mb-4 max-w-3xl text-sm text-chalk/80">
                  {s.lossModel === "simple"
                    ? "How likely is each combination of business result and contract result? The business either loses the modeled amount or does not. Business losses and the contract are not assumed to move together."
                    : "Define several possible operating losses. For each, say how likely it is that the contract pays and that it does not. All probabilities together must sum to 100%."}{" "}
                  Only enter probabilities you can support. None are filled in for you, and entered values are never reset silently.
                </p>
                {s.lossModel === "simple" ? (
                  <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
                    {STATES.map((st) => (
                      <F key={st.k} label={`${st.id}. ${st.title}`} pct name={st.title} value={s.probs[st.k]} onChange={(v) => setProb(st.k, v)} min={0} max={100} step={1} slider={false} testId={`prob-${st.k}`} />
                    ))}
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
                  <button type="button" onClick={() => up(s.lossModel === "simple" ? { probs: { ...ILLUSTRATIVE_PROBS }, probSource: "illustrative" } : { lossRows: illustrativeLossRows(a.loss), probSource: "illustrative" })} className="border border-line px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.12em] hover:border-chalk/40" data-testid="load-illustrative">Load illustrative placeholder</button>
                  <button type="button" onClick={() => up({ probs: { ...NAN_PROBS }, lossRows: blankLossRows(), probSource: "owner" })} className="px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-steel underline">Clear</button>
                </div>
                <div role="status" data-testid="prob-status" className="mt-3 text-sm">
                  {a.probs.kind === "ok" && a.stats ? (
                    <div className="space-y-1">
                      <p className="text-mint">Sum 100%.{a.probs.source === "illustrative" && <span className="text-copper"> Illustrative placeholder, not history: results are assumption-dependent.</span>}</p>
                      <ul className="grid gap-1 text-chalk/85 sm:grid-cols-2">
                        <li data-testid="stat-loss"><strong>Chance of a business loss:</strong> {pctFmt(a.stats.pLoss, 1)}{s.lossModel === "simple" ? " (A + B)" : ""}. How often your business earns less than normal.</li>
                        <li data-testid="stat-payout"><strong>Chance the contract pays:</strong> {pctFmt(a.stats.pPayout, 1)}{s.lossModel === "simple" ? " (A + C)" : ""}. The entered price implies about {pctFmt(s.price, 0)}.</li>
                        <li data-testid="stat-miss"><strong>Chance of a loss with no payout:</strong> {pctFmt(a.stats.pLossNoPay, 1)}{s.lossModel === "simple" ? " (B)" : ""}. This is basis risk.</li>
                        <li data-testid="stat-cond"><strong>Payout when the business loses:</strong> {a.stats.pPayGivenLoss === null ? "n/a (no business loss modeled)" : `${pctFmt(a.stats.pPayGivenLoss, 1)}${s.lossModel === "simple" ? " (A ÷ (A + B))" : ""}`}. Below 100% means the contract does not always pay when you need it.</li>
                      </ul>
                    </div>
                  ) : a.probs.kind === "invalid" ? <p className="text-copper" data-testid="prob-error">{a.probs.error}</p>
                    : <p className="text-steel">Not provided. Variance and CVaR optimization are blocked: insufficient information for a personalized optimal hedge estimate.</p>}
                </div>
              </Card>

              <div className="flex flex-wrap items-center gap-4">
                <button type="button" data-testid="find-hedge" onClick={() => { setRan(true); setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}
                  className="bg-mint px-8 py-4 font-mono text-sm font-medium uppercase tracking-[0.18em] text-ink transition-transform hover:-translate-y-0.5">Find my hedge</button>
                <p className="max-w-xl text-sm text-steel">Evaluates every whole-contract quantity within your limits, including zero, under the objective you selected.</p>
              </div>

              {ran && a.opt && <Results a={a} s={s} />}
              <Compare a={a} ran={ran} />
              <Card title="Coverage vs. financial impact" tag="hypo">
                <OwnerChart points={a.chart} loss={a.loss} hasProbs={a.probs.kind === "ok"}
                  optimized={ran && a.opt && a.opt.status === "ok" ? { pct: (a.opt.position.coverage ?? 0) * 100, position: a.opt.position } : null} />
              </Card>
              <MarketCard a={a} s={s} ms={ms} market={market} reload={reload} onToggle={(v) => up({ useLive: v })} />
              {detailed && <Suitability a={a} s={s} />}
            </>
          )}
        </div>
        <p className="mt-12 max-w-3xl border-t border-line pt-6 text-sm leading-relaxed text-steel">
          Hypothetical outcomes only. Nothing here guarantees protection, savings or profit, and nothing here is a recommendation to trade. Contracts can expire worthless. Entered figures stay in your browser and are never sent anywhere; they leave only if you copy or print the summary.
        </p>
      </div>

      <PrintView summary={printSummary} />
    </div>
  );
}

function ModeTag({ a }: { a: Analysis }) {
  const prob = a.basis === "probability";
  return (
    <span className={`inline-block border px-3 py-1 font-mono text-[0.68rem] uppercase tracking-[0.12em] ${prob ? "border-mint/60 text-mint" : "border-copper/60 text-copper"}`}>
      {prob ? "Probability-based optimization" : "Illustrative hedge sizing"}
      {prob && a.probs.kind === "ok" && a.probs.source === "illustrative" ? " · assumption-dependent" : ""}
    </span>
  );
}

function SizingResult({ a, s }: { a: Analysis; s: Scenario }) {
  const m = a.manual!, bad = m.budgetOk === false || m.lossCapOk === false || !m.positionOk || !m.coverageOk;
  const entered = !Number.isNaN(s.budget) && !Number.isNaN(s.maxTradingLoss);
  const ver = { illustrative: "illustrative", "owner-reported": "owner-reported", documented: "documented" }[s.verification];
  const rows: [string, string, string][] = [
    ["loss", "Estimated business loss", usd(a.loss)],
    ["protection", "Desired protection", `${pctFmt(s.coverage, 0)} (${usd(a.target)} if the contract pays)`],
    ["qty", "Financially feasible contract quantity", a.manualUnreachable ? "None: target cannot be filled" : !entered ? `${m.contracts.toLocaleString("en-US")} needed (no budget entered, so affordability is unknown)` : bad ? `None within your limits (target needs ${m.contracts.toLocaleString("en-US")})` : m.contracts.toLocaleString("en-US")],
    ["cost", "Total cost and maximum trading loss", a.manualUnreachable ? "n/a" : `${usd(m.cost)} (the most you can lose)`],
    ["win", "Net profit if the contract pays", a.manualUnreachable ? "n/a" : usd(m.netWin)],
    ["lose", "Outcome if the contract does not pay", a.manualUnreachable ? "n/a" : `${usd(-(a.loss + m.cost))} (loss plus contract cost)`],
    ["basis", "Basis risk", a.stats ? `${pctFmt(a.stats.pLossNoPay, 1)} chance of a loss with no payout` : "Not estimated: no probabilities entered"],
    ["fits", "Fits your budget", !entered ? "Not entered" : bad ? "No" : "Yes"],
    ["exec", "Market execution", a.priceSource === "live" ? "Order-book snapshot, not guaranteed" : a.liveUnavailable ? "Live book unavailable: nothing executable confirmed" : "Illustrative price, not verified"],
    ["probs", "Probability basis", a.probs.kind !== "ok" ? "None entered" : a.probs.source === "illustrative" ? "Illustrative placeholder" : `Owner-entered (${ver})`],
  ];
  return (
    <Card title="Hedge sizing result" tag="hypo" aside={<span data-testid="sizing-label"><ModeTag a={{ ...a, basis: "sizing" }} /></span>}>
      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2" data-testid="sizing">
        {rows.map(([id, k, v]) => (
          <div key={id} className="border-b border-line/60 pb-2"><dt className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-steel">{k}</dt><dd data-testid={`sz-${id}`} className="tnum mt-0.5 text-chalk">{v}</dd></div>
        ))}
      </dl>
      <p className="mt-4 text-sm text-steel">This sizes a contract to a protection target you chose. It is not a recommended allocation and does not claim positive expected value. Use Step 3 for a probability-based comparison.</p>
    </Card>
  );
}

function StepHead({ id, n, t }: { id: string; n: string; t: string }) {
  return <h2 id={id} className="font-display flex items-baseline gap-4 pt-8 text-3xl text-chalk sm:text-4xl"><span className="font-mono text-base text-copper">STEP {n}</span>{t}</h2>;
}

function TextField({ label, value, onChange, multiline, testId }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; testId?: string }) {
  const id = `tf-${label.replace(/\s/g, "")}`;
  const cls = "mt-1.5 w-full border border-line bg-ink px-3 py-2.5 text-base text-chalk focus:border-mint outline-none";
  return (
    <div>
      <label htmlFor={id} className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-chalk/80">{label}</label>
      {multiline ? <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={cls} /> : <input id={id} data-testid={testId} value={value} onChange={(e) => onChange(e.target.value)} className={cls} />}
    </div>
  );
}

function InvalidCard({ a }: { a: Analysis }) {
  return (
    <Card title="Check your inputs" tag="owner">
      <ul data-testid="invalid" className="list-disc space-y-1 pl-5 text-copper">{Object.values(a.errors).map((e, i) => <li key={i}>{e}</li>)}</ul>
      <p className="mt-3 text-sm text-steel">No results are shown until every input is valid.</p>
    </Card>
  );
}

function Buildup({ s, up, err, a }: { s: Scenario; up: (p: Partial<Scenario>) => void; err: (k: keyof Scenario) => string | undefined; a: Analysis }) {
  return (
    <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
      <F label="Residential customers" name="Residential customers" value={s.resCustomers} onChange={(v) => up({ resCustomers: v })} min={0} max={500} step={1} err={err("resCustomers")} />
      <F label="Commercial customers" name="Commercial customers" value={s.comCustomers} onChange={(v) => up({ comCustomers: v })} min={0} max={200} step={1} err={err("comCustomers")} />
      {s.publicFacts
        ? <p className="text-sm text-steel">Billing: per push only. No seasonal snow contracts are assumed for this company.</p>
        : (
          <div>
            <label className="flex items-center gap-2 text-sm text-chalk/90"><input type="checkbox" checked={s.seasonalEnabled} onChange={(e) => up({ seasonalEnabled: e.target.checked })} />This company has seasonal snow contracts</label>
            {s.seasonalEnabled && <div className="mt-3"><F label="Fixed seasonal revenue in December" prefix="$" name="Seasonal revenue" value={s.seasonalRevenue} onChange={(v) => up({ seasonalRevenue: v })} min={0} max={50000} step={100} err={err("seasonalRevenue")} hint="Enter the actual contractual amount. It is kept whatever the snowfall; nothing is derived from visits." /></div>}
          </div>
        )}
      <F label="Avg revenue per residential visit" prefix="$" name="Residential revenue" value={s.resRev} onChange={(v) => up({ resRev: v })} min={0} max={500} step={1} err={err("resRev")} />
      <F label="Avg revenue per commercial visit" prefix="$" name="Commercial revenue" value={s.comRev} onChange={(v) => up({ comRev: v })} min={0} max={2000} step={5} err={err("comRev")} />
      <div />
      <F label="Typical December visits" name="Normal visits" value={s.normalVisits} onChange={(v) => up({ normalVisits: v })} min={0} max={12} step={0.5} err={err("normalVisits")} />
      <F label="Low-snow December visits" name="Low-snow visits" value={s.lowVisits} onChange={(v) => up({ lowVisits: v })} min={0} max={12} step={0.5} err={err("lowVisits")} />
      <div />
      <F label="Labor per visit" prefix="$" name="Labor" value={s.labor} onChange={(v) => up({ labor: v })} min={0} max={200} step={1} err={err("labor")} />
      <F label="Fuel per visit" prefix="$" name="Fuel" value={s.fuel} onChange={(v) => up({ fuel: v })} min={0} max={100} step={0.5} err={err("fuel")} />
      <F label="Salt and materials per visit" prefix="$" name="Salt" value={s.salt} onChange={(v) => up({ salt: v })} min={0} max={100} step={0.5} err={err("salt")} />
      <F label="Other avoidable costs in a normal December" prefix="$" name="Avoidable costs" value={s.otherAvoidable} onChange={(v) => up({ otherAvoidable: v })} min={0} max={20000} step={50} err={err("otherAvoidable")} hint="Costs you avoid when snow is low." />
      <F label="Salting / ice revenue, normal December" prefix="$" name="Salting revenue" value={s.saltingRevenue} onChange={(v) => up({ saltingRevenue: v })} min={0} max={20000} step={50} err={err("saltingRevenue")} />
      <F label="Revenue retained despite low snow" prefix="$" name="Retained revenue" value={s.retainedRevenue} onChange={(v) => up({ retainedRevenue: v })} min={0} max={20000} step={50} err={err("retainedRevenue")} hint="Other low-snow December revenue not tied to visits." />
      {a.valid && <p className="col-span-full text-sm text-steel">Modeled shortfall: normal contribution <span className="tnum text-chalk">{usd(a.exposure.normalContribution)}</span> − low-snow contribution <span className="tnum text-chalk">{usd(a.exposure.lowContribution)}</span> = <span className="tnum text-chalk">{usd(a.exposure.lostContribution)}</span>.</p>}
    </div>
  );
}

function Bars({ a }: { a: Analysis }) {
  const m = a.manual!;
  const max = Math.max(a.loss, m.netWin, m.cost, 1);
  const rows = [
    { k: "Loss to the business if snow is low", v: a.loss, c: "bg-copper" },
    { k: "Net payout if the contract pays", v: m.netWin, c: "bg-mint" },
    { k: "Cash you could lose on the contract", v: m.cost, c: "bg-steel" },
  ];
  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <li key={r.k}>
          <div className="flex items-baseline justify-between gap-3 text-sm"><span className="text-chalk/85">{r.k}</span><span className="tnum text-chalk">{usd(r.v)}</span></div>
          <div className="mt-1.5 h-3 bg-chalk/10"><div className={`bar-fill h-full ${r.c}`} style={{ width: `${Math.min(100, (r.v / max) * 100)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

function DetailBlocks({ a, s }: { a: Analysis; s: Scenario }) {
  const e = a.exposure, m = a.manual!;
  const row = (k: string, v: string, id?: string) => (<div className="flex justify-between gap-4 border-b border-line/60 py-2 text-sm"><dt className="text-chalk/80">{k}</dt><dd data-testid={id} className="tnum text-right text-chalk">{v}</dd></div>);
  return (
    <>
      <Card title="Contribution-margin calculation" tag="hypo">
        <div className="grid gap-x-10 md:grid-cols-2">
          <dl>
            {row("Normal December revenue", usd(e.normalRevenue))}{row("Low-snow December revenue", usd(e.lowRevenue))}{row("Lost revenue", usd(e.lostRevenue), "d-lostrev")}
            {row(s.method === "simple" ? `× contribution margin ${pctFmt(s.margin, 0)}` : "Normal contribution margin", s.method === "simple" ? "" : usd(e.normalContribution))}
            {s.method === "buildup" && row("Low-snow contribution margin", usd(e.lowContribution))}
            {row("Lost contribution margin", usd(e.lostContribution), "d-lostcm")}
          </dl>
          <dl>
            {row("Target protection", usd(a.target))}
            {m && !a.manualUnreachable && <>
              {row("Contracts", m.contracts.toLocaleString("en-US"))}{row("Contract principal", usd(m.premium), "d-principal")}
              {row(`Estimated fee (M × ${FEE_COEF} × C × P × (1−P), centicent precision)`, usd(m.fee), "d-fee")}{row("Total cash at risk", usd(m.cost))}
              {row("Gross payout if it pays", usd(m.contracts))}{row("Net winning profit", usd(m.netWin))}
              {row("Break-even probability (trading alone)", m.breakEvenProb === null ? "n/a" : pctFmt(m.breakEvenProb, 2))}
            </>}
          </dl>
        </div>
        <p className="mt-4 text-sm text-steel">Internally exact to $0.0001 (fee plus cost rounded up to a centicent); shown to the cent. Contracts are always whole numbers: the smallest count whose net winning profit meets the target.</p>
      </Card>

      <Card title="Four joint outcomes" tag="hypo">
        {a.manualUnreachable ? <p className="text-steel">Target not reachable.</p> : (
          <div className="grid gap-4 sm:grid-cols-2" data-testid="outcomes">
            {STATES.map((st) => {
              const v = m.outcomes[st.k], I = st.icon;
              return (
                <div key={st.k} className={`lift border p-5 ${st.tone}`}>
                  <p className="flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.14em]"><I className="size-4" aria-hidden />Outcome {st.id}</p>
                  <p className="mt-2 text-chalk">{st.title}</p>
                  <p className="font-display mt-2 text-3xl"><Num value={v} testId={`out-${st.id}`} /></p>
                  <p className="mt-2 text-xs leading-snug text-chalk/70">{st.plain}</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Why it may not work: basis risk" tag="analyst">
        <p className="max-w-3xl leading-relaxed text-chalk/85">Basis risk means the contract and your business are measuring different things. The contract settles on snowfall at one airport (O&apos;Hare) for a calendar month. Your customers are spread across the city and your lost visits depend on when storms fall, not only on the month&apos;s total. Your business can lose money in a month when the contract pays nothing (outcome B), and the contract can pay when you lost nothing (outcome C). The four-state probabilities in Step 3 let you say how often each happens.</p>
      </Card>

      <Card title="Contract assumptions" tag="market">
        <ul className="grid gap-2 text-sm text-chalk/85 sm:grid-cols-2">
          <li><strong>Market:</strong> {MARKET.ticker}</li><li><strong>Event:</strong> {MARKET.threshold}</li>
          <li><strong>Side modeled:</strong> NO. Pays $1 per winning contract if the YES condition is false, subject to the actual market rules.</li>
          <li><strong>Multiplier:</strong> 1. Whole contracts only.</li>
          <li><strong>Fee:</strong> round_up(M × {FEE_COEF} × C × P × (1−P)); fee + position cost rounded up to $0.0001. M = {a.feeMult}. Multi-level fills apply the formula to each execution quantity.</li>
          <li><strong>Price:</strong> illustrative input unless you select the live order book.</li>
          <li className="sm:col-span-2" data-testid="early-settlement"><strong>Early settlement:</strong> {EARLY_SETTLEMENT}</li>
          <li className="sm:col-span-2" data-testid="fee-source"><strong>Fee source:</strong> <a className="text-mint underline" target="_blank" rel="noopener noreferrer" href={FEE_SOURCE.url}>{FEE_SOURCE.label}<span className="sr-only"> (opens in a new tab)</span></a>. General taker formula: Fee = round_up(M × {FEE_COEF} × C × P × (1−P)); fee + position cost rounded up to the next centicent ($0.0001).</li>
          <li className="sm:col-span-2"><a className="text-mint underline" target="_blank" rel="noopener noreferrer" href={MARKET.url}>Official market page<span className="sr-only"> (opens in a new tab)</span></a></li>
        </ul>
      </Card>
    </>
  );
}

function Results({ a, s }: { a: Analysis; s: Scenario }) {
  const o = a.opt!, p = o.position, b = o.baseline;
  return (
    <Card id="results" title="Your hedge analysis" tag="hypo" aside={<span data-testid="exec-label" className="font-mono text-[0.68rem] uppercase tracking-[0.1em] text-copper">{a.priceSource === "live" ? "Order-book snapshot · not a guaranteed fill" : a.liveUnavailable ? "Live book unavailable · nothing executable confirmed" : a.scenarioLabel}</span>}>
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-steel">Objective</p>
      <p className="mt-1 text-lg text-chalk" data-testid="opt-objective">{OBJECTIVE_TEXT[o.objective].name}</p>
      <p className="mt-1 max-w-3xl text-sm text-steel">{OBJECTIVE_TEXT[o.objective].math} Constraints: spend ≤ {Number.isNaN(s.budget) ? "not entered" : usd(s.budget)}, trading loss ≤ {Number.isNaN(s.maxTradingLoss) ? "not entered" : usd(s.maxTradingLoss)}, winning payout ≤ {pctFmt(s.maxCoverage, 0)} of the modeled loss{s.positionLimit > 0 ? `, ≤ ${s.positionLimit} contracts` : ""}.</p>
      <p data-testid="basis-label" className="mt-3"><ModeTag a={a} /></p>

      {o.status === "insufficient" ? (
        <p data-testid="opt-insufficient" className="mt-5 border border-copper/60 p-4 text-copper">{o.why}<span className="mt-1 block text-sm text-chalk/80">Enter probabilities you can support (or load the illustrative placeholder to explore), or choose “Target protection at minimum cost”.</span></p>
      ) : o.status === "infeasible" ? (
        <div data-testid="opt-infeasible" className="mt-5 border border-copper/60 p-4">
          <p className="text-copper">{o.why}</p>
          <p className="mt-2 text-sm text-chalk/85">Zero contracts is the only position inside your limits. {o.required && <>For reference, the target needs {o.required.contracts.toLocaleString("en-US")} contracts costing {usd(o.required.cost)}, with net profit {usd(o.required.netWin)} if it pays.</>}</p>
        </div>
      ) : (
        <>
          <p data-testid="opt-why" className={`mt-5 border-l-2 pl-3 ${p.contracts === 0 ? "border-copper text-copper" : "border-mint text-chalk"}`}>
            {p.contracts === 0 ? `Recommended under this objective: buy zero contracts. ${o.why}` : `Calculated position: ${p.contracts.toLocaleString("en-US")} contracts. ${o.why}`}
          </p>
          {a.basis === "probability" && a.probs.kind === "ok" && a.probs.source === "illustrative" && <p className="mt-2 text-sm text-copper">Based on illustrative placeholder probabilities: assumption-dependent, not a personalized estimate.</p>}
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat k="Calculated contracts" big tone="mint"><Num value={p.contracts} kind="int" testId="opt-contracts" /></Stat>
            <Stat k="Winning-payout coverage" sub="Net profit if it pays ÷ loss"><Num value={p.coverage} kind="pct" testId="opt-coverage" /></Stat>
            <Stat k="Required upfront capital"><Num value={p.cost} testId="opt-cost" /></Stat>
            <Stat k="Maximum contract loss" tone="copper"><Num value={p.maxLoss} testId="opt-maxloss" /></Stat>
            <Stat k="Expected trading P&L" sub="Under your probabilities"><Num value={p.expTrading} testId="opt-exptrading" /></Stat>
            <Stat k="Expected combined P&L" sub={b.expCombined === null ? undefined : `No hedge: ${usd(b.expCombined)}`}><Num value={p.expCombined} testId="opt-expcombined" /></Stat>
            <Stat k="Worst modeled combined outcome" sub={`No hedge: ${usd(b.worst)}`}><Num value={p.worst} testId="opt-worst" /></Stat>
            <Stat k="90% CVaR before → after" sub={b.cvar90 === null || p.cvar90 === null ? "needs probabilities" : `${usd(b.cvar90)} → ${usd(p.cvar90)}`}><Num value={p.cvar90 === null || b.cvar90 === null ? null : p.cvar90 - b.cvar90} testId="opt-cvar" /></Stat>
          </div>
          <ul className="mt-5 grid gap-2 text-sm text-chalk/85 sm:grid-cols-2">
            <li><strong>Basis-risk exposure:</strong> {p.basisMissProb === null ? "needs probabilities" : `${pctFmt(p.basisMissProb, 1)} chance you lose money and the contract pays nothing; that state costs ${usd(-p.outcomes.lossLoses)}.`}</li>
            <li><strong>Stress case</strong> (loss +{pctFmt(s.variability, 0)}): worst outcome {usd(p.stressWorst)}.</li>
            <li data-testid="opt-constraints"><strong>Owner limits:</strong> {p.allOk ? "all entered and satisfied" : "not all satisfied"} (spend {p.budgetOk === null ? "not entered" : p.budgetOk ? "ok" : "exceeded"}, trading loss {p.lossCapOk === null ? "not entered" : p.lossCapOk ? "ok" : "exceeded"}, position {p.positionOk ? "ok" : "exceeded"}, coverage {p.coverageOk ? "ok" : "exceeded"}).</li>
            <li data-testid="opt-exceeds"><strong>Coverage:</strong> {p.coverage === null ? "n/a" : pctFmt(p.coverage, 1)} of the modeled loss. {p.exceedsLoss ? "Winning payout exceeds modeled loss." : "Winning payout does not exceed the modeled loss."} If the business has no loss but the contract pays, you keep <span className="tnum">{usd(p.outcomes.noLossPays)}</span> (outcome C).</li>
          </ul>
          <p className="mt-4 text-sm text-steel">This is a calculation under the stated assumptions, not a guarantee that a hedge will work and not a recommendation to trade.</p>
        </>
      )}
    </Card>
  );
}

function Compare({ a, ran }: { a: Analysis; ran: boolean }) {
  const o = a.opt;
  const sufficient = ran && !!o && o.status === "ok";
  return (
    <Card title="Hedge size comparison" tag="hypo" aside={<span className="font-mono text-[0.68rem] uppercase tracking-[0.1em] text-copper">Illustrative hedge sizing, none is a recommended allocation</span>}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="compare">
        {a.compare.map((r) => {
          const p = r.position, isOpt = r.id === "opt", hl = isOpt && sufficient;
          return (
            <div key={r.id} data-testid={`cmp-${r.id}`} data-highlight={hl} className={`lift border p-4 ${hl ? "border-mint bg-mint/5" : "border-line bg-ink/40"}`}>
              <p className="flex items-center justify-between gap-2 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-chalk">{r.label}{hl && <span className="text-mint">Optimized</span>}</p>
              {isOpt && !sufficient && <p className="mt-2 text-xs text-steel">{!ran ? "Press “Find my hedge” to calculate." : o?.status === "insufficient" ? "Insufficient inputs for a personalized estimate." : "No feasible position."}</p>}
              {(!isOpt || sufficient) && (p ? (
                <dl className="mt-3 space-y-1.5 text-sm">
                  <Line k="Contracts" v={p.contracts.toLocaleString("en-US")} />
                  <Line k="Entry cost" v={usd(p.cost)} warn={p.budgetOk === false} />
                  <Line k="Net payout if it wins" v={usd(p.netWin)} />
                  <Line k="Loss left if it pays" v={usd(Math.max(0, a.loss - p.netWin))} />
                  <Line k="Loss if it does not pay" v={usd(a.loss + p.cost)} />
                  <Line k="Gain if no loss but it pays" v={usd(p.outcomes.noLossPays)} />
                  <Line k="Expected result" v={p.expCombined === null ? "needs probabilities" : signedUsd(p.expCombined)} />
                </dl>
              ) : <p className="mt-3 text-sm text-steel">Not reachable with the available depth.</p>)}
              {p && p.budgetOk === false && (!isOpt || sufficient) && <p className="mt-2 text-xs text-copper">Over your budget.</p>}
              {p && p.exceedsLoss && (!isOpt || sufficient) && <p className="mt-2 text-xs text-copper">Winning payout exceeds modeled loss.</p>}
              {hl && o!.position.contracts === 0 && <p className="mt-3 text-xs text-copper">{o!.why}</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
const Line = ({ k, v, warn }: { k: string; v: string; warn?: boolean }) => (<div className="flex justify-between gap-3"><dt className="text-steel">{k}</dt><dd className={`tnum text-right ${warn ? "text-copper" : "text-chalk"}`}>{v}</dd></div>);

const ICON = { pass: Check, fail: X, manual: CircleHelp, unavailable: CircleHelp } as const;
const STATUS_TXT = { pass: "Passed", fail: "Failed", manual: "Confirm manually", unavailable: "Unavailable" } as const;
const STATUS_CLS = { pass: "text-mint", fail: "text-copper", manual: "text-steel", unavailable: "text-steel" } as const;

function MarketCard({ a, s, ms, market, reload, onToggle }: { a: Analysis; s: Scenario; ms: MarketState; market: OwnerMarket | null; reload: () => void; onToggle: (v: boolean) => void }) {
  const levels = market?.levels.slice(0, 5) ?? [];
  return (
    <Card title="Market reference and execution checks" tag="market" aside={<button type="button" onClick={reload} className="inline-flex items-center gap-2 border border-line px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.12em]"><RefreshCw className="size-3.5" aria-hidden />Refresh</button>}>
      <p className="text-chalk/90">{MARKET.ticker}: {MARKET.threshold}. The modeled hedge is the <strong>NO</strong> side.</p>
      <p data-testid="market-status" className="mt-2 text-sm text-steel">
        {ms.phase === "loading" ? "Loading public market data…" : market?.status === "ok" ? `Public data fetched ${market.fetchedAt}. Market status: ${market.marketStatus}. ${market.note ?? ""}` : `Live data unavailable. ${market?.note ?? ""} Using the illustrative price you entered.`}
      </p>
      {levels.length > 0 && (
        <div className="mt-4">
          <p className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-steel">NO-side offers (best first). A snapshot, not a guaranteed fill.</p>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-5">{levels.map((l) => <li key={l.price} className="tnum border border-line px-3 py-2">{usd(l.price)} × {l.size.toLocaleString("en-US")}</li>)}</ul>
        </div>
      )}
      <label className={`mt-4 flex items-center gap-2 text-sm ${market?.verified ? "text-chalk" : "text-steel"}`}>
        <input type="checkbox" data-testid="use-live" disabled={!market?.verified && !s.useLive} checked={s.useLive} onChange={(e) => onToggle(e.target.checked)} />
        Price the hedge from the live order book (walks multiple price levels, recalculates fees on the fills)
      </label>
      <p data-testid="price-source" className="mt-2 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-copper">{a.priceSource === "live" ? "Pricing: order-book snapshot. Not a guaranteed price." : "Pricing: illustrative input. " + a.scenarioLabel}</p>
      <ul className="mt-5 space-y-2" data-testid="checks">
        {a.checks.map((c: CheckT) => { const I = ICON[c.status]; return (
          <li key={c.id} className="flex gap-3 border border-line p-3 text-sm"><I className={`mt-0.5 size-4 shrink-0 ${STATUS_CLS[c.status]}`} aria-hidden />
            <div><p className="text-chalk">{c.label}: <span className={STATUS_CLS[c.status]}>{STATUS_TXT[c.status]}</span></p><p className="text-steel">{c.detail}</p></div></li>
        ); })}
      </ul>
    </Card>
  );
}

function Suitability({ a, s }: { a: Analysis; s: Scenario }) {
  const items: [string, string][] = [
    ["Does the event match the loss?", "Snowfall at O'Hare for the whole month vs. your customers' lost visits. Confirm with the owner how closely they track."],
    ["Is the threshold relevant?", "The contract is about MORE than 2 inches. Does a month at or under 2 inches actually correspond to this business's bad months?"],
    ["Is the price consistent with the owner's view?", a.probs.kind === "ok" ? `The owner's inputs imply the contract pays ${pctFmt(s.probs.lossPays + s.probs.noLossPays, 1)}; the price implies about ${pctFmt(s.price, 0)}.` : "Needs the owner's four-state probabilities."],
    ["Is there enough liquidity?", a.checks.find((c) => c.id === "depth")?.detail ?? "Unknown."],
    ["Could the contract settle early?", EARLY_SETTLEMENT],
    ["Do timing and limits fit?", "Settlement otherwise follows the end of December 2026, and official confirmation takes time. Confirm account minimums, position limits and the owner's cash timing."],
  ];
  return (
    <Card title="Market suitability checklist" tag="analyst">
      <ul className="space-y-3 text-sm">{items.map(([q, t]) => <li key={q} className="border-b border-line/60 pb-3"><p className="text-chalk">{q}</p><p className="text-steel">{t}</p></li>)}</ul>
    </Card>
  );
}

function PrintView({ summary }: { summary: ReturnType<typeof buildSummary> }) {
  return (
    <div className="print-only" data-testid="print-view">
      <h1 className="text-2xl font-bold">{summary.title}</h1>
      <p className="text-sm">Independent research tool. Not affiliated with or endorsed by Kalshi. No trading functionality.</p>
      {summary.sections.map((sec) => (
        <div key={sec.heading} className="sec mt-4">
          <h2 className="border-b border-black text-base font-bold">{sec.heading}</h2>
          <table className="mt-1 w-full text-sm"><tbody>{sec.rows.map(([k, v], i) => <tr key={i} className="align-top"><th className="w-1/3 pr-3 text-left font-semibold">{k}</th><td>{v}</td></tr>)}</tbody></table>
        </div>
      ))}
    </div>
  );
}
