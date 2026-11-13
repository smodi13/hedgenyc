"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Plus, Printer, RotateCcw } from "lucide-react";
import type { MarketResult } from "@/lib/kalshi/server";
import { usd } from "@/lib/format";
import { analyze, buildSummary, defaultSelection, type Selection } from "@/lib/owner/analysis";
import { PRESET_NAMES, exampleProfile } from "@/lib/owner/business";
import { defaultScenario, MARKET, resetScenario, type Scenario } from "@/lib/owner/model";
import { BusinessStep, ExposureStep } from "./Business";
import { ContractPicker } from "./ContractPicker";
import { PrintView } from "./parts";
import { AnalystView, Compare, Dashboard, SizingPanel, SuitabilityCard } from "./Results";
import { Chip, Seg } from "./ui";

const MAX_CONTRACTS = 3;

type Fetched = Pick<Selection, "info" | "infoNote" | "siblings" | "loading">;
async function loadContract(ticker: string): Promise<Fetched> {
  try {
    const r = await fetch(`/api/kalshi/market?ticker=${encodeURIComponent(ticker)}`, { cache: "no-store" });
    const j = (await r.json()) as MarketResult;
    return { info: j.contract ?? null, infoNote: j.contract ? null : j.note ?? "Contract data is unavailable.", siblings: j.siblings ?? [], loading: false };
  } catch {
    return { info: null, infoNote: "Market data is unavailable right now.", siblings: [], loading: false };
  }
}

const StepHead = ({ id, n, t }: { id: string; n: string; t: string }) => (
  <div id={id} className="flex items-baseline gap-4 pt-8 scroll-mt-24"><span className="font-display text-5xl text-copper">{n}</span><h2 className="font-display text-2xl text-chalk sm:text-3xl">{t}</h2></div>
);

