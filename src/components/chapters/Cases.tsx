"use client";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { CASES, EXPOSURE_DEFAULTS, NEGATIVE_CONTROLS, NEGATIVE_CONTROL_TEXT, type CaseId, type CaseStudy } from "@/lib/research/cases";
import { fuelLoss, sailLoss, stormAdverseLoss, stormNet } from "@/lib/finance/hedge";
import { signedUsd, usd } from "@/lib/format";
import { Badge, Eyebrow, Ext, Section, Term, BigNum } from "../ui";

type Row = { label: string; value: number; note?: string; total?: boolean; signed?: boolean };

function Waterfall({ rows, caption }: { rows: Row[]; caption: string }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <figure>
      <ul className="space-y-3" role="list">
        {rows.map((r, i) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className={r.total ? "font-medium text-chalk" : "text-chalk/75"}>{r.label}</span>
              <span className={`tnum shrink-0 whitespace-nowrap font-mono ${r.value < 0 ? "text-copper" : r.total ? "text-mint" : "text-chalk"}`}>{r.total && !r.signed ? usd(r.value) : signedUsd(r.value)}</span>
            </div>
            <div className="mt-1.5 h-2 bg-line/60">
              <motion.div
                className={r.value < 0 ? "h-full bg-copper" : r.total ? "h-full bg-mint" : "h-full bg-chalk/70"}
                initial={{ width: 0 }} animate={{ width: `${(Math.abs(r.value) / max) * 100}%` }}
                transition={{ duration: 0.9, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            {r.note && <p className="mt-1 text-xs text-steel">{r.note}</p>}
          </li>
        ))}
      </ul>
      <figcaption className="mt-4 text-xs leading-relaxed text-steel">{caption}</figcaption>
    </figure>
  );
}

function Model({ id }: { id: CaseId }) {
  const [alt, setAlt] = useState(false);
  if (id === "sail") {
    const e = EXPOSURE_DEFAULTS.sail;
    const price = (e.bookingLow + e.bookingHigh) / 2;
    const L = sailLoss(price, e.avoidable, e.canceled);
    return <Waterfall rows={[
      { label: "Hypothetical private charter (midpoint of advertised $525–$575)", value: price },
      { label: `Avoidable variable cost (${e.avoidable * 100}% assumed, not supplied by the business)`, value: -(price - L) },
      { label: "Lost contribution margin if the booking is permanently lost", value: L, total: true },
    ]} caption="Contribution margin, not gross bookings. A rescheduled trip loses far less than this." />;
  }
  if (id === "xentra") {
    const e = EXPOSURE_DEFAULTS.xentra;
    const gross = e.gallons * e.shock;
    const L = fuelLoss(e.gallons, e.shock, e.passThrough);
    return <Waterfall rows={[
      { label: `${e.gallons.toLocaleString()} gallons × $${e.shock.toFixed(2)}/gal local increase (hypothetical)`, value: gross },
      { label: `Customer pass-through (${e.passThrough * 100}% assumed)`, value: -(gross - L) },
      { label: "Incremental cash cost absorbed", value: L, total: true },
    ]} caption="Gallons and shock are analyst assumptions, not Xentra's actual consumption." />;
  }
  const e = EXPOSURE_DEFAULTS.arbor;
  const emergency = alt ? 500 : e.emergencyGain;
  const net = stormNet(e.scheduledLoss, emergency);
  const adverse = stormAdverseLoss(e.scheduledLoss, emergency);
  return (
    <div>
      <Waterfall rows={[
        { label: "Scheduled planned-care margin lost in a storm (hypothetical)", value: -e.scheduledLoss },
        { label: "Emergency storm-work margin earned (hypothetical)", value: emergency },
        { label: net >= 0 ? "Net storm contribution" : "Net storm contribution (adverse)", value: net, total: true, signed: true, note: adverse === 0 ? "No adverse net loss: the storm is a net gain in this scenario." : `Adverse net economic exposure: ${usd(adverse)}. Still no approved hedge identified.` },
      ]} caption="Both amounts are made-up analyst scenarios. Modeling only the lost scheduled work would be incomplete." />
      <button type="button" aria-pressed={alt} onClick={() => setAlt((v) => !v)} className="mt-5 border border-line px-3 py-2 font-mono text-[0.66rem] uppercase tracking-[0.14em] hover:border-mint hover:text-mint aria-pressed:border-mint aria-pressed:text-mint">
        {alt ? "Back to $1,400 emergency margin" : "Test $500 emergency-margin sensitivity"}
      </button>
    </div>
  );
}

