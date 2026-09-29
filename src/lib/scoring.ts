import {
  confidenceFromQualities,
  criteriaForRole,
  evaluateExperienceBand,
  needsInterviewProbe,
  topWeightedCriteria,
  type EvidenceQuality,
  type Role,
} from "./rubric";
import type {
  CalibrationMatchResult,
  CriterionScoreResult,
  Eligibility,
  Recommendation,
} from "./types";
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

export interface CalibrationLineItem {
  key: string;
  name: string;
  maxPoints: number;
  pointsAwarded: number;
  matched: boolean;
  evidenceQuality: EvidenceQuality | null;
  evidenceQuote: string | null;
  rationale: string | null;
  /** True if this pattern matched but scored 0 because its prerequisite pattern didn't. */
  dependsOnUnmet: boolean;
}

export interface CombinedScoreResult {
  criterionScores: AdjustedCriterionScore[];
  criteriaWeightedTotal: number; // out of 90
  calibration: CalibrationLineItem[];
  calibrationScore: number; // out of 10
  calibrationAvailable: boolean;
  overallScore: number; // out of 100
  eligibility: Eligibility;
  experienceFlags: string[];
  experienceNote: string;
  confidence: EvidenceQuality;
  recommendation: Recommendation;
  gapCriteria: { key: string; label: string; weight: number }[];
  missingEvidence: string[];
}

/**
 * Rubric Part 8 scoring method:
 *  - Pattern with no prerequisite (Pattern 1 / ground-level ops exposure):
 *    HIGH or MEDIUM evidence quality -> full points; LOW -> half points
 *    (rounded); no match / NO_EVIDENCE -> 0.
 *  - Pattern with a prerequisite (Pattern 2 / unprompted build): full points
 *    ONLY if matched AND the prerequisite pattern scored above 0 for this
 *    candidate. Otherwise 0 — it is a reinforcing signal, never standalone.
 */
function scoreCalibrationPatterns(
  patterns: CalibrationPatternRow[],
  matches: CalibrationMatchResult[]
): CalibrationLineItem[] {
  const matchByKey = new Map(matches.map((m) => [m.patternKey, m]));
  const pointsByKey = new Map<string, number>();

  // First pass: score patterns with no prerequisite.
  const ordered = [...patterns].sort((a, b) =>
    a.requires_pattern_key ? 1 : b.requires_pattern_key ? -1 : 0
  );

  const items: CalibrationLineItem[] = [];
  for (const p of ordered) {
    const m = matchByKey.get(p.key);
    const matched = !!m?.matched;
    const quality = m?.evidenceQuality ?? "NO_EVIDENCE";

    let points = 0;
    let dependsOnUnmet = false;

    if (matched) {
      if (p.requires_pattern_key) {
        const prereqPoints = pointsByKey.get(p.requires_pattern_key) ?? 0;
        if (prereqPoints > 0) {
          points = p.points;
        } else {
          dependsOnUnmet = true;
        }
      } else if (quality === "HIGH" || quality === "MEDIUM") {
        points = p.points;
      } else if (quality === "LOW") {
        points = Math.round(p.points / 2);
      }
    }

    pointsByKey.set(p.key, points);
    items.push({
      key: p.key,
      name: p.name,
      maxPoints: p.points,
      pointsAwarded: points,
      matched,
      evidenceQuality: m?.evidenceQuality ?? null,
      evidenceQuote: m?.evidenceQuote ?? null,
      rationale: m?.rationale ?? "Not observed.",
      dependsOnUnmet,
    });
  }

  // Restore rubric-declared order (points desc) rather than the dependency-sort order used above.
  const byKey = new Map(items.map((i) => [i.key, i]));
  return patterns.map((p) => byKey.get(p.key)!).filter(Boolean);
}

