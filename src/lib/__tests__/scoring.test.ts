import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateExperienceBand, needsInterviewProbe, confidenceFromQualities } from "../rubric";
import { combineScores } from "../scoring";
import type { CalibrationMatchResult, CriterionScoreResult } from "../types";
import type { CalibrationPatternRow } from "../calibration";

// ---------------------------------------------------------------------------
// PM experience band (rubric Part 4 / Part 18)
// ---------------------------------------------------------------------------

test("PM experience band: 0 years -> ineligible", () => {
  const e = evaluateExperienceBand("PM", 0, null, false, "NO_EVIDENCE");
  assert.equal(e.eligible, false);
  assert.equal(e.experienceCriterionCap, 0);
});

test("PM experience band: 1 year, thin evidence -> eligible, capped at 1, early-tenure", () => {
  const e = evaluateExperienceBand("PM", 1, null, false, "MEDIUM");
  assert.equal(e.eligible, true);
  assert.equal(e.experienceCriterionCap, 1);
  assert.ok(e.flags.includes("early_tenure"));
});

test("PM experience band: 1 year, HIGH-quality scope evidence -> cap lifted to 2", () => {
  const e = evaluateExperienceBand("PM", 1, null, false, "HIGH");
  assert.equal(e.experienceCriterionCap, 2);
});

test("PM experience band: 2 years -> target band, no cap", () => {
  const e = evaluateExperienceBand("PM", 2, null, false, "MEDIUM");
  assert.equal(e.eligible, true);
  assert.equal(e.experienceCriterionCap, null);
  assert.deepEqual(e.flags, []);
});

test("PM experience band: 3 years -> target band, no cap", () => {
  const e = evaluateExperienceBand("PM", 3, null, false, "MEDIUM");
  assert.equal(e.experienceCriterionCap, null);
});

test("PM experience band: 4 years -> target band, no cap", () => {
  const e = evaluateExperienceBand("PM", 4, null, false, "MEDIUM");
  assert.equal(e.experienceCriterionCap, null);
});

test("PM experience band: 5+ years -> eligible, capped, consider-SPM flag", () => {
  const e = evaluateExperienceBand("PM", 6, null, false, "HIGH");
  assert.equal(e.eligible, true);
  assert.equal(e.experienceCriterionCap, 1);
  assert.ok(e.flags.includes("consider_spm_track"));
});

// ---------------------------------------------------------------------------
// SPM experience band (rubric Part 5 / Part 18)
// ---------------------------------------------------------------------------

test("SPM experience band: 0-3 years -> ineligible", () => {
  for (const y of [0, 1, 2, 3]) {
    const e = evaluateExperienceBand("SPM", y, null, false, "NO_EVIDENCE");
    assert.equal(e.eligible, false, `years=${y}`);
  }
});

test("SPM experience band: 4 years, typical evidence -> eligible, capped, early-for-SPM", () => {
  const e = evaluateExperienceBand("SPM", 4, null, false, "MEDIUM");
  assert.equal(e.eligible, true);
  assert.equal(e.experienceCriterionCap, 1);
  assert.ok(e.flags.includes("early_for_spm"));
});

test("SPM experience band: 4 years, exceptionally strong evidence -> cap lifted", () => {
  const e = evaluateExperienceBand("SPM", 4, null, false, "HIGH");
  assert.equal(e.experienceCriterionCap, null);
});

test("SPM experience band: 5,6,7,8 years -> target band, no cap", () => {
  for (const y of [5, 6, 7, 8]) {
    const e = evaluateExperienceBand("SPM", y, null, false, "MEDIUM");
    assert.equal(e.experienceCriterionCap, null, `years=${y}`);
    assert.deepEqual(e.flags, [], `years=${y}`);
  }
});

test("SPM experience band: 8+ years with growing scope -> eligible, not capped", () => {
  const e = evaluateExperienceBand("SPM", 10, true, false, "HIGH");
  assert.equal(e.experienceCriterionCap, null);
  assert.ok(e.flags.includes("above_band_growing_scope"));
});

