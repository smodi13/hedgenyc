"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { RotateCcw } from "lucide-react";
import { computeHedge, fuelLoss, rebalanceP00, sailLoss, stormAdverseLoss, sumProbs, type JointProbs, type StateKey } from "@/lib/finance/hedge";
import { CASES, EXPOSURE_DEFAULTS, type CaseId } from "@/lib/research/cases";
import { signedUsd, usd, pct, fmtTime } from "@/lib/format";
import { useMarketSnapshot } from "@/lib/useMarketSnapshot";
import { Badge, Eyebrow, Section, Term, BigNum } from "../ui";
import { NumField } from "./NumField";

interface LabState {
  contracts: number; price: number; feeCoef: number; probs: JointProbs;
  loss: number | null; // direct override of L; null = derive from drivers
  d: Record<string, number>;
  src: { ask: number; at: string; ticker: string } | null;
}

const driverDefaults = (id: CaseId): Record<string, number> => {
  if (id === "sail") { const e = EXPOSURE_DEFAULTS.sail; return { booking: (e.bookingLow + e.bookingHigh) / 2, avoidable: e.avoidable * 100, canceled: e.canceled }; }
  if (id === "xentra") { const e = EXPOSURE_DEFAULTS.xentra; return { gallons: e.gallons, shock: e.shock, pass: e.passThrough * 100 }; }
  const e = EXPOSURE_DEFAULTS.arbor; return { scheduled: e.scheduledLoss, emergency: e.emergencyGain };
};
const initial = (id: CaseId): LabState => {
  const c = CASES.find((x) => x.id === id)!;
  return { ...c.defaults, probs: { ...c.defaults.probs }, loss: null, d: driverDefaults(id), src: null };
};
const derivedLoss = (id: CaseId, d: Record<string, number>) =>
  id === "sail" ? sailLoss(d.booking!, d.avoidable! / 100, d.canceled!) : id === "xentra" ? fuelLoss(d.gallons!, d.shock!, d.pass! / 100) : stormAdverseLoss(d.scheduled!, d.emergency!);

// Xentra deliberately has no observed-ask: analyst review found no suitable contract (AAA benchmark, mixed fleet, single-date observation).
const OBSERVED: Partial<Record<CaseId, string>> = { sail: "KXRAINWKND-26NOV07-NYC" };

