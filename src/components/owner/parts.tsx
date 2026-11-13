"use client";
import { useEffect, useRef, useState } from "react";
import { signedUsd, usd } from "@/lib/format";
import type { CaseKey, Exposure } from "@/lib/owner/business";
import { CASE_LABEL } from "@/lib/owner/business";
import type { Summary } from "@/lib/owner/analysis";

export function TextField({ label, value, onChange, multiline, testId, placeholder }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; testId?: string; placeholder?: string }) {
  const id = `tf-${label.replace(/\W/g, "")}`;
  const cls = "mt-1.5 w-full border border-line bg-ink px-3 py-2.5 text-base text-chalk focus:border-mint outline-none";
  return (
    <div>
      <label htmlFor={id} className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-chalk/80">{label}</label>
      {multiline ? <textarea id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} rows={3} className={cls} /> : <input id={id} data-testid={testId} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cls} />}
    </div>
  );
}

export const Select = <T extends string>({ label, value, onChange, options, testId }: { label: string; value: T; onChange: (v: T) => void; options: { v: T; label: string }[]; testId?: string }) => {
  const id = `sel-${label.replace(/\W/g, "")}`;
  return (
    <div>
      <label htmlFor={id} className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-chalk/80">{label}</label>
      <select id={id} data-testid={testId} value={value} onChange={(e) => onChange(e.target.value as T)} className="mt-1.5 w-full border border-line bg-ink px-3 py-2.5 text-base text-chalk">
        {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
    </div>
  );
};

export function PrintView({ summary }: { summary: Summary }) {
  return (
    <div className="print-only" data-testid="print-view">
      <h1 className="text-2xl font-bold">{summary.title}</h1>
      <p className="text-sm">Independent research. Not affiliated with or endorsed by Kalshi. No trade execution.</p>
      {summary.sections.map((sec) => (
        <div key={sec.heading} className="sec mt-4">
          <h2 className="border-b border-black text-base font-bold">{sec.heading}</h2>
          <table className="mt-1 w-full text-sm"><tbody>{sec.rows.map(([k, v], i) => <tr key={i} className="align-top"><th className="w-1/3 pr-3 text-left font-semibold">{k}</th><td>{v}</td></tr>)}</tbody></table>
        </div>
      ))}
    </div>
  );
}

const COLORS: Record<CaseKey, string> = { low: "#c8773a", normal: "#8fa3b8", high: "#5fd1a8" };

/** Contribution by activity case, with the shortfall versus normal marked. Width follows its container. */
export function ScenarioChart({ e }: { e: Exposure }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(560);
  const [hot, setHot] = useState<CaseKey | null>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([x]) => setW(Math.max(260, Math.floor(x!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const keys: CaseKey[] = ["low", "normal", "high"], h = 240, ml = 8, mb = 40, mt = 22;
  const vals = keys.map((k) => e[k].contribution);
  const hi = Math.max(0, ...vals), lo = Math.min(0, ...vals), span = hi - lo || 1;
  const y = (v: number) => mt + ((hi - v) / span) * (h - mt - mb);
  const bw = Math.min(110, (w - ml * 2) / 3 - 24), gap = (w - ml * 2 - bw * 3) / 4;
  return (
    <div ref={wrap} data-testid="scenario-chart">
      <svg width={w} height={h} role="img" aria-label={`Contribution by activity level: low ${usd(e.low.contribution, 0)}, normal ${usd(e.normal.contribution, 0)}, high ${usd(e.high.contribution, 0)}`} className="block select-none">
        <line x1={ml} x2={w - ml} y1={y(0)} y2={y(0)} stroke="#8fa3b8" strokeOpacity=".5" />
        {keys.map((k, i) => {
          const v = e[k].contribution, x = ml + gap + i * (bw + gap), top = Math.min(y(v), y(0)), bh = Math.max(2, Math.abs(y(v) - y(0)));
          const d = e[k].contributionVsNormal;
          return (
            <g key={k} onPointerEnter={() => setHot(k)} onPointerLeave={() => setHot(null)} opacity={hot && hot !== k ? 0.55 : 1} className="transition-opacity">
              <rect x={x} y={top} width={bw} height={bh} fill={COLORS[k]} className="bar-grow" rx={2} />
              <text x={x + bw / 2} y={top - 6} textAnchor="middle" fontSize="13" fill="#eef1f5" className="tnum">{usd(v, 0)}</text>
              <text x={x + bw / 2} y={h - 20} textAnchor="middle" fontSize="12" fill="#c9d3de">{CASE_LABEL[k]}</text>
              {k !== "normal" && <text x={x + bw / 2} y={h - 5} textAnchor="middle" fontSize="11" fill={d < 0 ? "#e08a4f" : "#8fa3b8"} className="tnum">{d === 0 ? "same as normal" : `${signedUsd(d, 0)} vs normal`}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