test("SPM experience band: 8+ years without growing scope -> capped, stagnation flag", () => {
  const e = evaluateExperienceBand("SPM", 10, false, false, "HIGH");
  assert.equal(e.experienceCriterionCap, 1);
  assert.ok(e.flags.includes("above_band_capped"));
});

test("Ambiguous dates -> needs_more_evidence, never guessed", () => {
  const e = evaluateExperienceBand("PM", null, null, true, "NO_EVIDENCE");
  assert.equal(e.eligible, "needs_more_evidence");
  assert.ok(e.flags.includes("needs_more_evidence_dates"));
});

// ---------------------------------------------------------------------------
// Leadership: title alone vs. actual evidence (rubric Part 6)
// ---------------------------------------------------------------------------

function scoreFor(key: string, score: 0 | 1 | 2, quality: "HIGH" | "MEDIUM" | "LOW" | "NO_EVIDENCE"): CriterionScoreResult {
  return { criterionKey: key, score, evidenceQuote: quality === "NO_EVIDENCE" ? null : "quote", evidenceQuality: quality, rationale: "r" };
}

function baseSpmScores(overrides: Record<string, CriterionScoreResult> = {}): CriterionScoreResult[] {
  const keys = [
    "relevant_pm_experience",
    "independent_product_ownership",
    "platform_integration_experience",
    "technical_product_judgment",
    "ambiguity_decision_making",
    "leadership",
    "team_project_leadership",
    "build_from_scratch_early_stage",
    "logistics_supply_chain_ops",
    "first_principles_thinking",
    "software_technical_fluency",
  ];
  return keys.map((k) => overrides[k] ?? scoreFor(k, 1, "MEDIUM"));
}

test("SPM Leadership: title alone (no behavior) scores 0, NO_EVIDENCE -> mandatory probe", () => {
  const scores = baseSpmScores({ leadership: scoreFor("leadership", 0, "NO_EVIDENCE") });
  const result = combineScores({
    role: "SPM",
    years: 6,
    datesAmbiguous: false,
    recentScopeGrowing: null,
    aiScores: scores,
    calibrationMatches: [],
    calibrationPatterns: [],
  });
  const leadership = result.criterionScores.find((c) => c.key === "leadership")!;
  assert.equal(leadership.score, 0);
  assert.ok(result.gapCriteria.some((g) => g.key === "leadership"));
});

test("SPM Leadership: real behavior described scores 2, HIGH -> no probe needed", () => {
  const scores = baseSpmScores({ leadership: scoreFor("leadership", 2, "HIGH") });
  const result = combineScores({
    role: "SPM",
    years: 6,
    datesAmbiguous: false,
    recentScopeGrowing: null,
    aiScores: scores,
    calibrationMatches: [],
    calibrationPatterns: [],
  });
  const leadership = result.criterionScores.find((c) => c.key === "leadership")!;
  assert.equal(leadership.score, 2);
  assert.ok(!result.gapCriteria.some((g) => g.key === "leadership"));
});

// ---------------------------------------------------------------------------
// First-principles: generic statement vs. specific evidence (rubric Part 7)
// ---------------------------------------------------------------------------

test("First-principles: generic/thin signal capped at 1 even if AI scored it 2", () => {
  const scores = baseSpmScores({
    first_principles_thinking: scoreFor("first_principles_thinking", 2, "LOW"),
  });
  const result = combineScores({
    role: "SPM",
    years: 6,
    datesAmbiguous: false,
    recentScopeGrowing: null,
    aiScores: scores,
    calibrationMatches: [],
    calibrationPatterns: [],
  });
  const fp = result.criterionScores.find((c) => c.key === "first_principles_thinking")!;
  assert.equal(fp.score, 1);
  assert.ok(fp.capNote?.includes("first-principles"));
});

