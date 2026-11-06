# HedgeNYC Engineering Handoff

- Stack: Next.js 16 App Router, TypeScript strict, Tailwind v4, Motion, Lenis, Zod, Lucide; custom SVG charts.
- Run: `npm install && npm run dev`; production `npm run build && npm start`.
- Checks: `npm run lint`, `npm run typecheck`, `npm test` (Vitest), `npm run test:e2e` (Playwright desktop 1440x900, tablet 768, mobile 375x812, with axe).
- Results: lint 0, tsc 0, build 0, Vitest 74/74, Playwright 108 passed / 3 skipped (viewport-conditional) / 0 failed of 111.
- Routes: `/`, `/api/market-snapshot` (server-side read-only Kalshi public API, 3s deadline, 60s CDN cache, always 200 with status ok|partial|unavailable), `/opengraph-image`, 404/error pages.
- Downloads: `/downloads/*` byte-identical to research files (SHA-256 tested).
- Evidence: 47 records (33 company-site / 14 directory), all NOT CONTACTED.
- Screenshots: `screenshots/` (`node scripts/shots.mjs W H prefix`).
- Not done: Lighthouse run; deployment (see below). Fonts load from Google Fonts at build.
- Open items: `engineering/implementation-open-items.md`.
