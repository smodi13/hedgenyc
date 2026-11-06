import prospectsRaw from "../../../research/prospects.json";
import marketsRaw from "../../../research/markets.json";
import factors from "../../data/score-factors.json";
import { MarketsFileSchema, ProspectsFileSchema, type Prospect } from "./schema";

/** Throws at build time if the supplied research files violate the integrity contract. */
export const prospectsFile = ProspectsFileSchema.parse(prospectsRaw);
export const marketsFile = MarketsFileSchema.parse(marketsRaw);

export interface ScoreFactors { risk: number; observability: number; fit: number; pilot: number }
export const SCORE_WEIGHTS = factors.weights;

export const isPrimary = (p: Prospect) => p.verification_tier === "company-primary-source";

export interface ProspectView extends Prospect {
  primary: boolean;
  factors: ScoreFactors;
  /** Recomputed from workbook factors × rubric weights — must equal analyst_screen_score */
  computedScore: number;
}

const rows = factors.rows as Record<string, ScoreFactors>;
export const computeScore = (f: ScoreFactors) =>
  Math.round((f.risk * SCORE_WEIGHTS.risk + f.observability * SCORE_WEIGHTS.observability + f.fit * SCORE_WEIGHTS.fit + f.pilot * SCORE_WEIGHTS.pilot) * 20);

export const prospects: ProspectView[] = prospectsFile.prospects.map((p) => {
  const f = rows[p.name];
  if (!f) throw new Error(`No score factors for ${p.name}`);
  return { ...p, primary: isPrimary(p), factors: f, computedScore: computeScore(f) };
});

export const counts = {
  total: prospects.length,
  primary: prospects.filter((p) => p.primary).length,
  discovery: prospects.filter((p) => !p.primary).length,
};
