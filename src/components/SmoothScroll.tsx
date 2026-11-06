"use client";
import { useEffect } from "react";
import Lenis from "lenis";

/** Lenis on fine-pointer desktops only; never under reduced motion; never scroll-jacking (no pinning, native wheel feel). */
export function SmoothScroll() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (reduce || !fine) return;
    const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.95, anchors: { offset: -96 } });
    let raf = 0;
    const loop = (t: number) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    const onLock = (e: Event) => ((e as CustomEvent<boolean>).detail ? lenis.stop() : lenis.start());
    window.addEventListener("hny:scroll-lock", onLock);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("hny:scroll-lock", onLock); lenis.destroy(); };
  }, []);
  return null;
}
