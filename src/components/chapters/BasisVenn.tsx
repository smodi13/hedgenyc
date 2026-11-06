"use client";
import { useState } from "react";

const REGIONS = [
  { k: "p11", name: "Loss and the contract pays", text: "The hedge does its job. Even here, premium and fees were paid and the payout rarely matches the loss exactly.", x: 205, y: 140, tone: "mint" },
  { k: "p10", name: "Loss, but the contract does not pay", text: "The state most sales pitches leave out. The business loses margin, the contract settles NO, and the premium is gone too.", x: 110, y: 140, tone: "copper" },
  { k: "p01", name: "No loss, but the contract pays", text: "A windfall that is not a hedge: the contract settles YES while operations were fine. Premium was still spent to get it.", x: 300, y: 140, tone: "steel" },
  { k: "p00", name: "No loss, contract does not pay", text: "Nothing happened and the premium plus fee is simply spent. The ordinary cost of holding protection.", x: 205, y: 232, tone: "steel" },
] as const;

export function BasisVenn() {
  const [sel, setSel] = useState<(typeof REGIONS)[number]["k"]>("p10");
  const r = REGIONS.find((x) => x.k === sel)!;
  return (
    <div className="grid gap-6 sm:grid-cols-[minmax(0,320px)_1fr] sm:items-center">
      <svg viewBox="0 0 410 260" className="w-full" role="group" aria-label="Venn diagram of business loss events and contract YES settlement">
        <circle cx="160" cy="125" r="88" fill="#f2ad78" fillOpacity={sel === "p10" || sel === "p11" ? 0.2 : 0.08} stroke="#f2ad78" strokeWidth="1.2" />
        <circle cx="250" cy="125" r="88" fill="#84e5d0" fillOpacity={sel === "p01" || sel === "p11" ? 0.2 : 0.08} stroke="#84e5d0" strokeWidth="1.2" />
        <text x="62" y="26" fill="#f2ad78" fontSize="10" letterSpacing="2" fontFamily="var(--font-plex-mono)">WHAT HAPPENED</text>
        <text x="300" y="26" fill="#84e5d0" fontSize="10" letterSpacing="2" fontFamily="var(--font-plex-mono)">WHAT SETTLES</text>
        {REGIONS.map((g) => (
          <g key={g.k}>
            <circle cx={g.x} cy={g.y} r={g.k === "p00" ? 17 : 18} fill="#091019" stroke={sel === g.k ? "#f7f6f0" : "#8995A4"} strokeWidth={sel === g.k ? 1.6 : 1} />
            <text x={g.x} y={g.y + 4} textAnchor="middle" fill="#f7f6f0" fontSize="11" fontFamily="var(--font-plex-mono)">{g.k.toUpperCase()}</text>
            <foreignObject x={g.x - 24} y={g.y - 24} width="48" height="48">
              <button type="button" aria-label={g.name} aria-pressed={sel === g.k} onClick={() => setSel(g.k)} onMouseEnter={() => setSel(g.k)} onFocus={() => setSel(g.k)} className="size-12 rounded-full" />
            </foreignObject>
          </g>
        ))}
      </svg>
      <div aria-live="polite">
        <p className={`font-mono text-[0.68rem] uppercase tracking-[0.18em] ${r.tone === "copper" ? "text-copper" : r.tone === "mint" ? "text-mint" : "text-steel"}`}>{r.k.toUpperCase()} · {r.name}</p>
        <p className="mt-3 leading-relaxed text-chalk/80">{r.text}</p>
      </div>
    </div>
  );
}
