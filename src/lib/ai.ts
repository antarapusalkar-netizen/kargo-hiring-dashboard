import OpenAI from "openai";
import { env } from "./env";
import { unionCriteria, type Role } from "./rubric";
import type {
  BriefResult,
  CalibrationMatchResult,
  CriterionScoreResult,
  Eligibility,
  ExtractedResume,
  InterviewProbe,
} from "./types";
import type { ScoringPacket } from "./redact";
import type { CalibrationPatternRow } from "./calibration";

export class AiAnalysisError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "AiAnalysisError";
  }
}

let openai: OpenAI | null = null;
function client(): OpenAI {
  if (!openai) openai = new OpenAI({ apiKey: env.openaiApiKey });
  return openai;
}

/** OpenAI Structured Outputs (strict JSON schema) call. */
async function callStructured<T>(
  system: string,
  userContent: string,
  schemaName: string,
  schema: Record<string, unknown>
): Promise<T> {
  let response;
  try {
    response = await client().chat.completions.create({
      model: env.openaiModel,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: schemaName, strict: true, schema },
      },
    });
  } catch (err) {
    const detail =
      err instanceof OpenAI.APIError
        ? `${err.status ?? "?"} ${err.code ?? err.type ?? ""}: ${err.message}`.trim()
        : err instanceof Error
          ? err.message
          : String(err);
    throw new AiAnalysisError(
      `The AI analysis request failed (${detail}). Please try again.`,
      err
    );
  }

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new AiAnalysisError(
      "The AI did not return a structured result. Please try again."
    );
  }
  try {
    return JSON.parse(content) as T;
  } catch (err) {
    throw new AiAnalysisError("The AI returned malformed JSON.", err);
  }
}

// ---------------------------------------------------------------------------
// 1. Extraction
// ---------------------------------------------------------------------------

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "email", "phone", "location", "employment", "education", "skills"],
  properties: {
    name: { type: "string" },
    email: { type: ["string", "null"] },
    phone: { type: ["string", "null"] },
    location: { type: ["string", "null"] },
    employment: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["company", "title", "start", "end", "isPmRole", "bullets"],
        properties: {
          company: { type: "string" },
          title: { type: "string" },
          start: {
            type: "string",
            description: "Normalized as YYYY-MM. Best estimate if only a year is given.",
          },
          end: {
            type: "string",
            description: 'Normalized as YYYY-MM, or the literal string "present".',
          },
          isPmRole: {
            type: "boolean",
            description:
              'True only if the TITLE itself is a genuine Product Management title (e.g. "Product Manager", "Associate Product Manager", "Senior Product Manager", "APM", "Group PM"). Titles like "Senior Supply Chain Analyst", "Software Engineer", "Operations Lead", "Marketing Manager" are false even if duties overlap with PM work — per rubric, only PM-titled experience counts toward the experience band. Engineering/sales/ops/CS/marketing experience must be false here even at high seniority.',
          },
          bullets: { type: "array", items: { type: "string" } },
        },
      },
    },
    education: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["degree", "institution", "years"],
        properties: {
          degree: { type: "string" },
          institution: { type: "string" },
          years: { type: "string" },
        },
      },
    },
    skills: { type: "array", items: { type: "string" } },
  },
} as const;

export async function extractResume(
  resumeText: string
): Promise<ExtractedResume> {
  const system = `You extract structured facts from resumes for a hiring pipeline. Extract ONLY what is stated in the text — never invent skills, years of experience, responsibilities, achievements, leadership, or ownership that is not written. If a field is not present, use null (for scalars) or an empty array. Preserve bullet text close to verbatim so it can be used as evidence quotes later — do not summarize or embellish bullets.`;
  return callStructured<ExtractedResume>(
    system,
    `Extract structured data from this resume:\n\n---\n${resumeText}\n---`,
    "resume_extraction",
    EXTRACTION_SCHEMA
  );
}

// ---------------------------------------------------------------------------
// 2. Scoring
// ---------------------------------------------------------------------------

const scoreItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["criterionKey", "score", "evidenceQuote", "evidenceQuality", "rationale"],
  properties: {
    criterionKey: { type: "string" },
    score: { type: "integer", enum: [0, 1, 2] },
    evidenceQuote: {
      type: ["string", "null"],
      description:
        "A short quote or close paraphrase from the provided material that supports the score. Null if evidenceQuality is NO_EVIDENCE.",
    },
    evidenceQuality: {
      type: "string",
      enum: ["HIGH", "MEDIUM", "LOW", "NO_EVIDENCE"],
    },
    rationale: { type: "string" },
  },
} as const;

function buildScoringSchema(calibrationPatterns: CalibrationPatternRow[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["criterionScores", "calibrationMatches", "recentScopeGrowing"],
    properties: {
      criterionScores: {
        type: "array",
        items: scoreItemSchema,
        description: "One entry per rubric criterion, using the exact criterion keys given in the system prompt.",
      },
      calibrationMatches: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["patternKey", "matched", "evidenceQuality", "evidenceQuote", "rationale"],
          properties: {
            patternKey: { type: "string" },
            matched: { type: "boolean" },
            evidenceQuality: {
              type: "string",
              enum: ["HIGH", "MEDIUM", "LOW", "NO_EVIDENCE"],
              description:
                "Quality of the evidence for the match (independent of `matched`). NO_EVIDENCE/false matched if nothing in the resume speaks to this pattern.",
            },
            evidenceQuote: { type: ["string", "null"] },
            rationale: { type: "string" },
          },
        },
        description: `One entry per calibration pattern key: ${calibrationPatterns
          .map((p) => p.key)
          .join(", ")}. A candidate NOT matching a pattern is "not observed", never a penalty.`,
      },
      recentScopeGrowing: {
        type: ["boolean", "null"],
        description:
          "Only meaningful for SPM candidates with 8+ years of PM experience: does scope/seniority visibly grow in their most recent roles (vs. earlier ones), rather than tenure alone? Null if not applicable or not enough evidence.",
      },
    },
  } as const;
}

export async function scoreCandidate(
  appliedRole: Role,
  packet: ScoringPacket,
  calibrationPatterns: CalibrationPatternRow[]
): Promise<{
  criterionScores: CriterionScoreResult[];
  calibrationMatches: CalibrationMatchResult[];
  recentScopeGrowing: boolean | null;
}> {
  // Rubric Part 1: every candidate is scored against BOTH the PM and SPM
  // rubrics regardless of which role they applied for, so the dashboard can
  // surface a stronger fit for the other role without silently reassigning
  // them. One call covers the union of both criteria sets (two keys —
  // relevant_pm_experience and first_principles_thinking — are shared and
  // scored once; the years-based band cap that differs by role is applied
  // deterministically afterwards, not by the model).
  const criteria = unionCriteria();
  const rubricText = criteria
    .map(
      (c) =>
        `- ${c.key} (weight ${c.weight}): Strong(2) = ${c.strongDescription}${
          c.overrideRule ? ` OVERRIDE RULE: ${c.overrideRule}` : ""
        }`
    )
    .join("\n");

  const calibrationText = calibrationPatterns
    .map((p) => `- ${p.key}: ${p.name} — ${p.evidence_signal}`)
    .join("\n");

  const system = `You are scoring a candidate against Kargo's FINAL hiring rubric, for BOTH the Product Manager (PM) and Senior Product Manager (SPM) roles at once (the candidate applied for ${appliedRole}, but Kargo's process requires scoring every candidate against both rubrics — see the criteria list below, which is the union of both). This rubric is authoritative — do not invent your own criteria or weights.

Scale for every criterion: 0 = no evidence, 1 = partial, 2 = strong.
Evidence quality tag (separate from score): HIGH | MEDIUM | LOW | NO_EVIDENCE.
Never score based on employer prestige, name, age, gender, or location (you have not been given those — score only from the employment/skills evidence below).
Never invent skills, years of experience, responsibilities, achievements, leadership, or ownership not present in the material. If evidence is missing, use score 0, evidenceQuality NO_EVIDENCE, evidenceQuote null, and say "No evidence found" in the rationale.

Some criteria below carry an OVERRIDE RULE (e.g. capping First-Principles Thinking at 1 when evidence is thin, or not crediting a title alone for SPM Leadership). Apply these rules by choosing the correct score and evidenceQuality — do not narrate the rule itself, mention "override", or describe your own capping process in the rationale. The rationale should read as a normal, evidence-specific explanation, as if the rule didn't need to be stated.

You MUST return exactly one criterionScores entry for each of these keys, no more, no fewer: ${criteria
    .map((c) => c.key)
    .join(", ")}.
You MUST return exactly one calibrationMatches entry for each of these keys, no more, no fewer: ${calibrationPatterns
    .map((p) => p.key)
    .join(", ") || "(none configured)"}.

CRITERIA:
${rubricText}

CALIBRATION PATTERNS (derived from Kargo's own historical hires — evaluate whether this candidate's evidence matches each pattern; a non-match is neutral, never a penalty):
${calibrationText || "(none configured — return an empty calibrationMatches array)"}

Employer names have been replaced with aliases (Employer A, Employer B, ...) to avoid prestige bias — reason about role, scope, and bullets, not the alias.`;

  const userContent = `Candidate's redacted employment, education, and skills:\n\n${JSON.stringify(
    packet,
    null,
    2
  )}`;

  return callStructured(
    system,
    userContent,
    "candidate_scores",
    buildScoringSchema(calibrationPatterns)
  );
}

