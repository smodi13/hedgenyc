"use client";
import { useEffect, useRef } from "react";
import { motion, type MotionValue } from "motion/react";
import * as G from "./geometry";

export interface SceneLayers { grid: MotionValue<number>; far: MotionValue<number>; near: MotionValue<number>; nodes: MotionValue<number>; gx: MotionValue<number>; fx: MotionValue<number>; nx: MotionValue<number>; px: MotionValue<number>; pressure: MotionValue<number>; pressureOp: MotionValue<number>; netOp: MotionValue<number> }

const Pulse = ({ path, dur, begin, color }: { path: string; dur: number; begin: number; color: string }) => (
  <circle r="3.2" fill={color}>
    <animateMotion dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" path={path} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.45 0 0.55 1" />
    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.85;1" dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" />
  </circle>
);

export function CitySvg({ L, animated }: { L: SceneLayers; animated: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  // Pause SMIL pulses when the hero is off screen.
  useEffect(() => {
    const svg = ref.current;
    if (!svg || !animated || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => (e?.isIntersecting ? svg.unpauseAnimations() : svg.pauseAnimations()), { threshold: 0 });
    io.observe(svg);
    return () => io.disconnect();
  }, [animated]);

  const N = G.NODES;
  const label = (x: number, y: number, t: string, anchor: "start" | "end" = "start") => (
    <text x={x} y={y} textAnchor={anchor} fill="#f7f6f0" fillOpacity="0.78" fontSize="13" letterSpacing="3" fontFamily="var(--font-plex-mono), monospace">{t}</text>
  );

  return (
    <svg ref={ref} viewBox="0 0 1600 900" preserveAspectRatio="xMaxYMax slice" className="absolute inset-0 h-full w-full" role="img" aria-label="Abstract line illustration of the New York skyline, Brooklyn Bridge and harbor, with weather, fuel and event risk signals converging on one small waterfront business.">
      <defs>
        <linearGradient id="bldg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#16253a" stopOpacity="0.95" /><stop offset="1" stopColor="#091019" stopOpacity="1" /></linearGradient>
        <radialGradient id="fade" cx="0.72" cy="0.45" r="0.75"><stop offset="0" stopColor="#fff" stopOpacity="1" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <mask id="gridmask"><rect width="1600" height="900" fill="url(#fade)" /></mask>
        <linearGradient id="waterfade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#84e5d0" stopOpacity="0.28" /><stop offset="1" stopColor="#84e5d0" stopOpacity="0" /></linearGradient>
        <filter id="soft"><feGaussianBlur stdDeviation="2.2" /></filter>
      </defs>

      {/* L0 – blueprint street grid */}
      <motion.g style={{ y: L.grid, x: L.gx }} mask="url(#gridmask)">
        <g stroke="#f7f6f0" strokeOpacity="0.07" strokeWidth="1" fill="none" vectorEffect="non-scaling-stroke">
          {G.avenues.map((d, i) => <path key={`a${i}`} d={d} pathLength={1} className="draw" style={{ ["--d" as string]: `${200 + i * 40}ms` }} />)}
          {G.streets.map((d, i) => <path className="g-streets draw" key={`s${i}`} d={d} pathLength={1} style={{ ["--d" as string]: `${500 + i * 25}ms` }} />)}
        </g>
        <path d={G.broadway} fill="none" stroke="#84e5d0" strokeOpacity="0.16" strokeWidth="1" pathLength={1} className="draw" style={{ ["--d" as string]: "900ms" }} />
      </motion.g>

      {/* L1 – harbor + Brooklyn waterfront + bridge */}
      <motion.g style={{ y: L.far, x: L.fx }}>
        <g fill="none" stroke="url(#waterfade)" strokeWidth="1">
          {G.water.map((d, i) => <path key={i} d={d} pathLength={1} className="draw" style={{ ["--d" as string]: `${1400 + i * 120}ms` }} />)}
        </g>
        <path d={G.brooklynFill} fill="url(#bldg)" opacity="0.9" />
        <path d={G.brooklynPath} fill="none" stroke="#f7f6f0" strokeOpacity="0.38" strokeWidth="1.1" pathLength={1} className="draw" style={{ ["--d" as string]: "1100ms" }} />
        <g fill="none" stroke="#f7f6f0" strokeOpacity="0.45" strokeWidth="1.1">
          {[G.bridge.deck, ...G.bridge.towers, ...G.bridge.cables].map((d, i) => <path key={i} d={d} pathLength={1} className="draw" style={{ ["--d" as string]: `${1500 + i * 150}ms` }} />)}
          <g strokeOpacity="0.22">{G.bridge.hangers.map((d, i) => <path key={i} d={d} />)}</g>
        </g>
      </motion.g>

      {/* L2 – Manhattan skyline */}
      <motion.g style={{ y: L.near, x: L.nx }}>
        <path d={G.manhattanFill} fill="url(#bldg)" />
        <g fill="none" stroke="#f7f6f0" strokeOpacity="0.62" strokeWidth="1.2" strokeLinejoin="round">
          <path d={G.manhattanPath} pathLength={1} className="draw" style={{ ["--d" as string]: "700ms" }} />
          {[G.wtcPath, G.esbPath, G.chryslerPath, ...G.spires].map((d, i) => <path key={i} d={d} pathLength={1} className="draw" style={{ ["--d" as string]: `${900 + i * 160}ms` }} />)}
        </g>
        <g fill="#84e5d0" fillOpacity="0.55">{G.windows.map((w, i) => <rect key={i} x={w.x} y={w.y} width="2" height="3" />)}</g>
      </motion.g>

      {/* L3 – risk network */}
      <motion.g style={{ y: L.nodes, x: L.px, opacity: L.netOp }}>
        <g fill="none" strokeWidth="1.2">
          <path d={G.routes.weather} stroke="#f2ad78" strokeOpacity="0.55" pathLength={1} className="draw" style={{ ["--d" as string]: "1900ms" }} />
          <path d={G.routes.events} stroke="#f2ad78" strokeOpacity="0.4" strokeDasharray="2 6" />
          <path d={G.routes.fuel} stroke="#f2ad78" strokeOpacity="0.55" pathLength={1} className="draw" style={{ ["--d" as string]: "2100ms" }} />
        </g>
        {animated && (
          <g>
            <Pulse path={G.routes.weather} dur={7} begin={2.6} color="#f2ad78" />
            <Pulse path={G.routes.fuel} dur={8.5} begin={3.4} color="#f2ad78" />
            <Pulse path={G.routes.events} dur={9.5} begin={4.2} color="#84e5d0" />
          </g>
        )}
        {([["weather", "WEATHER", "end"], ["events", "EVENTS", "start"], ["fuel", "FUEL", "start"]] as const).map(([k, t, a], i) => {
          const n = N[k];
          return (
            <g key={k}>
              <circle cx={n.x} cy={n.y} r="5" fill="#091019" stroke="#f2ad78" strokeWidth="1.5" />
              <circle cx={n.x} cy={n.y} r="5" fill="none" stroke="#f2ad78" strokeWidth="1" className="node-ring" style={animated ? { ["--d" as string]: `${i * 1.2}s` } : { display: "none" }} />
              {label(n.x + (a === "end" ? -16 : 16), n.y + 4, t, a)}
            </g>
          );
        })}
        {/* the single small business at the pier */}
        <g>
          <circle cx={N.business.x} cy={N.business.y} r="16" fill="none" stroke="#84e5d0" strokeOpacity="0.5" strokeWidth="1" />
          <circle cx={N.business.x} cy={N.business.y} r="5.5" fill="#84e5d0" />
          {label(N.business.x + 26, N.business.y + 4, "ONE P&L")}
        </g>
      </motion.g>

      {/* risk-pressure wave: sweeps the city on scroll */}
      <motion.circle cx={N.business.x} cy={N.business.y} r="260" fill="none" stroke="#f2ad78" strokeWidth="1.2" className="pressure" style={{ scale: L.pressure, opacity: L.pressureOp }} />
      <motion.circle cx={N.business.x} cy={N.business.y} r="260" fill="none" stroke="#84e5d0" strokeWidth="0.8" style={{ scale: L.pressure, opacity: L.pressureOp }} className="pressure g-soft" />
    </svg>
  );
}
