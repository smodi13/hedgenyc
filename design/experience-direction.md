# HedgeNYC | Art direction and motion system

The two inspiration properties provided by the project owner:
- https://institutional-alternatives-lab.vercel.app/
- https://copper-constraint-atlas.vercel.app/

Borrow the **level of editorial rigor and spatial hierarchy**, not their exact code, layout or branding. HedgeNYC should feel like a premium NYC financial infrastructure research terminal with purposeful animation, not a generic crypto landing page or finance SaaS template.

## Visual concept: risk becomes visible

Overall style: midnight ink (#091019), graphite navy (#101B28), restrained luminous mint (#84E5D0), warm copper risk orange (#F2AD78), chalk white (#F7F6F0), cool steel (#8995A4); use high-contrast type. Type: editorial display serif or subtly contrasted grotesque for hero; modern geometric sans body; tabular monospaced source IDs, time stamps and quotes. Use accessible licensed web fonts only. A pixel-thin geographic grid and controlled grain serve as cues, not large gradients. Plenty of negative space and confident 64-100px type on desktop.

## Hero: 'City at risk'

- Height >= 100vh desktop. Full viewport animated city skyline abstracted into a beautifully crafted layered SVG/canvas illustration: Manhattan/Brooklyn waterfront silhouettes, six-axis urban grid and light threads. Prefer hand-coded vector, never unauthorized photos or a giant video download.
- On load, draw delicate city parcel/route lines with staggered opacity, then reveal giant masked H1 lines with line-mask y-translation and letter-spacing transitions. Tiny annotations float along three orbiting 'weather / fuel / events' indicator nodes with SVG connecting curves and gentle pointer parallax. Two or three traffic pulses travel down routes, slow and elegant. Avoid excessive perpetual motion.
- A low-key 'risk pressure' wave sweeps the city on scroll and resolves into the three analytical lenses: EXPOSURE / TRIGGER / EXECUTION. Hero graphic responds to pointer within max 8px parallax and scroll transform (<20% viewport travel) but never causes layout shift.
- Desktop editorial left and artwork right, or overlaid H1 with controlled contrast. Mobile: art simplified to 2D underlay, less text, all readable above fold.
- A static hero remains attractive without JS, motion, or API connectivity. `prefers-reduced-motion` means no parallax or continuous loops, no forced smooth scrolling.

## Scrollytelling

1. **Opening curtain:** self-contained animated mask pulls up (not blocking initial content); top navigation becomes translucent on scroll.
2. **The thesis:** sticky left story line, animated 3-step graph on right showing operational loss, imperfect settlement, execution price. On reduced motion show all three static.
3. **NYC origination:** clean dense data screen, elegant active filter transitions, map-like borough heat (do not invent coordinates), inline evidence drawer with fixed-position source citations. Scores must come from dataset and update deterministically.
4. **Field notes:** three immersive editorial case cards with large numeric annotations, swipe/keyboard accessible horizontal tab transitions, fade mask between risk and countervailing factors, linked sources.
5. **Hedge Lab:** scenario tree with 4 contract/business states; edges light up with user-controlled probabilities; paired exposure waterfalls and downside distributions animate with requestAnimationFrame-friendly spring transitions; all numbers share one pure financial logic module.
6. **Market Fit:** animated three-step public-orderbook evaluation ladder and 'basis mismatch' narrative; real unavailable market data shows an elegant explicit offline fallback rather than fake streaming widgets.
7. **New Markets:** three large research tiles that expand into trigger specification, source, mismatch and blockers, without pretending contracts exist.
8. **Methodology & Sources:** source atlas, export controls, freshness timestamps and methodology. Footer asserts independence.

## Motion implementation specification

Use Next.js App Router, TypeScript, Tailwind CSS, `motion` / Framer Motion, and `lenis` smooth scrolling (desktop only where appropriate). Consider GSAP ScrollTrigger only for 1-2 meaningful pinned sequences, avoid simultaneous scroll controllers and smooth-scroll loops without proper synchronization. CSS transform/opacity animations only for complex elements, avoid animating expensive layout properties. `IntersectionObserver` reveals for non-critical cards. Avoid large WebGL/3D payload; conditional dynamic import for any optional background effect. Fully cleanup listeners and animation instances after route changes. Scroll anchor offsets account for sticky header. Respect reduced-motion preference and keyboard users. Add `skip to content` link and visible focus states.

Quality targets: Lighthouse mobile performance >=85 and accessibility >=95 under sane deployment conditions, no CLS during reveal and initial render, no accidental horizontal overflow at 375px, great 1440px desktop and 768px tablet, stable server/client hydration, no uncaught network errors. `font-display: swap`, image sizing, pause offscreen loops, 60fps only where supported, no autoplay sound, no scroll-jacking.

Microinteractions: command palette for search optional; data chips hover glow, pointer-follow fine stroke not big blur, magnetic CTA movement <=3px, clickable source footnote with preview, subtle tick transitions, outcome badges with accessible status text, smooth chart interpolation. Never use floating fake live tickers or fake counter metrics.

## Suggested signature visual sections

- Animated network routes converge on a single small neighborhood business, visual metaphor for many risks hitting one P&L.
- Split 'what happened' versus 'what settles' hover/scroll component, highlighting basis mismatch.
- Four-state tree in hedge simulator, not a one-line 'hedge makes $X' marketing chart.
- Prospect confidence visualization with distinct primary-source and discovery halves.
- Negative-control story: 'When not to hedge' in dramatic but understated orange, which differentiates the work from a sales brochure.

Accessibility: use semantic headings, real interactive button elements, `aria-live` for input-driven numerical summaries throttled appropriately, accessible color contrast, keyboard-reachable chart data table, tooltip content not exclusive source of key data, no motion essential to comprehension.
