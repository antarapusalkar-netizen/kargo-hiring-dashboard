import { supabaseAdmin } from "./supabase";
import type { EvidenceQuality, ExperienceFlag, Role } from "./rubric";
import type {
  CandidateDetail,
  CandidateListItem,
  DecisionStatus,
  Eligibility,
  Recommendation,
} from "./types";

export async function listCandidates(role: Role): Promise<CandidateListItem[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("candidates")
    .select(
      "id, name, role, years_pm_experience, overall_score, eligibility, confidence, recommendation, status, error_message, experience_flags, decision_status, other_role, other_role_score, other_role_eligibility, other_role_flag, role_auto_detected, role_detection_note, created_at, interview_briefs(strengths, gaps)"
    )
    .eq("role", role)
    .order("overall_score", { ascending: false, nullsFirst: false });

  if (error) throw error;

  // Ineligible candidates are never ranked above an eligible one, regardless
  // of score (rubric Part 16), even though they're still shown for transparency.
  const scored = (data ?? []).filter((c) => c.overall_score !== null);
  const rankOrder = [...scored].sort((a, b) => {
    const aEligible = a.eligibility === "eligible" ? 0 : 1;
    const bEligible = b.eligibility === "eligible" ? 0 : 1;
    if (aEligible !== bEligible) return aEligible - bEligible;
    return (b.overall_score ?? 0) - (a.overall_score ?? 0);
  });
  const rankById = new Map<string, number>();
  rankOrder.forEach((c, idx) => rankById.set(c.id, idx + 1));

  return (data ?? []).map((c) => {
    const brief = Array.isArray(c.interview_briefs)
      ? c.interview_briefs[0]
      : c.interview_briefs;
    return {
      id: c.id,
      name: c.name,
      role: c.role as Role,
      yearsPmExperience: c.years_pm_experience,
      overallScore: c.overall_score,
      rank: rankById.get(c.id) ?? null,
      eligibility: (c.eligibility ?? "ineligible") as Eligibility,
      confidence: (c.confidence ?? null) as EvidenceQuality | null,
      recommendation: (c.recommendation ?? null) as Recommendation | null,
      strengths: brief?.strengths ?? [],
      gaps: brief?.gaps ?? [],
      status: c.status as "processing" | "scored" | "error",
      errorMessage: c.error_message,
      experienceFlags: (c.experience_flags ?? []) as ExperienceFlag[],
      decisionStatus: (c.decision_status ?? "pending") as DecisionStatus,
      otherRoleFit:
        c.other_role && c.other_role_score !== null
          ? {
              role: c.other_role as Role,
              score: c.other_role_score,
              eligibility: (c.other_role_eligibility ?? "ineligible") as Eligibility,
              flag: c.other_role_flag,
            }
          : null,
      roleAutoDetected: !!c.role_auto_detected,
      roleDetectionNote: c.role_detection_note,
      createdAt: c.created_at,
    };
  });
}

