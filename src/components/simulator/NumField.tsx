"use client";
import { useEffect, useId, useRef, useState } from "react";

interface Props {
  label: React.ReactNode; value: number; onChange: (n: number) => void;
  min: number; max: number; step: number; prefix?: string; suffix?: string; slider?: boolean; hint?: string; badge?: string; invalid?: boolean;
  testId?: string; name?: string;
}

const show = (n: number) => (Number.isFinite(n) ? String(Math.round(n * 1e6) / 1e6) : "");

/** Slider + exact numeric field sharing one value. The text box keeps what the user typed; invalid text propagates as NaN so the model can reject it. */
export function NumField({ label, value, onChange, min, max, step, prefix, suffix, slider = true, hint, badge, invalid, testId, name }: Props) {
  const id = useId();
  const [txt, setTxt] = useState(show(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setTxt(show(value)); }, [value]);
  const clamped = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-chalk/80">{label}</label>
        {badge && <span className="font-mono text-[0.56rem] uppercase tracking-[0.14em] text-copper">{badge}</span>}
      </div>
      <div className="mt-1.5 flex items-center border border-line bg-ink focus-within:border-mint">
        {prefix && <span className="pl-3 font-mono text-sm text-steel">{prefix}</span>}
        <input id={id} data-testid={testId} inputMode="decimal" type="text" value={txt} aria-invalid={invalid || !Number.isFinite(value)} aria-describedby={hint ? `${id}-h` : undefined}
          onFocus={() => { focused.current = true; }}
          onBlur={() => { focused.current = false; setTxt(show(value)); }}
          onChange={(e) => { setTxt(e.target.value); const t = e.target.value.trim(); onChange(t === "" ? NaN : Number(t)); }}
          className="tnum w-full min-w-0 bg-transparent px-3 py-2 font-mono text-base text-chalk outline-none aria-[invalid=true]:text-copper" />
        {suffix && <span className="pr-3 font-mono text-sm text-steel">{suffix}</span>}
      </div>
      {slider && (
        <input type="range" aria-label={`${name ?? (typeof label === "string" ? label : "value")} slider`} min={min} max={max} step={step} value={clamped} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full" />
      )}
      {hint && <p id={`${id}-h`} className="mt-1 text-xs leading-snug text-steel">{hint}</p>}
    </div>
  );
}
