import type { Role } from "./rubric";
import type { ExtractedResume } from "./types";

function roleLabel(role: Role): string {
  return role === "PM" ? "Product Manager" : "Senior Product Manager";
}

export interface RoleDetectionResult {
  role: Role;
  autoDetected: boolean;
  note: string | null;
}

/**
 * No PM/SPM picker is required at upload — this decides which role the
 * candidate is treated as having applied for:
 *   1. An explicit manual choice from the upload form always wins.
 *   2. Otherwise, if the resume itself states which role is being applied
 *      for (an objective line, a cover note — see ai.ts's extraction
 *      prompt), use that. This is never inferred from the candidate's
 *      current job title or seniority.
 *   3. Otherwise, fall back to the rubric's own years bands (Part 3): PM
 *      targets 2-4y, SPM targets 5-8y, so <=4y defaults to PM and 5y+
 *      defaults to SPM. This is a best-guess default, not a fact — Arjun
 *      can always see the reasoning (role_detection_note) and override.
 * Every candidate is still dual-scored against both rubrics regardless, so
 * an auto-detection miss doesn't hide the other role's fit.
 */
export function detectAppliedRole(params: {
  manualRole: Role | null;
  extracted: Pick<ExtractedResume, "statedTargetRole">;
  years: number | null;
}): RoleDetectionResult {
  const { manualRole, extracted, years } = params;

  if (manualRole) {
    return { role: manualRole, autoDetected: false, note: null };
  }
  if (extracted.statedTargetRole !== "NONE") {
    return {
      role: extracted.statedTargetRole,
      autoDetected: true,
      note: `Resume explicitly states this application is for the ${roleLabel(extracted.statedTargetRole)} position.`,
    };
  }
  if (years === null) {
    return {
      role: "PM",
      autoDetected: true,
      note: "Employment dates are unclear, so PM-titled experience couldn't be computed — defaulted to Product Manager. Please verify manually.",
    };
  }
  const role: Role = years <= 4 ? "PM" : "SPM";
  return {
    role,
    autoDetected: true,
    note: `No role was stated in the resume — auto-detected from ${years}y of PM-titled experience (PM targets 2-4y, SPM targets 5-8y).`,
  };
}