function useDebounced<T>(v: T, ms: number) {
  const [x, setX] = useState(v);
  useEffect(() => { const t = setTimeout(() => setX(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return x;
}

export function Lab() {
  const [caseId, setCaseId] = useState<CaseId>("sail");
  const [all, setAll] = useState<Record<CaseId, LabState>>({ sail: initial("sail"), xentra: initial("xentra"), arbor: initial("arbor") });
  const s = all[caseId];
  const c = CASES.find((x) => x.id === caseId)!;
  const set = (patch: Partial<LabState>) => setAll((a) => ({ ...a, [caseId]: { ...a[caseId], ...patch } }));
  const setD = (k: string, v: number) => set({ d: { ...s.d, [k]: v }, loss: null });
  const setP = (k: StateKey, pctVal: number) => set({ probs: { ...s.probs, [k]: pctVal / 100 } });

  useEffect(() => {
    const on = (e: Event) => setCaseId((e as CustomEvent<CaseId>).detail);
    window.addEventListener("hny:case", on);
    return () => window.removeEventListener("hny:case", on);
  }, []);

  const L = s.loss ?? derivedLoss(caseId, s.d);
  const r = useMemo(() => computeHedge({ loss: L, contracts: s.contracts, price: s.price, feeCoef: s.feeCoef, probs: s.probs }), [L, s.contracts, s.price, s.feeCoef, s.probs]);
  const total = sumProbs(s.probs);
  const totalOk = Math.abs(total - 1) <= 1e-8;

  const { state: feed } = useMarketSnapshot();
  const obs = useMemo(() => {
    if (feed.phase !== "ready") return null;
    const t = OBSERVED[caseId];
    const it = feed.snap.items.find((i) => i.researchId === t);
    const m = it?.market;
    if (!m || m.status !== "active" || m.yesAsk === null || !(m.yesAsk > 0 && m.yesAsk < 1)) return null;
    return { ask: m.yesAsk, ticker: m.ticker, at: feed.snap.fetchedAt, title: m.title };
  }, [feed, caseId]);

  const summary = useMemo(() => {
    if (!r.valid) return `Expected value blocked. ${r.errors[0] ?? ""}`;
    return `Cash at risk ${usd(r.contract!.cashAtRisk)}. Expected hedged result ${signedUsd(r.expectedHedged!)}, unhedged ${signedUsd(r.expectedUnhedged!)}, incremental ${signedUsd(r.expectedIncremental!)}. Loss with no payout: ${signedUsd(r.adverseNoPayoff!)} with probability ${pct(r.basisMissProbability!, 1)}.`;
  }, [r]);
  const liveText = useDebounced(summary, 600);

  const reset = () => setAll((a) => ({ ...a, [caseId]: initial(caseId) }));
  const dirty = JSON.stringify(s) !== JSON.stringify(initial(caseId));
  const maxAbs = Math.max(1, ...(r.states ?? []).flatMap((x) => [Math.abs(x.businessDelta), Math.abs(x.combinedDelta)]));
  const negIncr = r.valid && r.expectedIncremental! < 0;

  return (
    <Section id="lab" label="Hedge lab">
      <header className="grid gap-8 md:grid-cols-12" data-reveal>
        <BigNum n="04" className="md:col-span-2" />
        <div className="md:col-span-10">
          <Eyebrow>Hedge lab · illustrative scenarios</Eyebrow>
          <h2 id="lab-h" className="font-display mt-4 max-w-4xl text-[clamp(2rem,4.6vw,4rem)] leading-[1.04] tracking-[-0.015em] text-balance">See what your hedge covers. See what it doesn&rsquo;t.</h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-chalk/75">Run four states, including the one most sales pitches leave out: a real operating loss when the financial contract does not pay.</p>
        </div>
      </header>

      <div className="mt-12 flex flex-wrap items-center gap-3" data-reveal>
        <div role="group" aria-label="Choose a case" className="grid grid-cols-3 border border-line">
          {CASES.map((k) => (
            <button key={k.id} type="button" aria-pressed={caseId === k.id} onClick={() => setCaseId(k.id)} className={`px-4 py-3 font-mono text-[0.68rem] uppercase tracking-[0.12em] sm:px-6 ${caseId === k.id ? "bg-mint text-ink" : "hover:bg-line"}`}>{k.name}</button>
          ))}
        </div>
        <Badge tone={c.dispositionTone === "hold" ? "copper" : c.dispositionTone === "qualify" ? "mint" : "chalk"}>{c.disposition}</Badge>
        <button type="button" onClick={reset} disabled={!dirty} className="ml-auto flex items-center gap-2 border border-line px-3 py-2.5 font-mono text-[0.66rem] uppercase tracking-[0.16em] enabled:hover:border-mint enabled:hover:text-mint disabled:opacity-40"><RotateCcw className="size-3.5" aria-hidden /> Reset to research defaults</button>
      </div>

      {c.id === "arbor" && s.contracts === 0 && (
        <p className="mt-6 border border-chalk/30 bg-chalk/5 p-4 text-sm leading-relaxed" role="note"><strong className="font-mono text-xs uppercase tracking-[0.16em]">Analyst pass:</strong> zero contracts by default, no trade recommended. Even if you test a $500 emergency margin below, no suitably matched contract has been identified.</p>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-12">
        {/* INPUTS */}
        <div className="min-w-0 space-y-8 lg:col-span-4">
          <fieldset className="min-w-0 space-y-5 border border-line p-5">
            <legend className="px-2 font-mono text-[0.66rem] uppercase tracking-[0.2em] text-mint">1 · Business exposure</legend>
            {caseId === "sail" && <>
              <NumField label="Booking price" prefix="$" value={s.d.booking!} onChange={(v) => setD("booking", v)} min={0} max={2000} step={5} badge="Illustrative" hint="Midpoint of the advertised $525–$575 private charter." />
              <NumField label="Avoidable cost share" suffix="%" value={s.d.avoidable!} onChange={(v) => setD("avoidable", v)} min={0} max={100} step={1} badge="Assumed" hint="Not supplied by the business." />
              <NumField label="Canceled bookings" value={s.d.canceled!} onChange={(v) => setD("canceled", v)} min={0} max={20} step={1} badge="Illustrative" />
            </>}
            {caseId === "xentra" && <>
              <NumField label="Fuel gallons" value={s.d.gallons!} onChange={(v) => setD("gallons", v)} min={0} max={10000} step={50} badge="Assumed" hint="Not Xentra's actual consumption." />
              <NumField label="Fuel cost shock" prefix="$" suffix="/gal" value={s.d.shock!} onChange={(v) => setD("shock", v)} min={0} max={3} step={0.05} badge="Assumed" />
              <NumField label="Customer pass-through" suffix="%" value={s.d.pass!} onChange={(v) => setD("pass", v)} min={0} max={100} step={5} badge="Assumed" />
            </>}
            {caseId === "arbor" && <>
              <NumField label="Scheduled margin lost" prefix="$" value={s.d.scheduled!} onChange={(v) => setD("scheduled", v)} min={0} max={5000} step={50} badge="Hypothetical" />
              <NumField label="Emergency margin earned" prefix="$" value={s.d.emergency!} onChange={(v) => setD("emergency", v)} min={0} max={5000} step={50} badge="Hypothetical" hint={`Net storm contribution: ${signedUsd(s.d.emergency! - s.d.scheduled!)}. Adverse loss only if negative.`} />
            </>}
            <div className="border-t border-line pt-5">
              <NumField testId="loss" name="Business margin loss" label={<Term term="contribution margin">Business margin loss L</Term>} prefix="$" value={L} onChange={(v) => set({ loss: v })} min={0} max={5000} step={10} hint="Derived from the drivers above (contribution margin, never gross bookings). Edit to override." invalid={!Number.isFinite(L) || L < 0} />
              {s.loss !== null && <button type="button" onClick={() => set({ loss: null })} className="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-mint underline underline-offset-4">Re-derive from drivers</button>}
            </div>
          </fieldset>

          <fieldset className="min-w-0 space-y-5 border border-line p-5">
            <legend className="px-2 font-mono text-[0.66rem] uppercase tracking-[0.2em] text-mint">2 · Contract</legend>
            <NumField testId="price" name="YES limit price" label={<Term term="limit price">YES limit price</Term>} prefix="$" value={s.price} onChange={(v) => set({ price: v, src: null })} min={0.01} max={0.99} step={0.01} badge="Illustrative assumption" hint="Price is not a calibrated business-loss probability." />
            {obs && (
              <button type="button" onClick={() => set({ price: obs.ask, src: { ask: obs.ask, at: obs.at, ticker: obs.ticker } })} className="w-full border border-mint/50 px-3 py-2 text-left text-xs leading-snug text-mint hover:bg-mint/10">
                Use observed YES ask {usd(obs.ask)} <span className="text-steel">({obs.ticker}, Kalshi public API, {fmtTime(obs.at)})</span>
              </button>
            )}
            {caseId === "xentra" && (
              <p className="border border-copper/60 p-2 text-xs leading-snug text-copper" data-testid="xentra-no-hedge">NO SUITABLE XENTRA HEDGE VALIDATED. The price above is an illustrative assumption, not a quote. The listed diesel contract settles on a national AAA benchmark, Xentra&rsquo;s gasoline/diesel mix is unknown, and a single-date observation does not cover ongoing fuel expense. Further operating diligence is required.</p>
            )}
            {s.src && <p className="text-xs leading-snug text-copper">Price taken from an observed ask on {fmtTime(s.src.at)}. A fill may differ, other fees may apply, and probabilities below are unchanged.</p>}
            <NumField testId="contracts" name="YES contracts" label={<Term term="contract payout">YES contracts</Term>} value={s.contracts} onChange={(v) => set({ contracts: v })} min={0} max={1000} step={10} badge="Illustrative" hint="Pays $1 per contract if YES; $0 otherwise." />
            <NumField testId="fee" label="General taker multiplier" value={s.feeCoef} onChange={(v) => set({ feeCoef: v })} min={0} max={0.2} step={0.005} badge="Kalshi general" hint="Fee = round_up(m × N × p × (1 − p)), with fee + cost rounded up to $0.0001 (Kalshi Fee Schedule, effective July 7, 2026). Category and order-type schedules differ; verify before any transaction." />
          </fieldset>

          <fieldset className="min-w-0 space-y-4 border border-line p-5">
            <legend className="px-2 font-mono text-[0.66rem] uppercase tracking-[0.2em] text-mint">3 · Joint states (analyst hypotheticals)</legend>
            {(Object.keys(r.states ? Object.fromEntries(r.states.map((x) => [x.key, 1])) : { p11: 1, p10: 1, p01: 1, p00: 1 }) as StateKey[]).map((k) => (
              <NumField key={k} testId={k} label={{ p11: "Loss + YES", p10: "Loss + NO (basis miss)", p01: "No loss + YES", p00: "No loss + NO" }[k]} suffix="%" value={Math.round(s.probs[k] * 1e8) / 1e6} onChange={(v) => setP(k, v)} min={0} max={100} step={1} badge="Illustrative" />
            ))}
            <div className={`flex items-center justify-between gap-3 border px-3 py-2 text-sm ${totalOk ? "border-mint/50 text-mint" : "border-copper text-copper"}`} role="status">
              <span>Total <strong className="tnum font-mono">{Number.isFinite(total) ? (total * 100).toFixed(2) : "—"}%</strong> {totalOk ? "· valid" : "· must equal 100%"}</span>
              {!totalOk && <button type="button" onClick={() => set({ probs: rebalanceP00(s.probs) })} className="font-mono text-[0.6rem] uppercase tracking-[0.12em] underline underline-offset-4">Set “No loss + NO” to remainder</button>}
            </div>
            <p className="text-xs leading-snug text-steel">These weights are the analyst&rsquo;s hypotheses, not Kalshi-implied probabilities, not predictions, and not measured from data.</p>
          </fieldset>
        </div>

        {/* OUTPUTS */}
        <div className="min-w-0 space-y-8 lg:col-span-8">
          {!r.valid && (
            <div role="alert" data-testid="lab-errors" className="border border-copper bg-copper/10 p-4 text-sm">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-copper">Expected value blocked</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-chalk/90">{r.errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-px border border-line bg-line xl:grid-cols-3">
            <Tile t="Premium + general fee" v={r.contract ? usd(r.contract.cashAtRisk) : "—"} sub={r.contract ? `${usd(r.contract.premium)} premium + ${usd(r.contract.fee)} fee` : "Invalid contract inputs"} id="m-cash" />
            <Tile t="Payoff if contract settles YES" v={r.contract ? signedUsd(r.contract.netYes) : "—"} sub={r.contract ? `${usd(r.contract.grossPayoutYes, 0)} gross − cash at risk` : ""} tone="mint" id="m-yes" />
            <Tile t="Business margin loss" v={usd(L)} sub="Contribution margin, not gross sales" tone="copper" id="m-loss" />
            <Tile t="Expected result · illustrative states" v={r.valid ? signedUsd(r.expectedHedged!) : "Blocked"} sub={r.valid ? `Unhedged ${signedUsd(r.expectedUnhedged!)} · incremental ${signedUsd(r.expectedIncremental!)}` : "Fix inputs to compute"} tone={r.valid ? (negIncr ? "copper" : "chalk") : "copper"} id="m-ev" />
            <Tile t="Contract loses; business loses" v={r.adverseNoPayoff !== null ? signedUsd(r.adverseNoPayoff) : "—"} sub={r.valid ? `${pct(r.basisMissProbability!, 1)} illustrative probability · basis miss` : "Loss + NO state"} tone="copper" id="m-adverse" />
            <Tile t="False positive / false negative" v={r.valid ? `${pct(r.falsePositiveProbability!, 1)} / ${pct(r.falseNegativeProbability!, 1)}` : "—"} sub="False positive: contract pays, no business loss. False negative: business loss, no payout." id="m-basis" />
          </dl>
          {r.valid && negIncr && <p className="border-l-2 border-copper pl-4 text-sm text-chalk/85">Under these illustrative states the hedge&rsquo;s expected incremental result is negative ({signedUsd(r.expectedIncremental!)}). It is shown as computed; the lab does not recommend a hedge.</p>}
          {r.states && r.valid && <p className="text-sm text-chalk/80">Worst modeled combined outcome: <strong className="tnum font-mono text-copper">{signedUsd(r.worstCombined!)}</strong>. Premium plus fee ({usd(r.contract!.cashAtRisk)}) can be lost in full even when the business loses money.</p>}

          {/* tree */}
          {r.states && (
            <div className="border border-line bg-navy/50 p-5 sm:p-7">
              <h3 className="font-mono text-[0.66rem] uppercase tracking-[0.2em] text-mint">Four-state joint tree</h3>
              <Tree r={r} />
              <div className="mt-6 grid grid-cols-1 gap-2 sm:hidden">
                {r.states.map((x) => <div key={x.key} className={`border p-3 text-sm ${x.key === "p10" ? "border-copper" : "border-line"}`}><p className="text-xs text-steel">{x.label}</p><p className="mt-1 font-mono tnum">{pct(x.probability, 1)} · {signedUsd(x.combinedDelta)}</p></div>)}
              </div>
            </div>
          )}

          {/* paired outcome bars + probability strip */}
          {r.states && (
            <div className="border border-line bg-navy/50 p-5 sm:p-7">
              <h3 className="font-mono text-[0.66rem] uppercase tracking-[0.2em] text-mint">Outcome by state · unhedged vs hedged</h3>
              <div className="mt-6 space-y-5" role="img" aria-label={`Bar chart of unhedged and hedged outcomes in four states. Table below has exact values. ${r.valid ? summary : ""}`}>
                {r.states.map((x) => (
                  <div key={x.key}>
                    <div className="flex justify-between gap-3 text-xs"><span className={x.key === "p10" ? "text-copper" : "text-chalk/80"}>{x.label}</span><span className="tnum font-mono text-steel">{pct(x.probability, 1)}</span></div>
                    <Bar v={x.businessDelta} max={maxAbs} cls="bg-steel" /><Bar v={x.combinedDelta} max={maxAbs} cls={x.combinedDelta < 0 ? "bg-copper" : "bg-mint"} />
                  </div>
                ))}
                <p className="flex gap-5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-steel"><span><i className="mr-1 inline-block size-2 bg-steel" />Unhedged</span><span><i className="mr-1 inline-block size-2 bg-mint" />Hedged (loss → copper)</span></p>
              </div>
              <div className="mt-8">
                <p className="mb-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-steel">Joint probability strip · basis-miss state highlighted</p>
                <div className="flex h-8 w-full overflow-hidden border border-line" role="img" aria-label={`Joint probabilities: ${r.states.map((x) => `${x.label} ${pct(x.probability, 1)}`).join("; ")}`}>
                  {r.states.map((x) => (
                    <motion.div key={x.key} animate={{ width: `${Math.max(0, x.probability) * 100}%` }} transition={{ type: "spring", stiffness: 140, damping: 24 }}
                      className={x.key === "p10" ? "hatch border-x border-copper" : x.key === "p11" ? "bg-mint/80" : x.key === "p01" ? "bg-mint/35" : "bg-line"} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* screen-reader equivalent: always visible */}
          {r.states && (
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Four joint states data table, scrollable">
              <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
                <caption className="pb-3 text-left font-mono text-[0.66rem] uppercase tracking-[0.2em] text-mint">Data table · four joint states</caption>
                <thead><tr className="border-b border-line font-mono text-[0.62rem] uppercase tracking-[0.12em] text-steel">
                  <th scope="col" className="py-2 pr-3 font-normal">State</th><th scope="col" className="px-3 text-right font-normal">Prob.</th><th scope="col" className="px-3 text-right font-normal">Business</th><th scope="col" className="px-3 text-right font-normal">Contract net</th><th scope="col" className="pl-3 text-right font-normal">Combined</th></tr></thead>
                <tbody>{r.states.map((x) => (
                  <tr key={x.key} className={`border-b border-line/60 ${x.key === "p10" ? "text-copper" : ""}`}>
                    <th scope="row" className="py-2.5 pr-3 font-normal">{x.label}</th><td className="tnum px-3 text-right font-mono">{pct(x.probability, 2)}</td>
                    <td className="tnum px-3 text-right font-mono">{signedUsd(x.businessDelta)}</td><td className="tnum px-3 text-right font-mono">{signedUsd(x.contractDelta)}</td><td className="tnum pl-3 text-right font-mono">{signedUsd(x.combinedDelta)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <p className="text-xs leading-relaxed text-steel">Basis risk, settlement-rule differences, business location and timing, incomplete liquidity and total loss of premium are all possible. Not modeled: bid-ask spread, partial fills, slippage, other charges. Illustrative scenarios, not financial advice.</p>
          <p className="sr-only" aria-live="polite" aria-atomic="true">{liveText}</p>
        </div>
      </div>
    </Section>
  );
}

const Tile = ({ t, v, sub, tone = "chalk", id }: { t: string; v: string; sub: string; tone?: "chalk" | "mint" | "copper"; id: string }) => (
  <div className="bg-ink p-5" data-testid={id}>
    <dt className="font-mono text-[0.6rem] uppercase leading-snug tracking-[0.14em] text-steel">{t}</dt>
    <dd className={`font-display tnum mt-2 text-3xl sm:text-4xl ${tone === "mint" ? "text-mint" : tone === "copper" ? "text-copper" : "text-chalk"}`}>{v}</dd>
    <dd className="mt-1 text-xs leading-snug text-steel">{sub}</dd>
  </div>
);

function Bar({ v, max, cls }: { v: number; max: number; cls: string }) {
  const k = Math.min(1, Math.abs(v) / max);
  return (
    <div className="relative mt-1.5 flex h-2.5 items-center">
      <span className="absolute left-1/2 top-[-2px] h-[calc(100%+4px)] w-px bg-steel/50" aria-hidden />
      <div className="relative h-full w-1/2"><motion.div className={`absolute inset-y-0 right-0 w-full origin-right ${v < 0 ? cls : ""}`} animate={{ scaleX: v < 0 ? k : 0 }} transition={{ type: "spring", stiffness: 120, damping: 22 }} /></div>
      <div className="relative h-full w-1/2"><motion.div className={`absolute inset-y-0 left-0 w-full origin-left ${v >= 0 ? cls : ""}`} animate={{ scaleX: v >= 0 ? k : 0 }} transition={{ type: "spring", stiffness: 120, damping: 22 }} /></div>
    </div>
  );
}

const SHORT: Record<StateKey, string> = { p11: "Loss + contract pays", p10: "Loss + NO payout (basis miss)", p01: "No loss + contract pays", p00: "No loss + NO payout" };

function Tree({ r }: { r: ReturnType<typeof computeHedge> }) {
  const S = r.states!;
  const by = Object.fromEntries(S.map((x) => [x.key, x]));
  const pLoss = by.p11!.probability + by.p10!.probability;
  const W = (p: number) => 1 + Math.max(0, p) * 16;
  const leaves: [StateKey, number][] = [["p11", 50], ["p10", 140], ["p01", 250], ["p00", 340]];
  return (
    <svg viewBox="0 0 760 390" className="mt-5 hidden w-full sm:block" role="img" aria-label={`Four-state tree. Business loss ${pct(pLoss, 1)}, no loss ${pct(1 - pLoss, 1)}. ${S.map((x) => `${x.label}: ${pct(x.probability, 1)}, combined ${signedUsd(x.combinedDelta)}`).join(". ")}.`}>
      <g fill="none" strokeLinecap="round">
        <motion.path d="M70,195 C150,195 170,95 290,95" stroke="#f2ad78" animate={{ strokeWidth: W(pLoss), opacity: 0.35 + pLoss * 0.6 }} />
        <motion.path d="M70,195 C150,195 170,295 290,295" stroke="#8995a4" animate={{ strokeWidth: W(1 - pLoss), opacity: 0.35 + (1 - pLoss) * 0.6 }} />
        {leaves.map(([k, y]) => {
          const fromY = k === "p11" || k === "p10" ? 95 : 295;
          return <motion.path key={k} d={`M290,${fromY} C380,${fromY} 400,${y} 470,${y}`} stroke={k === "p10" ? "#f2ad78" : "#84e5d0"} animate={{ strokeWidth: W(by[k]!.probability), opacity: 0.3 + by[k]!.probability * 0.9 }} />;
        })}
      </g>
      <circle cx="62" cy="195" r="7" fill="#091019" stroke="#f7f6f0" /><text x="62" y="222" textAnchor="middle" fill="#f7f6f0" fontSize="12" fontFamily="var(--font-plex-mono)">EVENT</text>
      <text x="290" y="62" textAnchor="middle" fill="#f2ad78" fontSize="12" fontFamily="var(--font-plex-mono)">BUSINESS LOSS {pct(pLoss, 1)}</text>
      <text x="290" y="332" textAnchor="middle" fill="#8995a4" fontSize="12" fontFamily="var(--font-plex-mono)">NO LOSS {pct(1 - pLoss, 1)}</text>
      {leaves.map(([k, y]) => {
        const x = by[k]!; const bad = k === "p10";
        return (
          <g key={k}>
            <rect x="470" y={y - 34} width="282" height="68" fill={bad ? "rgba(242,173,120,0.12)" : "#101b28"} stroke={bad ? "#f2ad78" : "rgba(247,246,240,0.18)"} />
            <text x="484" y={y - 12} fill={bad ? "#f2ad78" : "#f7f6f0"} fontSize="12.5" fontFamily="var(--font-hanken)">{SHORT[k]}</text>
            <text x="484" y={y + 10} fill="#8995a4" fontSize="12" fontFamily="var(--font-plex-mono)">P = {pct(x.probability, 1)}</text>
            <text x="738" y={y + 12} textAnchor="end" fill={x.combinedDelta < 0 ? "#f2ad78" : "#84e5d0"} fontSize="22" fontFamily="var(--font-fraunces)">{signedUsd(x.combinedDelta)}</text>
          </g>
        );
      })}
    </svg>
  );
}
