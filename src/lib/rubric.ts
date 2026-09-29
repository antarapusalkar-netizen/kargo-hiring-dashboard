// Kargo Candidate Scoring Rubric — transcribed verbatim from
// KARGO_HIRING_RUBRIC.txt (Parts 3-9). This file is the single source of
// truth for weights, bands, and override rules. Do not adjust criteria,
// weights, or bands without updating that source document first — if code
// and the rubric text ever disagree, the rubric text wins.

export type Role = "PM" | "SPM";

export type EvidenceQuality = "HIGH" | "MEDIUM" | "LOW" | "NO_EVIDENCE";

export interface RubricCriterion {
  key: string;
  label: string;
  weight: number;
  strongDescription: string;
  /** First-Principles / Leadership etc. carry extra override rules. */
  overrideRule?: string;
  /** Part 12: always generate an interview probe when evidence is LOW/NO_EVIDENCE, regardless of weight. */
  alwaysProbe?: boolean;
}

// Calibration is worth 10/100 for both roles (rubric Part 8). Criteria below
// sum to 90 for each role; +10 calibration = 100.
export const CALIBRATION_WEIGHT = 10;
export const CRITERIA_TOTAL = 90; // + 10 calibration = 100

export const PM_CRITERIA: RubricCriterion[] = [
  {
    key: "relevant_pm_experience",
    label: "Relevant PM Experience",
    weight: 15,
    strongDescription:
      "In the 2-4y band, with genuine scope (not pure support/coordination work), OR 1 year with unusually deep, HIGH-quality scope evidence.",
  },
  {
    key: "product_ownership",
    label: "Product Ownership",
    weight: 12,
    strongDescription:
      "Explicitly named ownership of a module/product area, with scope and priority decisions attributed to the candidate.",
  },
  {
    key: "product_execution_shipping",
    label: "Product Execution / Shipping",
    weight: 12,
    strongDescription:
      "Named features shipped with quantified outcomes (adoption %, revenue, retention, tickets reduced).",
  },
  {
    key: "customer_user_understanding",
    label: "Customer / User Understanding",
    weight: 10,
    strongDescription:
      "Described discovery activity (interviews, ticket analysis, direct time with users) explicitly tied to a product decision.",
  },
  {
    key: "working_in_ambiguity",
    label: "Working in Ambiguity",
    weight: 10,
    strongDescription:
      "Describes creating a first-of-its-kind process, template, or decision with no prior structure to lean on.",
  },
  {
    key: "first_principles_thinking",
    label: "First-Principles Thinking",
    weight: 10,
    strongDescription:
      'A specific instance of breaking a problem into components, challenging an assumption, or identifying a root cause. "Worked at a startup", "strategic thinker", "problem solver" are NEVER sufficient by themselves.',
    overrideRule:
      "If evidence is insufficient (generic/thin signal only): score capped at 1, evidence quality LOW/NO_EVIDENCE, mandatory interview probe — regardless of how strong the candidate otherwise reads.",
    alwaysProbe: true,
  },
  {
    key: "software_tool_fluency",
    label: "Software / Product Tool Fluency",
    weight: 7,
    strongDescription:
      "Named analytics/product tools tied to an actual decision, or direct described collaboration with engineering on specs.",
  },
  {
    key: "accountability",
    label: "Accountability",
    weight: 7,
    strongDescription:
      "A named outcome (positive or negative) explicitly tied to the candidate's own decision, including evidence of correcting course.",
    alwaysProbe: true,
  },
  {
    key: "ability_under_pressure",
    label: "Ability to Work Under Pressure",
    weight: 4,
    strongDescription:
      "A specific incident/deadline/volume spike named with the candidate's own action and resolution described.",
    alwaysProbe: true,
  },
  {
    key: "ability_under_lead",
    label: "Ability to Work Under a Lead",
    weight: 3,
    strongDescription:
      "Explicit evidence of reporting into and acting on direction from a lead/founder/manager (e.g. regular alignment, agreed roadmap).",
  },
];

