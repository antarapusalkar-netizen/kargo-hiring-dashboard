import type { ExtractedResume } from "./types";

/**
 * Builds the payload the scoring model is allowed to see. Per the rubric,
 * scores must never be influenced by name, university/company prestige,
 * age, gender, or location. This strips those out before the scoring call,
 * while preserving employer *type* (industry/stage), titles, dates, bullets
 * and skills — the actual evidence the rubric scores against.
 *
 * Company names are replaced with stable aliases (Employer A, Employer B, ...)
 * so the model can still reason about "same employer across two roles"
 * without seeing the brand name itself.
 */
export interface ScoringPacket {
  employment: {
    employerAlias: string;
    title: string;
    start: string;
    end: string;
    isPmRole: boolean;
    bullets: string[];
  }[];
  educationDegrees: string[]; // degree + field only, institution stripped
  skills: string[];
}

export function buildScoringPacket(resume: ExtractedResume): ScoringPacket {
  const aliasByCompany = new Map<string, string>();
  const nextAlias = () => {
    const n = aliasByCompany.size;
    const letter = String.fromCharCode(65 + (n % 26));
    return `Employer ${letter}`;
  };

  const employment = resume.employment.map((e) => {
    const key = e.company.trim().toLowerCase();
    if (!aliasByCompany.has(key)) aliasByCompany.set(key, nextAlias());
    return {
      employerAlias: aliasByCompany.get(key)!,
      title: e.title,
      start: e.start,
      end: e.end,
      isPmRole: e.isPmRole,
      bullets: e.bullets,
    };
  });

  return {
    employment,
    educationDegrees: resume.education.map((ed) => ed.degree).filter(Boolean),
    skills: resume.skills,
  };
}
