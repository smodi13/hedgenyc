# CLAUDE CODE MASTER ENGINEERING PROMPT | HedgeNYC

You are Claude Code functioning ONLY as the chief software engineer, visual interactive designer, API integrator, QA engineer, and deployment engineer for HedgeNYC. You are not the analyst. ChatGPT has already conducted research, selected businesses, made risk recommendations, researched contracts, specified assumptions and authored editorial copy. The existing files in this working directory are the source of truth. Your job is to turn them into a production-grade website without introducing unsupported claims or changing investment/hedging judgments.

## FIRST: inspect project and read the entire supplied handoff

Before writing production code, read:

1. `README.md`
2. `research/prospects.json` AND `research/prospects.csv` (cross-check company count and evidence tiers)
3. `research/markets.json`
4. `research/case-studies.md`
5. `research/new-market-specs.md`
6. `research/gtm-plan.md`
7. `research/sources.csv`
8. `content/site-copy.md`
9. `design/experience-direction.md`
10. `engineering/acceptance-tests.md`
11. `model/HedgeNYC_Formula_Driven_Hedging_Model.xlsx` (preserve as downloadable asset, do not replace model content with typed constants)

Inspect the existing directory and git status, then implement incrementally. Do NOT silently overwrite research deliverables. The bundle is the complete editorial and mathematical specification, not a request that you conduct fresh research. If something is unknown or ambiguous, make the website disclose that limitation and log it in `engineering/implementation-open-items.md` instead of inventing facts, changing recommendations, or guessing quotes.

## YOUR MISSION

Build and, if permitted by existing credentials, deploy a spectacular, smooth, dynamic, interactive NYC business risk and hedging research application that looks as polished and deliberate as https://institutional-alternatives-lab.vercel.app/ and https://copper-constraint-atlas.vercel.app/ in editorial sophistication. Study those two visual references for style cues only. Do not clone their implementation. This must feel like a distinctive, art-directed, premium financial markets research work sample, not an ordinary dashboard, template page, or crypto hype site.

High-level user preference: substantial and smooth scroll-linked motion, dynamic hero animation, premium typography, intelligent hover transitions, fluid chart interactivity, strong hierarchy, purposeful branded visual metaphors, beautiful both desktop and mobile. But performance, accessibility, and rigorous data labeling override animation theatrics.

## NON-NEGOTIABLE SCOPE & ANALYTICAL SAFETY

- Brand/site label: **HEDGE / NYC** or **HedgeNYC**. Add visible `Independent research, not affiliated with Kalshi` below header and in footer.
- This is NOT Kalshi official company software. Do not use protected Kalshi trademarks as site logo, impersonate Kalshi staff, or display unapproved affiliate claims. It's fine to include sourced Kalshi links and a text link to its official public hedging site.
- Every factual business claim must derive from provided research source. Company-site verification does NOT verify any income, owner willingness, actual hedge, outreach, customer status, or financial result. All records should default to `NOT CONTACTED`. Do not assert a business is definitely not a Kalshi user just because it isn't featured on its site.
- Do not display all discovered business records as primary-source verified. Derive count and ratios from the JSON at runtime/build time. The script currently distinguishes company first-party evidence and unverified directory discoveries.
- Do not label the static documented November 2026 contract examples as live quotes, executable orders or live available contracts. Live market data, only when independently fetched and valid, must show source and update timestamp. No mock streaming market ticker. When official API fails, show a precise fallback `Market feed unavailable` and preserve the illustrative simulator.
- No live brokerage trading/order placement, no credentials for trading accounts, no automated outreach, no mass email, no mock testimonials, fake pilot customers, fake site traffic, fake interviews or fabricated Kalshi collaborations.
- Never calculate an outcome from gross booking receipts when the economic exposure is lost *contribution margin*. Explicitly show the conversion to contribution margin with source/assumption labels.
- There must be 4 disjoint joint states of operations and contract payoff. The key distinctive case is **business loses money but the financial contract does not pay**. Always show it.
- The static scenario probabilities are analyst hypothetical inputs, NOT the probability inferred from Kalshi contract prices and NOT predictions. All calculation defaults editable and resettable.
- Use current matching Kalshi fee rules if available, but model general taker fee `ROUNDUP(0.07 * contracts * price * (1-price), 2)` only for the expressly labeled illustrative base. Some fee schedules differ by category and order type, user must verify before any transaction.
- All formula-derived Excel values stay formulas. Keep unchanged downloadable original XLSX supplied by analyst. You may build a matching typed pure TS calculation module for live simulator, with parity tests to the workbook illustrative inputs.
- Explicitly mention basis risk, settlement rule differences, relevant business location/time, incomplete liquidity, and total loss of premiums possible.

## STACK AND ARCHITECTURE

