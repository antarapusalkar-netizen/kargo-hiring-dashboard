"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DecisionStatus } from "@/lib/types";
import { DecisionStatusBadge } from "./Badges";

/**
 * The founder decision gate (rubric Part 15 / non-negotiable #12 & #16):
 * the AI never advances or rejects a candidate on its own. This is the one
 * control that writes decision_status, and until it's set the email draft
 * stays hidden (see EmailPanel).
 */
export function DecisionPanel({
  candidateId,
  decisionStatus,
}: {
  candidateId: string;
  decisionStatus: DecisionStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(decisionStatus);
  const [pending, setPending] = useState<"advanced" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "advanced" | "rejected") {
    setPending(decision);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to record decision.");
        return;
      }
      setStatus(decision);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Founder decision
        </h2>
        <DecisionStatusBadge status={status} />
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        The AI recommends; only Arjun&apos;s decision here generates and unlocks the matching email draft below.
      </p>
      <div className="mt-3 flex gap-3">
        <button
          onClick={() => decide("advanced")}
          disabled={pending !== null}
          className={
            status === "advanced"
              ? "rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              : "rounded-md bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-900/30 dark:text-emerald-300"
          }
        >
          {pending === "advanced" ? "Advancing…" : "Advance"}
        </button>
        <button
          onClick={() => decide("rejected")}
          disabled={pending !== null}
          className={
            status === "rejected"
              ? "rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              : "rounded-md bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:bg-rose-900/30 dark:text-rose-300"
          }
        >
          {pending === "rejected" ? "Rejecting…" : "Reject"}
        </button>
        {error && <span className="self-center text-sm text-rose-600">{error}</span>}
      </div>
    </section>
  );
}