const tone = { hold: "text-copper border-copper/60 bg-copper/10", qualify: "text-mint border-mint/60 bg-mint/10", pass: "text-chalk border-chalk/40 bg-chalk/5" } as const;

const H = ({ children }: { children: React.ReactNode }) => <h4 className="mb-2 font-mono text-[0.66rem] uppercase tracking-[0.2em] text-mint">{children}</h4>;

function Panel({ c }: { c: CaseStudy }) {
  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <div className="space-y-8 lg:col-span-7">
        <div><H>Risk driver</H><p className="leading-relaxed text-chalk/85">{c.riskDriver}</p></div>
        <div>
          <H>Observed business evidence</H>
          <p className="leading-relaxed text-chalk/85">{c.observed}</p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1">{c.observedSources.map((s) => <li key={s.url}><Ext href={s.url}>{s.label}</Ext></li>)}</ul>
        </div>
        <div>
          <H>{c.id === "arbor" ? "Unmatched contract" : "Matched contract (dated discovery, not verified live)"}</H>
          <p className="leading-relaxed text-chalk/85">{c.matched}</p>
          {c.id === "xentra" && <p className="mt-3 border border-copper/60 p-3 text-sm text-copper">Not selected: analyst review found no suitable Xentra hedge. The diesel contract is shown as an unselected market example only (AAA national benchmark, unknown gasoline/diesel mix, single-date observation). Further operating diligence would be required.</p>}
          {c.matchedSources.length > 0 && <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1">{c.matchedSources.map((s) => <li key={s.url}><Ext href={s.url}>{s.label}</Ext></li>)}</ul>}
        </div>
        <div className="border-l-2 border-copper pl-5">
          <H><span className="text-copper"><Term term="basis risk">Basis mismatch</Term></span></H>
          <p className="leading-relaxed text-chalk/85">{c.basis}</p>
        </div>
        <div>
          <H>Questions for the owner (not yet asked)</H>
          <ul className="list-disc space-y-1.5 pl-5 text-chalk/80 marker:text-steel">{c.ownerQuestions.map((q) => <li key={q}>{q}</li>)}</ul>
        </div>
      </div>
      <aside className="space-y-8 lg:col-span-5">
        <div className={`border p-6 ${tone[c.dispositionTone]}`}>
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.2em] opacity-80">Analyst disposition</p>
          <p className="font-display mt-2 text-2xl leading-snug">{c.disposition}</p>
          <p className="mt-4 text-sm leading-relaxed text-chalk/85">{c.dispositionDetail}</p>
        </div>
        <div className="border border-line bg-navy/60 p-6">
          <H>Hypothetical economic model</H>
          <p className="mb-5 text-sm leading-relaxed text-chalk/70">{c.hypothetical}</p>
          <Model id={c.id} />
        </div>
        <button type="button" onClick={() => { window.dispatchEvent(new CustomEvent("hny:case", { detail: c.id })); document.getElementById("lab")?.scrollIntoView({ behavior: "smooth" }); history.replaceState(null, "", "#lab"); }}
          className="group flex w-full items-center justify-between border border-mint/60 px-5 py-4 font-mono text-[0.72rem] uppercase tracking-[0.18em] text-mint hover:bg-mint hover:text-ink">
          Stress-test this case in the Hedge Lab <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
        </button>
      </aside>
    </div>
  );
}