export const SPM_CRITERIA: RubricCriterion[] = [
  {
    key: "relevant_pm_experience",
    label: "Relevant PM Experience",
    weight: 14,
    strongDescription:
      "5-8 years with described ownership of increasing scope, or 8+ years with clear evidence of continued scope growth in recent years.",
  },
  {
    key: "independent_product_ownership",
    label: "Independent Product Ownership",
    weight: 11,
    strongDescription:
      "Explicitly the most senior/sole PM on a product area, with decisions attributed directly to the candidate — no senior PM layer above making the actual calls.",
  },
  {
    key: "platform_integration_experience",
    label: "Platform / Integration Experience",
    weight: 7,
    strongDescription:
      "Described ownership of an integration/API/data-layer product decision (not just implementation).",
  },
  {
    key: "technical_product_judgment",
    label: "Technical Product Judgment",
    weight: 9,
    strongDescription:
      "A specific build-vs-configure(-vs-avoid) decision described, with the reasoning behind it.",
  },
  {
    key: "ambiguity_decision_making",
    label: "Ambiguity / Decision-Making",
    weight: 9,
    strongDescription:
      "A specific high-stakes call described, with the outcome (positive or negative) and no mention of committee sign-off.",
  },
  {
    key: "leadership",
    label: "Leadership",
    weight: 9,
    strongDescription:
      'Explicit evidence of leading a team, a cross-functional group, or a major multi-team initiative, with described decisions and outcomes. A "Senior/Lead/Manager/Head" title is NEVER sufficient by itself.',
    overrideRule:
      'Title alone (Senior Product Manager, Lead PM, Head of Product, Manager) is never sufficient evidence. Requires actual described behavior: managed/led a team, led a cross-functional team, led engineers/designers/analysts on an initiative, owned a major initiative end-to-end, led a multi-team program.',
    alwaysProbe: true,
  },
  {
    key: "team_project_leadership",
    label: "Team / Project Leadership",
    weight: 7,
    strongDescription:
      "A specific project or initiative led end-to-end, spanning more than one function/team (same evidence bar as Leadership, scored against a named project).",
  },
  {
    key: "build_from_scratch_early_stage",
    label: "Build-from-Scratch / Early-Stage",
    weight: 6,
    strongDescription:
      "Explicit early-stage tenure with a described from-scratch build (a process, a team, a first-of-its-kind artifact).",
  },
  {
    key: "logistics_supply_chain_ops",
    label: "Logistics / Supply Chain / Ops",
    weight: 5,
    strongDescription:
      "Direct hands-on freight/logistics/customs/ports operational role — a genuine advantage per the JD, not a hard requirement.",
  },
  {
    key: "first_principles_thinking",
    label: "First-Principles Thinking",
    weight: 7,
    strongDescription:
      "Same bar as the PM rubric — a specific instance of breaking a problem down or challenging an assumption.",
    overrideRule:
      "If evidence is insufficient: score capped at 1, evidence quality LOW/NO_EVIDENCE, mandatory interview probe — identical rule to the PM rubric.",
    alwaysProbe: true,
  },
  {
    key: "software_technical_fluency",
    label: "Software / Technical Fluency",
    weight: 6,
    strongDescription:
      "Technical literacy sufficient to reason about integration architecture and data quality — not necessarily coding ability.",
  },
];

export function criteriaForRole(role: Role): RubricCriterion[] {
  return role === "PM" ? PM_CRITERIA : SPM_CRITERIA;
}

/** Union of PM + SPM criteria, deduplicated by key (shared keys: relevant_pm_experience, first_principles_thinking). One AI scoring call covers both roles at once. */
export function unionCriteria(): RubricCriterion[] {
  const seen = new Map<string, RubricCriterion>();
  for (const c of [...PM_CRITERIA, ...SPM_CRITERIA]) {
    if (!seen.has(c.key)) seen.set(c.key, c);
  }
  return [...seen.values()];
}

/** Top 3 highest-weighted criteria, in rubric-listed order on weight ties. Used for confidence (Part 11). */
export function topWeightedCriteria(role: Role, n = 3): RubricCriterion[] {
  const list = criteriaForRole(role);
  return [...list]
    .map((c, idx) => ({ c, idx }))
    .sort((a, b) => b.c.weight - a.c.weight || a.idx - b.idx)
    .slice(0, n)
    .map((x) => x.c);
}

// ---------------------------------------------------------------------------
// Experience rules (Part 3 general table + Part 4/Part 5 role-specific bands)
// ---------------------------------------------------------------------------

export type ExperienceFlag =
  | "ineligible_below_band"
  | "early_tenure"
  | "consider_spm_track"
  | "early_for_spm"
  | "above_band_growing_scope"
  | "above_band_capped"
  | "needs_more_evidence_dates";

export interface ExperienceEvaluation {
  years: number | null;
  eligible: boolean | "needs_more_evidence";
  /** Hard cap on the Relevant PM Experience criterion score (0-2), if any. */
  experienceCriterionCap: 0 | 1 | 2 | null;
  flags: ExperienceFlag[];
  note: string;
}

