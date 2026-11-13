"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";

export function Footer() {
  if (usePathname().startsWith("/owner-lab")) {
    return <footer className="border-t border-line bg-navy px-5 py-6 text-center font-mono text-[0.62rem] uppercase tracking-[0.16em] text-steel">Independent research, not affiliated with Kalshi · No trading functionality · Hypothetical outcomes only</footer>;
  }
  return (
    <footer className="relative border-t border-line bg-navy">
      <div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-16 sm:px-8 md:grid-cols-12">
        <div className="md:col-span-5">
          <p className="font-mono text-sm tracking-[0.3em]">HEDGE<span className="text-copper"> / </span>NYC</p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-chalk/70">Small business exposure lab. Independent NYC research on where event contracts might offset operational risk, and where they cannot.</p>
        </div>
        <ul className="space-y-2 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-steel md:col-span-3">
          <li><Link className="hover:text-mint" href="/#screen">Business screen</Link></li>
          <li><Link className="hover:text-mint" href="/#lab">Hedge lab</Link></li>
          <li><Link className="hover:text-mint" href="/owner-lab">Owner lab calculator</Link></li>
          <li><Link className="hover:text-mint" href="/#evidence">Evidence &amp; downloads</Link></li>
          <li><a className="hover:text-mint" target="_blank" rel="noopener noreferrer" href="https://kalshi.com/hedging">Official Kalshi hedging page<span className="sr-only"> (opens in a new tab)</span></a></li>
        </ul>
        <p className="text-sm leading-relaxed text-chalk/80 md:col-span-4">
          Independent research work sample. Not affiliated with Kalshi. Illustrative scenarios, not financial advice. No business outreach or trading has occurred.
        </p>
      </div>
      <div className="border-t border-line px-5 py-4 text-center font-mono text-[0.62rem] uppercase tracking-[0.16em] text-steel">
        Independent research, not affiliated with Kalshi · Research as of Nov 6, 2026
      </div>
    </footer>
  );
}
