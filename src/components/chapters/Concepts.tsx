"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { BLOCKERS, CONCEPTS, FALSIFICATION } from "@/lib/research/concepts";
import { Badge, Eyebrow, Section, BigNum } from "../ui";

export function Concepts() {
  const [open, setOpen] = useState<string | null>("A");
  return (
    <Section id="concepts" label="New markets" className="!pt-0">
      <header className="grid gap-8 md:grid-cols-12" data-reveal>
        <BigNum n="06" className="md:col-span-2" />
        <div className="md:col-span-10">
          <Eyebrow tone="copper">Market design · independent proposals</Eyebrow>
          <h2 id="concepts-h" className="font-display mt-4 max-w-4xl text-[clamp(2rem,4.6vw,4rem)] leading-[1.04] tracking-[-0.015em] text-balance">Sometimes the market you need does not exist.</h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-chalk/75">Three research concepts for a markets team to evaluate. They are unapproved, unticketed and unlisted, with no staff collaboration implied.</p>
        </div>
      </header>

      <ul className="mt-14 border-t border-line">
        {CONCEPTS.map((c) => {
          const on = open === c.id;
          return (
            <li key={c.id} className="border-b border-line">
              <h3>
                <button type="button" aria-expanded={on} aria-controls={`concept-${c.id}`} onClick={() => setOpen(on ? null : c.id)} className="group flex w-full items-start gap-5 py-8 text-left sm:gap-8">
                  <span className="font-display text-5xl leading-none text-copper sm:text-7xl" aria-hidden>{c.id}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap gap-2"><Badge tone="copper">Unapproved research concept</Badge><Badge tone="steel">Not an actual Kalshi-listed contract</Badge></span>
                    <span className="font-display mt-3 block text-2xl leading-tight group-hover:text-mint sm:text-4xl">{c.title}</span>
                    <span className="mt-2 block max-w-2xl text-chalk/70">{c.job}</span>
                  </span>
                  <Plus className={`mt-2 size-6 shrink-0 text-mint transition-transform duration-300 ${on ? "rotate-45" : ""}`} aria-hidden />
                </button>
              </h3>
              <AnimatePresence initial={false}>
                {on && (
                  <motion.div id={`concept-${c.id}`} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                    <dl className="grid gap-8 pb-10 sm:pl-24 md:grid-cols-2">
                      {[
                        ["Candidate question", c.question], ["Resolution & settlement spec", c.settlement], ["Gap in existing markets", c.gap],
                        ["Proposed index", c.proposedIndex], ["Buyer hypothesis", c.buyer], ["Demand test / priority", `${c.demandTest} Priority: ${c.priority}.`],
                      ].map(([k, v]) => <div key={k}><dt className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-mint">{k}</dt><dd className="mt-2 leading-relaxed text-chalk/85">{v}</dd></div>)}
                      <div className="border-l-2 border-copper pl-5 md:col-span-2"><dt className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-copper">Hedging limitation / basis mismatch</dt><dd className="mt-2 leading-relaxed text-chalk/85">{c.limitation}</dd></div>
                      <div className="md:col-span-2"><dt className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-steel">Market-viability blockers for a markets team to evaluate</dt><dd className="mt-3 flex flex-wrap gap-2">{BLOCKERS.map((b) => <Badge key={b}>{b}</Badge>)}</dd></div>
                    </dl>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
      <div className="mt-12 grid gap-8 md:grid-cols-12" data-reveal>
        <h3 className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-copper md:col-span-4">Reject a concept if</h3>
        <ol className="space-y-2 md:col-span-8">{FALSIFICATION.map((f, i) => <li key={f} className="flex gap-4 text-chalk/80"><span className="font-mono text-xs text-steel">{i + 1}</span>{f}</li>)}</ol>
      </div>
      <p className="mt-8 text-xs text-steel">No ticker, price, rule or resolution source for these concepts has been invented. A theoretically useful hedge or an owner interview does not guarantee product fit.</p>
    </Section>
  );
}
