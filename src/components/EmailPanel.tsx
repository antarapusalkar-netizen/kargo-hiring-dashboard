"use client";

import { useState } from "react";
import type { CandidateDetail, DecisionStatus } from "@/lib/types";

type Brief = NonNullable<CandidateDetail["brief"]>;

/**
 * Only rendered once a founder decision has been recorded (see the
 * candidate page). Shows exactly the ONE draft that matches the decision —
 * never a free choice between interview/rejection — and Send is the only
 * action that ever reaches Resend (rubric Part 15).
 */
export function EmailPanel({
  candidateId,
  brief,
  hasEmail,
  decisionStatus,
}: {
  candidateId: string;
  brief: Brief;
  hasEmail: boolean;
  decisionStatus: Exclude<DecisionStatus, "pending">;
}) {
  const type = decisionStatus === "advanced" ? "interview" : "rejection";
  const subject = type === "interview" ? brief.emailInterviewSubject : brief.emailRejectionSubject;
  const body = type === "interview" ? brief.emailInterviewBody : brief.emailRejectionBody;

  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [sentType, setSentType] = useState(brief.sentEmailType);

  async function handleSend() {
    setSending(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/email`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ kind: "error", text: data.error ?? "Failed to send." });
      } else {
        setMessage({ kind: "ok", text: `Sent ${type} email.` });
        setSentType(type);
      }
    } catch {
      setMessage({ kind: "error", text: "Network error — please try again." });
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          {type === "interview" ? "Interview invite draft" : "Rejection draft"}
        </h2>
        {sentType && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            {sentType} email sent
          </span>
        )}
      </div>

      <div className="mt-3 rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800">
        <p className="font-medium">{subject}</p>
        <p className="mt-2 whitespace-pre-wrap text-neutral-600 dark:text-neutral-400">{body}</p>
      </div>

      {!hasEmail && (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
          No email address on file for this candidate — sending is disabled.
        </p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={handleSend}
          disabled={sending || !hasEmail}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {sending ? "Sending…" : `Send ${type} email`}
        </button>
        {message && (
          <span className={message.kind === "ok" ? "text-sm text-emerald-600" : "text-sm text-rose-600"}>
            {message.text}
          </span>
        )}
      </div>
    </section>
  );
}
