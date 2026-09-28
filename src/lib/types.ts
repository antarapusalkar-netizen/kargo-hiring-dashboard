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

export interface CandidateListItem {
  id: string;
  name: string;
  role: Role;
  yearsPmExperience: number;
  overallScore: number | null;
  rank: number | null;
  eligibility: "eligible" | "ineligible";
  confidence: EvidenceQuality | null;
  strengths: string[];
  gaps: string[];
  status: "processing" | "scored" | "error";
  errorMessage: string | null;
  experienceFlags: ExperienceFlag[];
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
  calibration: {
    key: string;
    name: string;
    points: number;
    matched: boolean;
    evidenceQuote: string | null;
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
