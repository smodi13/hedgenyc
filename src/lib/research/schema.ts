import { z } from "zod";

export const ProspectSchema = z.object({
  id: z.string().regex(/^HNY-\d{3}$/),
  name: z.string().min(1),
  sector: z.string(),
  area: z.string(),
  verification_tier: z.enum(["company-primary-source", "business-directory-discovery"]),
  company_source_url: z.string().url().nullable(),
  publicly_documented_fact: z.string(),
  risk_hypothesis: z.string(),
  contract_fit_preliminary: z.string(),
  research_priority: z.string(),
  outreach_status: z.literal("NOT CONTACTED"),
  not_confirmed_to_be_kalshi_customer: z.boolean(),
  customer_status: z.literal("UNKNOWN"),
  actual_exposure_quantified: z.literal(false),
  financials_verified: z.literal(false),
  analyst_screen_score: z.number().min(0).max(100),
  scoring_note: z.string(),
  as_of: z.string(),
  next_diligence_step: z.string(),
}).superRefine((p, ctx) => {
  const primary = p.verification_tier === "company-primary-source";
  if (primary && !p.company_source_url) ctx.addIssue({ code: "custom", message: `${p.id}: primary record needs a company URL` });
  if (!primary && p.company_source_url) ctx.addIssue({ code: "custom", message: `${p.id}: directory record must not carry an invented URL` });
});

export const ProspectsFileSchema = z.object({
  as_of: z.string(),
  methodology: z.string(),
  total_unique_businesses: z.number(),
  primary_source_profiles: z.number(),
  discovery_only_profiles: z.number(),
  prospects: z.array(ProspectSchema),
}).superRefine((f, ctx) => {
  const ids = new Set(f.prospects.map((p) => p.id));
  const names = new Set(f.prospects.map((p) => p.name.toLowerCase()));
  const primary = f.prospects.filter((p) => p.verification_tier === "company-primary-source").length;
  if (ids.size !== f.prospects.length) ctx.addIssue({ code: "custom", message: "duplicate id" });
  if (names.size !== f.prospects.length) ctx.addIssue({ code: "custom", message: "duplicate name" });
  if (f.prospects.length !== f.total_unique_businesses) ctx.addIssue({ code: "custom", message: "total mismatch" });
  if (primary !== f.primary_source_profiles || f.prospects.length - primary !== f.discovery_only_profiles)
    ctx.addIssue({ code: "custom", message: "tier counts do not sum to total" });
});

export const MarketRecordSchema = z.object({
  id: z.string(),
  market_family: z.string(),
  event: z.string(),
  source_url: z.string().url(),
  settlement_proxy: z.string(),
  candidate_use: z.string(),
  basis_mismatch: z.string(),
  status: z.string(),
  snapshot_price_usd: z.null(),
  as_of: z.string(),
});

export const MarketsFileSchema = z.object({
  as_of: z.string(),
  warning: z.string(),
  official_public_api: z.string().url(),
  official_api_docs: z.string().url(),
  orderbook_docs: z.string().url(),
  fee_schedule: z.string().url(),
  markets: z.array(MarketRecordSchema),
});

export type Prospect = z.infer<typeof ProspectSchema>;
export type MarketRecord = z.infer<typeof MarketRecordSchema>;
