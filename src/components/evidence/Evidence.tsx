import { Download } from "lucide-react";
import { loadDownloads, loadSources } from "@/lib/research/sources";
import { GLOSSARY, Eyebrow, Ext, Section, BigNum } from "../ui";

const kb = (b: number) => (b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");

export function Evidence({ counts }: { counts: { total: number; primary: number; discovery: number } }) {
  const sources = loadSources();
  const downloads = loadDownloads();
  const tiers = [
    [counts.primary, "Company-website-backed records", "First-party pages support existence, stated activity, published policies or advertised details. They do not establish owner exposure, customer status, revenue or hedge suitability."],
    [counts.discovery, "Directory-discovery records", "Surfaced by business directories or discovery searches. No first-party source in the dataset; lower confidence; not ready-to-contact or qualified."],
    [3, "Flagship cases", "Public operating evidence plus plainly hypothetical margin assumptions, with cautionary analyst decisions. Not due diligence or owner consultations."],
    [5, "Kalshi discovery records", "Dated Nov 2026 market and family records with original URLs. No live quote, executable book or availability validated in the files."],
  ] as const;
  return (
    <Section id="evidence" label="Evidence">
      <header className="grid gap-8 md:grid-cols-12" data-reveal>
        <BigNum n="08" className="md:col-span-2" />
        <div className="md:col-span-10">
          <Eyebrow>Evidence · methodology · downloads</Eyebrow>
          <h2 id="evidence-h" className="font-display mt-4 max-w-4xl text-[clamp(2rem,4.6vw,4rem)] leading-[1.04] tracking-[-0.015em] text-balance">Evidence is part of the product.</h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-chalk/75">Every company observation links to its public origin. Every number is marked as sourced or hypothetical. Every market quote must come from the exchange and include an observation time. An unavailable feed does not become a made-up price.</p>
        </div>
      </header>

      <div className="mt-14 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4" data-reveal>
        {tiers.map(([n, t, d]) => <div key={t} className="bg-ink p-6"><p className="font-display tnum text-5xl text-mint">{n}</p><h3 className="mt-3 font-mono text-[0.68rem] uppercase tracking-[0.16em]">{t}</h3><p className="mt-3 text-sm leading-relaxed text-chalk/70">{d}</p></div>)}
      </div>

      <div className="mt-20" id="downloads">
        <h3 className="font-display text-3xl" data-reveal>Downloads</h3>
        <p className="mt-3 max-w-2xl text-chalk/70" data-reveal>Original research files, byte-for-byte as supplied. SHA-256 fingerprints let you verify them.</p>
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {downloads.map((d) => (
            <li key={d.file} data-reveal>
              <a href={`/downloads/${d.file}`} download className="group flex h-full gap-5 border border-line bg-navy/50 p-6 transition-colors hover:border-mint">
                <Download className="mt-1 size-5 shrink-0 text-mint transition-transform group-hover:translate-y-0.5" aria-hidden />
                <span className="min-w-0">
                  <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-copper">{d.kind} · {kb(d.bytes)}</span>
                  <span className="font-display mt-1 block text-2xl leading-snug">{d.title}</span>
                  <span className="mt-2 block text-sm leading-relaxed text-chalk/70">{d.blurb}</span>
                  <span className="mt-3 block break-all font-mono text-[0.58rem] text-steel">{d.file} · sha256 {d.sha.slice(0, 16)}…</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-20 grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5" data-reveal>
          <h3 className="font-display text-3xl">Method &amp; limits</h3>
          <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-chalk/80 marker:font-mono marker:text-steel">
            <li>Distinguish sourced operating detail, inferred exposure, hypothetical calculations and executable market data.</li>
            <li>Review the settlement rule at the exact contract level before discussing protection.</li>
            <li>Value a loss at contribution margin or incremental cash cost, not gross ticket value.</li>
            <li>Include the loss-without-payout state, not only the payout-wins states.</li>
            <li>Treat no suitable contract, basis match or affordable liquidity as a reason to pass.</li>
            <li>Never imply positive hedge returns or that these businesses have engaged with Kalshi.</li>
          </ol>
          <p className="mt-6 text-sm leading-relaxed text-steel">The analyst triage score is a subjective composite (30% risk clarity, 20% source observability, 30% contract fit, 20% pilot tractability), not a statistical model. A genuine pilot would need permissioned owner interviews, owner-level data, the exact contract rulebook, time-stamped executable asks and internal compliance review. None is claimed here.</p>
          <h3 className="font-display mt-12 text-2xl">Glossary</h3>
          <dl className="mt-4 space-y-4">{GLOSSARY.map(([k, v]) => <div key={k}><dt className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-mint">{k}</dt><dd className="mt-1 text-sm leading-relaxed text-chalk/75">{v}</dd></div>)}</dl>
        </div>
        <div className="lg:col-span-7" data-reveal>
          <h3 className="font-display text-3xl">Source register</h3>
          <p className="mt-3 text-sm text-chalk/70">{sources.length} sources. Primary = company website; government and Kalshi sources are labelled.</p>
          <div className="mt-6 overflow-x-auto" tabIndex={0} role="region" aria-label="Source register table, scrollable">
            <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
              <thead><tr className="border-b border-line font-mono text-[0.6rem] uppercase tracking-[0.14em] text-steel"><th scope="col" className="py-2 pr-3 font-normal">ID</th><th scope="col" className="px-3 font-normal">Source</th><th scope="col" className="px-3 font-normal">Kind</th><th scope="col" className="pl-3 font-normal">Supports</th></tr></thead>
              <tbody className="align-top">
                {sources.map((s) => (
                  <tr key={s.id} id={s.id} className="border-b border-line/60">
                    <th scope="row" className="py-3 pr-3 font-mono text-xs font-normal text-copper">{s.id}</th>
                    <td className="px-3 py-3"><Ext href={s.url}>{s.document}</Ext></td>
                    <td className="px-3 py-3 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-steel">{s.kind}</td>
                    <td className="pl-3 py-3 text-chalk/70">{s.supports}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-20 border border-line p-6 text-center text-sm leading-relaxed text-chalk/80" data-reveal>
        Independent research work sample. Not affiliated with Kalshi. Illustrative scenarios, not financial advice. No business outreach or trading has occurred.
      </div>
    </Section>
  );
}
