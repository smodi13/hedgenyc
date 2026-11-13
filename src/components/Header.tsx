"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, useScroll, useSpring } from "motion/react";
import { Menu, X } from "lucide-react";

export const CHAPTERS = [
  { id: "thesis", label: "Thesis", group: "The Thesis" },
  { id: "risk", label: "Risk lines", group: "The Thesis" },
  { id: "screen", label: "Origination", group: "Business Screen" },
  { id: "cases", label: "Field notes", group: "Field Notes" },
  { id: "lab", label: "Hedge lab", group: "Hedge Lab" },
  { id: "market-fit", label: "Market fit", group: "Market Design" },
  { id: "concepts", label: "New markets", group: "Market Design" },
  { id: "pipeline", label: "Pipeline", group: "Evidence" },
  { id: "evidence", label: "Evidence", group: "Evidence" },
] as const;

const NAV = [
  { label: "The Thesis", href: "/#thesis" },
  { label: "Business Screen", href: "/#screen" },
  { label: "Field Notes", href: "/#cases" },
  { label: "Hedge Lab", href: "/#lab" },
  { label: "Market Design", href: "/#market-fit" },
  { label: "Evidence", href: "/#evidence" },
];
const GROUP_OF_HREF: Record<string, string> = Object.fromEntries(NAV.map((n) => [n.href.slice(2), n.label]));

function useActiveChapter(enabled: boolean) {
  const [active, setActive] = useState<string>("");
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const calc = () => {
      raf = 0;
      let cur = "";
      for (const c of CHAPTERS) {
        const el = document.getElementById(c.id);
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.4) cur = c.id;
      }
      setActive((p) => (p === cur ? p : cur));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(calc); };
    calc();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [enabled]);
  return active;
}

export function Header() {
  const path = usePathname();
  const home = path === "/";
  const owner = path.startsWith("/owner-lab");
  const active = useActiveChapter(home);
  const activeGroup = CHAPTERS.find((c) => c.id === active)?.group ?? "";
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4 });
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // Focus trap + Escape: active only while the mobile menu is open.
  useEffect(() => {
    if (!open) return;
    const root = menuRef.current!;
    const focusables = () => Array.from(root.querySelectorAll<HTMLElement>("a[href],button"));
    focusables()[0]?.focus();
    window.dispatchEvent(new CustomEvent("hny:scroll-lock", { detail: true }));
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); btnRef.current?.focus(); return; }
      if (e.key !== "Tab") return;
      const f = focusables();
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      window.dispatchEvent(new CustomEvent("hny:scroll-lock", { detail: false }));
    };
  }, [open]);

  return (
    <>
      <a href="#main" className="fixed left-4 top-4 z-[120] -translate-y-24 bg-mint px-4 py-2 font-mono text-xs uppercase tracking-widest text-ink focus:translate-y-0">Skip to content</a>
      <header className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${scrolled || open ? "border-b border-line bg-ink/80 backdrop-blur-xl" : "border-b border-transparent bg-transparent"}`}>
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="font-mono text-[0.8rem] font-medium tracking-[0.3em] text-chalk" aria-label="HEDGE / NYC home">
            HEDGE<span className="text-copper"> / </span>NYC
          </Link>
          {owner && <Link href="/" className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-steel hover:text-chalk">Research site</Link>}
          {!owner && <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {NAV.map((n) => {
                const on = home && activeGroup === GROUP_OF_HREF[n.href.slice(2)];
                return (
                  <li key={n.href}>
                    <Link href={n.href} aria-current={on ? "location" : undefined} className={`relative px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.16em] transition-colors hover:text-chalk ${on ? "text-mint" : "text-steel"}`}>
                      {n.label}
                      {on && <motion.span layoutId="navline" className="absolute inset-x-3 -bottom-px h-px bg-mint" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>}
          {!owner && <button ref={btnRef} type="button" className="p-2 text-chalk lg:hidden" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((v) => !v)}>
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>}
        </div>
        <div className="border-t border-line/60 bg-ink/60 text-center">
          <p className="mx-auto max-w-[1320px] px-5 py-1 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-steel sm:px-8 sm:text-left sm:text-[0.62rem] sm:tracking-[0.14em]">
            Independent research, not affiliated with Kalshi
          </p>
        </div>
        <motion.div aria-hidden style={{ scaleX: progress }} className="absolute inset-x-0 bottom-0 h-px origin-left bg-mint" />
      </header>
      {open && !owner && (
        <div ref={menuRef} id="mobile-menu" role="dialog" aria-modal="true" aria-label="Site menu" className="fixed inset-0 z-40 bg-ink px-6 pt-32 lg:hidden" data-lenis-prevent>
          <ul className="space-y-1">
            {NAV.map((n, i) => (
              <li key={n.href}>
                <Link href={n.href} onClick={(e) => { if (!home) { setOpen(false); return; } e.preventDefault(); setOpen(false); const id = n.href.slice(2); setTimeout(() => { history.pushState(null, "", `#${id}`); document.getElementById(id)?.scrollIntoView(); }, 60); }} className="font-display flex items-baseline gap-4 border-b border-line py-4 text-4xl text-chalk">
                  <span className="font-mono text-xs text-copper">0{i + 1}</span>{n.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {home && (
        <nav aria-label="Chapters" className="fixed right-5 top-1/2 z-30 hidden -translate-y-1/2 xl:block">
          <ul className="flex flex-col items-end gap-3">
            {CHAPTERS.map((c) => {
              const on = active === c.id;
              return (
                <li key={c.id}>
                  <a href={`#${c.id}`} aria-label={c.label} aria-current={on ? "location" : undefined} className="group flex items-center gap-3">
                    <span className={`font-mono text-[0.6rem] uppercase tracking-[0.16em] transition-opacity ${"text-mint opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}>{c.label}</span>
                    <span className={`block h-px transition-all ${on ? "w-7 bg-mint" : "w-3 bg-steel/60 group-hover:w-5"}`} />
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}