test("First-principles: specific root-cause evidence, HIGH quality -> allowed to score 2", () => {
  const scores = baseSpmScores({
    first_principles_thinking: scoreFor("first_principles_thinking", 2, "HIGH"),
  });
  const result = combineScores({
    role: "SPM",
    years: 6,
    datesAmbiguous: false,
    recentScopeGrowing: null,
    aiScores: scores,
    calibrationMatches: [],
    calibrationPatterns: [],
  });
  const fp = result.criterionScores.find((c) => c.key === "first_principles_thinking")!;
  assert.equal(fp.score, 2);
  assert.equal(fp.capNote, null);
});

// ---------------------------------------------------------------------------
// Missing evidence / evidence quality (rubric Part 2, Part 10)
// ---------------------------------------------------------------------------

test("Missing evidence: NO_EVIDENCE criteria are listed, never silently dropped", () => {
  const scores = baseSpmScores({
    logistics_supply_chain_ops: scoreFor("logistics_supply_chain_ops", 0, "NO_EVIDENCE"),
  });
  const result = combineScores({
    role: "SPM",
    years: 6,
    datesAmbiguous: false,
    recentScopeGrowing: null,
    aiScores: scores,
    calibrationMatches: [],
    calibrationPatterns: [],
  });
  assert.ok(result.missingEvidence.includes("Logistics / Supply Chain / Ops"));
});

// ---------------------------------------------------------------------------
// Calibration present / absent, and the pattern-2-depends-on-pattern-1 rule
// (rubric Part 8 — exactly this dependency, no third pattern, sums to 10)
// ---------------------------------------------------------------------------

const PATTERNS: CalibrationPatternRow[] = [
  {
    id: "p1",
    key: "ground_level_ops_exposure",
    name: "Ground-Level Logistics / Operations Exposure",
    description: "d",
    evidence_signal: "s",
    points: 6,
    requires_pattern_key: null,
    source_note: "n",
    active: true,
  },
  {
    id: "p2",
    key: "unprompted_build_adopted",
    name: "Unprompted Build, Adopted Beyond Role",
    description: "d",
    evidence_signal: "s",
    points: 4,
    requires_pattern_key: "ground_level_ops_exposure",
    source_note: "n",
    active: true,
  },
];

function calMatch(key: string, matched: boolean, quality: "HIGH" | "MEDIUM" | "LOW" | "NO_EVIDENCE"): CalibrationMatchResult {
  return { patternKey: key, matched, evidenceQuality: quality, evidenceQuote: matched ? "q" : null, rationale: "r" };
}

test("Calibration absent (no patterns configured) -> calibrationScore 0, available=false", () => {
  const scores = baseSpmScores();
  const result = combineScores({
    role: "SPM",
    years: 6,
    datesAmbiguous: false,
    recentScopeGrowing: null,
    aiScores: scores,
    calibrationMatches: [],
    calibrationPatterns: [],
  });
  assert.equal(result.calibrationScore, 0);
  assert.equal(result.calibrationAvailable, false);
});

test("Calibration: pattern 1 HIGH quality -> full 6 points; pattern 2 matched + prereq>0 -> full 4 points; total 10", () => {
  const result = combineScores({
    role: "SPM",
    years: 6,
    datesAmbiguous: false,
    recentScopeGrowing: null,
    aiScores: baseSpmScores(),
    calibrationMatches: [
      calMatch("ground_level_ops_exposure", true, "HIGH"),
      calMatch("unprompted_build_adopted", true, "MEDIUM"),
    ],
    calibrationPatterns: PATTERNS,
  });
  assert.equal(result.calibrationScore, 10);
});

test("Calibration: pattern 1 LOW quality -> half points (3); pattern 2 still unlocked since prereq>0", () => {
  const result = combineScores({
    role: "SPM",
    years: 6,
    datesAmbiguous: false,
    recentScopeGrowing: null,
    aiScores: baseSpmScores(),
    calibrationMatches: [
      calMatch("ground_level_ops_exposure", true, "LOW"),
      calMatch("unprompted_build_adopted", true, "HIGH"),
    ],
    calibrationPatterns: PATTERNS,
  });
  assert.equal(result.calibrationScore, 3 + 4);
});

