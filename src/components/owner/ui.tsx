"use client";
import type { ReactNode } from "react";
import { NumField } from "@/components/simulator/NumField";

export type Tag = "fact" | "owner" | "analyst" | "market" | "hypo";
const TAGS: Record<Tag, { t: string; c: string }> = {
  fact: { t: "Published fact", c: "border-chalk/40 text-chalk" },
  owner: { t: "Owner-entered data", c: "border-mint/60 text-mint" },
  analyst: { t: "Analyst assumption", c: "border-copper/60 text-copper" },
  market: { t: "Market data", c: "border-[#9db7ff]/60 text-[#9db7ff]" },
  hypo: { t: "Hypothetical outcome", c: "border-steel/70 text-steel" },
};
export const Chip = ({ tag }: { tag: Tag }) => (
  <span className={`inline-block border px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] ${TAGS[tag].c}`}>{TAGS[tag].t}</span>
);

export function Card({ children, className = "", id, tag, title, aside }: { children: ReactNode; className?: string; id?: string; tag?: Tag; title?: ReactNode; aside?: ReactNode }) {
  return (
    <section id={id} className={`glow fade-up relative border border-line bg-gradient-to-br from-navy-2/70 to-navy/60 p-5 sm:p-7 ${className}`}>
      {(title || tag) && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {title && <h3 className="font-display text-xl text-chalk sm:text-2xl">{title}</h3>}
          <div className="flex items-center gap-3">{aside}{tag && <Chip tag={tag} />}</div>
        </div>
      )}
      {children}
    </section>
  );
}

/** NumField with its validation message under it. Values are stored as fractions for percent fields. */
export function F({ err, pct, value, onChange, ...p }: Omit<React.ComponentProps<typeof NumField>, "invalid"> & { err?: string; pct?: boolean }) {
  const v = pct && Number.isFinite(value) ? Math.round(value * 1e8) / 1e6 : value;
  return (
    <div>
      <NumField {...p} value={v} onChange={(n) => onChange(pct ? n / 100 : n)} invalid={!!err} suffix={pct ? "%" : p.suffix} min={p.min} max={p.max} />
      {err && <p role="alert" className="mt-1 text-xs text-copper">{err}</p>}
    </div>
  );
}

export const Seg = <T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; label: string }) => (
  <div role="group" aria-label={label} className="inline-flex border border-line">
    {options.map((o) => (
      <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}
        className={`px-4 py-2.5 font-mono text-[0.7rem] uppercase tracking-[0.14em] transition-colors ${value === o.v ? "bg-mint text-ink" : "text-chalk/80 hover:bg-chalk/5"}`}>{o.label}</button>
    ))}
  </div>
);

export const Stat = ({ k, children, sub, tone = "chalk", big }: { k: string; children: ReactNode; sub?: string; tone?: "chalk" | "mint" | "copper"; big?: boolean }) => (
  <div className="border border-line bg-ink/40 p-4">
    <p className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-steel">{k}</p>
    <p className={`font-display mt-1 ${big ? "text-3xl sm:text-4xl" : "text-2xl"} ${tone === "mint" ? "text-mint" : tone === "copper" ? "text-copper" : "text-chalk"}`}>{children}</p>
    {sub && <p className="mt-1 text-xs leading-snug text-steel">{sub}</p>}
  </div>
);
