"use client";
import { usd, pct as pctFmt, signedUsd } from "@/lib/format";
import { CASE_KEYS, CASE_LABEL, exampleProfile, exposureSentence, fixedTotal, seasonalAmount, type CaseInputs, type CaseKey, type Profile, type Verification } from "@/lib/owner/business";
import type { Analysis } from "@/lib/owner/analysis";
import type { Scenario } from "@/lib/owner/model";
import { Num } from "./Num";
import { Card, Chip, F, Seg, Stat } from "./ui";
import { ScenarioChart, Select, TextField } from "./parts";

type Up = (patch: Partial<Scenario>) => void;

export function BusinessStep({ s, up, a, onExample }: { s: Scenario; up: Up; a: Analysis; onExample: () => void }) {
  const p = s.profile, err = (k: string) => a.errors[k];
  const upP = (patch: Partial<Profile>) => up({ profile: { ...p, ...patch } });
  const upCase = (k: CaseKey, patch: Partial<CaseInputs>) => upP({ [k]: { ...p[k], ...patch } } as Partial<Profile>);
  const quick = p.mode === "quick";
  return (
    <>
      <Card title="About the business" tag="owner">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField label="Business name" value={p.name} onChange={(v) => upP({ name: v })} testId="scenario-name" />
          <TextField label="City" value={p.city} onChange={(v) => upP({ city: v })} testId="in-city" />
          <TextField label="State" value={p.state} onChange={(v) => upP({ state: v })} />
          <TextField label="Industry" value={p.industry} onChange={(v) => upP({ industry: v })} />
          <TextField label="Modeling period (YYYY-MM)" value={p.period} onChange={(v) => upP({ period: v })} testId="in-period" />
          <Select label="Assumption status" value={p.verification} onChange={(v: Verification) => upP({ verification: v })} testId="verif"
            options={[{ v: "illustrative", label: "Illustrative defaults, not verified" }, { v: "owner-reported", label: "Owner-reported, not independently verified" }, { v: "documented", label: "Documented from owner records" }]} />
          <div className="sm:col-span-2 lg:col-span-3"><TextField label="Notes" value={p.notes} onChange={(v) => upP({ notes: v })} multiline /></div>
        </div>
        {err("period") && <p role="alert" className="mt-2 text-xs text-copper">{err("period")}</p>}
        <p className="mt-3 text-sm text-steel">The modeling period must match the contract&apos;s settlement period: a December contract is compared with December activity, not the whole year.</p>
        {p.verification === "illustrative" && <p className="mt-3 text-sm text-copper">All figures are generic illustrative defaults. They are not this company&apos;s verified financials.</p>}
        {p.publicFacts && (
          <div className="mt-4 border border-line p-4 text-sm leading-relaxed text-chalk/85">
            <Chip tag="fact" />
            <p className="mt-2">Public facts from the company&apos;s own site: snow removal is pay-per-push with no flat seasonal snow-removal contracts; residential service starts from $60 per push; services also include commercial snow removal, salting, ice management and property maintenance. <a className="text-mint underline" target="_blank" rel="noopener noreferrer" href="https://assetoperationsgroup.com/chicagoland-snow-plowing-ice-management">Source<span className="sr-only"> (opens in a new tab)</span></a></p>
            <p className="mt-2 text-steel">Not public, and not assumed: customer counts, margins, historical revenue and contract mix. Seasonal contracts are never assumed for this business.</p>
          </div>
        )}
      </Card>

      <Card title="Revenue, costs and activity levels" tag="owner" aside={<Seg label="Calculation mode" value={p.mode} onChange={(v) => upP({ mode: v })} options={[{ v: "quick", label: "Quick: I know my margin" }, { v: "detailed", label: "Detailed: revenue minus costs" }]} />}>
        <p className="mb-4 max-w-3xl text-sm text-chalk/80">{quick ? "Quick mode applies the contribution margin you enter to each activity level. Costs are not entered separately, so nothing is counted twice." : "Detailed mode subtracts the variable costs below from revenue. No margin percentage is applied, so nothing is counted twice."}</p>
        <div className="mb-5 flex flex-wrap gap-3">
          <button type="button" data-testid="load-example" onClick={onExample} className="border border-line px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.12em] hover:border-chalk/40">Load illustrative example (150 / 250 / 350 customers)</button>
        </div>
        <div className="grid gap-6 lg:grid-cols-3" data-testid="cases">
          {CASE_KEYS.map((k) => {
            const c = p[k], n = (f: keyof CaseInputs) => `${k}.${f}`;
            return (
              <fieldset key={k} className="space-y-4 border border-line p-4" data-testid={`case-${k}`}>
                <legend className="px-2 font-display text-lg text-chalk">{CASE_LABEL[k]}</legend>
                <F label="Residential customers" name={`${k} residential customers`} value={c.resCustomers} onChange={(v) => upCase(k, { resCustomers: v })} min={0} max={500} step={1} testId={`${k}-rescust`} err={err(n("resCustomers"))} />
                <F label="Visits per residential customer" name={`${k} residential visits`} value={c.resVisits} onChange={(v) => upCase(k, { resVisits: v })} min={0} max={12} step={0.5} testId={`${k}-resvis`} err={err(n("resVisits"))} />
                <F label="Residential revenue per visit" prefix="$" name={`${k} residential revenue`} value={c.resRev} onChange={(v) => upCase(k, { resRev: v })} min={0} max={500} step={1} testId={`${k}-resrev`} err={err(n("resRev"))} />
                <F label="Commercial customers" name={`${k} commercial customers`} value={c.comCustomers} onChange={(v) => upCase(k, { comCustomers: v })} min={0} max={200} step={1} testId={`${k}-comcust`} err={err(n("comCustomers"))} />
                <F label="Visits per commercial customer" name={`${k} commercial visits`} value={c.comVisits} onChange={(v) => upCase(k, { comVisits: v })} min={0} max={12} step={0.5} slider={false} testId={`${k}-comvis`} err={err(n("comVisits"))} />
                <F label="Commercial revenue per visit" prefix="$" name={`${k} commercial revenue`} value={c.comRev} onChange={(v) => upCase(k, { comRev: v })} min={0} max={5000} step={10} slider={false} testId={`${k}-comrev`} err={err(n("comRev"))} />
                <F label="Salting occurrences" name={`${k} salting`} value={c.saltOcc} onChange={(v) => upCase(k, { saltOcc: v })} min={0} max={200} step={1} slider={false} err={err(n("saltOcc"))} />
                <F label="Ice-management occurrences" name={`${k} ice`} value={c.iceOcc} onChange={(v) => upCase(k, { iceOcc: v })} min={0} max={200} step={1} slider={false} err={err(n("iceOcc"))} />
                <F label="Other incremental revenue" prefix="$" name={`${k} other revenue`} value={c.otherRevenue} onChange={(v) => upCase(k, { otherRevenue: v })} min={0} max={100000} step={50} slider={false} err={err(n("otherRevenue"))} />
                {quick
                  ? <F label="Contribution margin" pct name={`${k} margin`} value={c.margin} onChange={(v) => upCase(k, { margin: v })} min={0} max={100} step={1} testId={`${k}-margin`} err={err(n("margin"))} hint="Revenue left after the costs that change with each visit." />
                  : <F label="Incremental costs (overtime, repairs, extra fuel)" prefix="$" name={`${k} incremental costs`} value={c.otherCosts} onChange={(v) => upCase(k, { otherCosts: v })} min={0} max={100000} step={50} slider={false} testId={`${k}-othercost`} err={err(n("otherCosts"))} hint="Costs that only this activity level adds." />}
              </fieldset>
            );
          })}
        </div>

        <div className="mt-6 grid gap-x-6 gap-y-5 border-t border-line pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <F label="Minimum service charge" prefix="$" name="Minimum charge" value={p.minCharge} onChange={(v) => upP({ minCharge: v })} min={0} max={500} step={5} slider={false} err={err("minCharge")} hint="A visit bills at least this amount." />
          <F label="Salting revenue per occurrence" prefix="$" name="Salting revenue" value={p.saltRev} onChange={(v) => upP({ saltRev: v })} min={0} max={5000} step={5} slider={false} err={err("saltRev")} />
          <F label="Ice-management revenue per occurrence" prefix="$" name="Ice revenue" value={p.iceRev} onChange={(v) => upP({ iceRev: v })} min={0} max={5000} step={5} slider={false} err={err("iceRev")} />
        </div>

        {!quick && (
          <div className="mt-6 grid gap-x-6 gap-y-5 border-t border-line pt-6 sm:grid-cols-2 lg:grid-cols-3" data-testid="variable-costs">
            <p className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-copper sm:col-span-2 lg:col-span-3">Variable costs: change with the number of visits</p>
            <F label="Labor per visit" prefix="$" name="Labor" value={p.labor} onChange={(v) => upP({ labor: v })} min={0} max={200} step={1} testId="in-labor" err={err("labor")} />
            <F label="Fuel per visit" prefix="$" name="Fuel" value={p.fuel} onChange={(v) => upP({ fuel: v })} min={0} max={100} step={0.5} testId="in-fuel" err={err("fuel")} />
            <F label="Salt and materials per visit" prefix="$" name="Salt" value={p.salt} onChange={(v) => upP({ salt: v })} min={0} max={100} step={0.5} testId="in-salt" err={err("salt")} />
            <F label="Subcontractor cost per visit" prefix="$" name="Subcontractor" value={p.subcontract} onChange={(v) => upP({ subcontract: v })} min={0} max={200} step={1} slider={false} err={err("subcontract")} />
            <F label="Vehicle cost per visit" prefix="$" name="Vehicle" value={p.vehicle} onChange={(v) => upP({ vehicle: v })} min={0} max={200} step={1} slider={false} err={err("vehicle")} />
            <F label="Cost per salting / ice occurrence" prefix="$" name="Occurrence cost" value={p.occCost} onChange={(v) => upP({ occCost: v })} min={0} max={5000} step={5} slider={false} err={err("occCost")} />
          </div>
        )}

        <div className="mt-6 grid gap-x-6 gap-y-5 border-t border-line pt-6 sm:grid-cols-2 lg:grid-cols-3" data-testid="fixed-costs">
          <p className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-copper sm:col-span-2 lg:col-span-3">Fixed costs for the period: shared by every activity level, kept out of contribution margin</p>
          <F label="Overhead" prefix="$" name="Overhead" value={p.fixedOverhead} onChange={(v) => upP({ fixedOverhead: v })} min={0} max={100000} step={100} slider={false} err={err("fixedOverhead")} />
          <F label="Equipment" prefix="$" name="Equipment" value={p.fixedEquipment} onChange={(v) => upP({ fixedEquipment: v })} min={0} max={100000} step={100} slider={false} err={err("fixedEquipment")} />
          <F label="Insurance" prefix="$" name="Insurance" value={p.fixedInsurance} onChange={(v) => upP({ fixedInsurance: v })} min={0} max={100000} step={100} slider={false} err={err("fixedInsurance")} />
          <F label="Facilities" prefix="$" name="Facilities" value={p.fixedFacilities} onChange={(v) => upP({ fixedFacilities: v })} min={0} max={100000} step={100} slider={false} err={err("fixedFacilities")} />
          <F label="Other fixed costs" prefix="$" name="Other fixed" value={p.fixedOther} onChange={(v) => upP({ fixedOther: v })} min={0} max={100000} step={100} slider={false} err={err("fixedOther")} />
        </div>

        {!p.publicFacts && (
          <div className="mt-6 border-t border-line pt-6">
            <label className="flex items-center gap-2 text-sm text-chalk/90"><input type="checkbox" data-testid="seasonal-on" checked={p.seasonalEnabled} onChange={(e) => upP({ seasonalEnabled: e.target.checked })} />This business also has fixed seasonal contract revenue that is paid whatever the snowfall</label>
            {p.seasonalEnabled && <div className="mt-4 max-w-sm"><F label="Seasonal contract revenue in this period" prefix="$" name="Seasonal revenue" value={p.seasonalRevenue} onChange={(v) => upP({ seasonalRevenue: v })} min={0} max={500000} step={500} slider={false} testId="in-seasonal" err={err("seasonalRevenue")} hint="Enter the actual fixed amount. It stays in every activity level." /></div>}
          </div>
        )}
        {p.publicFacts && <p className="mt-6 border-t border-line pt-4 text-sm text-steel">This business bills per push, so no seasonal contract revenue is modeled.</p>}
      </Card>
    </>
  );
}