export function combineScores(params: {
  role: Role;
  years: number | null;
  datesAmbiguous: boolean;
  recentScopeGrowing: boolean | null;
  aiScores: CriterionScoreResult[];
  calibrationMatches: CalibrationMatchResult[];
  calibrationPatterns: CalibrationPatternRow[];
}): CombinedScoreResult {
  const {
    role,
    years,
    datesAmbiguous,
    recentScopeGrowing,
    aiScores,
    calibrationMatches,
    calibrationPatterns,
  } = params;
  const criteria = criteriaForRole(role);
  const byKey = new Map(aiScores.map((s) => [s.criterionKey, s]));

  const experienceRaw = byKey.get("relevant_pm_experience");
  const experience = evaluateExperienceBand(
    role,
    years,
    recentScopeGrowing,
    datesAmbiguous,
    experienceRaw?.evidenceQuality ?? "NO_EVIDENCE"
  );

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

    // First-Principles override rule: insufficient evidence -> cap at 1 (Part 7).
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
      rationale: raw?.rationale ?? "No evidence found in resume.",
      capNote,
    };
  });

  const criteriaWeightedTotal = adjusted.reduce(
    (sum, c) => sum + c.weight * (c.score / 2),
    0
  );

  const calibrationAvailable = calibrationPatterns.length > 0;
  const calibration = calibrationAvailable
    ? scoreCalibrationPatterns(calibrationPatterns, calibrationMatches)
    : [];
  const calibrationScore = calibration.reduce((sum, c) => sum + c.pointsAwarded, 0);

  const eligibility: Eligibility =
    experience.eligible === "needs_more_evidence"
      ? "needs_more_evidence"
      : experience.eligible
        ? "eligible"
        : "ineligible";

  const overallScore = Math.round(criteriaWeightedTotal + calibrationScore);

  const top3 = topWeightedCriteria(role);
  const top3Qualities = top3.map(
    (c) => adjusted.find((a) => a.key === c.key)?.evidenceQuality ?? "NO_EVIDENCE"
  );
  const confidence = confidenceFromQualities(top3Qualities);

  const gapCriteria = adjusted
    .filter((c) => {
      const criterion = criteria.find((cr) => cr.key === c.key);
      return needsInterviewProbe(c.weight, c.evidenceQuality, criterion?.alwaysProbe);
    })
    .map((c) => ({ key: c.key, label: c.label, weight: c.weight }));

  const missingEvidence = adjusted
    .filter((c) => c.evidenceQuality === "NO_EVIDENCE")
    .map((c) => c.label);

  const recommendation = deriveRecommendation({
    eligibility,
    confidence,
    criteriaWeightedTotal,
  });

  return {
    criterionScores: adjusted,
    criteriaWeightedTotal: Math.round(criteriaWeightedTotal * 10) / 10,
    calibration,
    calibrationScore,
    calibrationAvailable,
    overallScore,
    eligibility,
    experienceFlags: experience.flags,
    experienceNote: experience.note,
    confidence,
    recommendation,
    gapCriteria,
    missingEvidence,
  };
}

/**
 * Rubric Part 14 — exactly three states, computed deterministically (never
 * left to the model to self-assess, so it can't sound more certain than the
 * evidence supports).
 *   - NEEDS MORE EVIDENCE: hard gate ambiguous (missing dates), or confidence
 *     is LOW.
 *   - DOES NOT CURRENTLY MEET ROLE REQUIREMENTS: ineligible, or eligible with
 *     a low score across most weighted criteria (<45/90, i.e. under half).
 *   - RECOMMENDED FOR HUMAN REVIEW: eligible, confidence >= MEDIUM, and score
 *     is reasonable-to-strong.
 */
function deriveRecommendation(params: {
  eligibility: Eligibility;
  confidence: EvidenceQuality;
  criteriaWeightedTotal: number;
}): Recommendation {
  const { eligibility, confidence, criteriaWeightedTotal } = params;

  if (eligibility === "needs_more_evidence") return "NEEDS MORE EVIDENCE";
  if (eligibility === "ineligible") return "DOES NOT CURRENTLY MEET ROLE REQUIREMENTS";
  if (confidence === "LOW") return "NEEDS MORE EVIDENCE";
  if (criteriaWeightedTotal < 45) return "DOES NOT CURRENTLY MEET ROLE REQUIREMENTS";
  return "RECOMMENDED FOR HUMAN REVIEW";
}
