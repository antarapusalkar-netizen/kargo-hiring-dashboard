import {
  confidenceFromQualities,
  criteriaForRole,
  evaluateExperienceBand,
  needsInterviewProbe,
  topWeightedCriteria,
  type EvidenceQuality,
  type Role,
} from "./rubric";
import type { CalibrationMatchResult, CriterionScoreResult } from "./types";
import type { CalibrationPatternRow } from "./calibration";

export interface AdjustedCriterionScore {
  key: string;
  label: string;
  weight: number;
  score: 0 | 1 | 2;
  rawAiScore: 0 | 1 | 2;
  evidenceQuote: string | null;
  evidenceQuality: EvidenceQuality;
  rationale: string;
  capNote: string | null;
}

export interface CombinedScoreResult {
  criterionScores: AdjustedCriterionScore[];
  criteriaWeightedTotal: number; // out of 85
  calibrationScore: number; // out of 15
  calibrationAvailable: boolean;
  overallScore: number; // out of 100
  eligibility: "eligible" | "ineligible";
  experienceFlags: string[];
  experienceNote: string;
  confidence: EvidenceQuality;
  gapCriteria: { key: string; label: string; weight: number }[];
}

export function combineScores(params: {
  role: Role;
  years: number;
  recentScopeGrowing: boolean | null;
  aiScores: CriterionScoreResult[];
  calibrationMatches: CalibrationMatchResult[];
  calibrationPatterns: CalibrationPatternRow[];
}): CombinedScoreResult {
  const { role, years, recentScopeGrowing, aiScores, calibrationMatches, calibrationPatterns } =
    params;
  const criteria = criteriaForRole(role);
  const experience = evaluateExperienceBand(role, years, recentScopeGrowing);

  const byKey = new Map(aiScores.map((s) => [s.criterionKey, s]));

  const adjusted: AdjustedCriterionScore[] = criteria.map((c) => {
    const raw = byKey.get(c.key);
    const rawScore = (raw?.score ?? 0) as 0 | 1 | 2;
    let score = rawScore;
    let capNote: string | null = null;

    if (c.key === "relevant_pm_experience" && experience.experienceCriterionCap !== null) {
      const cap = experience.experienceCriterionCap;
      if (rawScore > cap) {
        score = cap;
        capNote = `Capped at ${cap} — ${experience.note}`;
      }
    }

    // First-Principles override rule: insufficient evidence -> cap at 1.
    if (
      c.key === "first_principles_thinking" &&
      raw &&
      (raw.evidenceQuality === "LOW" || raw.evidenceQuality === "NO_EVIDENCE") &&
      score > 1
    ) {
      score = 1;
      capNote = capNote
        ? `${capNote}; capped at 1 (insufficient first-principles evidence)`
        : "Capped at 1 (insufficient first-principles evidence per rubric override rule)";
    }

    return {
      key: c.key,
      label: c.label,
      weight: c.weight,
      score,
      rawAiScore: rawScore,
      evidenceQuote: raw?.evidenceQuote ?? null,
      evidenceQuality: raw?.evidenceQuality ?? "NO_EVIDENCE",
      rationale: raw?.rationale ?? "No evidence found.",
      capNote,
    };
  });

  const criteriaWeightedTotal = adjusted.reduce(
    (sum, c) => sum + c.weight * (c.score / 2),
    0
  );

  const calibrationAvailable = calibrationPatterns.length > 0;
  const matchByKey = new Map(calibrationMatches.map((m) => [m.patternKey, m]));
  const calibrationScore = calibrationAvailable
    ? calibrationPatterns.reduce((sum, p) => {
        const m = matchByKey.get(p.key);
        return sum + (m?.matched ? p.points : 0);
      }, 0)
    : 0;

  const eligibility: "eligible" | "ineligible" = experience.eligible
    ? "eligible"
    : "ineligible";

  const overallScore = eligibility === "ineligible"
    ? Math.round(criteriaWeightedTotal + calibrationScore)
    : Math.round(criteriaWeightedTotal + calibrationScore);

  const top3 = topWeightedCriteria(role);
  const top3Qualities = top3.map(
    (c) => adjusted.find((a) => a.key === c.key)?.evidenceQuality ?? "NO_EVIDENCE"
  );
  const confidence = confidenceFromQualities(top3Qualities);

  const gapCriteria = adjusted
    .filter((c) => needsInterviewProbe(c.weight, c.evidenceQuality))
    .map((c) => ({ key: c.key, label: c.label, weight: c.weight }));

  return {
    criterionScores: adjusted,
    criteriaWeightedTotal: Math.round(criteriaWeightedTotal * 10) / 10,
    calibrationScore,
    calibrationAvailable,
    overallScore,
    eligibility,
    experienceFlags: experience.flags,
    experienceNote: experience.note,
    confidence,
    gapCriteria,
  };
}
