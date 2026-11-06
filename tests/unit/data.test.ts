import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { counts, computeScore, marketsFile, prospects, prospectsFile } from "@/lib/research/load";
import { ProspectsFileSchema } from "@/lib/research/schema";
import { CASES } from "@/lib/research/cases";
import { CONCEPTS } from "@/lib/research/concepts";

const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");

describe("research dataset integrity", () => {
  it("47 unique businesses = 33 company-site + 14 directory", () => {
    expect(counts).toEqual({ total: 47, primary: 33, discovery: 14 });
    expect(prospectsFile.total_unique_businesses).toBe(47);
  });
  it("ids and names are unique", () => {
    expect(new Set(prospects.map((p) => p.id)).size).toBe(47);
    expect(new Set(prospects.map((p) => p.name)).size).toBe(47);
  });
  it("every primary record has a URL; no directory record has one", () => {
    prospects.forEach((p) => (p.primary ? expect(p.company_source_url).toMatch(/^https:\/\//) : expect(p.company_source_url).toBeNull()));
  });
  it("every record is NOT CONTACTED, UNKNOWN customer, unquantified, unverified financials", () => {
    prospects.forEach((p) => {
      expect(p.outreach_status).toBe("NOT CONTACTED");
      expect(p.customer_status).toBe("UNKNOWN");
      expect(p.actual_exposure_quantified).toBe(false);
      expect(p.financials_verified).toBe(false);
    });
  });
  it("no record claims a confirmed customer / contact", () => {
    const blob = JSON.stringify(prospectsFile).toLowerCase();
    expect(blob).not.toMatch(/customer confirmed|is a customer|not a customer|interviewed|we contacted/);
  });
  it("workbook factors × rubric weights reproduce every analyst_screen_score", () => {
    prospects.forEach((p) => expect(computeScore(p.factors), p.name).toBe(p.analyst_screen_score));
  });
  it("schema rejects a directory record with an invented URL", () => {
    const bad = structuredClone(prospectsFile);
    bad.prospects.find((p) => p.verification_tier === "business-directory-discovery")!.company_source_url = "https://example.com";
    expect(ProspectsFileSchema.safeParse(bad).success).toBe(false);
  });
  it("schema rejects count mismatch", () => {
    const bad = structuredClone(prospectsFile);
    bad.total_unique_businesses = 50;
    expect(ProspectsFileSchema.safeParse(bad).success).toBe(false);
  });
  it("two rain-or-shine negative controls exist", () => {
    expect(prospects.filter((p) => p.research_priority === "Tier 2: negative control").map((p) => p.name).sort()).toEqual(["Foods of NY Tours", "Like A Local Tours"]);
  });
  it("five dated Kalshi discovery records with no snapshot price", () => {
    expect(marketsFile.markets).toHaveLength(5);
    marketsFile.markets.forEach((m) => { expect(m.snapshot_price_usd).toBeNull(); expect(m.as_of).toBe("2026-11-06"); });
  });
  it("3 cases with the analyst dispositions; 3 unlisted market concepts", () => {
    expect(CASES.map((c) => c.disposition.split(":")[0])).toEqual(["HOLD", "QUALIFY", "PASS FOR NOW"]);
    expect(CONCEPTS).toHaveLength(3);
  });
});

describe("downloads are byte-identical to the supplied research", () => {
  const map: [string, string][] = [
    ["research/HedgeNYC_Executive_Research_Brief.pdf", "aa0c8fa16a1f709ba60de5fedaea110e6c12330225cd65d13fb525836ab92944"],
    ["research/HedgeNYC_Three_Owner_Education_Briefs.pdf", "6b7dda0735a1763794142940f2e8a5228579430d3e2e0079921b36c6646a33b7"],
    ["model/HedgeNYC_Formula_Driven_Hedging_Model.xlsx", "cf1703f5f0ee2dac37a329e50379d22737b8f47318eecdc051754ee467688be5"],
    ["research/prospects.csv", "99b5d4982b1aaa0a1f40f5a6d3052a6db8332c4c1ccb759e481ed5904d78867e"],
    ["research/prospects.json", "cfc54797836693117513fd7d4a87fc684a5867899552eec2313eebbccb452c2f"],
    ["research/markets.json", "4ddf4f28eb89afc8503742a97c252ea8f7f498519c14620753afaa0637179785"],
    ["research/sources.csv", "47b051534fb339d5673153b0209e211c393661e8dc7247d0825926260dff69c5"],
  ];
  for (const [src, hash] of map) {
    const dest = "public/downloads/" + src.split("/").pop();
    it(`${dest} exists and matches the SHA256 manifest`, () => {
      expect(existsSync(dest)).toBe(true);
      expect(sha(src)).toBe(hash);
      expect(sha(dest)).toBe(hash);
    });
  }
});

describe("Xentra presentation (analyst: no suitable hedge validated)", () => {
  it("Hedge Lab has no observed-ask mapping for Xentra or any diesel strike", () => {
    const src = readFileSync("src/components/simulator/Lab.tsx", "utf8");
    expect(src).not.toMatch(/xentra:\s*"KX/);
    expect(src).not.toContain("T6.18");
    expect(src).toContain("NO SUITABLE XENTRA HEDGE VALIDATED");
  });
  it("the diesel contract remains in the market research records as a dated discovery", () => {
    expect(marketsFile.markets.some((m) => m.id === "KXDIESELW-26NOV09-T6.18")).toBe(true);
  });
});
