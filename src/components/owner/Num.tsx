"use client";
import { useEffect, useRef, useState } from "react";
import { pct, usd } from "@/lib/format";

const FMT = { usd: (n: number) => usd(n), usd0: (n: number) => usd(n, 0), int: (n: number) => Math.round(n).toLocaleString("en-US"), pct: (n: number) => pct(n, 1), pct0: (n: number) => pct(n, 0) };
export type NumKind = keyof typeof FMT;

/**
 * Animated figure. Text is written straight to the DOM (no React re-render per frame) and the exact final value
 * is always in data-value. Skips animation under prefers-reduced-motion.
 */
export function Num({ value, kind = "usd", testId, className }: { value: number | null; kind?: NumKind; testId?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);
  const [initial] = useState(() => (value === null || !Number.isFinite(value) ? "—" : FMT[kind](value)));
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const f = FMT[kind];
    if (value === null || !Number.isFinite(value)) { el.textContent = "—"; shown.current = null; return; }
    const from = shown.current;
    if (from === null || from === value || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = f(value); shown.current = value; return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 280);
      const v = k === 1 ? value : from + (value - from) * (1 - (1 - k) ** 3);
      el.textContent = f(v); shown.current = v;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, kind]);
  return <span ref={ref} data-testid={testId} data-value={value === null || !Number.isFinite(value) ? "" : String(value)} className={`tnum ${className ?? ""}`}>{initial}</span>;
}