export async function getCandidateDetail(
  id: string
): Promise<CandidateDetail | null> {
  const supabase = supabaseAdmin();
  const { data: candidate, error } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!candidate) return null;

  const [{ data: scores }, { data: calibrationMatches }, { data: probes }, { data: brief }] =
    await Promise.all([
      supabase
        .from("criterion_scores")
        .select("*")
        .eq("candidate_id", id),
      supabase
        .from("calibration_matches")
        .select("*, calibration_patterns(key, name, points, requires_pattern_key)")
        .eq("candidate_id", id),
      supabase.from("interview_probes").select("*").eq("candidate_id", id),
      supabase
        .from("interview_briefs")
        .select("*")
        .eq("candidate_id", id)
        .maybeSingle(),
    ]);

  // Rank among peers for the same role (never mixed with the other role's pool).
  const { data: peers } = await supabase
    .from("candidates")
    .select("id, overall_score, eligibility")
    .eq("role", candidate.role)
    .not("overall_score", "is", null)
    .order("overall_score", { ascending: false });
  const rankOrder = (peers ?? [])
    .slice()
    .sort((a, b) => {
      const aEligible = a.eligibility === "eligible" ? 0 : 1;
      const bEligible = b.eligibility === "eligible" ? 0 : 1;
      if (aEligible !== bEligible) return aEligible - bEligible;
      return (b.overall_score ?? 0) - (a.overall_score ?? 0);
    });
  const rank = rankOrder.findIndex((p) => p.id === id) + 1 || null;

  const calibrationScore = (calibrationMatches ?? []).reduce(
    (sum, m) => sum + (m.points_awarded ?? 0),
    0
  );

  return {
    id: candidate.id,
    name: candidate.name,
    role: candidate.role as Role,
    yearsPmExperience: candidate.years_pm_experience,
    overallScore: candidate.overall_score,
    rank,
    eligibility: (candidate.eligibility ?? "ineligible") as Eligibility,
    confidence: (candidate.confidence ?? null) as EvidenceQuality | null,
    recommendation: (candidate.recommendation ?? null) as Recommendation | null,
    strengths: brief?.strengths ?? [],
    gaps: brief?.gaps ?? [],
    status: candidate.status,
    errorMessage: candidate.error_message,
    experienceFlags: (candidate.experience_flags ?? []) as ExperienceFlag[],
    decisionStatus: (candidate.decision_status ?? "pending") as DecisionStatus,
    otherRoleFit:
      candidate.other_role && candidate.other_role_score !== null
        ? {
            role: candidate.other_role as Role,
            score: candidate.other_role_score,
            eligibility: (candidate.other_role_eligibility ?? "ineligible") as Eligibility,
            flag: candidate.other_role_flag,
          }
        : null,
    roleAutoDetected: !!candidate.role_auto_detected,
    roleDetectionNote: candidate.role_detection_note,
    createdAt: candidate.created_at,
    email: candidate.email,
    phone: candidate.phone,
    location: candidate.location,
    resumeStoragePath: candidate.resume_storage_path,
    resumeText: candidate.resume_text,
    criterionScores: (scores ?? [])
      .sort((a, b) => b.weight - a.weight)
      .map((s) => ({
        key: s.criterion_key,
        label: s.label,
        weight: s.weight,
        score: s.score,
        evidenceQuote: s.evidence_quote,
        evidenceQuality: s.evidence_quality,
        rationale: s.rationale,
        capNote: s.cap_note,
      })),
    missingEvidence: brief?.missing_evidence ?? [],
    calibration: (calibrationMatches ?? []).map((m) => {
      const pattern = Array.isArray(m.calibration_patterns)
        ? m.calibration_patterns[0]
        : m.calibration_patterns;
      return {
        key: pattern?.key ?? "",
        name: pattern?.name ?? "",
        maxPoints: pattern?.points ?? 0,
        pointsAwarded: m.points_awarded ?? 0,
        matched: m.matched,
        evidenceQuality: (m.evidence_quality ?? null) as EvidenceQuality | null,
        evidenceQuote: m.evidence_quote,
        rationale: m.rationale,
        dependsOnUnmet: !!pattern?.requires_pattern_key && m.matched && (m.points_awarded ?? 0) === 0,
      };
    }),
    calibrationScore,
    calibrationAvailable: (calibrationMatches ?? []).length > 0,
    interviewProbes: (probes ?? []).map((p) => ({
      criterionKey: p.criterion_key,
      question: p.question,
    })),
    brief: brief
      ? {
          summary: brief.summary,
          strengths: brief.strengths ?? [],
          gaps: brief.gaps ?? [],
          emailInterviewSubject: brief.email_interview_subject,
          emailInterviewBody: brief.email_interview_body,
          emailRejectionSubject: brief.email_rejection_subject,
          emailRejectionBody: brief.email_rejection_body,
          sentEmailType: brief.sent_email_type,
          sentAt: brief.sent_at,
        }
      : null,
  };
}