- Preferred: modern Next.js App Router, TypeScript strict mode, Tailwind CSS, Motion (or Framer Motion), Lenis for well-tuned smooth desktop scroll, Lucide React, Recharts/Visx for diagrams, Vitest with pure calculation tests and Playwright for desktop/mobile/a11y navigation.
- Use only packages actually compatible with installed Next.js version; pin lockfile. If package availability is blocked, select robust equivalents and explain.
- Prefer server components for text/research and lightweight client components for interactive sections. Avoid turning the whole app into a giant hydrated client island.
- Architecture: `src/lib/research/` validated dataset loader and Zod schemas; `src/lib/finance/hedge.ts` pure deterministic model; `src/lib/kalshi/` server-side typed API; `src/components/hero/`, `/chapters/`, `/simulator/`, `/evidence/`, `src/app/` and `/api/market-snapshot/` (if needed).
- Use `fetch` to official `https://external-api.kalshi.com/trade-api/v2/markets`, ideally series lookup query and documented market endpoints; route server-side only, with a 60-second or appropriate cache, 2-4s deadline, non-exception fallback, timestamp. For spread/order-book analysis call documented `GET /markets/{ticker}/orderbook`, handle integer/fixed-point versions, empty books, 404 and closed markets. **Check current Kalshi developer documentation instead of assuming field names**; engineering docs consultation is allowed but DO NOT change research judgments. No keys necessary for public endpoints. Do not fetch any private user data or store personal credentials.
- Raw research files should be included in repository with accessible download copies in `public/downloads/`. Avoid exposing extra personal information. A static schema-validated JSON import is fine. No secret keys.
- Render SSR stable content, progressively enhance motion. If API is blocked by CORS/rate limits or service limits, the site remains fully functional and explicitly marks market feed unavailable.
- Deploy on Vercel if connected and permitted. If not connected, fully build and test locally and give exact commands to link/deploy; never claim a deployment that didn't succeed.

## REQUIRED VISUAL LANGUAGE

Read `design/experience-direction.md` fully. Distinctive art direction: midnight ink with mint signal and muted copper danger, chalk typography, editorial display type; very thin gridlines, city-mapped geometry, photo-free vector / procedural NYC skyline and moving risk nodes. Do not merely apply dark background to simple cards. Typography should be oversized yet legible, with deliberate asymmetry and generous spacing. The city hero must be visually memorable and show multiple risk signals propagating through a city grid, not a generic stock chart. Add subtle film grain via a tiny CSS/SVG procedural effect if lightweight. Ensure low-contrast decorative grid never reduces text contrast.

### Hero behavior details

Create a viewport-scale scene with layered custom SVG NYC skyline or stylized overhead city grid. On first entry: animated micro-label, skyline line-draw, tiny signals orbit along curved routes, masked 2-line headline reveal, paragraph fade, CTA stagger, scroll cue. Animate pointer-driven depth <8px max. Use scroll progress to transform interconnected nodes into the 3 lenses of `exposure / trigger / execution`. Keep all content above the fold readable at 375px and 1440px. Respect reduced motion, battery / performance fallback, and initial SSR.

### Chapters + transitions

1. Hero / Thesis.
2. Risk lines: 3 exposures and 2-sided nature of storms. Elegant orbiting signal strips.
3. Origination: sourced list, filters (industry, evidence, priority, fit), search, live computed counters, a sorted leaderboard, responsive accessible detail drawer and source links. Confidence/evidence chips; no fabricated addresses or geolocation pins.
4. Cases: visually immersive selector/tabs for Brooklyn Sail, Xentra, Arborpolitan. Every case must show risk driver, observed business evidence, hypothetical economic model, matched or unmatched contract, basis mismatch, owner questions, disposition and link to source.
5. Interactive hedge lab: 4-state joint probability tree, sliders plus exact number fields for business loss, YES price, contracts, general taker multiplier and joint state probabilities. Show expected P&L, maximum loss, premium at risk, hedge payouts, and adverse-loss/no-payoff basis case. Show editable probabilities sum check; if invalid, block computed expected value and flag reason. Include reset-to-research defaults. Provide screen-reader table equivalent to charts.
6. Market fit: real Kalshi public API preview with status timestamp and documentation. Separate dated discovered contracts and refreshed live snapshots. If closed/missing, show `Historical reference`/`unavailable`, never `TRADE NOW`. No order form.
7. New market concepts: three specs with independent resolution, gap, proposed index, buyer hypothesis, market-viability blockers. Include `Not an actual Kalshi-listed contract` visibly.
8. GTM execution framework: listen-first qualification stages and public-source to owner-data evidence gap; clearly no outreach performed.
9. Evidence & downloads, source register, methodology and researcher disclaimers.

Smooth scrollytelling with sticky chapter progress bar, page progress indication, active nav changes, revealing source footnotes, tasteful chart and filter transitions. Avoid scroll hijacking; deep-links and browser history must work. Keep native page accessible and working with JS reduced.