export function OwnerLab() {
  const [list, setList] = useState<Scenario[]>(() => [defaultScenario("Asset Operations Group", "s-initial")]);
  const [activeId, setActiveId] = useState("s-initial");
  // Contract choices live outside any scenario so switching scenarios or contracts never touches business inputs.
  const [sels, setSels] = useState<Selection[]>(() => [defaultSelection()]);
  const [call, setCall] = useState(true);
  const [analystOpen, setAnalystOpen] = useState(false);
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");
  const [stamp, setStamp] = useState<Date | null>(null);
  const req = useRef<number[]>([0, 0, 0]);

  const s = list.find((x) => x.id === activeId) ?? list[0]!;
  const up = useCallback((patch: Partial<Scenario>) => setList((l) => l.map((x) => (x.id === activeId ? { ...x, ...patch } : x))), [activeId]);
  const patchSel = useCallback((i: number, patch: Partial<Selection>) => setSels((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x))), []);

  const load = useCallback((i: number, ticker: string) => {
    const id = ++req.current[i]!;
    setSels((l) => l.map((x, j) => (j === i ? { ...x, ticker, info: null, infoNote: null, siblings: [], loading: true } : x)));
    loadContract(ticker).then((f) => { if (req.current[i] === id) setSels((l) => l.map((x, j) => (j === i && x.ticker === ticker ? { ...x, ...f } : x))); });
  }, []);
  // first load of the default contract; its selection already starts in the loading state
  useEffect(() => {
    let live = true;
    loadContract(MARKET.ticker).then((f) => { if (live) setSels((l) => l.map((x, j) => (j === 0 && x.ticker === MARKET.ticker && x.loading ? { ...x, ...f } : x))); });
    return () => { live = false; };
  }, []);
  useEffect(() => { const f = () => setStamp(new Date()); window.addEventListener("beforeprint", f); return () => window.removeEventListener("beforeprint", f); }, []);

  const analyses = useMemo(() => sels.map((x) => analyze(s, x)), [s, sels]);
  const a = analyses[0]!, sel = sels[0]!;
  const printSummary = useMemo(() => buildSummary(s, a, sel, stamp), [s, a, sel, stamp]);

  const add = (name: string) => { const n = defaultScenario(name); setList((l) => [...l, n]); setActiveId(n.id); };
  const remove = () => { if (list.length < 2) return; const rest = list.filter((x) => x.id !== s.id); setList(rest); setActiveId(rest[0]!.id); };
  const used = new Set(list.map((x) => x.profile.name));
  const missing = PRESET_NAMES.filter((n) => n === "New / Custom Business" || !used.has(n));
  const copy = async () => {
    try { await navigator.clipboard.writeText(buildSummary(s, a, sel, new Date()).text); setCopied("ok"); } catch { setCopied("fail"); }
    setTimeout(() => setCopied(""), 4000);
  };
  const onMove = (e: React.PointerEvent) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>(".glow");
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty("--mx", `${e.clientX - r.left}px`); c.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  const btn = "inline-flex items-center gap-2 border border-line px-3 py-2.5 font-mono text-[0.68rem] uppercase tracking-[0.12em] hover:border-chalk/40";

  return (
    <div onPointerMove={onMove} className={`mx-auto max-w-[1180px] px-5 pb-28 pt-32 sm:px-8 ${call ? "call-mode" : ""}`} data-call={call ? "on" : "off"}>
      <div className="no-print">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-copper">Owner Lab</p>
        <h1 className="font-display mt-3 text-4xl leading-[1.05] text-chalk sm:text-6xl">Business Hedge Builder</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-chalk/80">Start with your business. See what a slow or costly month could do to your numbers. Then look at what an event-based contract could and could not offset.</p>
        <p className="mt-5 inline-block border border-line bg-navy/70 px-4 py-3 text-sm text-chalk/90" data-testid="disclaimer">Independent research. Not affiliated with or endorsed by Kalshi. No trade execution.</p>

        <div className="mt-8 flex flex-wrap items-center gap-3 border-y border-line py-4">
          <div role="group" aria-label="Businesses" className="flex flex-wrap gap-2">
            {list.map((x) => (
              <button key={x.id} type="button" aria-pressed={x.id === s.id} onClick={() => setActiveId(x.id)} className={`border px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.1em] ${x.id === s.id ? "border-mint bg-mint/10 text-mint" : "border-line text-chalk/80 hover:border-chalk/40"}`}>{x.profile.name || "Untitled"}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Add business">
            {missing.map((n) => <button key={n} type="button" onClick={() => add(n)} className="border border-dashed border-line px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.1em] text-steel hover:text-chalk">+ {n}</button>)}
          </div>
          {list.length > 1 && <button type="button" onClick={remove} className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-steel underline hover:text-copper">Delete this business</button>}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Seg label="View mode" value={call ? "call" : "full"} onChange={(v) => setCall(v === "call")} options={[{ v: "call", label: "Owner Call Mode" }, { v: "full", label: "Full detail" }]} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" data-testid="reset" onClick={() => setList((l) => l.map((x) => (x.id === s.id ? resetScenario(x) : x)))} className={btn}><RotateCcw className="size-3.5" aria-hidden />Reset Illustrative Scenario</button>
            <button type="button" data-testid="copy" onClick={copy} className={btn}><Copy className="size-3.5" aria-hidden />Copy Scenario Summary</button>
            <button type="button" data-testid="print" onClick={() => { setStamp(new Date()); setTimeout(() => window.print(), 60); }} className={btn}><Printer className="size-3.5" aria-hidden />Print / Save as PDF</button>
          </div>
        </div>
        <p role="status" data-testid="copy-status" className="mt-2 min-h-5 font-mono text-xs text-mint">{copied === "ok" ? "Summary copied to clipboard." : ""}</p>
        {copied === "fail" && (
          <div className="mb-4 border border-copper/60 p-3">
            <p className="text-sm text-copper">Clipboard unavailable. Select and copy the summary below.</p>
            <textarea readOnly aria-label="Scenario summary" value={buildSummary(s, a, sel, new Date()).text} onFocus={(e) => e.currentTarget.select()} className="mt-2 h-40 w-full bg-ink p-2 font-mono text-xs" />
          </div>
        )}

        <nav aria-label="Steps" className="mb-8 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {[["step1", "1", "Understand your business"], ["step2", "2", "Understand your financial exposure"], ["step3", "3", "Explore available Kalshi contracts"], ["step4", "4", "Compare potential hedging strategies"]].map(([id, n, t]) => (
            <a key={id} href={`#${id}`} className="bg-ink px-4 py-3 text-sm text-chalk/90 hover:bg-navy"><span className="mr-2 font-mono text-copper">{n}</span>{t}</a>
          ))}
        </nav>
        <ul className="call-hide mb-8 flex flex-wrap gap-2" aria-label="Data legend">{(["fact", "owner", "analyst", "market", "hypo"] as const).map((t) => <li key={t}><Chip tag={t} /></li>)}</ul>

        <div className="space-y-6">
          <StepHead id="step1" n="1" t="Understand your business" />
          <BusinessStep s={s} up={up} a={a} onExample={() => up({ profile: exampleProfile(s.profile) })} />

          <StepHead id="step2" n="2" t="Understand your financial exposure" />
          <ExposureStep s={s} up={up} a={a} />

          <StepHead id="step3" n="3" t="Explore available Kalshi contracts" />
          <p className="max-w-3xl text-chalk/85">Pick any open market, or look one up by ticker. A contract may pay under certain conditions, but it can also expire worthless or fail to match your actual losses.</p>
          {sels.map((x, i) => (
            <div key={i} className="space-y-3">
              <ContractPicker idx={i} sel={x} a={analyses[i]!} title={sels.length > 1 ? `Contract ${i + 1}` : "Choose a contract"} onChange={(p) => patchSel(i, p)} onLoad={(t) => load(i, t)} />
              {i > 0 && <button type="button" onClick={() => setSels((l) => l.filter((_, j) => j !== i))} className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-steel underline hover:text-copper">Remove contract {i + 1}</button>}
            </div>
          ))}
          {sels.length < MAX_CONTRACTS && (
            <button type="button" data-testid="add-contract" onClick={() => setSels((l) => [...l, { ...defaultSelection(), ticker: "", loading: false, infoNote: "Search for a contract or enter a ticker." }])} className={btn}><Plus className="size-3.5" aria-hidden />Compare another contract ({sels.length} of {MAX_CONTRACTS})</button>
          )}
          {a.valid && <SuitabilityCard s={s} up={up} a={a} />}

          <StepHead id="step4" n="4" t="Compare potential hedging strategies" />
          {a.valid && (
            <>
              <SizingPanel s={s} up={up} a={a} openAnalyst={() => { setCall(false); setAnalystOpen(true); }} />
              <Dashboard s={s} a={a} sel={sel} />
              <Compare entries={sels.map((x, i) => ({ sel: x, a: analyses[i]! }))} />
              <div className="call-hide"><AnalystView s={s} up={up} a={a} sel={sel} open={analystOpen} setOpen={setAnalystOpen} /></div>
            </>
          )}
        </div>
        <p className="mt-12 max-w-3xl border-t border-line pt-6 text-sm leading-relaxed text-steel">
          Hypothetical outcomes only. Nothing here guarantees protection, savings or profit, and nothing here is a recommendation to trade. Contracts can expire worthless. Entered business figures stay in this browser tab and are never sent anywhere or saved; only public tickers and search words go to Kalshi&apos;s public data. They leave this tab only if you copy or print the summary.
        </p>
      </div>
      {call && a.valid && a.sizing && (
        <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 px-5 py-3 backdrop-blur sm:px-8" data-testid="sticky-summary">
          <p className="mx-auto max-w-[1180px] text-sm text-chalk"><strong>{a.sizing.headline}</strong>{a.sizing.position.contracts > 0 ? ` Cost ${usd(a.sizing.position.cost)}, profit if it wins ${usd(a.sizing.position.netWin)}.` : ""}</p>
        </div>
      )}
      <PrintView summary={printSummary} />
    </div>
  );
}
