import type { EvidenceQuality, ExperienceFlag, Role } from "./rubric";

export interface EmploymentEntry {
  company: string;
  title: string;
  start: string; // YYYY-MM, best-effort
  end: string; // YYYY-MM or "present"
  isPmRole: boolean;
  bullets: string[];
}

export interface ExtractedResume {
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  employment: EmploymentEntry[];
  education: { degree: string; institution: string; years: string }[];
  skills: string[];
}

export interface CriterionScoreResult {
  criterionKey: string;
  score: 0 | 1 | 2;
  evidenceQuote: string | null;
  evidenceQuality: EvidenceQuality;
  rationale: string;
}

export interface CalibrationMatchResult {
  patternKey: string;
  matched: boolean;
  evidenceQuality: EvidenceQuality;
  evidenceQuote: string | null;
  rationale: string;
}

export interface InterviewProbe {
  criterionKey: string;
  question: string;
}

export interface BriefResult {
  summary: string;
  strengths: string[];
  gaps: string[];
  emailInterviewSubject: string;
  emailInterviewBody: string;
  emailRejectionSubject: string;
  emailRejectionBody: string;
}

export type Eligibility = "eligible" | "ineligible" | "needs_more_evidence";

export type Recommendation =
  | "RECOMMENDED FOR HUMAN REVIEW"
  | "NEEDS MORE EVIDENCE"
  | "DOES NOT CURRENTLY MEET ROLE REQUIREMENTS";

export type DecisionStatus = "pending" | "advanced" | "rejected";

export interface OtherRoleFit {
  role: Role;
  score: number;
  eligibility: Eligibility;
  flag: string | null;
}

export interface CandidateListItem {
  id: string;
  name: string;
  role: Role;
  yearsPmExperience: number | null;
  overallScore: number | null;
  rank: number | null;
  eligibility: Eligibility;
  confidence: EvidenceQuality | null;
  recommendation: Recommendation | null;
  strengths: string[];
  gaps: string[];
  status: "processing" | "scored" | "error";
  errorMessage: string | null;
  experienceFlags: ExperienceFlag[];
  decisionStatus: DecisionStatus;
  otherRoleFit: OtherRoleFit | null;
  createdAt: string;
}

export interface CandidateDetail extends CandidateListItem {
  email: string | null;
  phone: string | null;
  location: string | null;
  resumeStoragePath: string | null;
  resumeText: string | null;
  criterionScores: {
    key: string;
    label: string;
    weight: number;
    score: 0 | 1 | 2 | null;
    evidenceQuote: string | null;
    evidenceQuality: EvidenceQuality;
    rationale: string;
    capNote: string | null;
  }[];
  missingEvidence: string[];
  calibration: {
    key: string;
    name: string;
    maxPoints: number;
    pointsAwarded: number;
    matched: boolean;
    evidenceQuality: EvidenceQuality | null;
    evidenceQuote: string | null;
    rationale: string | null;
    dependsOnUnmet: boolean;
  }[];
  calibrationScore: number;
  calibrationAvailable: boolean;
  interviewProbes: InterviewProbe[];
  brief: {
    summary: string;
    strengths: string[];
    gaps: string[];
    emailInterviewSubject: string;
    emailInterviewBody: string;
    emailRejectionSubject: string;
    emailRejectionBody: string;
    sentEmailType: "interview" | "rejection" | null;
    sentAt: string | null;
  } | null;
}
