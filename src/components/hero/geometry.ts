/** Procedural, deterministic NYC skyline + street grid geometry (no photos, no assets). viewBox 1600×900. */
const BASE = 720;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

type Seg = { x: number; w: number; h: number };

/** Left-to-right silhouette path through the given blocks, on the shared baseline. */
function silhouette(blocks: Seg[], x0: number, x1: number): string {
  let d = `M${x0},${BASE}`;
  for (const b of blocks) d += ` L${b.x},${BASE - 0} L${b.x},${BASE - b.h} L${b.x + b.w},${BASE - b.h} L${b.x + b.w},${BASE}`;
  return d + ` L${x1},${BASE}`;
}

function city(seed: number, from: number, to: number, hMin: number, hMax: number, wMin: number, wMax: number, skip: [number, number][]) {
  const r = rng(seed);
  const out: Seg[] = [];
  let x = from;
  while (x < to) {
    const w = Math.round(wMin + r() * (wMax - wMin));
    const h = Math.round(hMin + r() * r() * (hMax - hMin) + (hMax - hMin) * 0.15 * r());
    const hit = skip.find(([a, b]) => x + w > a && x < b);
    if (hit) { x = hit[1]; continue; }
    out.push({ x, w, h });
    x += w + Math.round(r() * 4);
  }
  return out;
}

const WTC = { cx: 1010 }, ESB = { cx: 1295 }, CHR = { cx: 1392 };
const skip: [number, number][] = [[WTC.cx - 30, WTC.cx + 30], [ESB.cx - 60, ESB.cx + 60], [CHR.cx - 28, CHR.cx + 28]];

const manhattanBlocks = city(7, 935, 1600, 60, 290, 14, 34, skip);
const brooklynBlocks = city(21, 40, 600, 14, 70, 12, 30, []);

function landmark(cx: number, pts: [number, number][]) {
  // pts are [dx, height] for the left half, mirrored for the right half
  const left = pts.map(([dx, h]) => `L${cx - dx},${BASE - h}`).join(" ");
  const right = [...pts].reverse().map(([dx, h]) => `L${cx + dx},${BASE - h}`).join(" ");
  return `M${cx - pts[0]![0]},${BASE} ${left} ${right} L${cx + pts[0]![0]},${BASE}`;
}

export const wtcPath = landmark(WTC.cx, [[24, 0], [24, 300], [0, 395]]).replace(/L1010,325 /, "");
export const esbPath = landmark(ESB.cx, [[56, 0], [56, 175], [40, 175], [40, 255], [26, 255], [26, 318], [13, 318], [13, 345], [0, 345]]);
export const chryslerPath = landmark(CHR.cx, [[22, 0], [22, 270], [18, 292], [13, 312], [8, 332], [3, 350]]);
export const spires = [
  `M${WTC.cx},${BASE - 395} L${WTC.cx},${BASE - 470}`,
  `M${ESB.cx},${BASE - 345} L${ESB.cx},${BASE - 410}`,
  `M${CHR.cx},${BASE - 350} L${CHR.cx},${BASE - 395}`,
];

export const manhattanPath = silhouette(manhattanBlocks, 935, 1600);
export const brooklynPath = silhouette(brooklynBlocks, 40, 600);
export const manhattanFill = manhattanPath + ` L1600,${BASE} L935,${BASE} Z`;
export const brooklynFill = brooklynPath + ` L600,${BASE} L40,${BASE} Z`;

export const bridge = {
  deck: `M600,704 L935,704`,
  towers: [`M700,704 L700,598`, `M836,704 L836,598`],
  cables: [`M600,704 Q664,606 700,598`, `M700,598 Q768,690 836,598`, `M836,598 Q880,606 935,704`],
  hangers: Array.from({ length: 11 }, (_, i) => { const x = 706 + i * 12; return `M${x},${704} L${x},${676 + Math.abs(i - 5) * 3}`; }),
};

/** Sparse lit windows (deterministic) */
export const windows = (() => {
  const r = rng(99);
  return manhattanBlocks.filter((b) => b.h > 110 && r() > 0.45).flatMap((b) =>
    Array.from({ length: 2 + Math.floor(r() * 3) }, () => ({ x: b.x + 4 + Math.floor(r() * (b.w - 9)), y: BASE - b.h + 8 + Math.floor(r() * (b.h - 24)) })),
  );
})();

/** Street grid: avenues at 29° (Manhattan grid) and cross streets, clipped by a radial mask in the scene */
export const avenues = Array.from({ length: 26 }, (_, i) => {
  const o = -400 + i * 74;
  return `M${o},-100 L${o + 760},1000`;
});
export const streets = Array.from({ length: 34 }, (_, i) => {
  const y = -60 + i * 34;
  return `M-100,${y} L1700,${y + 280}`;
});
export const broadway = "M1000,-60 C1060,160 1180,340 1300,560 S1500,900 1560,960";

export const water = Array.from({ length: 9 }, (_, i) => {
  const y = 742 + i * 17 + i * i * 0.6;
  return `M${40 + i * 18},${y} C${300 + i * 24},${y - 4} ${620},${y + 3} ${960},${y - 2} S${1380},${y + 3} ${1600},${y - 1}`;
});

export const NODES = {
  weather: { x: 1432, y: 190 },
  events: { x: 1198, y: 128 },
  fuel: { x: 1030, y: 292 },
  business: { x: 1128, y: 758 },
} as const;

const c = (a: { x: number; y: number }, b: { x: number; y: number }, bend: number) =>
  `M${a.x},${a.y} C${a.x - bend},${a.y + 260} ${b.x + bend * 0.5},${b.y - 300} ${b.x},${b.y}`;

export const routes = {
  weather: c(NODES.weather, NODES.business, 120),
  events: c(NODES.events, NODES.business, -60),
  fuel: c(NODES.fuel, NODES.business, 110),
};
