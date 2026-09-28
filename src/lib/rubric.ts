// Kargo Candidate Scoring Rubric (FINAL) — transcribed verbatim from
// kargo_scoring_rubric_table.txt. This file is the single source of truth
// for weights, bands, and rules. Do not adjust criteria, weights, or bands
// without updating that source document first.

export type Role = "PM" | "SPM";

export type EvidenceQuality = "HIGH" | "MEDIUM" | "LOW" | "NO_EVIDENCE";

export interface RubricCriterion {
  key: string;
  label: string;
  weight: number;
  strongDescription: string;
  /** First-Principles / Leadership etc. carry extra override rules. */
  overrideRule?: string;
}

export const CALIBRATION_WEIGHT = 15;

export const PM_CRITERIA: RubricCriterion[] = [
  {
    key: "relevant_pm_experience",
    label: "Relevant PM Experience",
    weight: 18,
    strongDescription:
      "In the 2-4y band, with genuine scope (not pure support/coordination work).",
  },
  {
    key: "product_ownership",
    label: "Product Ownership",
    weight: 10,
    strongDescription:
      "Owns a defined product area end-to-end, not just executing assigned tickets.",
  },
  {
    key: "product_execution_shipping",
    label: "Product Execution / Shipping",
    weight: 10,
    strongDescription:
      "Named features shipped with measurable outcomes (adoption, revenue, retention).",
  },
  {
    key: "customer_user_understanding",
    label: "Customer / User Understanding",
    weight: 8,
    strongDescription:
      "Direct discovery: interviews, ticket analysis, time spent with real users.",
  },
  {
    key: "working_in_ambiguity",
    label: "Working in Ambiguity",
    weight: 9,
    strongDescription:
      "Built a process/decision from nothing; no playbook, no committee approval.",
  },
  {
    key: "first_principles_thinking",
    label: "First-Principles Thinking",
    weight: 9,
    strongDescription:
      'Broke a problem to fundamentals or challenged an assumption — NOT credited just for "worked at a startup".',
    overrideRule:
      'If evidence is insufficient: score capped at 1, confidence LOW, auto-generate a targeted interview probe. "Worked at a startup" alone is never sufficient evidence.',
  },
  {
    key: "software_tool_fluency",
    label: "Software / Product Tool Fluency",
    weight: 6,
    strongDescription:
      "Works directly with engineering; uses analytics tools to inform decisions.",
  },
  {
    key: "accountability",
    label: "Accountability",
    weight: 7,
    strongDescription:
      "Owns outcomes, including admitting and acting on failures (e.g. killed a feature).",
  },
  {
    key: "ability_under_pressure",
    label: "Ability to Work Under Pressure",
    weight: 4,
    strongDescription:
      "Delivered through incidents/deadlines/volume spikes without being rescued.",
  },
  {
    key: "ability_under_lead",
    label: "Ability to Work Under a Lead",
    weight: 4,
    strongDescription:
      "Evidence of taking direction and executing agreed priorities.",
  },
];

export const SPM_CRITERIA: RubricCriterion[] = [
  {
    key: "relevant_pm_experience",
    label: "Relevant PM Experience",
    weight: 15,
    strongDescription: "In the 5-8y band, with real scope.",
  },
  {
    key: "independent_product_ownership",
    label: "Independent Product Ownership",
    weight: 10,
    strongDescription:
      "Owned a product area with NO senior PM layer above making the actual calls.",
  },
  {
    key: "platform_integration_experience",
    label: "Platform / Integration Experience",
    weight: 9,
    strongDescription:
      "Worked on integrations, APIs, data layers, or systems embedded in customer environments.",
  },
  {
    key: "technical_product_judgment",
    label: "Technical Product Judgment",
    weight: 8,
    strongDescription:
      "Made build-vs-configure-vs-avoid calls; reasons about technical trade-offs.",
  },
  {
    key: "ambiguity_decision_making",
    label: "Ambiguity / Decision-Making",
    weight: 8,
    strongDescription:
      "Made high-consequence calls and lived with the outcome, no committee involved.",
  },
  {
    key: "leadership",
    label: "Leadership",
    weight: 8,
    strongDescription:
      'Led a team, a cross-functional group, or a major multi-team initiative — NOT credited for a "Senior/Lead/Manager/Head" title alone.',
    overrideRule:
      'Title containing "Senior", "Lead", "Manager", or "Head" is never sufficient evidence on its own. Requires at least one of: led a team / led a cross-functional team / led a significant product project / led a major multi-team initiative.',
  },
  {
    key: "team_project_leadership",
    label: "Team / Project Leadership",
    weight: 7,
    strongDescription:
      "Same evidence bar as Leadership above, scored against a specific project/team.",
  },
  {
    key: "build_from_scratch_early_stage",
    label: "Build-from-Scratch / Early-Stage",
    weight: 6,
    strongDescription:
      "Built a function, process, or product from nothing, or worked at an early-stage company.",
  },
  {
    key: "logistics_supply_chain_ops",
    label: "Logistics / Supply Chain / Ops",
    weight: 5,
    strongDescription:
      "Genuine advantage per JD, not required. Direct ground-level freight/logistics exposure.",
  },
  {
    key: "first_principles_thinking",
    label: "First-Principles Thinking",
    weight: 6,
    strongDescription: "Same bar as PM rubric.",
    overrideRule:
      'If evidence is insufficient: score capped at 1, confidence LOW, auto-generate a targeted interview probe. "Worked at a startup" alone is never sufficient evidence.',
  },
  {
    key: "software_technical_fluency",
    label: "Software / Technical Fluency",
    weight: 3,
    strongDescription:
      "Technical literacy sufficient to reason about integration architecture/data quality — not necessarily coding ability.",
  },
];

