# HedgeNYC | Independent NYC Hedging Research

**Live site: https://hedgenyc.vercel.app**

HedgeNYC is an independent research work sample: an interactive website that maps New York small businesses, the events that move their margins, and the questions between a market price and a useful hedge. **It is not affiliated with, endorsed by, or commissioned by Kalshi.** Scenarios are illustrative and are not financial advice. No business outreach, owner interview, pilot or trading has occurred.

## What it does

- **Hero and thesis:** animated vector NYC skyline with risk routes; exposure / trigger / execution framing.
- **Business screen:** all 47 public-source records, split into 33 company-site records and 14 directory discoveries (not verified). Search, filters, sorting, detail drawers with source links and a score breakdown. Every record is `NOT CONTACTED`.
- **Field notes:** three cases (Brooklyn Sail: hold; Xentra Transport: qualify; Arborpolitan: no recommendation) plus two "do not pitch" negative controls.
- **Hedge lab:** four joint states (including a business loss where the contract does not pay), editable inputs, Kalshi general taker fee, expected values, false-positive / false-negative definitions, data table, reset to research defaults. Invalid probabilities block the expected value.
- **Market fit:** read-only check of Kalshi's public market and order-book API from the server, with timestamps. If the API fails the site says "Market feed unavailable"; it never invents a quote. No order form.
- **Market design:** three unapproved, unlisted market concepts.
- **Pipeline and evidence:** proposed 30/60/90-day pilot, source register (36 sources), glossary, and downloads (report PDFs, Excel model, CSV/JSON data).

## Stack

Next.js 16 (App Router), TypeScript (strict), Tailwind CSS v4, Motion, Lenis, Zod, Lucide, custom SVG charts. Vitest and Playwright (with axe) for tests.

## Local setup

```bash
npm install
npm run dev            # http://localhost:3000
```

Requires Node 20+. No environment variables or API keys are needed (Kalshi public endpoints only).

## Testing

```bash
npm run lint
npm run typecheck
npm test               # Vitest: finance model, workbook parity, data integrity, Kalshi parsers
npm run build
npm run test:e2e       # Playwright: desktop 1440x900, tablet 768, mobile 375x812; builds and serves on :3100
PW_BASE_URL=https://hedgenyc.vercel.app npm run test:e2e   # run against production
```

## Deployment

The Vercel project `hedgenyc` is connected to this repository. Pushes to `main` deploy to production (https://hedgenyc.vercel.app); other branches and pull requests get preview deployments.

## Data sourcing and limitations

- Research inputs live in `research/`, the workbook in `model/`, copy in `content/`. Downloads in `public/downloads/` are byte-identical copies (see `SHA256_MANIFEST.txt`); `scripts/sync-downloads.mjs` refreshes them.
- A company website establishes that a business operates and what it advertises. It does not establish revenue, margins, owner willingness to hedge, or Kalshi customer status. The 14 directory records have no first-party source in the dataset.
- Dollar figures, contract prices and joint probabilities in the cases and simulator are **analyst hypotheticals**, not quotes, forecasts or Kalshi-implied probabilities. Losses are contribution margin, not gross bookings.
- **False positive** = contract pays but there is no business loss; **false negative** = business loses but the contract does not pay (basis miss).
- Fees use the general taker formula only; category and order-type schedules differ. Spread, partial fills and slippage are not modelled. Premium plus fees can be lost in full.
- Market records are dated discoveries (Nov 2026). Live API fields are shown with fetch times but are not offers or recommendations.
- **Open analyst question:** which diesel strike (if any) suits Xentra Transport. It is unresolved and labelled unverified on the site. See `engineering/implementation-open-items.md`.