export function ExposureStep({ s, up, a }: { s: Scenario; up: Up; a: Analysis }) {
  const p = s.profile, e = a.exposure, err = (k: string) => a.errors[k];
  const upP = (patch: Partial<Profile>) => up({ profile: { ...p, ...patch } });
  if (!a.valid) return (
    <Card title="Check your inputs" tag="owner"><ul data-testid="invalid" className="list-disc space-y-1 pl-5 text-copper">{Object.values(a.errors).map((x, i) => <li key={i}>{x}</li>)}</ul></Card>
  );
  const row = (k: string, f: (r: typeof e.low) => string, id: string) => (
    <tr className="border-b border-line/60"><th scope="row" className="py-2 pr-3 text-left text-sm font-normal text-chalk/80">{k}</th>
      {CASE_KEYS.map((c) => <td key={c} data-testid={`${id}-${c}`} className="tnum py-2 pr-3 text-right text-sm text-chalk">{f(e[c])}</td>)}</tr>
  );
  return (
    <>
      <Card title="Your numbers by activity level" tag="hypo">
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Numbers by activity level">
          <table className="w-full min-w-[520px]" data-testid="case-table">
            <thead><tr><th className="sr-only">Measure</th>{CASE_KEYS.map((c) => <th key={c} scope="col" className="pb-2 pr-3 text-right font-mono text-[0.64rem] uppercase tracking-[0.14em] text-steel">{CASE_LABEL[c]}</th>)}</tr></thead>
            <tbody>
              {row("Revenue", (r) => usd(r.revenue), "rev")}
              {row("Variable costs", (r) => usd(r.variableCosts), "var")}
              {row("Contribution", (r) => usd(r.contribution), "contrib")}
              {row("Contribution margin", (r) => (r.marginPct === null ? "n/a" : pctFmt(r.marginPct, 1)), "marg")}
              {row("Fixed costs", (r) => usd(r.fixedCosts), "fixed")}
              {row("Operating income", (r) => usd(r.operatingIncome), "noi")}
              {row("Contribution vs normal", (r) => signedUsd(r.contributionVsNormal), "dvs")}
            </tbody>
          </table>
        </div>
        {seasonalAmount(p) > 0 && <p className="mt-3 text-sm text-steel">Includes {usd(seasonalAmount(p))} of fixed seasonal revenue in every case. It does not change the shortfall.</p>}
        {fixedTotal(p) > 0 && <p className="mt-1 text-sm text-steel">Fixed costs lower operating income in every case equally, so they do not change the shortfall.</p>}
        <div className="mt-6"><ScenarioChart e={e} /></div>
        <p className="mt-2 text-xs text-steel">High activity is not automatically the most profitable: extra visits also add labor, fuel, salt and overtime.</p>
      </Card>

      <Card title="Your financial exposure" tag="hypo">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat k="Low-activity shortfall" tone="copper" big sub="Normal contribution minus low contribution, never below $0"><Num value={e.shortfallLow} testId="out-short-low" /></Stat>
          <Stat k="High-activity shortfall" tone="copper" big sub="Normal contribution minus high contribution, never below $0"><Num value={e.shortfallHigh} testId="out-short-high" /></Stat>
          <Stat k="Loss to protect" big sub={s.useOverride ? "Your own figure" : `From the ${p.hedgeCase}-activity case`}><Num value={a.loss} testId="out-loss" /></Stat>
        </div>
        <p className="mt-4 max-w-3xl text-chalk/90" data-testid="exposure-sentence">{exposureSentence(p, e)}</p>
        <div className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
          <Select label="Which shortfall to hedge" value={p.hedgeCase} onChange={(v: "low" | "high") => upP({ hedgeCase: v })} testId="hedge-case" options={[{ v: "low", label: "Low activity (for example, a light-snow month)" }, { v: "high", label: "High activity (extra work adds costs)" }]} />
          <div>
            <label className="flex items-center gap-2 text-sm text-chalk/90"><input type="checkbox" data-testid="use-override" checked={s.useOverride} onChange={(e) => up({ useOverride: e.target.checked, overrideLoss: e.target.checked && !s.overrideLoss ? a.exposure.shortfall : s.overrideLoss })} />Use my own figure for the loss to protect</label>
            {s.useOverride && <div className="mt-3"><F label="Loss to protect" prefix="$" name="Loss to protect" value={s.overrideLoss} onChange={(v) => up({ overrideLoss: v })} min={0} max={50000} step={50} testId="in-override" err={err("overrideLoss")} /></div>}
          </div>
        </div>
      </Card>
    </>
  );
}

export { exampleProfile };