export function criteriaForRole(role: Role): RubricCriterion[] {
  return role === "PM" ? PM_CRITERIA : SPM_CRITERIA;
}

/** Top 3 highest-weighted criteria, in rubric-listed order on weight ties. Used for confidence. */
export function topWeightedCriteria(role: Role, n = 3): RubricCriterion[] {
  const list = criteriaForRole(role);
  return [...list]
    .map((c, idx) => ({ c, idx }))
    .sort((a, b) => b.c.weight - a.c.weight || a.idx - b.idx)
    .slice(0, n)
    .map((x) => x.c);
}

export const CRITERIA_TOTAL = 85; // + 15 calibration = 100

// ---------------------------------------------------------------------------
// Experience bands
// ---------------------------------------------------------------------------

export type ExperienceFlag =
  | "ineligible_below_band"
  | "early_tenure"
  | "consider_spm_track"
  | "early_for_spm"
  | "above_band_growing_scope"
  | "above_band_capped";

export interface ExperienceEvaluation {
  years: number;
  eligible: boolean;
  /** Hard cap on the Relevant PM Experience criterion score (0-2), if any. */
  experienceCriterionCap: 0 | 1 | 2 | null;
  flags: ExperienceFlag[];
  note: string;
}

/**
 * Only PRODUCT MANAGEMENT titled experience counts toward these bands.
 * `recentScopeGrowing` matters only for SPM candidates with 8+ years.
 */
export function evaluateExperienceBand(
  role: Role,
  years: number,
  recentScopeGrowing: boolean | null
): ExperienceEvaluation {
  if (role === "PM") {
    if (years <= 0) {
      return {
        years,
        eligible: false,
        experienceCriterionCap: 0,
        flags: ["ineligible_below_band"],
        note: "0 years of PM-titled experience — ineligible for PM per rubric experience band.",
      };
    }
    if (years < 2) {
      return {
        years,
        eligible: true,
        experienceCriterionCap: 1,
        flags: ["early_tenure"],
        note: "1 year of PM-titled experience — eligible but capped low, flagged early-tenure.",
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
      note: "5+ years — eligible but flagged 'consider for SPM track' instead of extra credit; capped, no extra credit for tenure alone.",
    };
  }

  // SPM
  if (years < 4) {
    return {
      years,
      eligible: false,
      experienceCriterionCap: 0,
      flags: ["ineligible_below_band"],
      note: "0-3 years of PM-titled experience — ineligible for SPM per rubric experience band.",
    };
  }
  if (years < 5) {
    return {
      years,
      eligible: true,
      experienceCriterionCap: 1,
      flags: ["early_for_spm"],
      note: "4 years of PM-titled experience — eligible but capped low, flagged early-for-SPM.",
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
    note: "8+ years but recent scope is not clearly growing — capped low per rubric (tenure alone is not extra credit).",
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

/** Interview probe auto-generation rule: weight >= 6 AND evidence LOW or NO_EVIDENCE. */
export function needsInterviewProbe(
  weight: number,
  quality: EvidenceQuality
): boolean {
  return weight >= 6 && (quality === "LOW" || quality === "NO_EVIDENCE");
}
