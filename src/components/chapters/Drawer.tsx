"use client";
import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import type { ProspectView } from "@/lib/research/load";
import { SCORE_WEIGHTS } from "@/lib/research/load";
import { NEGATIVE_CONTROL_TEXT } from "@/lib/research/cases";
import { Badge, Ext } from "../ui";

export const isMismatch = (p: ProspectView) => /weak|no recommended|no hedge/i.test(p.contract_fit_preliminary);
export const isNegControl = (p: ProspectView) => /negative control/i.test(p.research_priority);

export function EvidenceBadges({ p, all = false }: { p: ProspectView; all?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {p.primary ? <Badge tone="mint">Company source verified</Badge> : <Badge tone="copper" className="hatch">Directory discovery: verify</Badge>}
      {isNegControl(p) && <Badge tone="copper">Negative control</Badge>}
      {isMismatch(p) && <Badge tone="copper">Mismatch</Badge>}
      {all && <><Badge>No interview</Badge><Badge>Requires owner data</Badge></>}
    </div>
  );
}

const FACTORS: [keyof typeof SCORE_WEIGHTS, string, string][] = [
  ["risk", "Risk clarity", "Public basis for a plausible event-linked risk"],
  ["observability", "Source observability", "Quality of first-party evidence"],
  ["fit", "Contract fit", "Trigger, location, tenor and settlement alignment"],
  ["pilot", "Pilot tractability", "Plausibility of a learn-first business conversation"],
];

export function Drawer({ p, onClose }: { p: ProspectView; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current!;
    const prev = document.activeElement as HTMLElement | null;
    root.querySelector<HTMLElement>("[data-close]")?.focus();
    document.body.style.overflow = "hidden";
    window.dispatchEvent(new CustomEvent("hny:scroll-lock", { detail: true }));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab") return;
      const f = Array.from(root.querySelectorAll<HTMLElement>("a[href],button,[tabindex]:not([tabindex='-1'])"));
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      window.dispatchEvent(new CustomEvent("hny:scroll-lock", { detail: false }));
      prev?.focus?.();
    };
  }, [onClose]);

  const total = p.computedScore;
  return (
    <div className="fixed inset-0 z-[80]" data-lenis-prevent>
      <motion.div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden />
      <motion.div
        ref={ref} role="dialog" aria-modal="true" aria-labelledby="drawer-title"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 260, damping: 32 }}
        className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-y-auto border-l border-line bg-navy shadow-2xl outline-none"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-navy/95 p-5 backdrop-blur sm:p-7">
          <div className="min-w-0">
            <p className="font-mono text-[0.68rem] tracking-[0.2em] text-steel">{p.id} · {p.sector.toUpperCase()} · {p.area.toUpperCase()}</p>
            <h3 id="drawer-title" className="font-display mt-2 break-words text-3xl leading-tight">{p.name}</h3>
            <div className="mt-3"><EvidenceBadges p={p} all /></div>
          </div>
          <button type="button" data-close onClick={onClose} aria-label="Close business details" className="shrink-0 border border-line p-2 text-chalk hover:border-mint hover:text-mint"><X className="size-5" /></button>
        </div>

        <div className="space-y-8 p-5 sm:p-7">
          {isNegControl(p) && (
            <div className="border border-copper/60 bg-copper/10 p-4 text-sm leading-relaxed">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-copper">Do not pitch · negative control</p>
              <p className="mt-2 text-chalk/85">{NEGATIVE_CONTROL_TEXT}</p>
            </div>
          )}
          <Block t="Publicly documented fact"><p>{p.publicly_documented_fact}</p></Block>
          <Block t="Evidence source">
            {p.company_source_url
              ? <Ext href={p.company_source_url} className="break-all">{p.company_source_url.replace(/^https?:\/\//, "")}</Ext>
              : <p className="text-copper">No first-party company source in the dataset. This record was surfaced by a business directory or discovery search and needs independent verification.</p>}
            <p className="mt-2 text-xs text-steel">A website claim is an observed public statement, not audited fact. It does not establish revenue, owner willingness to hedge, or customer status.</p>
          </Block>
          <Block t="Risk hypothesis"><p>{p.risk_hypothesis}</p></Block>
          <Block t="Preliminary contract fit"><p className={isMismatch(p) ? "text-copper" : ""}>{p.contract_fit_preliminary}</p></Block>

          <Block t="Analyst triage score">
            <div className="flex items-end gap-3">
              <span className="font-display tnum text-6xl leading-none text-mint">{total}</span>
              <span className="pb-1 font-mono text-xs text-steel">/ 100 · ANALYST TRIAGE</span>
            </div>
            <ul className="mt-5 space-y-3">
              {FACTORS.map(([k, label, desc]) => {
                const f = p.factors[k];
                return (
                  <li key={k}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span>{label} <span className="text-steel">· weight {Math.round(SCORE_WEIGHTS[k] * 100)}%</span></span>
                      <span className="tnum font-mono text-xs">{f}/5 → {(f * SCORE_WEIGHTS[k] * 20).toFixed(0)} pts</span>
                    </div>
                    <div className="mt-1.5 h-1.5 bg-line" role="img" aria-label={`${label}: ${f} of 5`}>
                      <motion.div className="h-full bg-mint" initial={{ width: 0 }} animate={{ width: `${(f / 5) * 100}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
                    </div>
                    <p className="mt-1 text-xs text-steel">{desc}</p>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-steel">{p.scoring_note} Factors are subjective 0–5 analyst hypotheses from the supplied workbook; the score is research triage, not conversion probability, price, loss or a trading recommendation.</p>
          </Block>

          <Block t="Status">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-steel">Outreach</dt><dd className="font-mono">{p.outreach_status}</dd></div>
              <div><dt className="text-steel">Kalshi customer status</dt><dd className="font-mono">{p.customer_status}</dd></div>
              <div><dt className="text-steel">Exposure quantified</dt><dd className="font-mono">{p.actual_exposure_quantified ? "YES" : "NO"}</dd></div>
              <div><dt className="text-steel">Financials verified</dt><dd className="font-mono">{p.financials_verified ? "YES" : "NO"}</dd></div>
            </dl>
          </Block>
          <Block t="Next diligence step"><p>{p.next_diligence_step}</p></Block>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-steel">Research as of {p.as_of} · Independent research, not affiliated with Kalshi</p>
        </div>
      </motion.div>
    </div>
  );
}

const Block = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <section>
    <h4 className="mb-2 font-mono text-[0.68rem] uppercase tracking-[0.2em] text-mint">{t}</h4>
    <div className="leading-relaxed text-chalk/85">{children}</div>
  </section>
);
