import { BasisVenn } from "./BasisVenn";
import { Eyebrow, Section, Term } from "../ui";

function Step({ n, title, children, visual }: { n: string; title: string; children: React.ReactNode; visual: React.ReactNode }) {
  return (
    <article data-reveal className="border-t border-line py-10 md:py-14">
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-xs text-copper">{n}</span>
        <h3 className="font-display text-2xl md:text-3xl">{title}</h3>
      </div>
      <p className="mt-4 max-w-xl leading-relaxed text-chalk/75">{children}</p>
      <div className="mt-8 border border-line bg-navy/60 p-5 sm:p-7">{visual}</div>
    </article>
  );
}

const Axis = () => <path d="M10 130 H390 M10 130 V10" stroke="#8995a4" strokeOpacity=".5" fill="none" />;

export function Thesis() {
  return (
    <Section id="thesis" label="Thesis">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-32" data-reveal>
            <Eyebrow>The thesis</Eyebrow>
            <h2 id="thesis-h" className="font-display mt-4 text-[clamp(2.2rem,4.4vw,3.8rem)] leading-[1.04] tracking-[-0.015em] text-balance">Hedging starts with the business, not the contract.</h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-chalk/75">
              A sailor cancels for wind. A price screen pays for rain. Those two events can overlap without being the same risk. Our job is to find the cash-flow exposure, identify the actual settlement trigger, and decide whether the match is strong enough to matter.
            </p>
            <ul className="mt-10 space-y-5">
              {[
                ["EXPOSURE", "What genuinely changes contribution margin?"],
                ["TRIGGER", "What does the contract actually settle on?"],
                ["EXECUTION", "What does protection cost, and can the business obtain it?"],
              ].map(([t, q], i) => (
                <li key={t} className="grid grid-cols-[2.5rem_1fr] gap-3 border-l border-mint/50 pl-4">
                  <span className="font-mono text-xs text-mint">0{i + 1}</span>
                  <span><span className="font-mono text-xs tracking-[0.18em] text-chalk">{t}</span><span className="mt-1 block text-chalk/70">{q}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lg:col-span-7">
          <Step n="STEP 1 / EXPOSURE" title="An operating loss, in contribution margin"
            visual={
              <svg viewBox="0 0 400 150" className="w-full" role="img" aria-label="Schematic: a margin line dips during a disruption; the area under the baseline is the lost contribution margin.">
                <Axis />
                <path d="M10 70 H120 C150 70 150 112 185 112 C220 112 220 70 250 70 H390" stroke="#f7f6f0" strokeWidth="1.6" fill="none" pathLength={1} className="dr" />
                <path d="M120 70 C150 70 150 112 185 112 C220 112 220 70 250 70 Z" fill="#f2ad78" fillOpacity=".25" />
                <path d="M10 70 H390" stroke="#8995a4" strokeDasharray="3 5" strokeOpacity=".6" />
                <text x="190" y="140" textAnchor="middle" fill="#f2ad78" fontSize="9.5" letterSpacing="1.5" fontFamily="var(--font-plex-mono)">LOST CONTRIBUTION MARGIN</text>
                <text x="392" y="64" textAnchor="end" fill="#8995a4" fontSize="9" fontFamily="var(--font-plex-mono)">NORMAL MARGIN</text>
              </svg>
            }>
            The loss that matters is <Term term="contribution margin">contribution margin</Term>, not gross bookings. A $550 charter is not a $550 loss when avoidable costs disappear with it.
          </Step>
          <Step n="STEP 2 / TRIGGER" title="Imperfect settlement: what happened vs what settles" visual={<BasisVenn />}>
            Four joint states, not two. <Term term="basis risk">Basis risk</Term> lives in the copper region: a real loss that the contract does not pay.
          </Step>
          <Step n="STEP 3 / EXECUTION" title="An execution price that is not a probability"
            visual={
              <svg viewBox="0 0 400 150" className="w-full" role="img" aria-label="Schematic: a YES contract costs a price p and pays one dollar if it settles YES.">
                <Axis />
                <rect x="60" y="76" width="110" height="54" fill="#f2ad78" fillOpacity=".22" stroke="#f2ad78" />
                <rect x="230" y="22" width="110" height="108" fill="#84e5d0" fillOpacity=".16" stroke="#84e5d0" />
                <text x="115" y="106" textAnchor="middle" fill="#f7f6f0" fontSize="12" fontFamily="var(--font-plex-mono)">p + fee</text>
                <text x="285" y="80" textAnchor="middle" fill="#f7f6f0" fontSize="12" fontFamily="var(--font-plex-mono)">$1 if YES</text>
                <text x="115" y="145" textAnchor="middle" fill="#8995a4" fontSize="9" letterSpacing="1.5" fontFamily="var(--font-plex-mono)">CASH AT RISK</text>
                <text x="285" y="145" textAnchor="middle" fill="#8995a4" fontSize="9" letterSpacing="1.5" fontFamily="var(--font-plex-mono)"><tspan>CONTRACT PAYOUT</tspan></text>
                <path d="M170 103 H230" stroke="#8995a4" strokeDasharray="3 4" className="dr" pathLength={1} />
              </svg>
            }>
            A <Term term="limit price">limit price</Term> is what the protection costs, not the odds your business loses money. The <Term term="contract payout">payout</Term> is a fixed $1 per contract, whatever your actual loss.
          </Step>
        </div>
      </div>
    </Section>
  );
}

function Orbit({ tone, t = 16, r = 38 }: { tone: "copper" | "mint"; t?: number; r?: number }) {
  const c = tone === "copper" ? "#f2ad78" : "#84e5d0";
  return (
    <svg viewBox="0 0 200 100" className="h-20 w-40 shrink-0" aria-hidden>
      <ellipse cx="100" cy="50" rx="86" ry={r} fill="none" stroke={c} strokeOpacity=".35" />
      <ellipse cx="100" cy="50" rx="52" ry={r * 0.55} fill="none" stroke="#f7f6f0" strokeOpacity=".15" />
      <circle cx="100" cy="50" r="4" fill="#f7f6f0" />
      <g className="orbit" style={{ ["--t" as string]: `${t}s` }}><circle cx="186" cy="50" r="3.5" fill={c} /></g>
    </svg>
  );
}

export function RiskLines() {
  const rows = [
    { tone: "copper" as const, k: "WEATHER", t: "A cancellation is not a rainout.", d: "Brooklyn Sail cancels for unsafe conditions, which can include wind with little rain. An any-measurable-rain contract settles on a different event.", href: "#cases" },
    { tone: "copper" as const, k: "FUEL", t: "A fuel bill is local, mixed and timed.", d: "Xentra advertises no fuel surcharge, so a pump-price rise lands in margin. A national diesel threshold is a related, not identical, number.", href: "#cases" },
    { tone: "mint" as const, k: "STORMS · TWO-SIDED", t: "A storm can be a setback and a sale.", d: "Arborpolitan loses scheduled work in a storm but may gain emergency work. Hedging only the downside can turn a natural offset into a bet.", href: "#cases" },
  ];
  return (
    <Section id="risk" label="Risk lines" className="!pt-0">
      <div data-reveal><Eyebrow tone="copper">Risk lines</Eyebrow>
        <h2 id="risk-h" className="font-display mt-4 max-w-3xl text-[clamp(1.9rem,3.8vw,3.2rem)] leading-tight">Three exposures. Different signs, different triggers.</h2>
      </div>
      <ul className="mt-12 border-b border-line">
        {rows.map((r, i) => (
          <li key={r.k} data-reveal style={{ ["--d" as string]: `${i * 90}ms` }} className="grid items-center gap-6 border-t border-line py-8 md:grid-cols-[11rem_1fr_auto]">
            <Orbit tone={r.tone} t={14 + i * 5} />
            <div>
              <p className={`font-mono text-[0.7rem] tracking-[0.2em] ${r.tone === "copper" ? "text-copper" : "text-mint"}`}>{r.k}</p>
              <h3 className="font-display mt-2 text-2xl md:text-3xl">{r.t}</h3>
              <p className="mt-3 max-w-2xl leading-relaxed text-chalk/70">{r.d}</p>
            </div>
            <a href={r.href} className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-steel hover:text-mint">Field notes →</a>
          </li>
        ))}
      </ul>
    </Section>
  );
}
