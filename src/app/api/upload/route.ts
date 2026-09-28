import { NextRequest, NextResponse } from "next/server";
import { extractResume, scoreCandidate, generateBrief, AiAnalysisError } from "@/lib/ai";
import { fetchActiveCalibrationPatterns } from "@/lib/calibration";
import { computePmExperienceYears } from "@/lib/experience";
import { extractResumeText, UnreadableResumeError } from "@/lib/parse";
import { buildScoringPacket } from "@/lib/redact";
import { checkEnv, MissingEnvError } from "@/lib/env";
import { criteriaForRole, type Role } from "@/lib/rubric";
import { combineScores } from "@/lib/scoring";
import { RESUME_BUCKET, supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
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

  const role = formData.get("role");
  const file = formData.get("file");

  if (role !== "PM" && role !== "SPM") {
    return badRequest('Role must be "PM" or "SPM".');
  }
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

  // 2. Upload the original file to Supabase Storage.
  const storagePath = `${role}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
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
    const years = computePmExperienceYears(extracted.employment);

    const { data: inserted, error: insertError } = await supabase
      .from("candidates")
      .insert({
        name: extracted.name || file.name,
        email: extracted.email,
        phone: extracted.phone,
        location: extracted.location,
        role,
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

    // 4. Score against the rubric (redacted packet — no name/contact/university).
    const patterns = await fetchActiveCalibrationPatterns();
    const packet = buildScoringPacket(extracted);
    const { criterionScores, calibrationMatches, recentScopeGrowing } =
      await scoreCandidate(role as Role, packet, patterns);

    const combined = combineScores({
      role: role as Role,
      years,
      recentScopeGrowing,
      aiScores: criterionScores,
      calibrationMatches,
      calibrationPatterns: patterns,
    });

    // 5. Interview brief + email drafts + interview probes.
    const criteriaLabels = Object.fromEntries(
      criteriaForRole(role as Role).map((c) => [c.key, c.label])
    );
    const brief = await generateBrief({
      role: role as Role,
      candidateName: extracted.name || "Candidate",
      overallScore: combined.overallScore,
      eligibility: combined.eligibility,
      criterionScores: combined.criterionScores.map((c) => ({
        criterionKey: c.key,
        score: c.score,
        evidenceQuote: c.evidenceQuote,
        evidenceQuality: c.evidenceQuality,
        rationale: c.rationale,
      })),
      criteriaLabels,
      gapCriteria: combined.gapCriteria,
    });

    // 6. Persist everything.
    await supabase.from("criterion_scores").upsert(
      combined.criterionScores.map((c) => ({
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
        patterns.map((p) => {
          const m = matchByKey.get(p.key);
          return {
            candidate_id: candidateId,
            pattern_id: p.id,
            matched: !!m?.matched,
            evidence_quote: m?.evidenceQuote ?? null,
            rationale: m?.rationale ?? "Not observed.",
            points_awarded: m?.matched ? p.points : 0,
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
        eligibility: combined.eligibility,
        overall_score: combined.overallScore,
        confidence: combined.confidence,
        experience_flags: combined.experienceFlags,
        status: "scored",
      })
      .eq("id", candidateId);

    return NextResponse.json({ candidateId, overallScore: combined.overallScore });
  } catch (err) {
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
