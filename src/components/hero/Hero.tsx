"use client";
import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { ArrowDown } from "lucide-react";
import { CitySvg, type SceneLayers } from "./CitySvg";
import { MarketStatusLabel } from "../MarketStatusLabel";

interface Props { counts: { total: number; primary: number; discovery: number; contacted: number } }

function Magnetic({ children, href, primary }: { children: React.ReactNode; href: string; primary?: boolean }) {
  const reduce = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 18 });
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 18 });
  return (
    <motion.a
      href={href}
      style={{ x, y }}
      onPointerMove={(e) => {
        if (reduce || e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        x.set(Math.max(-3, Math.min(3, ((e.clientX - r.left) / r.width - 0.5) * 8)));
        y.set(Math.max(-3, Math.min(3, ((e.clientY - r.top) / r.height - 0.5) * 8)));
      }}
      onPointerLeave={() => { x.set(0); y.set(0); }}
      className={`inline-flex items-center justify-center px-6 py-3.5 font-mono text-[0.72rem] uppercase tracking-[0.2em] transition-colors ${primary ? "bg-mint text-ink hover:bg-chalk" : "border border-chalk/40 text-chalk hover:border-mint hover:text-mint"}`}
    >
      {children}
    </motion.a>
  );
}

export function Hero({ counts }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const reduce = !!useReducedMotion();
  const { scrollYProgress: p } = useScroll({ target: wrap, offset: ["start start", "end end"] });

  // pointer parallax, hard-capped at 8px
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 20 });
  const sy = useSpring(my, { stiffness: 60, damping: 20 });

  const off = reduce;
  const gScroll = useTransform(p, [0, 1], [0, off ? 0 : -30]);
  const fScroll = useTransform(p, [0, 1], [0, off ? 0 : -60]);
  const nScroll = useTransform(p, [0, 1], [0, off ? 0 : -110]);
  const ndScroll = useTransform(p, [0, 1], [0, off ? 0 : -150]);
  const layers: SceneLayers = {
    grid: useTransform([gScroll, sy], ([a, b]: number[]) => (a ?? 0) + (b ?? 0) * 0.25),
    far: useTransform([fScroll, sy], ([a, b]: number[]) => (a ?? 0) + (b ?? 0) * 0.5),
    near: useTransform([nScroll, sy], ([a, b]: number[]) => (a ?? 0) + (b ?? 0) * 0.75),
    nodes: useTransform([ndScroll, sy], ([a, b]: number[]) => (a ?? 0) + (b ?? 0)),
    gx: useTransform(sx, (v) => v * 0.25),
    fx: useTransform(sx, (v) => v * 0.5),
    nx: useTransform(sx, (v) => v * 0.75),
    px: useTransform(sx, (v) => v),
    pressure: useTransform(p, [0.05, 0.9], [0.25, off ? 0.25 : 3.2]),
    pressureOp: useTransform(p, [0.05, 0.25, 0.75, 0.95], [0, off ? 0 : 0.5, off ? 0 : 0.25, 0]),
    netOp: useTransform(p, [0.5, 0.95], [1, off ? 1 : 0.55]),
  };
  const textY = useTransform(p, [0, 0.5], [0, off ? 0 : -60]);
  const textOp = useTransform(p, [0.3, 0.62], [1, off ? 1 : 0.0]);
  const lensOp = useTransform(p, [0.55, 0.85], [off ? 1 : 0, 1]);
  const lensY = useTransform(p, [0.55, 0.85], [off ? 0 : 24, 0]);
  const cueOp = useTransform(p, [0, 0.12], [1, 0]);

  return (
    <div ref={wrap} className="relative h-[150svh] md:h-[185svh] motion-reduce:h-auto" id="top">
      <div
        className="sticky top-0 flex min-h-[100svh] flex-col overflow-hidden motion-reduce:static"
        onPointerMove={(e) => {
          if (reduce || e.pointerType !== "mouse") return;
          mx.set((e.clientX / window.innerWidth - 0.5) * 16); // ±8px
          my.set((e.clientY / window.innerHeight - 0.5) * 16);
        }}
      >
        <div className="curtain" aria-hidden />
        <div className="absolute inset-0 gridlines opacity-60" aria-hidden />
        <div className="absolute inset-0 opacity-55 sm:opacity-100"><CitySvg L={layers} animated={!reduce} /></div>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#091019_8%,rgba(9,16,25,0.88)_38%,rgba(9,16,25,0.2)_68%,transparent)] sm:bg-[linear-gradient(90deg,#091019_6%,rgba(9,16,25,0.86)_34%,rgba(9,16,25,0.15)_62%,transparent)]" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" aria-hidden />

        <motion.div style={{ y: textY, opacity: textOp }} className="relative z-10 mx-auto flex w-full max-w-[1320px] flex-1 flex-col justify-center px-5 pb-12 pt-32 sm:px-8 md:pt-32">
          <p className="fade-up font-mono text-[0.68rem] uppercase tracking-[0.22em] text-mint sm:text-[0.72rem]" style={{ ["--d" as string]: "700ms" }}>
            Independent research <span className="mx-2 text-copper">/</span> NYC <span className="mx-1 text-copper">/</span> Nov 2026
          </p>
          <h1 className="font-display mt-5 max-w-[15ch] text-[clamp(2.4rem,5.3vw,5rem)] font-light leading-[0.98] tracking-[-0.025em] text-chalk sm:max-w-[16ch]">
            <span className="mask-line"><span style={{ ["--d" as string]: "850ms" }}>Every business</span></span>{" "}
            <span className="mask-line"><span style={{ ["--d" as string]: "960ms" }}>is exposed.</span></span>{" "}
            <span className="mask-line mt-1 italic text-copper"><span style={{ ["--d" as string]: "1150ms" }}>Not every risk</span></span>{" "}
            <span className="mask-line italic text-copper"><span style={{ ["--d" as string]: "1260ms" }}>is hedgeable.</span></span>
          </h1>
          <p className="fade-up mt-6 max-w-xl text-base leading-relaxed text-chalk/80 sm:text-lg" style={{ ["--d" as string]: "1500ms" }}>
            An evidence-led map of New York businesses, the events that move their margins, and the hard questions between a market price and a useful hedge.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <div className="fade-up" style={{ ["--d" as string]: "1650ms" }}><Magnetic href="#screen" primary>Explore the business screen</Magnetic></div>
            <div className="fade-up" style={{ ["--d" as string]: "1760ms" }}><Magnetic href="#lab">Stress-test a hedge</Magnetic></div>
          </div>
          <div className="fade-up mt-7 max-w-xl" style={{ ["--d" as string]: "1900ms" }}><MarketStatusLabel /></div>
          <dl className="fade-up mt-6 grid max-w-xl grid-cols-4 gap-x-4 border-t border-line pt-4" style={{ ["--d" as string]: "2000ms" }}>
            {[
              [counts.total, "businesses screened"],
              [counts.primary, "company-site records"],
              [counts.discovery, "discovery-only candidates"],
              [counts.contacted, "contacted"],
            ].map(([n, l]) => (
              <div key={l as string}>
                <dd className="font-display tnum text-2xl text-chalk sm:text-3xl">{n}</dd>
                <dt className="mt-1 font-mono text-[0.6rem] uppercase leading-snug tracking-[0.12em] text-steel">{l}</dt>
              </div>
            ))}
          </dl>
        </motion.div>

        {/* lenses: the network resolves into three analytical questions as you scroll */}
        <motion.div style={{ opacity: lensOp, y: lensY }} className="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden md:block motion-reduce:static motion-reduce:pointer-events-auto">
          <div className="mx-auto grid max-w-[1320px] gap-px px-8 pb-20 md:grid-cols-3">
            {[
              ["01", "EXPOSURE", "What genuinely changes contribution margin?"],
              ["02", "TRIGGER", "What does the contract actually settle on?"],
              ["03", "EXECUTION", "What does protection cost, and can the business obtain it?"],
            ].map(([n, t, q]) => (
              <div key={t} className="border-t border-mint/60 bg-ink/70 p-5 backdrop-blur-sm">
                <p className="font-mono text-[0.68rem] tracking-[0.22em] text-mint">{n} · {t}</p>
                <p className="font-display mt-3 text-2xl leading-snug text-chalk">{q}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.a href="#thesis" style={{ opacity: cueOp }} className="absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.3em] text-steel sm:flex motion-reduce:hidden" aria-label="Scroll to the thesis">
          Scroll <ArrowDown className="scroll-cue size-4 text-mint" aria-hidden />
        </motion.a>
      </div>
    </div>
  );
}
