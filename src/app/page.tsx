import { Hero } from "@/components/hero/Hero";
import { Thesis, RiskLines } from "@/components/chapters/Thesis";
import { Screen } from "@/components/chapters/Screen";
import { Cases } from "@/components/chapters/Cases";
import { Lab } from "@/components/simulator/Lab";
import { MarketFit } from "@/components/chapters/MarketFit";
import { Concepts } from "@/components/chapters/Concepts";
import { Pipeline } from "@/components/chapters/Pipeline";
import { Evidence } from "@/components/evidence/Evidence";
import { counts, prospects } from "@/lib/research/load";

export default function Home() {
  const contacted = prospects.filter((p) => p.outreach_status !== "NOT CONTACTED").length;
  return (
    <>
      <Hero counts={{ ...counts, contacted }} />
      <Thesis />
      <RiskLines />
      <Screen data={prospects} />
      <Cases />
      <Lab />
      <MarketFit />
      <Concepts />
      <Pipeline counts={{ total: counts.total, primary: counts.primary, withHypothesis: prospects.filter((p) => p.risk_hypothesis.trim()).length, contacted }} />
      <Evidence counts={counts} />
    </>
  );
}
