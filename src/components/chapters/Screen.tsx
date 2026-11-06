"use client";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { RotateCcw, Search } from "lucide-react";
import type { ProspectView } from "@/lib/research/load";
import { Badge, Eyebrow, Section, BigNum } from "../ui";
import { Drawer, EvidenceBadges, isMismatch, isNegControl } from "./Drawer";

type Evidence = "all" | "primary" | "discovery";
type Sort = "score-desc" | "score-asc" | "name" | "sector";

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export function Screen({ data }: { data: ProspectView[] }) {
  const [q, setQ] = useState("");
  const [evidence, setEvidence] = useState<Evidence>("all");
  const [sector, setSector] = useState("");
  const [priority, setPriority] = useState("");
  const [fit, setFit] = useState("");
  const [area, setArea] = useState("");
  const [sort, setSort] = useState<Sort>("score-desc");
  const [openId, setOpenId] = useState<string | null>(null);
  const pushed = useRef(false);
  const dq = useDeferredValue(q);

  const sectors = useMemo(() => [...new Set(data.map((d) => d.sector))].sort(), [data]);
  const priorities = useMemo(() => [...new Set(data.map((d) => d.research_priority))].sort(), [data]);
  const fits = useMemo(() => [...new Set(data.map((d) => d.contract_fit_preliminary))].sort(), [data]);
  const areas = useMemo(() => {
    const m = new Map<string, number>();
    data.forEach((d) => m.set(d.area, (m.get(d.area) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const results = useMemo(() => {
    const tokens = norm(dq).split(" ").filter(Boolean);
    const list = data.filter((d) => {
      if (evidence === "primary" && !d.primary) return false;
      if (evidence === "discovery" && d.primary) return false;
      if (sector && d.sector !== sector) return false;
      if (priority && d.research_priority !== priority) return false;
      if (fit && d.contract_fit_preliminary !== fit) return false;
      if (area && d.area !== area) return false;
      if (!tokens.length) return true;
      const hay = norm([d.id, d.name, d.sector, d.area, d.risk_hypothesis, d.publicly_documented_fact, d.contract_fit_preliminary, d.research_priority].join(" "));
      return tokens.every((t) => hay.includes(t));
    });
    const cmp: Record<Sort, (a: ProspectView, b: ProspectView) => number> = {
      "score-desc": (a, b) => b.computedScore - a.computedScore || a.name.localeCompare(b.name),
      "score-asc": (a, b) => a.computedScore - b.computedScore || a.name.localeCompare(b.name),
      name: (a, b) => a.name.localeCompare(b.name),
      sector: (a, b) => a.sector.localeCompare(b.sector) || b.computedScore - a.computedScore,
    };
    return [...list].sort(cmp[sort]);
  }, [data, dq, evidence, sector, priority, fit, area, sort]);

  const nPrimary = results.filter((r) => r.primary).length;
  const nDisc = results.length - nPrimary;
  const avg = results.length ? Math.round(results.reduce((a, r) => a + r.computedScore, 0) / results.length) : null;
  const dirty = !!(q || sector || priority || fit || area || evidence !== "all" || sort !== "score-desc");
  const reset = () => { setQ(""); setEvidence("all"); setSector(""); setPriority(""); setFit(""); setArea(""); setSort("score-desc"); };

  // Deep-linking: #business-HNY-001 opens a record; the browser Back button closes it.
  useEffect(() => {
    const sync = () => { const m = /^#business-(HNY-\d{3})$/.exec(location.hash); setOpenId(m && data.some((d) => d.id === m[1]) ? m[1]! : null); };
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => { window.removeEventListener("hashchange", sync); window.removeEventListener("popstate", sync); };
  }, [data]);
  const open = useCallback((id: string) => { history.pushState(null, "", `#business-${id}`); pushed.current = true; setOpenId(id); }, []);
  const close = useCallback(() => {
    if (pushed.current) { pushed.current = false; history.back(); } else { history.replaceState(null, "", "#screen"); setOpenId(null); }
  }, []);
  const current = data.find((d) => d.id === openId) ?? null;
  const maxArea = Math.max(...areas.map((a) => a[1]));

  const sel = "w-full border border-line bg-ink px-3 py-2.5 text-sm text-chalk focus:border-mint";
  const lab = "mb-1.5 block font-mono text-[0.62rem] uppercase tracking-[0.18em] text-steel";

  return (
    <Section id="screen" label="Origination">
      <header className="grid gap-8 md:grid-cols-12" data-reveal>
        <BigNum n="02" className="md:col-span-2" />
        <div className="md:col-span-10">
          <Eyebrow>Origination · {data.length} public-source records</Eyebrow>
          <h2 id="screen-h" className="font-display mt-4 max-w-4xl text-[clamp(2rem,4.6vw,4rem)] leading-[1.04] tracking-[-0.015em] text-balance">An origination universe, not a customer list.</h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-chalk/75">
            These businesses were identified through public sources. None has been contacted as part of this work sample. Site evidence establishes operations, not revenue, trading interest, or prior Kalshi customer status.
          </p>
        </div>
      </header>

      {/* confidence split */}
      <div className="mt-14 grid gap-8 border-y border-line py-8 lg:grid-cols-12" data-reveal>
        <div className="lg:col-span-7">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-steel">Evidence tier of current results</p>
          <div className="mt-4 flex h-9 w-full overflow-hidden border border-line" role="img" aria-label={`${nPrimary} company-source records and ${nDisc} directory discoveries in the current results`}>
            <motion.div className="h-full bg-mint/85" animate={{ width: `${results.length ? (nPrimary / results.length) * 100 : 0}%` }} transition={{ type: "spring", stiffness: 140, damping: 24 }} />
            <motion.div className="hatch h-full border-l border-copper/60" animate={{ width: `${results.length ? (nDisc / results.length) * 100 : 0}%` }} transition={{ type: "spring", stiffness: 140, damping: 24 }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[0.68rem] uppercase tracking-[0.14em]">
            <span className="text-mint">■ Company source verified</span><span className="text-copper">▨ Directory discovery: verify</span>
          </div>
        </div>
        <dl className="grid grid-cols-4 gap-4 lg:col-span-5" aria-live="polite" aria-atomic="true">
          {[
            [results.length, `of ${data.length} shown`, "text-chalk"],
            [nPrimary, "company-site records", "text-mint"],
            [nDisc, "discovery-only", "text-copper"],
            [avg ?? "—", "avg triage /100", "text-chalk"],
          ].map(([n, l, c]) => (
            <div key={l as string}><dd className={`font-display tnum text-4xl ${c}`}>{n}</dd><dt className="mt-1 font-mono text-[0.58rem] uppercase leading-snug tracking-[0.12em] text-steel">{l}</dt></div>
          ))}
        </dl>
      </div>

      {/* area tiles, as recorded; not geolocated */}
      <div className="mt-8" data-reveal>
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-steel">Area as recorded · not geolocated, no map pins</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {areas.map(([a, n]) => (
            <button key={a} type="button" aria-pressed={area === a} onClick={() => setArea(area === a ? "" : a)}
              className={`relative overflow-hidden border p-3 text-left transition-colors ${area === a ? "border-mint" : "border-line hover:border-steel"}`}>
              <span className="absolute inset-0 bg-mint" style={{ opacity: 0.05 + 0.2 * (n / maxArea) }} aria-hidden />
              <span className="relative block font-display text-2xl tnum">{n}</span>
              <span className="relative block font-mono text-[0.62rem] uppercase tracking-[0.12em] text-chalk/80">{a === "NYC" ? "NYC (borough unspecified)" : a}</span>
            </button>
          ))}
        </div>
      </div>

      {/* controls */}
      <form role="search" aria-label="Filter businesses" onSubmit={(e) => e.preventDefault()} className="mt-10 grid gap-4 border border-line bg-navy/50 p-4 sm:p-6 md:grid-cols-12" data-reveal>
        <div className="md:col-span-5">
          <label htmlFor="q" className={lab}>Search name, sector, risk, fact</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-steel" aria-hidden />
            <input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. sailing, fuel, rain or shine" className={`${sel} pl-9`} autoComplete="off" />
          </div>
        </div>
        <div className="md:col-span-4">
          <span className={lab} id="ev-l">Evidence tier</span>
          <div role="group" aria-labelledby="ev-l" className="grid grid-cols-3 border border-line text-xs">
            {([["all", "All"], ["primary", "Company-site"], ["discovery", "Directory"]] as [Evidence, string][]).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={evidence === k} onClick={() => setEvidence(k)} className={`px-2 py-2.5 font-mono uppercase tracking-[0.08em] ${evidence === k ? "bg-mint text-ink" : "text-chalk hover:bg-line"}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="flex items-end md:col-span-3">
          <label className="flex cursor-pointer items-center gap-3 py-2.5 text-sm">
            <input type="checkbox" className="size-4 accent-[#84e5d0]" checked={evidence === "primary"} onChange={(e) => setEvidence(e.target.checked ? "primary" : "all")} />
            Hide unverified directory leads
          </label>
        </div>
        <div className="md:col-span-3"><label htmlFor="f-sector" className={lab}>Industry</label>
          <select id="f-sector" className={sel} value={sector} onChange={(e) => setSector(e.target.value)}><option value="">All industries</option>{sectors.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div className="md:col-span-3"><label htmlFor="f-pri" className={lab}>Research priority</label>
          <select id="f-pri" className={sel} value={priority} onChange={(e) => setPriority(e.target.value)}><option value="">All priorities</option>{priorities.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div className="md:col-span-3"><label htmlFor="f-fit" className={lab}>Preliminary contract fit</label>
          <select id="f-fit" className={sel} value={fit} onChange={(e) => setFit(e.target.value)}><option value="">All fits</option>{fits.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div className="md:col-span-3"><label htmlFor="f-sort" className={lab}>Sort</label>
          <select id="f-sort" className={sel} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="score-desc">Triage score, high → low</option><option value="score-asc">Triage score, low → high</option><option value="name">Name A → Z</option><option value="sector">Sector</option></select></div>
        <div className="flex items-center justify-between gap-4 md:col-span-12">
          <p className="text-xs text-steel">Analyst triage /100 blends risk clarity, source observability, contract fit and pilot tractability. It is not predicted conversion or a measure of actual risk.</p>
          <button type="button" onClick={reset} disabled={!dirty} className="flex shrink-0 items-center gap-2 border border-line px-3 py-2 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-chalk enabled:hover:border-mint enabled:hover:text-mint disabled:opacity-40"><RotateCcw className="size-3.5" aria-hidden /> Reset filters</button>
        </div>
      </form>

      {/* leaderboard */}
      <p className="mt-8 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-steel" role="status">{results.length} {results.length === 1 ? "business" : "businesses"} · {nPrimary} company-site · {nDisc} directory</p>
      <LayoutGroup>
        <motion.ol layout className="mt-3 border-t border-line">
          <AnimatePresence initial={false} mode="popLayout">
            {results.map((d, i) => (
              <motion.li key={d.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.28 }} className="border-b border-line">
                <button type="button" onClick={() => open(d.id)}
                  className="group grid w-full grid-cols-[2rem_1fr_auto] items-center gap-x-4 gap-y-2 px-1 py-5 text-left transition-colors hover:bg-navy/70 sm:grid-cols-[3rem_minmax(0,1.4fr)_minmax(0,1fr)_7rem] sm:px-3">
                  <span className="font-mono text-xs text-steel tnum">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0">
                    <span className="block break-words font-display text-xl leading-snug group-hover:text-mint sm:text-2xl">{d.name}</span>
                    <span className="mt-1 block font-mono text-[0.62rem] uppercase tracking-[0.12em] text-steel">{d.id} · {d.sector} · {d.area}</span>
                    <span className="mt-2 block"><EvidenceBadges p={d} /></span>
                  </span>
                  <span className="col-span-3 col-start-2 row-start-3 text-sm leading-snug text-chalk/70 sm:col-span-1 sm:col-start-3 sm:row-start-1">
                    <span className="block text-steel">{d.risk_hypothesis}</span>
                    <span className={`mt-1 block ${isMismatch(d) || isNegControl(d) ? "text-copper" : ""}`}>{d.contract_fit_preliminary}</span>
                  </span>
                  <span className="col-start-3 row-start-1 text-right sm:col-start-4">
                    <span className="font-display tnum text-3xl">{d.computedScore}</span><span className="font-mono text-[0.6rem] text-steel">/100</span>
                    <span className="mt-1.5 block h-1 bg-line"><span className={`block h-full ${d.primary ? "bg-mint" : "hatch"}`} style={{ width: `${d.computedScore}%` }} /></span>
                  </span>
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ol>
      </LayoutGroup>
      {results.length === 0 && (
        <div className="border-b border-line py-16 text-center">
          <p className="font-display text-2xl">No records match these filters.</p>
          <button type="button" onClick={reset} className="mt-4 font-mono text-xs uppercase tracking-[0.18em] text-mint underline underline-offset-4">Reset filters</button>
        </div>
      )}
      <p className="mt-6 text-xs text-steel"><Badge tone="steel">Scope</Badge> <span className="ml-2">All {data.length} records are NOT CONTACTED. A named business is not a Kalshi customer, non-customer, or qualified lead.</span></p>

      <AnimatePresence>{current && <Drawer key={current.id} p={current} onClose={close} />}</AnimatePresence>
    </Section>
  );
}