export function Cases() {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const touch = useRef<number | null>(null);
  const go = (n: number, focus = false) => { const k = (n + CASES.length) % CASES.length; setDir(k >= i ? 1 : -1); setI(k); if (focus) refs.current[k]?.focus(); };
  const c = CASES[i]!;

  return (
    <Section id="cases" label="Field notes">
      <header className="grid gap-8 md:grid-cols-12" data-reveal>
        <BigNum n="03" className="md:col-span-2" />
        <div className="md:col-span-10">
          <Eyebrow tone="copper">Field notes</Eyebrow>
          <h2 id="cases-h" className="font-display mt-4 max-w-4xl text-[clamp(2rem,4.6vw,4rem)] leading-[1.04] tracking-[-0.015em]">Three exposures. Three different answers.</h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-chalk/75">Operating evidence is public. Every dollar figure below is a hypothetical analyst input, labelled as such, and none was supplied by the business.</p>
        </div>
      </header>

      <div className="mt-14" data-reveal>
        <div role="tablist" aria-label="Case studies" className="grid border border-line sm:grid-cols-3"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1, true); }
            else if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1, true); }
            else if (e.key === "Home") { e.preventDefault(); go(0, true); }
            else if (e.key === "End") { e.preventDefault(); go(CASES.length - 1, true); }
          }}>
          {CASES.map((k, n) => (
            <button key={k.id} ref={(el) => { refs.current[n] = el; }} role="tab" id={`tab-${k.id}`} aria-selected={i === n} aria-controls={`panel-${k.id}`} tabIndex={i === n ? 0 : -1}
              onClick={() => go(n)} className={`relative border-b border-line px-5 py-5 text-left last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${i === n ? "bg-navy" : "hover:bg-navy/50"}`}>
              {i === n && <motion.span layoutId="casebar" className="absolute inset-x-0 top-0 h-0.5 bg-mint" />}
              <span className="font-mono text-xs text-copper">{k.index}</span>
              <span className="font-display mt-1 block text-2xl">{k.name}</span>
              <span className="mt-1 block font-mono text-[0.62rem] uppercase tracking-[0.14em] text-steel">{k.exposureType}</span>
            </button>
          ))}
        </div>

        <div className="mt-px border border-t-0 border-line bg-navy/40 p-5 sm:p-10" onTouchStart={(e) => { touch.current = e.touches[0]?.clientX ?? null; }}
          onTouchEnd={(e) => { const s = touch.current; touch.current = null; const x = e.changedTouches[0]?.clientX; if (s !== null && x !== undefined && Math.abs(x - s) > 70) go(i + (x < s ? 1 : -1)); }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={c.id} role="tabpanel" id={`panel-${c.id}`} aria-labelledby={`tab-${c.id}`} tabIndex={0}
              initial={{ opacity: 0, x: 28 * dir }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -28 * dir }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
              <div className="mb-10 flex flex-wrap items-end justify-between gap-6 border-b border-line pb-8">
                <div className="flex items-baseline gap-5">
                  <BigNum n={c.index} className="bignum-lg" />
                  <h3 className="font-display max-w-2xl text-[clamp(1.7rem,3.4vw,2.8rem)] leading-tight">{c.title}</h3>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => go(i - 1)} aria-label="Previous case" className="border border-line p-2.5 hover:border-mint hover:text-mint"><ChevronLeft className="size-5" /></button>
                  <button type="button" onClick={() => go(i + 1)} aria-label="Next case" className="border border-line p-2.5 hover:border-mint hover:text-mint"><ChevronRight className="size-5" /></button>
                </div>
              </div>
              <Panel c={c} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-16 border border-copper/50 bg-copper/[0.06] p-6 sm:p-10" data-reveal>
        <Badge tone="copper">When not to hedge</Badge>
        <h3 className="font-display mt-4 text-3xl text-copper sm:text-4xl">Two negative controls. Outcome: do not pitch.</h3>
        <p className="mt-4 max-w-3xl leading-relaxed text-chalk/80">{NEGATIVE_CONTROL_TEXT}</p>
        <ul className="mt-5 flex flex-wrap gap-x-8 gap-y-2">
          {NEGATIVE_CONTROLS.map((n) => <li key={n.name}><Ext href={n.url}>{n.name}</Ext></li>)}
        </ul>
      </div>
    </Section>
  );
}