## FINANCIAL LOGIC, TEST CASE

For YES side, quantity `N`, decimal price `p` between 0 and 1, general taker coefficient `m` (default 0.07):

- `premium = N*p`
- `fee = ceil(m*N*p*(1-p)*100)/100` using integer-cents-safe rounding
- `cashAtRisk = premium + fee`
- `netYes = N - cashAtRisk`, `netNo = -cashAtRisk`
- Given unhedged business adverse operating delta `-L`, the four net business outcomes are: `-L+netYes`, `-L+netNo`, `netYes`, `netNo` for (loss, YES); (loss, NO); (no loss, YES); (no loss, NO).
- Four hypothetical joint probabilities `p11`, `p10`, `p01`, `p00` must be >=0, <=1 and sum to 1 (tolerance 1e-8). `Expected hedged` = sum `jointProb_i * netOutcome_i`; `Expected unhedged` = `-L*(p11+p10)`; `Expected incremental` = difference.
- `basisMissProbability = p10` (loss when contract NO), `nonLossPayoutProbability = p01`, both illustrative and not measured.
- For Brooklyn Sail initial illustrative default N=250, p=0.43, m=0.07, L=330, p11=0.12, p10=0.08, p01=0.23, p00=0.57. Expected result may be negative. It must be allowed to be negative; do not coerce into a positive hedge benefit or claim a recommendation.
- Verify correct general fee by independent JS decimal/cent-safe test and consistent with analyst XLSX. Quotes from API must not silently override illustrative defaults or probabilities; provide opt-in “use observed ask” with timestamp only if actually sourced and filled quantity may differ.
- Xentra input: illustrative N=350, p=0.38, m=0.07, gallons=1200, fuel shock=$0.40, pass-through=0, business impact=$480. Scenario probabilities as per workbook.
- Arborpolitan: initial $1,000 scheduled margin lost and $1,400 emergency margin gained => no net adverse event loss in default. Set N=0, make this an analyst pass, no recommended trade. Support user change to $500 emergency margin, yielding $500 adverse net economic exposure, but still no actual approved hedge identified.
- Do not infer probabilities by dividing lost business exposure by $1 contract notional.

## CRITICAL INTERACTIONS

- All filters must work simultaneously, search normalized, number of rows and confidence totals recalc. Clicking a sourced record opens a readable details panel, not a dead card.
- Case switch, simulator controls, reset, downloads, citations, market fetch indicator, next chapter nav, and back-to-top must all function. No decorative inert controls.
- Semantic tooltips explain technical terms (`basis risk`, `contribution margin`, `limit price`, `contract payout`).
- Mobile menu with keyboard focus trap only when actually open, correct escape handling, and reduced-motion fallback.
- External official-source links `target=_blank rel=noopener noreferrer`; downloadable assets actually exist and are not 404s.

## ENGINEERING QUALITY GATES

- Run ESLint, TypeScript noEmit, full production build, Vitest >=35 focused assertions, Playwright desktop >=1440x900, mobile 375x812, and tablet. Test offline/API 503 fallback, malformed quote/empty book, invalid probabilities, false-negative outcome, negative expected payoff, no fake customer claims, exactly dataset-specific business counts. Unit test all formula cases and orderbook parsing.
- Accessibility: axe or similar scan, >=95 accessibility goal, visible focus, headings, skip link, reduced-motion environment.
- Visual QA: capture and inspect 1440x900 and 375x812 screenshots. Specifically check massive hero typography overflow, nav overlap, long business names and cards, modal boundaries, sticky sections and charts.
- Performance: optimize SVG/canvas, do not trap scrolling, use `will-change` transiently, avoid oversized JS bundle. Lighthouse mobile performance goal >=85 when possible. Set proper `metadata` for social share.
- Read and execute `engineering/acceptance-tests.md` checklist. Document test counts, exact exit codes, screenshots, and limitations. Never report `all passed` without running.
- Create final `ENGINEERING_HANDOFF.md` recording production URL if deployed (else local run instructions), git commit, changed files, API status, reports/screenshots, run instructions, evidence count, known uncertainties.

## IMPLEMENTATION ORDER

1. Inspect file evidence and scaffold.
2. Define TypeScript schemas / pure finance engine and tests.
3. Build content components and visual system.
4. Implement hero motion, scroll choreography and responsive UX.
5. Add simulator, filters, source drawer and market-feed fallback.
6. Export original research/models in working downloads.
7. Verify claims, run complete QA, fix visual/a11y/perf issues.
8. Commit to git and deploy if permitted. Provide user with direct URL, test summary and any blockers.

**Most important final instruction:** The website must convey genuine analyst discernment, including a rigorous NO HEDGE outcome, not merely beautiful charts or a promotional prediction-market narrative. You are the software engineer. The supplied researched inputs and judgments are binding. If more investment research is needed, leave an explicit issue for ChatGPT, not a fabricated fact.
