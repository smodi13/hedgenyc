# Engineering acceptance tests | HedgeNYC

## Content integrity

- [ ] Source screen number equals `prospects.json.total_unique_businesses` and verified/directory totals sum exactly to that number.
- [ ] All 3 flagship business cases exist, with documented sources and actual analyst dispositions (Brooklyn Sail HOLD, Xentra QUALIFY, Arborpolitan NO RECOMMENDATION).
- [ ] None of the company records says “customer confirmed”, “not a customer” or “contacted”. No generated contact notes or fabricated conversion data.
- [ ] Primary source and directory-discovery cards have visibly different badges and controls to hide unverified leads.
- [ ] The two rain-or-shine companies act as explicit negative controls, no simplistic forced hedge pitch.
- [ ] Every business evidence link opens its correct real company URL if present. No invented URLs for discovery-only.
- [ ] 3 speculative market designs each show “research concept only, not currently listed”.
- [ ] Dates on discovered Kalshi examples are November 2026, not automatically branded currently active.
- [ ] Branding includes “Independent research; not affiliated with Kalshi” on every route.

## Financial accuracy

- [ ] All outcomes come from typed calculator, not formatted placeholder numbers or duplicated hardcodes.
- [ ] YES 250 x $0.43 produces $107.50 premium, rounded general taker fee $4.29, $111.79 cash at risk, +$138.21 net YES, -$111.79 net NO.
- [ ] Brooklyn Sail L = 550 * (1 - 0.40) = $330. No gross booking amount presented as lost margin.
- [ ] Sail scenario probabilities total 1 and each joint state P&L/expected outcome consistent.
- [ ] Fuel shock base impact is `1,200 * 0.40 * (1 - 0) = 480` dollars.
- [ ] Arborpolitan default net storm contribution = 1400 - 1000 = +400, implying zero downside if no other costs; no default hedge recommendation.
- [ ] If Arborpolitan emergency contribution set to $500, adverse net contribution loss becomes $500.
- [ ] All input reset buttons restore documented illustrative assumptions and any invalid custom probability inputs are rejected with legible error message.
- [ ] Exactly four outcomes including business-loss + contract-NO, with p10 explicitly tracked as miss/basis risk.
- [ ] Model does NOT treat `contract price = probability of business loss`; no implied hedge guarantee.
- [ ] Excel output remains formula-driven and downloadable, original workbook checksums unchanged from supplied reference.

## API and truthfulness

- [ ] Date-stamped public Kalshi API responses are parsed and checked against contract's actual status, source, resolution, `yes_ask_dollars` or equivalent documented fields; closed markets never shown as tradeable.
- [ ] If API returns malformed JSON, 429, 500, timeout or empty data, all research works and market module displays “unavailable” (not a fabricated fallback quote).
- [ ] No plaintext API keys committed or client-side trading keys. No trading endpoints, no POST order placement.
- [ ] No fake live quotes, tickers, volatility scores, clients, reviews, trade volume or execution assurances.
- [ ] Dated contract data only with original source URLs and label `DISCOVERED CONTRACT / NOT VERIFIED LIVE`.
- [ ] Simulated price is prominent `ILLUSTRATIVE ASSUMPTION` and never quietly replaced by actual market observation.

## Visual and interaction

- [ ] Distinctive skyline and neighborhood-grid animated hero on desktop; legible static alternative on reduced motion.
- [ ] Substantial but tasteful smooth scroll, animated section changes, active chapter navigation, and no sticky content obstruction.
- [ ] Loaded all screens at 1440px desktop, 768px tablet, 375px mobile; no horizontal overflow or clipped hero words.
- [ ] Keyboard-only nav, search, business drawer, all financial slider labels and close controls work.
- [ ] Filter-by-sector/evidence/market-fit and free text search affect visible records and live counters accurately.
- [ ] Responsive screenshot and visual review. WCAG color contrast, skip link and reduced-motion tested.
- [ ] 404 and 500 safe handling; all primary source links valid (when reachable); all downloads load and match original research file bytes.
- [ ] No site errors with offline API; client hydration stable.

## Tests and deployment

- [ ] `npm run lint`, typecheck, production build exit 0 (fix actual errors before claiming success).
- [ ] Automated finance tests include 4 state outputs, fee cent rounding, expense pass-through, invalid probabilities, zero contracts, high-priced contract and no matching market case.
- [ ] Automated data tests include count uniqueness, evidence URL presence for first-party source, absence for directory-only, no duplicate company ID.
- [ ] Playwright user journeys for source drawer, investor demo, menu scroll, case selector, offline fallback, downloading XLSX and report.
- [ ] Document exact passed/failed counts and deployment URL only after confirmed.
- [ ] Production metadata, favicon, Open Graph, image alt and mobile navigation verified.

## Final handoff contract

Write `ENGINEERING_HANDOFF.md` with exact local running commands, deployment result, routes, screenshots (or relative paths), test counts, limitations, remaining analyst research needs and git status. Be transparent.
