"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { signedUsd, usd } from "@/lib/format";
import type { ChartPoint, Position } from "@/lib/owner/hedge";

interface Props { points: ChartPoint[]; loss: number; optimized: { pct: number; position: Position } | null; hasProbs: boolean }

const M = { l: 58, r: 12, t: 12, b: 34 };
const niceTicks = (lo: number, hi: number, n = 4) => {
  const span = hi - lo || 1, raw = span / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.abs(v) < 1e-9 ? 0 : v);
  return out;
};
const short = (n: number) => (n < 0 ? "−" : "") + "$" + (Math.abs(n) >= 1000 ? `${(Math.abs(n) / 1000).toFixed(Math.abs(n) % 1000 ? 1 : 0)}k` : Math.abs(n).toFixed(0));

export function OwnerChart({ points, loss, optimized, hasProbs }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [sel, setSel] = useState<number | null>(null);
  const id = useId();
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.floor(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const h = w < 420 ? 260 : 330;
  const iw = w - M.l - M.r, ih = h - M.t - M.b;

  const { lo, hi } = useMemo(() => {
    const vals: number[] = [0, -loss];
    for (const p of points) for (const v of [p.ifPays, p.ifNotPays, p.expected, p.cost === null ? null : -p.cost]) if (v !== null) vals.push(v);
    const a = Math.min(...vals), b = Math.max(...vals), pad = (b - a || 1) * 0.06;
    return { lo: a - pad, hi: b + pad };
  }, [points, loss]);

  const x = (pct: number) => M.l + (pct / 100) * iw;
  const y = (v: number) => M.t + (1 - (v - lo) / (hi - lo)) * ih;
  const line = (get: (p: ChartPoint) => number | null) => {
    let d = "", pen = false;
    for (const p of points) { const v = get(p); if (v === null) { pen = false; continue; } d += `${pen ? "L" : "M"}${x(p.pct).toFixed(1)} ${y(v).toFixed(1)}`; pen = true; }
    return d;
  };
  const ok = points.filter((p) => p.ifPays !== null);
  const area = ok.length > 1
    ? `M${x(ok[0]!.pct)} ${y(-loss)}` + ok.map((p) => `L${x(p.pct).toFixed(1)} ${y(p.ifPays!).toFixed(1)}`).join("") + `L${x(ok[ok.length - 1]!.pct)} ${y(-loss)}Z`
    : "";

  const idx = sel ?? (optimized ? Math.round(optimized.pct) : 25);
  const cur = points[Math.max(0, Math.min(100, idx))]!;
  const set = (clientX: number, rect: DOMRect) => setSel(Math.max(0, Math.min(100, Math.round(((clientX - rect.left - M.l) / iw) * 100))));
  const yt = niceTicks(lo, hi);

  return (
    <div>
      <div ref={wrap} className="relative">
        <svg width={w} height={h} role="img" aria-labelledby={`${id}-t`} className="block touch-pan-y select-none"
          onPointerMove={(e) => set(e.clientX, e.currentTarget.getBoundingClientRect())} onPointerDown={(e) => set(e.clientX, e.currentTarget.getBoundingClientRect())}>
          <title id={`${id}-t`}>Hedge coverage against financial impact. Use the inspector slider below to read exact numbers.</title>
          {yt.map((v) => (
            <g key={v}>
              <line x1={M.l} x2={w - M.r} y1={y(v)} y2={y(v)} stroke="rgba(247,246,240,.09)" />
              <text x={M.l - 8} y={y(v) + 4} textAnchor="end" className="fill-steel" fontSize="11" fontFamily="var(--font-plex-mono)">{short(v)}</text>
            </g>
          ))}
          <line x1={M.l} x2={w - M.r} y1={y(0)} y2={y(0)} stroke="rgba(247,246,240,.3)" />
          {[0, 25, 50, 75, 100].map((p) => <text key={p} x={x(p)} y={h - 12} textAnchor={p === 0 ? "start" : p === 100 ? "end" : "middle"} className="fill-steel" fontSize="11" fontFamily="var(--font-plex-mono)">{p}%</text>)}
          {area && <path d={area} fill="rgba(132,229,208,.12)" className="chart-path" />}
          <path d={line(() => -loss)} fill="none" stroke="#8995a4" strokeDasharray="4 4" />
          <path d={line((p) => (p.cost === null ? null : -p.cost))} fill="none" stroke="#f2ad78" strokeDasharray="2 3" strokeWidth="1.5" className="chart-path" />
          <path d={line((p) => p.ifNotPays)} fill="none" stroke="#f2ad78" strokeWidth="2" className="chart-path" />
          <path d={line((p) => p.ifPays)} fill="none" stroke="#84e5d0" strokeWidth="2" className="chart-path" />
          {hasProbs && <path d={line((p) => p.expected)} fill="none" stroke="#f7f6f0" strokeWidth="2" className="chart-path" />}
          {optimized && (
            <g>
              <line x1={x(optimized.pct)} x2={x(optimized.pct)} y1={M.t} y2={M.t + ih} stroke="#84e5d0" strokeDasharray="1 4" />
              <circle cx={x(optimized.pct)} cy={y(hasProbs && optimized.position.expCombined !== null ? optimized.position.expCombined : optimized.position.outcomes.lossPays)} r="5" fill="#091019" stroke="#84e5d0" strokeWidth="2" />
              <text x={Math.min(x(optimized.pct) + 6, w - 70)} y={M.t + 11} className="fill-mint" fontSize="11" fontFamily="var(--font-plex-mono)">Optimized</text>
            </g>
          )}
          <line x1={x(cur.pct)} x2={x(cur.pct)} y1={M.t} y2={M.t + ih} stroke="rgba(247,246,240,.55)" />
          {cur.ifPays !== null && <circle cx={x(cur.pct)} cy={y(cur.ifPays)} r="3.5" fill="#84e5d0" />}
          {cur.ifNotPays !== null && <circle cx={x(cur.pct)} cy={y(cur.ifNotPays)} r="3.5" fill="#f2ad78" />}
          {hasProbs && cur.expected !== null && <circle cx={x(cur.pct)} cy={y(cur.expected)} r="3.5" fill="#f7f6f0" />}
        </svg>
        <p className="mt-1 text-center font-mono text-[0.65rem] uppercase tracking-[0.14em] text-steel">Hedge coverage: share of your loss the contract would repay if it pays</p>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-chalk/80">
        <Key c="#84e5d0" t="Loss left if the contract pays" /><Key c="#f2ad78" t="Loss if it does not pay (incl. cost)" /><Key c="#f2ad78" dash t="Upfront hedge cost" />
        {hasProbs && <Key c="#f7f6f0" t="Expected hedged result" />}<Key c="#8995a4" dash t="No hedge (full loss)" />
      </ul>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1.4fr] md:items-center">
        <div>
          <label htmlFor={`${id}-s`} className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-chalk/80">Inspect coverage: <span className="text-mint">{cur.pct}%</span></label>
          <input id={`${id}-s`} data-testid="chart-inspect" type="range" min={0} max={100} step={1} value={cur.pct} onChange={(e) => setSel(Number(e.target.value))} className="mt-1 w-full" />
        </div>
        <dl data-testid="chart-readout" className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          {cur.contracts === null ? <p className="col-span-full text-steel">Not reachable with the available price and depth.</p> : (
            <>
              <R k="Contracts" v={cur.contracts.toLocaleString("en-US")} />
              <R k="Upfront cost" v={usd(cur.cost!)} />
              <R k="Loss left if it pays" v={usd(-cur.ifPays!)} />
              <R k="Loss if it does not pay" v={usd(-cur.ifNotPays!)} />
              <R k="Risk reduction if it pays" v={usd(loss + cur.ifPays!)} />
              <R k="Expected result" v={cur.expected === null ? "needs probabilities" : signedUsd(cur.expected)} />
              {cur.cvarChange !== null && <R k="Change in 90% CVaR" v={signedUsd(cur.cvarChange)} />}
            </>
          )}
        </dl>
      </div>
    </div>
  );
}

const Key = ({ c, t, dash }: { c: string; t: string; dash?: boolean }) => (
  <li className="flex items-center gap-2"><svg width="22" height="6" aria-hidden><line x1="0" x2="22" y1="3" y2="3" stroke={c} strokeWidth="2" strokeDasharray={dash ? "3 3" : undefined} /></svg>{t}</li>
);
const R = ({ k, v }: { k: string; v: string }) => (<div><dt className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-steel">{k}</dt><dd className="tnum text-chalk">{v}</dd></div>);
