/**
 * Business profile and Low / Normal / High activity model.
 * Arithmetic is plain dollars rounded to 1e-6 to remove binary-float noise; displays round to cents.
 *
 * Contribution per case:
 *   QUICK    contribution = (visit + occurrence + other revenue) x entered margin   (no costs are deducted)
 *   DETAILED contribution = revenue - variable costs                                (no margin is applied)
 * Seasonal contract revenue (generic companies only, owner-entered) is retained in full in every case.
 * Fixed costs are shared by all cases, so they change operating income but never the shortfall.
 */

export type Mode = "quick" | "detailed";
export type Verification = "illustrative" | "owner-reported" | "documented";
export type CaseKey = "low" | "normal" | "high";
export const CASE_KEYS: CaseKey[] = ["low", "normal", "high"];
export const CASE_LABEL: Record<CaseKey, string> = { low: "Low activity", normal: "Normal activity", high: "High activity" };

export interface CaseInputs {
  resCustomers: number; comCustomers: number;
  resVisits: number; comVisits: number;
  resRev: number; comRev: number;
  /** Salting and ice-management occurrences in the period */
  saltOcc: number; iceOcc: number;
  otherRevenue: number;
  /** QUICK mode: contribution margin on this case's revenue */
  margin: number;
  /** DETAILED mode: incremental costs of this case (overtime, repairs, extra fuel not captured per visit) */
  otherCosts: number;
}

export interface Profile {
  name: string; city: string; state: string; industry: string;
  /** Financial modeling period, YYYY-MM. Must match the contract's settlement period. */
  period: string;
  notes: string; verification: Verification;
  /** Published facts exist for this preset (Asset Operations Group): per-push billing only */
  publicFacts: boolean;
  mode: Mode;
  low: CaseInputs; normal: CaseInputs; high: CaseInputs;
  minCharge: number; saltRev: number; iceRev: number;
  /** Variable costs per billable visit */
  labor: number; fuel: number; salt: number; subcontract: number; vehicle: number;
  /** Variable cost per salting / ice occurrence */
  occCost: number;
  seasonalEnabled: boolean; seasonalRevenue: number;
  fixedOverhead: number; fixedEquipment: number; fixedInsurance: number; fixedFacilities: number; fixedOther: number;
  /** Which shortfall the hedge is sized against */
  hedgeCase: "low" | "high";
}

export const caseDefault = (customers: number, visits: number): CaseInputs => ({
  resCustomers: customers, comCustomers: 0, resVisits: visits, comVisits: visits, resRev: 60, comRev: 150,
  saltOcc: 0, iceOcc: 0, otherRevenue: 0, margin: 0.5, otherCosts: 0,
});

export const PRESET_NAMES = ["Asset Operations Group", "2 Aces Snow Plowing", "Brancato Snow & Ice Management", "New / Custom Business"] as const;

export function defaultProfile(name: string = "Asset Operations Group"): Profile {
  const aog = name === "Asset Operations Group";
  return {
    name, city: aog ? "Chicago" : "", state: aog ? "IL" : "", industry: "Snow removal", period: "2026-12", notes: "",
    verification: "illustrative", publicFacts: aog, mode: "quick",
    low: caseDefault(20, 1), normal: caseDefault(20, 3), high: caseDefault(20, 5),
    minCharge: 0, saltRev: 0, iceRev: 0, labor: 22, fuel: 5, salt: 3, subcontract: 0, vehicle: 0, occCost: 0,
    seasonalEnabled: false, seasonalRevenue: 0,
    fixedOverhead: 0, fixedEquipment: 0, fixedInsurance: 0, fixedFacilities: 0, fixedOther: 0,
    hedgeCase: "low",
  };
}

/** The illustrative example from the owner call brief. Labeled illustrative everywhere it is shown. */
export function exampleProfile(p: Profile): Profile {
  return { ...p, verification: "illustrative", low: { ...p.low, resCustomers: 150, resVisits: 1 }, normal: { ...p.normal, resCustomers: 250, resVisits: 3 }, high: { ...p.high, resCustomers: 350, resVisits: 5 } };
}

const r6 = (x: number) => Math.round(x * 1e6) / 1e6;

export interface CaseResult {
  revenue: number; visits: number; variableCosts: number; contribution: number;
  marginPct: number | null; fixedCosts: number; operatingIncome: number;
  /** Differences versus the normal case (this case minus normal) */
  contributionVsNormal: number; operatingIncomeVsNormal: number; revenueVsNormal: number;
}

export const fixedTotal = (p: Profile) => r6(p.fixedOverhead + p.fixedEquipment + p.fixedInsurance + p.fixedFacilities + p.fixedOther);
export const seasonalAmount = (p: Profile) => (p.seasonalEnabled && !p.publicFacts ? p.seasonalRevenue : 0);

function rawCase(p: Profile, c: CaseInputs) {
  const perRes = Math.max(c.resRev, p.minCharge), perCom = Math.max(c.comRev, p.minCharge);
  const resVisits = c.resCustomers * c.resVisits, comVisits = c.comCustomers * c.comVisits;
  const visits = resVisits + comVisits;
  const occ = c.saltOcc + c.iceOcc;
  const variableRevenue = (c.resCustomers > 0 && c.resVisits > 0 ? resVisits * perRes : 0) + (c.comCustomers > 0 && c.comVisits > 0 ? comVisits * perCom : 0) + c.saltOcc * p.saltRev + c.iceOcc * p.iceRev + c.otherRevenue;
  const seasonal = seasonalAmount(p);
  const revenue = variableRevenue + seasonal;
  const costs = p.mode === "quick"
    ? variableRevenue * (1 - c.margin)
    : visits * (p.labor + p.fuel + p.salt + p.subcontract + p.vehicle) + occ * p.occCost + c.otherCosts;
  return { visits, revenue: r6(revenue), variableCosts: r6(costs), contribution: r6(revenue - costs) };
}