test("Calibration: pattern 2 matched but pattern 1 NOT matched -> pattern 2 earns 0 (never standalone)", () => {
  const result = combineScores({
    role: "SPM",
    years: 6,
    datesAmbiguous: false,
    recentScopeGrowing: null,
    aiScores: baseSpmScores(),
    calibrationMatches: [
      calMatch("ground_level_ops_exposure", false, "NO_EVIDENCE"),
      calMatch("unprompted_build_adopted", true, "HIGH"),
    ],
    calibrationPatterns: PATTERNS,
  });
  assert.equal(result.calibrationScore, 0);
  const p2 = result.calibration.find((c) => c.key === "unprompted_build_adopted")!;
  assert.equal(p2.pointsAwarded, 0);
  assert.equal(p2.dependsOnUnmet, true);
});

// ---------------------------------------------------------------------------
// Weighted math correctness
// ---------------------------------------------------------------------------

test("Weighted scores are mathematically correct: all-2s = full 90 criteria weight", () => {
  const scores = baseSpmScores({
    relevant_pm_experience: scoreFor("relevant_pm_experience", 2, "HIGH"),
    independent_product_ownership: scoreFor("independent_product_ownership", 2, "HIGH"),
    platform_integration_experience: scoreFor("platform_integration_experience", 2, "HIGH"),
    technical_product_judgment: scoreFor("technical_product_judgment", 2, "HIGH"),
    ambiguity_decision_making: scoreFor("ambiguity_decision_making", 2, "HIGH"),
    leadership: scoreFor("leadership", 2, "HIGH"),
    team_project_leadership: scoreFor("team_project_leadership", 2, "HIGH"),
    build_from_scratch_early_stage: scoreFor("build_from_scratch_early_stage", 2, "HIGH"),
    logistics_supply_chain_ops: scoreFor("logistics_supply_chain_ops", 2, "HIGH"),
    first_principles_thinking: scoreFor("first_principles_thinking", 2, "HIGH"),
    software_technical_fluency: scoreFor("software_technical_fluency", 2, "HIGH"),
  });
  const result = combineScores({
    role: "SPM",
    years: 6, // target band, no cap
    datesAmbiguous: false,
    recentScopeGrowing: null,
    aiScores: scores,
    calibrationMatches: [],
    calibrationPatterns: [],
  });
  assert.equal(result.criteriaWeightedTotal, 90);
  assert.equal(result.overallScore, 90);
});

test("Weighted scores: all-0s = 0 criteria weight, ineligible drives overall down", () => {
  const scores = baseSpmScores({
    relevant_pm_experience: scoreFor("relevant_pm_experience", 0, "NO_EVIDENCE"),
  }).map((s) => ({ ...s, score: 0 as const, evidenceQuality: "NO_EVIDENCE" as const }));
  const result = combineScores({
    role: "SPM",
    years: 1, // below SPM band -> ineligible
    datesAmbiguous: false,
    recentScopeGrowing: null,
    aiScores: scores,
    calibrationMatches: [],
    calibrationPatterns: [],
  });
  assert.equal(result.criteriaWeightedTotal, 0);
  assert.equal(result.overallScore, 0);
  assert.equal(result.eligibility, "ineligible");
});

// ---------------------------------------------------------------------------
// Confidence + interview-probe helper functions
// ---------------------------------------------------------------------------

test("confidenceFromQualities returns the worst quality in the set", () => {
  assert.equal(confidenceFromQualities(["HIGH", "MEDIUM", "LOW"]), "LOW");
  assert.equal(confidenceFromQualities(["HIGH", "HIGH"]), "HIGH");
  assert.equal(confidenceFromQualities(["NO_EVIDENCE"]), "NO_EVIDENCE");
});

test("needsInterviewProbe: weight>=6 + thin evidence triggers; low-weight criteria only trigger when alwaysProbe", () => {
  assert.equal(needsInterviewProbe(7, "LOW", false), true);
  assert.equal(needsInterviewProbe(3, "LOW", false), false);
  assert.equal(needsInterviewProbe(3, "LOW", true), true); // e.g. PM Ability to Work Under Pressure (weight 4)
  assert.equal(needsInterviewProbe(9, "HIGH", false), false);
});
