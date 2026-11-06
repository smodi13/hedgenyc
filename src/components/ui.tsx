import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";

/** Decorative chapter numeral rendered via CSS content so it is not a text node (intentionally low contrast). */
export const BigNum = ({ n, className = "" }: { n: string; className?: string }) => <span aria-hidden data-n={n} className={`bignum ${className}`} />;

export function Eyebrow({ children, tone = "mint" }: { children: ReactNode; tone?: "mint" | "copper" | "steel" }) {
  const c = tone === "mint" ? "text-mint" : tone === "copper" ? "text-copper" : "text-steel";
  return <p className={`font-mono text-[0.72rem] uppercase tracking-[0.22em] ${c}`}>{children}</p>;
}

export function Badge({ children, tone = "steel", className = "" }: { children: ReactNode; tone?: "mint" | "copper" | "steel" | "chalk"; className?: string }) {
  const t = {
    mint: "border-mint/50 text-mint",
    copper: "border-copper/60 text-copper",
    steel: "border-steel/50 text-steel",
    chalk: "border-chalk/40 text-chalk",
  }[tone];
  return <span className={`inline-flex max-w-full items-center border px-2 py-[3px] leading-snug font-mono text-[0.64rem] uppercase tracking-[0.14em] ${t} ${className}`}>{children}</span>;
}

export function Ext({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`inline-flex items-baseline gap-1 text-mint underline decoration-mint/40 underline-offset-4 transition-colors hover:decoration-mint ${className}`}>
      <span>{children}</span>
      <ExternalLink aria-hidden className="size-3 shrink-0 translate-y-[1px]" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export function SectionHead({ id, no, eyebrow, title, lead, tone = "mint" }: { id?: string; no: string; eyebrow: string; title: ReactNode; lead?: ReactNode; tone?: "mint" | "copper" }) {
  return (
    <header className="grid gap-8 md:grid-cols-12" data-reveal>
      <div className="md:col-span-2">
        <BigNum n={no} />
      </div>
      <div className="md:col-span-10">
        <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
        <h2 id={id} className="font-display mt-4 max-w-4xl text-[clamp(2rem,4.6vw,4rem)] leading-[1.04] tracking-[-0.015em] text-balance">{title}</h2>
        {lead && <p className="mt-6 max-w-2xl text-lg leading-relaxed text-chalk/75">{lead}</p>}
      </div>
    </header>
  );
}

export const Section = ({ id, label, children, className = "" }: { id: string; label: string; children: ReactNode; className?: string }) => (
  <section id={id} aria-labelledby={`${id}-h`} data-chapter={label} className={`relative mx-auto w-full max-w-[1320px] px-5 py-24 sm:px-8 md:py-36 ${className}`}>
    {children}
  </section>
);

/** Accessible tooltip for technical terms: focusable button + described-by popover; definition also lives in the glossary. */
const DEFS: Record<string, string> = {
  "basis risk": "The gap between what hurts the business and what the contract settles on. You can lose money operationally while the contract pays nothing, or collect a payout when the business is fine.",
  "contribution margin": "Revenue minus the variable costs avoided when a job is lost. The relevant loss for a hedge, not the gross ticket price.",
  "limit price": "The most you say you will pay per YES contract ($0.00–$1.00). A price is not a calibrated probability of your business loss.",
  "contract payout": "A winning YES contract pays $1.00 per contract at settlement; a losing one pays $0. Premium and fees are lost either way.",
};
export function Term({ children, term }: { children: ReactNode; term: keyof typeof DEFS }) {
  const id = `tip-${term.replace(/\s/g, "-")}`;
  return (
    <span className="group relative inline-block">
      <button type="button" aria-describedby={id} className="cursor-help border-b border-dotted border-mint/70 text-inherit">{children}</button>
      <span id={id} role="tooltip" className="tip pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-64 max-w-[calc(100vw-2.5rem)] border border-line bg-navy-2 p-3 text-left font-sans text-xs normal-case leading-relaxed tracking-normal text-chalk shadow-xl group-focus-within:block group-hover:block">
        {DEFS[term]}
      </span>
    </span>
  );
}
export const GLOSSARY = Object.entries(DEFS);