export interface Exposure {
  low: CaseResult; normal: CaseResult; high: CaseResult;
  shortfallLow: number; shortfallHigh: number;
  /** Shortfall the hedge is sized against (before any owner override) */
  shortfall: number;
  fixedCosts: number;
}

export function exposure(p: Profile): Exposure {
  const f = fixedTotal(p);
  const base = Object.fromEntries(CASE_KEYS.map((k) => [k, rawCase(p, p[k])])) as Record<CaseKey, ReturnType<typeof rawCase>>;
  const n = base.normal;
  const res = Object.fromEntries(CASE_KEYS.map((k) => {
    const b = base[k];
    return [k, {
      revenue: b.revenue, visits: b.visits, variableCosts: b.variableCosts, contribution: b.contribution,
      marginPct: b.revenue > 0 ? b.contribution / b.revenue : null, fixedCosts: f, operatingIncome: r6(b.contribution - f),
      contributionVsNormal: r6(b.contribution - n.contribution), operatingIncomeVsNormal: r6(b.contribution - n.contribution), revenueVsNormal: r6(b.revenue - n.revenue),
    } satisfies CaseResult];
  })) as Record<CaseKey, CaseResult>;
  const shortfallLow = Math.max(0, r6(n.contribution - base.low.contribution));
  const shortfallHigh = Math.max(0, r6(n.contribution - base.high.contribution));
  return { ...res, shortfallLow, shortfallHigh, shortfall: p.hedgeCase === "low" ? shortfallLow : shortfallHigh, fixedCosts: f };
}

/** Month string YYYY-MM check */
export const validPeriod = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

export function validateProfile(p: Profile): Record<string, string> {
  const e: Record<string, string> = {};
  const money = (k: string, v: number, label: string) => { if (!Number.isFinite(v) || v < 0 || v > 1e9) e[k] = `${label} must be a dollar amount of $0 or more.`; };
  const whole = (k: string, v: number, label: string) => { if (!Number.isInteger(v) || v < 0 || v > 1e6) e[k] = `${label} must be a whole number, 0 or more.`; };
  const count = (k: string, v: number, label: string) => { if (!Number.isFinite(v) || v < 0 || v > 1e4) e[k] = `${label} must be a number, 0 or more.`; };
  if (!validPeriod(p.period)) e.period = "Modeling period must be a month, like 2026-12.";
  for (const c of CASE_KEYS) {
    const i = p[c];
    whole(`${c}.resCustomers`, i.resCustomers, "Residential customers"); whole(`${c}.comCustomers`, i.comCustomers, "Commercial customers");
    count(`${c}.resVisits`, i.resVisits, "Visits per residential customer"); count(`${c}.comVisits`, i.comVisits, "Visits per commercial customer");
    money(`${c}.resRev`, i.resRev, "Residential revenue per visit"); money(`${c}.comRev`, i.comRev, "Commercial revenue per visit");
    count(`${c}.saltOcc`, i.saltOcc, "Salting occurrences"); count(`${c}.iceOcc`, i.iceOcc, "Ice-management occurrences");
    money(`${c}.otherRevenue`, i.otherRevenue, "Other revenue");
    if (p.mode === "quick") { if (!Number.isFinite(i.margin) || i.margin < 0 || i.margin > 1) e[`${c}.margin`] = "Contribution margin must be between 0% and 100%."; }
    else money(`${c}.otherCosts`, i.otherCosts, "Incremental costs");
  }
  money("minCharge", p.minCharge, "Minimum service charge"); money("saltRev", p.saltRev, "Salting revenue per occurrence"); money("iceRev", p.iceRev, "Ice revenue per occurrence");
  if (p.mode === "detailed") {
    money("labor", p.labor, "Labor per visit"); money("fuel", p.fuel, "Fuel per visit"); money("salt", p.salt, "Salt and materials per visit");
    money("subcontract", p.subcontract, "Subcontractor cost per visit"); money("vehicle", p.vehicle, "Vehicle cost per visit"); money("occCost", p.occCost, "Cost per salting/ice occurrence");
  }
  if (p.seasonalEnabled && !p.publicFacts) money("seasonalRevenue", p.seasonalRevenue, "Seasonal contract revenue");
  for (const k of ["fixedOverhead", "fixedEquipment", "fixedInsurance", "fixedFacilities", "fixedOther"] as const) money(k, p[k], "Fixed cost");
  return e;
}

/** The owner-facing sentence. Always conditional on the entered assumptions. */
export function exposureSentence(p: Profile, x: Exposure): string {
  const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
  const per = p.period;
  if (p.hedgeCase === "low")
    return x.shortfallLow > 0
      ? `Based on the information entered, an unusually light-activity ${per} could reduce your contribution by approximately ${usd(x.shortfallLow)} compared with a normal ${per}.`
      : `Based on the information entered, a light-activity ${per} does not reduce your contribution below a normal ${per}.`;
  return x.shortfallHigh > 0
    ? `Based on the information entered, an unusually heavy-activity ${per} could reduce your contribution by approximately ${usd(x.shortfallHigh)} compared with a normal ${per}, because extra work also adds costs.`
    : `Based on the information entered, a heavy-activity ${per} does not reduce your contribution below a normal ${per}.`;
}
