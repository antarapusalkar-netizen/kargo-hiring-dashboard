import clsx from "clsx";
import type { EvidenceQuality } from "@/lib/rubric";
import type { DecisionStatus, Eligibility, Recommendation } from "@/lib/types";

export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-sm text-neutral-400">—</span>;
  }
  const color =
    score >= 75
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
      : score >= 55
      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
      : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300";
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold", color)}>
      {score}/100
    </span>
  );
}

export function EligibilityBadge({ eligibility }: { eligibility: Eligibility }) {
  const label =
    eligibility === "eligible"
      ? "Eligible"
      : eligibility === "needs_more_evidence"
      ? "Needs more evidence"
      : "Ineligible";
  const color =
    eligibility === "eligible"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-900/30 dark:text-emerald-300"
      : eligibility === "needs_more_evidence"
      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-900/30 dark:text-amber-300"
      : "bg-neutral-100 text-neutral-600 ring-1 ring-neutral-500/20 dark:bg-neutral-800 dark:text-neutral-300";
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", color)}>
      {label}
    </span>
  );
}

export function ConfidenceBadge({
  confidence,
}: {
  confidence: EvidenceQuality | null;
}) {
  if (!confidence) return <span className="text-sm text-neutral-400">—</span>;
  const color =
    confidence === "HIGH"
      ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
      : confidence === "MEDIUM"
      ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
      : confidence === "LOW"
      ? "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400";
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", color)}>
      {confidence.replace("_", " ")}
    </span>
  );
}

export function StatusBadge({
  status,
}: {
  status: "processing" | "scored" | "error";
}) {
  if (status === "scored") return null;
  const color =
    status === "processing"
      ? "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
      : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", color)}>
      {status === "processing" ? "Processing…" : "Error"}
    </span>
  );
}

export function EvidenceQualityTag({ quality }: { quality: EvidenceQuality }) {
  const color =
    quality === "HIGH"
      ? "text-blue-700 dark:text-blue-300"
      : quality === "MEDIUM"
      ? "text-amber-700 dark:text-amber-300"
      : quality === "LOW"
      ? "text-orange-700 dark:text-orange-300"
      : "text-neutral-400";
  return <span className={clsx("text-xs font-medium uppercase tracking-wide", color)}>{quality.replace("_", " ")}</span>;
}

export function RecommendationBadge({
  recommendation,
}: {
  recommendation: Recommendation | null;
}) {
  if (!recommendation) return <span className="text-sm text-neutral-400">—</span>;
  const color =
    recommendation === "RECOMMENDED FOR HUMAN REVIEW"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-900/30 dark:text-emerald-300"
      : recommendation === "NEEDS MORE EVIDENCE"
      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-900/30 dark:text-amber-300"
      : "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20 dark:bg-rose-900/30 dark:text-rose-300";
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", color)}>
      {recommendation}
    </span>
  );
}

export function DecisionStatusBadge({ status }: { status: DecisionStatus }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
        Pending
      </span>
    );
  }
  const color =
    status === "advanced"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
      : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", color)}>
      {status === "advanced" ? "Advanced" : "Rejected"}
    </span>
  );
}
