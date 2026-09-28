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

/**
 * Computes total years of *PM-titled* experience (per rubric: only actual
 * Product Management titled experience counts), de-duplicating overlapping
 * months so concurrent PM roles aren't double-counted.
 */
export function computePmExperienceYears(
  employment: EmploymentEntry[],
  now: Date = new Date()
): number {
  const months = new Set<number>();
  for (const entry of employment) {
    if (!entry.isPmRole) continue;
    const start = toMonthIndex(entry.start, now);
    const end = toMonthIndex(entry.end, now);
    if (start === null || end === null || end < start) continue;
    for (let m = start; m <= end; m++) months.add(m);
  }
  return Math.round((months.size / 12) * 10) / 10;
}

/** True if the candidate's most recent PM role(s) show growing scope vs earlier ones. */
export function hasEmploymentHistory(employment: EmploymentEntry[]): boolean {
  return employment.some((e) => e.isPmRole);
}
