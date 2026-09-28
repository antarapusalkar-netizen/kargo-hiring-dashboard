import Link from "next/link";
import { notFound } from "next/navigation";
import { getCandidateDetail } from "@/lib/queries";
import { RESUME_BUCKET, supabaseAdmin } from "@/lib/supabase";
import { ConfidenceBadge, EligibilityBadge, EvidenceQualityTag, ScoreBadge } from "@/components/Badges";
import { DecisionBanner } from "@/components/DecisionBanner";
import { EmailPanel } from "@/components/EmailPanel";

export const dynamic = "force-dynamic";

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const candidate = await getCandidateDetail(id);
  if (!candidate) notFound();

  let resumeUrl: string | null = null;
  if (candidate.resumeStoragePath) {
    const { data } = await supabaseAdmin()
      .storage.from(RESUME_BUCKET)
      .createSignedUrl(candidate.resumeStoragePath, 60 * 10);
    resumeUrl = data?.signedUrl ?? null;
  }

  if (candidate.status === "error") {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
        <Link href={`/?role=${candidate.role}`} className="text-sm text-indigo-600 hover:underline">
          ← Back to dashboard
        </Link>
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <p className="font-semibold">Analysis failed for {candidate.name}</p>
          <p className="mt-1">{candidate.errorMessage}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <Link href={`/?role=${candidate.role}`} className="text-sm text-indigo-600 hover:underline">
        ← Back to {candidate.role === "PM" ? "Product Manager" : "Senior Product Manager"} dashboard
      </Link>

      <DecisionBanner />

      <header className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{candidate.name}</h1>
            <p className="text-sm text-neutral-500">
              {candidate.role === "PM" ? "Product Manager" : "Senior Product Manager"} ·{" "}
              {candidate.yearsPmExperience}y PM-titled experience
              {candidate.rank ? ` · Rank #${candidate.rank}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ScoreBadge score={candidate.overallScore} />
            <EligibilityBadge eligibility={candidate.eligibility} />
            <ConfidenceBadge confidence={candidate.confidence} />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-neutral-500">
          {candidate.email && <span>{candidate.email}</span>}
          {candidate.phone && <span>{candidate.phone}</span>}
          {candidate.location && <span>{candidate.location}</span>}
          {resumeUrl && (
            <a href={resumeUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
              View original resume
            </a>
          )}
        </div>
        {candidate.experienceFlags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {candidate.experienceFlags.map((f) => (
              <span
                key={f}
                className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
              >
                {f.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
      </header>

      {candidate.brief && (
        <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Interview brief
          </h2>
          <p className="mt-2 text-sm leading-relaxed">{candidate.brief.summary}</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-400">
                Strengths
              </h3>
              <ul className="mt-1 list-disc pl-4 text-sm text-neutral-600 dark:text-neutral-400">
                {candidate.brief.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase text-rose-700 dark:text-rose-400">
                Gaps
              </h3>
              <ul className="mt-1 list-disc pl-4 text-sm text-neutral-600 dark:text-neutral-400">
                {candidate.brief.gaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Score breakdown
          </h2>
          <span className="text-sm text-neutral-500">
            Criteria {candidate.overallScore !== null ? candidate.overallScore - candidate.calibrationScore : "—"}/85 ·
            Calibration {candidate.calibrationScore}/15
            {!candidate.calibrationAvailable && " (no historical dataset)"}
          </span>
        </div>
        <div className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800">
          {candidate.criterionScores.map((c) => (
            <div key={c.key} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {c.label} <span className="text-neutral-400 font-normal">(wt {c.weight})</span>
                </span>
                <div className="flex items-center gap-3">
                  <EvidenceQualityTag quality={c.evidenceQuality} />
                  <span className="text-sm font-semibold">{c.score}/2</span>
                </div>
              </div>
              {c.evidenceQuote && (
                <blockquote className="mt-1 border-l-2 border-neutral-200 pl-3 text-sm italic text-neutral-500 dark:border-neutral-700">
                  &ldquo;{c.evidenceQuote}&rdquo;
                </blockquote>
              )}
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{c.rationale}</p>
              {c.capNote && (
                <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-400">
                  ⚠ {c.capNote}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {candidate.calibrationAvailable && (
        <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Past-hire calibration ({candidate.calibrationScore}/15)
          </h2>
          <div className="mt-3 space-y-2">
            {candidate.calibration.map((c) => (
              <div key={c.key} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <span className="font-medium">{c.name}</span>
                  {c.evidenceQuote && (
                    <p className="mt-0.5 italic text-neutral-500">&ldquo;{c.evidenceQuote}&rdquo;</p>
                  )}
                </div>
                <span
                  className={
                    c.matched
                      ? "shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : "shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500 dark:bg-neutral-800"
                  }
                >
                  {c.matched ? `+${c.points} matched` : "Not observed"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {candidate.interviewProbes.length > 0 && (
        <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Interview probes
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
            {candidate.interviewProbes.map((p, i) => (
              <li key={i}>{p.question}</li>
            ))}
          </ul>
        </section>
      )}

      {candidate.brief && (
        <EmailPanel candidateId={candidate.id} brief={candidate.brief} hasEmail={!!candidate.email} />
      )}
    </main>
  );
}
