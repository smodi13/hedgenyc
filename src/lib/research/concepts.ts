/** Transcribed from research/new-market-specs.md. Independent proposals, none listed. */
export interface MarketConcept {
  id: "A" | "B" | "C";
  title: string;
  job: string;
  question: string;
  settlement: string;
  limitation: string;
  gap: string;
  proposedIndex: string;
  buyer: string;
  demandTest: string;
  priority: string;
}

export const CONCEPTS: MarketConcept[] = [
  {
    id: "A",
    title: "NYC weekend sustained high-wind / gust event",
    job: "Wind-triggered safety disruption for harbor charters, outdoor construction and some visitor operations.",
    question: "Will the official observation at a specified station exceed a predefined sustained-wind or gust threshold during a defined NYC Saturday–Sunday window?",
    settlement: "Specified station, data publisher, units, sample frequency, handling of missing observations, revision cutoff and exact interval must all be established before listing.",
    limitation: "Central Park and airport wind can differ materially from harbor wind; cancellations could occur below or above the threshold.",
    gap: "Any-rain contracts miss the wind-driven cancellations that matter to marine operators.",
    proposedIndex: "Official station sustained wind or gust, defined weekend window",
    buyer: "Harbor charter and sailing operators; construction and visitor operations (hypothesis).",
    demandTest: "Obtain five nonbinding owner explanations of cancellation policy and threshold before seeking product development.",
    priority: "Pending owner demand test",
  },
  {
    id: "B",
    title: "NYC extreme rain during operating hours",
    job: "Businesses harmed by heavy single-day rainfall, where any-measurable-rain markets trigger too easily.",
    question: "Does the official NYC Central Park station record ≥ 1.0 inch of precipitation in a clearly defined 24-hour window?",
    settlement: "NWS / observation source, precise site, raw versus corrected reading, day boundary and revisions.",
    limitation: "Borough-by-borough flooding and business cancellations may vary materially from Central Park.",
    gap: "Existing rain markets settle on any measurable rain (strictly greater than zero), which says little about disruptive rainfall.",
    proposedIndex: "Central Park ≥ 1.0 inch in 24 hours",
    buyer: "Outdoor-exposed operators harmed by heavy rain (hypothesis).",
    demandTest: "Historical correlation test of station data against documented cancellation conditions.",
    priority: "Medium, pending historical correlation tests",
  },
  {
    id: "C",
    title: "East Coast or NYC diesel fuel cost index",
    job: "Delivery companies whose local gallons and fixed contract prices are exposed to diesel hikes.",
    question: "Is a specified authoritative EIA Central Atlantic or NYC retail diesel index above a threshold on its publication date?",
    settlement: "Official named series, exact publication time, revision policy, strike, strike unit, holiday handling and missing-publication treatment.",
    limitation: "A threshold pays a fixed $1 per contract and still will not replicate per-gallon expense; weekly settlements differ from long-term purchase costs.",
    gap: "The discovered diesel market is a national AAA series, not a regional index matching NYC purchases.",
    proposedIndex: "EIA Central Atlantic or NYC retail diesel",
    buyer: "Delivery and transport fleets with local diesel exposure (hypothesis).",
    demandTest: "Investigate after verified buyer interest and market feasibility.",
    priority: "Investigate after verified buyer interest",
  },
];

export const FALSIFICATION = [
  "The business loss trigger cannot be documented.",
  "The underlying observable index cannot be resolved unambiguously.",
  "The remaining mismatch is economically material.",
  "Desired exposures are too infrequent or fragmented for sustainable two-sided liquidity.",
  "A cheaper physical mitigation, surcharge, insurance or existing future offers better protection.",
];

export const BLOCKERS = [
  "Regulatory permissibility", "Manipulability", "Resolution independence",
  "Market-maker support", "Customer demand", "Liquidity economics",
];

export const PIPELINE_STAGES = [
  "Research discovered", "Company source verified", "Exposure hypothesis", "Owner consented interview",
  "Financial loss quantified", "Contract/rule matched", "Price & liquidity vetted", "Compliance/partner review", "Not suitable / Potential pilot",
];

export const PIPELINE_REACHED = 2; // index of the last stage reached by any record: "Exposure hypothesis"

export const GTM_PHASES = [
  { days: "0–30", title: "Source and qualify", points: [
    "Maintain two funnels: primary-source verified and discovery-only. Never treat them as equally validated.",
    "Choose 12 primary-source prospects across marine tourism, logistics, gardening, cycling and walking tours.",
    "Before each interview assemble one source-backed fact, a risk hypothesis, a contribution-margin question, a possible market and the obvious mismatch.",
  ]},
  { days: "31–60", title: "Test matched economics", points: [
    "Seek up to five voluntary conversations, transparently as an independent researcher. No interviews have occurred.",
    "Collect volumes only with explicit consent; otherwise remain hypothetical.",
    "Backtest station data against documented cancellation conditions; produce a basis error matrix.",
    "Validate contracts, spread, expiry, maximum premium plus fees, and whether size can be filled near expected price.",
  ]},
  { days: "61–90", title: "Decision-ready pilot briefs", points: [
    "Recommend a pilot only when exposure is owner-verified, resolution matches loss timing and location, and liquidity supports the size.",
    "Escalate unsuitable listed contracts to the Markets team as feedback; never invent a market.",
    "Publish anonymized learnings where permission exists: reasons to pass are as informative as conversion.",
  ]},
];

export const MILESTONES = [
  "Primary-source business screen", "Optional owner discovery", "Cash flow verified", "Contract and liquidity checked", "Potential pilot",
];

export const METRICS = [
  ["Qualified prospect count", "Primary-source verified businesses with an identified risk trigger, not directory matches."],
  ["Owner conversations", "Only real, confirmed conversations count."],
  ["Trigger-match ratio", "Share of documented loss events matching settlement conditions, with sample sizes."],
  ["Projected premium-to-loss ratio", "Premiums plus fees relative to owner-verified loss, not gross revenue."],
  ["Liquidity-to-need ratio", "Firm near-touch size versus requested notional, time-stamped, with slippage caveats."],
  ["Product feedback", "Documented market gaps and repeatable hypotheses, not speculative TAM."],
];