// ---------------------------------------------------------------------------
// 3. Interview brief + email drafts
// ---------------------------------------------------------------------------

const BRIEF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "strengths",
    "gaps",
    "emailInterviewSubject",
    "emailInterviewBody",
    "emailRejectionSubject",
    "emailRejectionBody",
    "interviewProbes",
  ],
  properties: {
    summary: {
      type: "string",
      description:
        "3-5 sentence interview brief for the founder: who this candidate is, why they ranked where they did, what to probe if he moves forward.",
    },
    strengths: {
      type: "array",
      items: { type: "string" },
      description: "Up to 5 short strengths.",
    },
    gaps: {
      type: "array",
      items: { type: "string" },
      description: "Up to 5 short gaps.",
    },
    emailInterviewSubject: { type: "string" },
    emailInterviewBody: {
      type: "string",
      description:
        "Warm, specific interview-invite email in Arjun's voice (founder of Kargo), referencing something concrete from the resume. No placeholders like [X] left unfilled.",
    },
    emailRejectionSubject: { type: "string" },
    emailRejectionBody: {
      type: "string",
      description:
        "Respectful, brief rejection email in Arjun's voice. No generic corporate boilerplate.",
    },
    interviewProbes: {
      type: "array",
      description:
        "Exactly one targeted interview question per gap criterion listed in the prompt, testing the specific missing evidence. Empty array if no gap criteria were listed. Never used as a substitute for scoring.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["criterionKey", "question"],
        properties: {
          criterionKey: { type: "string" },
          question: { type: "string" },
        },
      },
    },
  },
} as const;

export async function generateBrief(params: {
  role: Role;
  candidateName: string;
  overallScore: number;
  eligibility: Eligibility;
  criterionScores: CriterionScoreResult[];
  criteriaLabels: Record<string, string>;
  gapCriteria: { key: string; label: string }[];
}): Promise<BriefResult & { interviewProbes: InterviewProbe[] }> {
  const {
    role,
    candidateName,
    overallScore,
    eligibility,
    criterionScores,
    criteriaLabels,
    gapCriteria,
  } = params;

  const system = `You write concise, evidence-grounded interview briefs and email drafts for Arjun Mehta, founder of Kargo (a Series A logistics SaaS company in Mumbai), who makes every final hiring decision himself. Never invent facts about the candidate beyond what's in the scores/evidence given. The system recommends; Arjun decides — your brief should support a fast, confident decision, not make it for him.`;

  const scoreLines = criterionScores
    .map(
      (s) =>
        `- ${criteriaLabels[s.criterionKey] ?? s.criterionKey}: ${s.score}/2 (${s.evidenceQuality}) — ${s.rationale}`
    )
    .join("\n");

  const gapLines = gapCriteria.length
    ? gapCriteria.map((g) => `- ${g.key}: ${g.label}`).join("\n")
    : "(none — return an empty interviewProbes array)";

  const userContent = `Candidate: ${candidateName}\nRole applied for: ${role}\nOverall score: ${overallScore}/100\nEligibility: ${eligibility}\n\nCriterion scores:\n${scoreLines}\n\nGap criteria requiring an interview probe (one question each, exact keys):\n${gapLines}`;

  return callStructured(system, userContent, "interview_brief", BRIEF_SCHEMA);
}
