import { supabaseAdmin } from "./supabase";
import type { EvidenceQuality, ExperienceFlag, Role } from "./rubric";
import type { CandidateDetail, CandidateListItem } from "./types";

export async function listCandidates(role: Role): Promise<CandidateListItem[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("candidates")
    .select(
      "id, name, role, years_pm_experience, overall_score, eligibility, confidence, status, error_message, experience_flags, created_at, interview_briefs(strengths, gaps)"
    )
    .eq("role", role)
    .order("overall_score", { ascending: false, nullsFirst: false });

  if (error) throw error;

  const scored = (data ?? []).filter((c) => c.overall_score !== null);
  const rankById = new Map<string, number>();
  scored.forEach((c, idx) => rankById.set(c.id, idx + 1));

  return (data ?? []).map((c) => {
    const brief = Array.isArray(c.interview_briefs)
      ? c.interview_briefs[0]
      : c.interview_briefs;
    return {
      id: c.id,
      name: c.name,
      role: c.role as Role,
      yearsPmExperience: c.years_pm_experience ?? 0,
      overallScore: c.overall_score,
      rank: rankById.get(c.id) ?? null,
      eligibility: (c.eligibility ?? "ineligible") as "eligible" | "ineligible",
      confidence: (c.confidence ?? null) as EvidenceQuality | null,
      strengths: brief?.strengths ?? [],
      gaps: brief?.gaps ?? [],
      status: c.status as "processing" | "scored" | "error",
      errorMessage: c.error_message,
      experienceFlags: (c.experience_flags ?? []) as ExperienceFlag[],
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
        .select("*, calibration_patterns(key, name, points)")
        .eq("candidate_id", id),
      supabase.from("interview_probes").select("*").eq("candidate_id", id),
      supabase
        .from("interview_briefs")
        .select("*")
        .eq("candidate_id", id)
        .maybeSingle(),
    ]);

  // Rank among peers for the same role.
  const { data: peers } = await supabase
    .from("candidates")
    .select("id, overall_score")
    .eq("role", candidate.role)
    .not("overall_score", "is", null)
    .order("overall_score", { ascending: false });
  const rank = peers ? peers.findIndex((p) => p.id === id) + 1 || null : null;

  const calibrationScore = (calibrationMatches ?? []).reduce(
    (sum, m) => sum + (m.points_awarded ?? 0),
    0
  );

  return {
    id: candidate.id,
    name: candidate.name,
    role: candidate.role as Role,
    yearsPmExperience: candidate.years_pm_experience ?? 0,
    overallScore: candidate.overall_score,
    rank,
    eligibility: (candidate.eligibility ?? "ineligible") as "eligible" | "ineligible",
    confidence: (candidate.confidence ?? null) as EvidenceQuality | null,
    strengths: brief?.strengths ?? [],
    gaps: brief?.gaps ?? [],
    status: candidate.status,
    errorMessage: candidate.error_message,
    experienceFlags: (candidate.experience_flags ?? []) as ExperienceFlag[],
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
    calibration: (calibrationMatches ?? []).map((m) => {
      const pattern = Array.isArray(m.calibration_patterns)
        ? m.calibration_patterns[0]
        : m.calibration_patterns;
      return {
        key: pattern?.key ?? "",
        name: pattern?.name ?? "",
        points: pattern?.points ?? 0,
        matched: m.matched,
        evidenceQuote: m.evidence_quote,
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
