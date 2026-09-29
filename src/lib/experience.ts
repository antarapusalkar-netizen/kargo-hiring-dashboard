import type { EmploymentEntry } from "./types";

/** Parses "YYYY-MM" or "present"/"current" into a sortable month index (0 = Jan year 0). */
function toMonthIndex(value: string, now: Date): number | null {
  const v = value.trim().toLowerCase();
  if (v === "present" || v === "current" || v === "") {
    return now.getFullYear() * 12 + now.getMonth();
  }
  const match = v.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    return parseInt(match[1], 10) * 12 + (parseInt(match[2], 10) - 1);
  }
  const yearOnly = v.match(/^(\d{4})$/);
  if (yearOnly) {
    return parseInt(yearOnly[1], 10) * 12;
  }
  return null;
}

export interface ExperienceComputation {
  /** Null when dates could not be computed at all — never guessed (rubric Part 18). */
  years: number | null;
  /** True if any PM-titled role had unparseable/missing dates that were excluded from the total. */
  datesAmbiguous: boolean;
}

/**
 * Computes total years of *PM-titled* experience (per rubric: only actual
 * Product Management titled experience counts), de-duplicating overlapping
 * months so concurrent PM roles aren't double-counted.
 *
 * Per Part 18: if a PM-titled role's dates can't be parsed, do not silently
 * drop it and guess a smaller total — flag it so the pipeline reports
 * "NEEDS MORE EVIDENCE" instead of a wrong ineligible/eligible call.
 */
export function computePmExperienceYears(
  employment: EmploymentEntry[],
  now: Date = new Date()
): ExperienceComputation {
  const pmRoles = employment.filter((e) => e.isPmRole);
  if (pmRoles.length === 0) {
    return { years: 0, datesAmbiguous: false };
  }

  const months = new Set<number>();
  let datesAmbiguous = false;

  for (const entry of pmRoles) {
    const start = toMonthIndex(entry.start, now);
    const end = toMonthIndex(entry.end, now);
    if (start === null || end === null || end < start) {
      datesAmbiguous = true;
      continue;
    }
    for (let m = start; m <= end; m++) months.add(m);
  }

  if (datesAmbiguous && months.size === 0) {
    // Every PM-titled role had unparseable dates — nothing to compute from.
    return { years: null, datesAmbiguous: true };
  }

  const years = Math.round((months.size / 12) * 10) / 10;
  return { years, datesAmbiguous };
}

/** True if the candidate's most recent PM role(s) show growing scope vs earlier ones. */
export function hasEmploymentHistory(employment: EmploymentEntry[]): boolean {
  return employment.some((e) => e.isPmRole);
}