/**
 * Only PRODUCT MANAGEMENT titled experience counts toward these bands
 * (Part 3). `recentScopeGrowing` matters only for SPM candidates with 8+
 * years (Part 5 band). `datesAmbiguous` is Part 18's edge case: resume has
 * no/unparseable dates — never guess, flag for manual review instead.
 * `experienceEvidenceQuality` implements the two named exceptions where a
 * cap can be lifted by exceptionally strong (HIGH-quality) scope evidence.
 */
export function evaluateExperienceBand(
  role: Role,
  years: number | null,
  recentScopeGrowing: boolean | null,
  datesAmbiguous: boolean,
  experienceEvidenceQuality: EvidenceQuality
): ExperienceEvaluation {
  if (datesAmbiguous || years === null) {
    return {
      years,
      eligible: "needs_more_evidence",
      experienceCriterionCap: null,
      flags: ["needs_more_evidence_dates"],
      note: "Resume has missing or unparseable employment dates — tenure cannot be computed reliably. Flagged for manual review rather than guessed (per rubric Part 18).",
    };
  }

  if (role === "PM") {
    if (years <= 0) {
      return {
        years,
        eligible: false,
        experienceCriterionCap: 0,
        flags: ["ineligible_below_band"],
        note: "0 years of genuine PM-type work — ineligible for PM per rubric hard eligibility gate.",
      };
    }
    if (years < 2) {
      const exceptional = experienceEvidenceQuality === "HIGH";
      return {
        years,
        eligible: true,
        experienceCriterionCap: exceptional ? 2 : 1,
        flags: ["early_tenure"],
        note: exceptional
          ? "1 year of PM-type work, but scope evidence is HIGH quality — criterion may reach 2, still flagged short tenure."
          : "1 year of PM-type work — eligible but capped low, flagged early-tenure.",
      };
    }
    if (years <= 4) {
      return {
        years,
        eligible: true,
        experienceCriterionCap: null,
        flags: [],
        note: "Within the 2-4y target band for PM.",
      };
    }
    return {
      years,
      eligible: true,
      experienceCriterionCap: 1,
      flags: ["consider_spm_track"],
      note: "5+ years — eligible but flagged 'Above PM target range — consider SPM track'. No extra credit for tenure alone; this criterion does not out-score a strong 2-4y candidate.",
    };
  }

  // SPM
  if (years < 4) {
    return {
      years,
      eligible: false,
      experienceCriterionCap: 0,
      flags: ["ineligible_below_band"],
      note: "Under 4 years of genuine PM-type work — ineligible for SPM per rubric hard eligibility gate.",
    };
  }
  if (years < 5) {
    const exceptional = experienceEvidenceQuality === "HIGH";
    return {
      years,
      eligible: true,
      experienceCriterionCap: exceptional ? null : 1,
      flags: ["early_for_spm"],
      note: exceptional
        ? "4 years, but independent-ownership scope evidence is exceptionally strong (HIGH quality) — cap lifted per rubric exception, still flagged early-for-SPM."
        : "4 years of PM-type work — eligible but capped low, flagged early-for-SPM.",
    };
  }
  if (years <= 8) {
    return {
      years,
      eligible: true,
      experienceCriterionCap: null,
      flags: [],
      note: "Within the 5-8y target band for SPM.",
    };
  }
  if (recentScopeGrowing) {
    return {
      years,
      eligible: true,
      experienceCriterionCap: null,
      flags: ["above_band_growing_scope"],
      note: "8+ years with growing scope in recent years — eligible, not capped.",
    };
  }
  return {
    years,
    eligible: true,
    experienceCriterionCap: 1,
    flags: ["above_band_capped"],
    note: "8+ years but recent scope is not clearly growing — capped low per rubric ('stagnation — verify growth trajectory in interview'), tenure alone is not extra credit.",
  };
}

export function confidenceFromQualities(
  qualities: EvidenceQuality[]
): EvidenceQuality {
  const order: EvidenceQuality[] = ["NO_EVIDENCE", "LOW", "MEDIUM", "HIGH"];
  let worst: EvidenceQuality = "HIGH";
  for (const q of qualities) {
    if (order.indexOf(q) < order.indexOf(worst)) worst = q;
  }
  return worst;
}

/**
 * Interview probe auto-generation rule (Part 12): weight >= 6 AND evidence
 * LOW/NO_EVIDENCE, OR the criterion is one of the named mandatory ones
 * (First-Principles, SPM Leadership, PM Under-Pressure/Accountability)
 * regardless of its weight.
 */
export function needsInterviewProbe(
  weight: number,
  quality: EvidenceQuality,
  alwaysProbe: boolean | undefined
): boolean {
  const thin = quality === "LOW" || quality === "NO_EVIDENCE";
  return thin && (weight >= 6 || !!alwaysProbe);
}
