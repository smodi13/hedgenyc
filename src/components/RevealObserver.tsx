"use client";
import { useEffect } from "react";

/** Adds `.in` to [data-reveal] elements as they enter the viewport. No-JS and reduced-motion show everything. */
export function RevealObserver() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "1"; // test hook: client handlers are attached
    const els = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  return null;
}
