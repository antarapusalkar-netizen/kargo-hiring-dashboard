import { NextRequest, NextResponse } from "next/server";
import { extractResume, scoreCandidate, generateBrief, AiAnalysisError } from "@/lib/ai";
import { fetchActiveCalibrationPatterns } from "@/lib/calibration";
import { computePmExperienceYears } from "@/lib/experience";
import { extractResumeText, UnreadableResumeError } from "@/lib/parse";
import { buildScoringPacket } from "@/lib/redact";
import { checkEnv, MissingEnvError } from "@/lib/env";
import { criteriaForRole, type Role } from "@/lib/rubric";
import { detectAppliedRole } from "@/lib/roleDetection";
import { combineScores, type CombinedScoreResult } from "@/lib/scoring";
import { RESUME_BUCKET, supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function otherRole(role: Role): Role {
  return role === "PM" ? "SPM" : "PM";
}

/**
 * Rubric Part 1 / Part 16: if the OTHER role's rubric scores notably higher
 * (and the candidate clears that role's eligibility gate), surface an
 * explicit flag on the applied-role card — never silently reassign them.
 * "Notably higher" = other role beats the applied score by 8+ points, which
 * is roughly one full-weight criterion swinging from 0 to 2.
 */
function buildOtherRoleFlag(
  appliedRole: Role,
  applied: CombinedScoreResult,
  other: CombinedScoreResult
): string | null {
  if (other.eligibility !== "eligible") return null;
  if (other.overallScore - applied.overallScore < 8) return null;
  return `Potential ${otherRole(appliedRole)} fit — review recommended.`;
}

export async function POST(req: NextRequest) {
  const envCheck = checkEnv();
  if (!envCheck.ok) {
    return NextResponse.json(
      {
        error: `Server is missing required configuration: ${envCheck.missing.join(
          ", "
        )}. Set these in .env.local (local) or Vercel Environment Variables (production).`,
      },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return badRequest("Could not read the upload — please try again.");
  }

  const roleField = formData.get("role");
  const file = formData.get("file");

  if (roleField !== null && roleField !== "" && roleField !== "PM" && roleField !== "SPM") {
    return badRequest('Role must be "PM", "SPM", or left blank to auto-detect.');
  }
  const manualRole: Role | null = roleField === "PM" || roleField === "SPM" ? roleField : null;

  if (!(file instanceof File)) {
    return badRequest("No resume file was uploaded.");
  }
  if (file.size === 0) {
    return badRequest("The uploaded file is empty.");
  }
  if (file.size > 10 * 1024 * 1024) {
    return badRequest("The resume file is too large (10MB limit).");
  }

  const supabase = supabaseAdmin();
  const buffer = Buffer.from(await file.arrayBuffer());

  // 1. Extract raw text from the resume (PDF/DOCX only).
  let resumeText: string;
  try {
    resumeText = await extractResumeText(buffer, file.name, file.type);
  } catch (err) {
    if (err instanceof UnreadableResumeError) {
      return badRequest(err.message);
    }
    throw err;
  }

  // 2. Upload the original file to Supabase Storage. The path doesn't
  // depend on role — which role applies isn't known until after extraction.
  const storagePath = `uploads/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
  const { error: storageError } = await supabase.storage
    .from(RESUME_BUCKET)
    .upload(storagePath, buffer, { contentType: file.type || undefined });
  if (storageError) {
    return NextResponse.json(
      { error: `Supabase Storage upload failed: ${storageError.message}` },
      { status: 502 }
    );
  }

  // 3. AI extraction of structured resume facts.
  let candidateId: string | null = null;
  try {
    const extracted = await extractResume(resumeText);
    const { years, datesAmbiguous } = computePmExperienceYears(extracted.employment);
    const { role: appliedRole, autoDetected, note: roleDetectionNote } = detectAppliedRole({
      manualRole,
      extracted,
      years,
    });
    const secondaryRole = otherRole(appliedRole);

    const { data: inserted, error: insertError } = await supabase
      .from("candidates")
      .insert({
        name: extracted.name || file.name,
        email: extracted.email,
        phone: extracted.phone,
        location: extracted.location,
        role: appliedRole,
        role_auto_detected: autoDetected,
        role_detection_note: roleDetectionNote,
        resume_storage_path: storagePath,
        resume_text: resumeText,
        raw_extraction: extracted,
        years_pm_experience: years,
        status: "processing",
      })
      .select("id")
      .single();
    if (insertError || !inserted) {
      throw new Error(`Supabase insert failed: ${insertError?.message}`);
    }
    candidateId = inserted.id as string;

    // 4. Score against BOTH rubrics in one call (redacted packet — no
    // name/contact/university), then combine deterministically per role.
    const patterns = await fetchActiveCalibrationPatterns();
    const packet = buildScoringPacket(extracted);
    const { criterionScores, calibrationMatches, recentScopeGrowing } =
      await scoreCandidate(appliedRole, packet, patterns);

    const combinedByRole: Record<Role, CombinedScoreResult> = {
      [appliedRole]: combineScores({
        role: appliedRole,
        years,
        datesAmbiguous,
        recentScopeGrowing,
        aiScores: criterionScores,
        calibrationMatches,
        calibrationPatterns: patterns,
      }),
      [secondaryRole]: combineScores({
        role: secondaryRole,
        years,
        datesAmbiguous,
        recentScopeGrowing,
        aiScores: criterionScores,
        calibrationMatches,
        calibrationPatterns: patterns,
      }),
    } as Record<Role, CombinedScoreResult>;

    const applied = combinedByRole[appliedRole];
    const other = combinedByRole[secondaryRole];
    const otherRoleFlag = buildOtherRoleFlag(appliedRole, applied, other);

    // 5. Interview brief + email drafts + interview probes (applied role only).
    const criteriaLabels = Object.fromEntries(
      criteriaForRole(appliedRole).map((c) => [c.key, c.label])
    );
    const brief = await generateBrief({
      role: appliedRole,
      candidateName: extracted.name || "Candidate",
      overallScore: applied.overallScore,
      eligibility: applied.eligibility,
      criterionScores: applied.criterionScores.map((c) => ({
        criterionKey: c.key,
        score: c.score,
        evidenceQuote: c.evidenceQuote,
        evidenceQuality: c.evidenceQuality,
        rationale: c.rationale,
      })),
      criteriaLabels,
      gapCriteria: applied.gapCriteria,
    });

    // 6. Persist everything (applied-role breakdown in full; other role as a summary).
    await supabase.from("criterion_scores").upsert(
      applied.criterionScores.map((c) => ({
        candidate_id: candidateId,
        criterion_key: c.key,
        label: c.label,
        weight: c.weight,
        score: c.score,
        raw_ai_score: c.rawAiScore,
        evidence_quote: c.evidenceQuote,
        evidence_quality: c.evidenceQuality,
        rationale: c.rationale,
        cap_note: c.capNote,
      })),
      { onConflict: "candidate_id,criterion_key" }
    );

    if (patterns.length > 0) {
      const matchByKey = new Map(calibrationMatches.map((m) => [m.patternKey, m]));
      await supabase.from("calibration_matches").upsert(
        applied.calibration.map((c) => {
          const m = matchByKey.get(c.key);
          return {
            candidate_id: candidateId,
            pattern_id: patterns.find((p) => p.key === c.key)!.id,
            matched: c.matched,
            evidence_quality: m?.evidenceQuality ?? "NO_EVIDENCE",
            evidence_quote: c.evidenceQuote,
            rationale: c.rationale,
            points_awarded: c.pointsAwarded,
          };
        }),
        { onConflict: "candidate_id,pattern_id" }
      );
    }

    if (brief.interviewProbes.length > 0) {
      await supabase.from("interview_probes").insert(
        brief.interviewProbes.map((p) => ({
          candidate_id: candidateId,
          criterion_key: p.criterionKey,
          question: p.question,
        }))
      );
    }

    await supabase.from("interview_briefs").upsert(
      {
        candidate_id: candidateId,
        summary: brief.summary,
        strengths: brief.strengths,
        gaps: brief.gaps,
        missing_evidence: applied.missingEvidence,
        email_interview_subject: brief.emailInterviewSubject,
        email_interview_body: brief.emailInterviewBody,
        email_rejection_subject: brief.emailRejectionSubject,
        email_rejection_body: brief.emailRejectionBody,
      },
      { onConflict: "candidate_id" }
    );

    await supabase
      .from("candidates")
      .update({
        eligibility: applied.eligibility,
        overall_score: applied.overallScore,
        confidence: applied.confidence,
        recommendation: applied.recommendation,
        experience_flags: applied.experienceFlags,
        other_role: secondaryRole,
        other_role_score: other.overallScore,
        other_role_eligibility: other.eligibility,
        other_role_flag: otherRoleFlag,
        status: "scored",
      })
      .eq("id", candidateId);

    return NextResponse.json({ candidateId, overallScore: applied.overallScore, appliedRole });
  } catch (err) {
    console.error("[upload] pipeline error", err);
    const message =
      err instanceof AiAnalysisError || err instanceof MissingEnvError
        ? err.message
        : `Unexpected error while analyzing the resume: ${
            err instanceof Error ? err.message : String(err)
          }`;

    if (candidateId) {
      await supabase
        .from("candidates")
        .update({ status: "error", error_message: message })
        .eq("id", candidateId);
      return NextResponse.json({ candidateId, error: message }, { status: 500 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
