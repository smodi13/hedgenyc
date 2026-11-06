import { GTM_PHASES, METRICS, MILESTONES, PIPELINE_STAGES } from "@/lib/research/concepts";
import { Badge, Eyebrow, Section, BigNum } from "../ui";

export function Pipeline({ counts }: { counts: { total: number; primary: number; withHypothesis: number; contacted: number } }) {
  const reached = [counts.total, counts.primary, counts.withHypothesis, 0, 0, 0, 0, 0, 0];
  return (
    <Section id="pipeline" label="Pipeline" className="!pt-0">
      <header className="grid gap-8 md:grid-cols-12" data-reveal>
        <BigNum n="07" className="md:col-span-2" />
        <div className="md:col-span-10">
          <Eyebrow>Business development · proposed pilot</Eyebrow>
          <h2 id="pipeline-h" className="font-display mt-4 max-w-4xl text-[clamp(2rem,4.6vw,4rem)] leading-[1.04] tracking-[-0.015em] text-balance">A pipeline that starts with listening.</h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-chalk/75">Source a real operator. Listen for the margin that moves. Test the trigger. Stress the basis. Only then discuss a practical use case.</p>
        </div>
      </header>

      <div className="mt-10 border border-copper/60 bg-copper/[0.07] p-5" data-reveal>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-copper">No outreach has been performed</p>
        <p className="mt-2 text-sm leading-relaxed text-chalk/85">{counts.contacted} of {counts.total} records have been contacted. No owner interviews, pilots, customer relationships or Kalshi collaboration exist. Every record is NOT CONTACTED.</p>
      </div>

      <ol className="mt-12 grid gap-px border border-line bg-line sm:grid-cols-3 lg:grid-cols-9" data-reveal aria-label="Qualification stages and records that have reached each">
        {PIPELINE_STAGES.map((s, i) => (
          <li key={s} className="bg-ink p-4">
            <p className="font-mono text-[0.58rem] text-steel">{String(i + 1).padStart(2, "0")}</p>
            <p className="mt-2 min-h-[3.2rem] text-sm leading-snug">{s}</p>
            <p className={`font-display tnum mt-3 text-3xl ${reached[i]! > 0 ? "text-mint" : "text-chalk/25"}`}>{reached[i]}</p>
            <p className="font-mono text-[0.56rem] uppercase tracking-[0.1em] text-steel">{reached[i]! > 0 ? "records" : "none yet"}</p>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-steel">Counts come from the research dataset. &ldquo;Exposure hypothesis&rdquo; means a hypothesis was written from public information, not that exposure was confirmed.</p>

      <div className="mt-16 grid gap-px border border-line bg-line md:grid-cols-3" data-reveal>
        {GTM_PHASES.map((p) => (
          <div key={p.days} className="bg-ink p-6 sm:p-8">
            <p className="font-mono text-xs tracking-[0.2em] text-copper">DAYS {p.days}</p>
            <h3 className="font-display mt-2 text-2xl">{p.title}</h3>
            <ul className="mt-5 list-disc space-y-3 pl-5 text-sm leading-relaxed text-chalk/75 marker:text-steel">{p.points.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        ))}
      </div>

      <div className="mt-16 grid gap-10 lg:grid-cols-2" data-reveal>
        <div>
          <h3 className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-mint">Evidence gap: public source → owner data</h3>
          <table className="mt-4 w-full border-collapse text-left text-sm">
            <thead><tr className="border-b border-line font-mono text-[0.6rem] uppercase tracking-[0.14em] text-steel"><th scope="col" className="py-2 pr-4 font-normal">Public sources can show</th><th scope="col" className="py-2 font-normal">Only the owner can supply</th></tr></thead>
            <tbody className="align-top text-chalk/80">
              {[["Operations exist; stated policies", "Contribution margin by job"], ["Advertised prices, locations", "Weekly volumes and cancellations"], ["A plausible risk hypothesis", "The trigger that actually costs money"], ["That a market exists", "Appetite, budget and ability to hold a position"]].map(([a, b]) => <tr key={a} className="border-b border-line/60"><td className="py-3 pr-4">{a}</td><td className="py-3 text-copper">{b}</td></tr>)}
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-mint">Pilot milestones</h3>
          <ol className="mt-4 space-y-3">{MILESTONES.map((m, i) => <li key={m} className="flex items-center gap-4 border-b border-line/60 pb-3"><span className="font-mono text-xs text-steel">{String(i + 1).padStart(2, "0")}</span><span>{m}</span>{i === 0 && <Badge tone="mint" className="ml-auto">Complete: desk research</Badge>}{i > 0 && <Badge className="ml-auto">Not started</Badge>}</li>)}</ol>
        </div>
      </div>

      <div className="mt-16" data-reveal>
        <h3 className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-mint">How the pilot would be measured</h3>
        <dl className="mt-5 grid gap-x-10 gap-y-6 md:grid-cols-2 lg:grid-cols-3">{METRICS.map(([k, v]) => <div key={k}><dt className="font-display text-xl">{k}</dt><dd className="mt-1 text-sm leading-relaxed text-chalk/70">{v}</dd></div>)}</dl>
      </div>
    </Section>
  );
}
