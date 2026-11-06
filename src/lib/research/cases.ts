/**
 * Editorial case content transcribed from research/case-studies.md and the workbook.
 * Numbers here are the analyst's illustrative INPUTS; every derived figure comes from finance/hedge.ts.
 */
import type { JointProbs } from "../finance/hedge";

export type CaseId = "sail" | "xentra" | "arbor";

export interface CaseStudy {
  id: CaseId;
  index: string;
  name: string;
  exposureType: string;
  title: string;
  disposition: string;
  dispositionTone: "hold" | "qualify" | "pass";
  dispositionDetail: string;
  riskDriver: string;
  observed: string;
  observedSources: { label: string; url: string }[];
  hypothetical: string;
  matched: string;
  matchedSources: { label: string; url: string }[];
  basis: string;
  ownerQuestions: string[];
  /** Simulator defaults (analyst workbook inputs) */
  defaults: {
    contracts: number;
    price: number;
    feeCoef: number;
    probs: JointProbs;
  };
}

export const CASES: CaseStudy[] = [
  {
    id: "sail",
    index: "01",
    name: "Brooklyn Sail",
    exposureType: "Weather cancellations",
    title: "The rain contract that misses the cancellation.",
    disposition: "HOLD: BASIS RISK NOT YET ACCEPTABLE",
    dispositionTone: "hold",
    dispositionDetail:
      "Not a ready-made hedge. Hold any customer pitch pending evidence that cancellation losses statistically co-move with the contract's exact settlement, and that liquidity and pricing are adequate. A better concept is a local extreme-wind or safety-warning market with reproducible settlement, if it were compliant and liquid enough to list.",
    riskDriver:
      "Severe weather can cancel a prepaid voyage, forcing a refund or reschedule: lost contribution margin, crew and scheduling friction, possibly a lost customer. A cancellation is not the same as a lost sale if the customer reschedules.",
    observed:
      "Brooklyn Sail publicly describes when voyages cancel for bad weather and its refund and rescheduling options, and lists private and group ticket prices. These are advertised service details, not income statements or demand estimates.",
    observedSources: [
      { label: "bksail.com/details", url: "https://www.bksail.com/details" },
      { label: "bksail.com/pricing", url: "https://www.bksail.com/pricing" },
    ],
    hypothetical:
      "One hypothetical $550 private charter (midpoint of the advertised $525–$575), 40% assumed avoidable variable cost, one canceled booking: lost contribution margin L = 550 × (1 − 0.40) = $330. The 40% was NOT provided by the business. Price, quantity, fee multiplier and the four joint probabilities are examples for demonstrating the calculation, not quotes or Kalshi-implied probabilities.",
    matched:
      "Discovered (dated) proxy: KXRAINWKND-26NOV07-NYC, a measurable-rain market for Nov 7–8, 2026. Use solely as a proxy test; verify resolution, observation site and executable offers through the official API.",
    matchedSources: [
      { label: "Kalshi: KXRAINWKND-26NOV07", url: "https://kalshi.com/markets/kxrainwknd/where-will-it-rain-this-weekend/kxrainwknd-26nov07" },
    ],
    basis:
      "A contract that pays on any measurable rain will often settle YES when the vessel sails safely, and may settle NO when high wind makes sailing unsafe in dry weather. Both failure directions are modeled.",
    ownerQuestions: [
      "What specific wind, gust or precipitation conditions trigger a cancellation?",
      "What share of canceled journeys reschedule?",
      "What is lost contribution margin versus lost gross bookings?",
      "How many exposed sailings fall in each month?",
      "Would avoiding a bad weekend loss matter more than monthly profit volatility?",
      "Who decides cancellations, and how? Is any insurance or force majeure protection in place?",
    ],
    defaults: { contracts: 250, price: 0.43, feeCoef: 0.07, probs: { p11: 0.12, p10: 0.08, p01: 0.23, p00: 0.57 } },
  },
  {
    id: "xentra",
    index: "02",
    name: "Xentra Transport",
    exposureType: "Fuel and contract pricing",
    title: "A fuel-price hedge needs a real fuel bill.",
    disposition: "QUALIFY: MIX, INDEX AND TENOR UNVERIFIED",
    dispositionTone: "qualify",
    dispositionDetail:
      "Qualify first. No transaction is recommended until the operator confirms diesel fleet gallons, exposure tenor, hedging budget, ability to price fuel pass-through, and how closely the proposed settlement index tracks its actual cost.",
    riskDriver:
      "When an operator cannot promptly reprice deliveries, rising fuel costs compress contribution margin on existing jobs. A national diesel-threshold event might pay, but local pump prices, the gasoline/diesel mix, timing and gallons are different variables.",
    observed:
      "Xentra's site describes sedan and larger transport operations and publicly advertises no fuel surcharges. Its fleet, gasoline/diesel mix, gallons purchased, pass-through ability and margin are NOT verified.",
    observedSources: [{ label: "xentratransport.com", url: "https://www.xentratransport.com/" }],
    hypothetical:
      "1,200 gallons in a month and a $0.40/gallon local pump increase with zero customer pass-through: L = 1,200 × 0.40 × (1 − 0) = $480. Both gallons and shock are entirely hypothetical and are not Xentra's actual consumption.",
    matched:
      "Discovered (dated) national price-threshold market: KXDIESELW-26NOV09, week of Nov 9. EIA regional diesel prices are context only; the Kalshi series is AAA-defined and must not be mistaken for EIA weekly regional figures. A WTI crude contract is even further removed from pump expense.",
    matchedSources: [
      { label: "Kalshi: KXDIESELW-26NOV09", url: "https://kalshi.com/markets/kxdieselw/diesel-prices-this-week/kxdieselw-26nov09" },
      { label: "Kalshi: KXWTI-26NOV0914", url: "https://kalshi.com/markets/kxwti/wti-oil-on-day/kxwti-26nov0914" },
      { label: "EIA gasoline & diesel data", url: "https://www.eia.gov/petroleum/gasdiesel/" },
    ],
    basis: "National AAA index versus actual NYC retail purchases, purchase timing and gallons; passenger vehicles may burn gasoline rather than diesel.",
    ownerQuestions: [
      "Monthly or weekly diesel gallons by vehicle? Gasoline gallons?",
      "What share of direct costs is fuel?",
      "Spot versus fixed-price fuel contracts, and the renewal cycle?",
      "Are fuel cards or price contracts already in use?",
      "What size of margin shock is material?",
      "Could a fuel surcharge replace a financial hedge?",
    ],
    defaults: { contracts: 350, price: 0.38, feeCoef: 0.07, probs: { p11: 0.24, p10: 0.16, p01: 0.15, p00: 0.45 } },
  },
  {
    id: "arbor",
    index: "03",
    name: "Arborpolitan",
    exposureType: "Storm work has two signs",
    title: "A storm can be a setback and a sale.",
    disposition: "PASS FOR NOW: NET STORM EXPOSURE UNKNOWN",
    dispositionTone: "pass",
    dispositionDetail:
      "No hedge recommendation. First interview the owner, segment storm-related income and costs, distinguish severe from routine weather, and quantify contribution margin by job type. If emergency work reliably rises in storms, hedging against storms may be counterproductive.",
    riskDriver:
      "A severe storm can postpone planned maintenance or add safety and insurance costs, but may increase demand for post-storm emergency removal. These are offsetting revenue channels; modeling only lost scheduled work would be economically incomplete.",
    observed:
      "Arborpolitan's site describes tree care and storm-related response, with trucks and service operations. Seasonality and profitability by job type are unknown.",
    observedSources: [
      { label: "arborpolitan.com", url: "https://arborpolitan.com/" },
      { label: "arborpolitan.com/tree-care", url: "https://arborpolitan.com/tree-care" },
    ],
    hypothetical:
      "Scheduled planned-care margin lost = $1,000 in a storm; emergency storm-work margin earned = $1,400; net +$400. A second sensitivity with only $500 emergency margin yields a net −$500. Both amounts are made-up analyst scenarios, which is why the default position is zero contracts.",
    matched:
      "The project identifies no eligible, suitably matched contract. Broad rainfall contracts are insufficient, and a gusts or storm-warning contract remains only a research concept. No trade recommendation is manufactured.",
    matchedSources: [],
    basis: "No matched market exists to measure a mismatch against; the exposure itself may be long storms rather than short.",
    ownerQuestions: [
      "How do scheduled-work cancellations compare with emergency-work revenue?",
      "Timing of emergency payables and receivables?",
      "Which storm triggers generate profit versus cost?",
      "What is the impact of storm warning lead time?",
      "How often do capacity limits stop the business from monetizing demand spikes?",
      "Are there pre-paid crew overtime or insurer reimbursement issues?",
    ],
    defaults: { contracts: 0, price: 0.45, feeCoef: 0.07, probs: { p11: 0.2, p10: 0.1, p01: 0.3, p00: 0.4 } },
  },
];

/** Analyst exposure inputs behind each case's loss L (workbook "Assumptions" sheet) */
export const EXPOSURE_DEFAULTS = {
  sail: { bookingLow: 525, bookingHigh: 575, avoidable: 0.4, canceled: 1 },
  xentra: { gallons: 1200, shock: 0.4, passThrough: 0 },
  arbor: { scheduledLoss: 1000, emergencyGain: 1400 },
} as const;

export const NEGATIVE_CONTROLS = [
  { name: "Foods of NY Tours", url: "https://www.foodsofny.com/faq/" },
  { name: "Like A Local Tours", url: "https://likealocaltours.com/faq" },
];

export const NEGATIVE_CONTROL_TEXT =
  "Both companies state publicly that tours generally run in ordinary rain, cancelling only for exceptional conditions. That is primary-source evidence against marketing any-rain NYC contracts to every outdoor tour operator. Outcome: do not pitch.";
