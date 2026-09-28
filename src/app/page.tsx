import Link from "next/link";
import clsx from "clsx";
import { checkEnv } from "@/lib/env";
import { listCandidates } from "@/lib/queries";
import type { Role } from "@/lib/rubric";
import { CandidateTable } from "@/components/CandidateTable";
import { UploadForm } from "@/components/UploadForm";
import { DecisionBanner } from "@/components/DecisionBanner";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const params = await searchParams;
  const role: Role = params.role === "SPM" ? "SPM" : "PM";
  const envCheck = checkEnv();

  const candidates = envCheck.ok ? await listCandidates(role) : [];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Kargo Hiring Dashboard
        </h1>
        <p className="text-sm text-neutral-500">
          Product Manager &amp; Senior Product Manager candidates, scored against
          Kargo&apos;s final rubric.
        </p>
        <DecisionBanner />
      </div>

      {!envCheck.ok && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <p className="font-semibold">Setup incomplete</p>
          <p className="mt-1">
            Missing environment variable{envCheck.missing.length > 1 ? "s" : ""}:{" "}
            <code className="font-mono">{envCheck.missing.join(", ")}</code>. Add
            them to <code className="font-mono">.env.local</code> and restart the
            dev server (see README).
          </p>
        </div>
      )}

      {envCheck.ok && envCheck.missingResend && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <code className="font-mono">RESEND_API_KEY</code> is not set — scoring
          works, but sending emails from a candidate page will fail until it&apos;s
          added.
        </div>
      )}

      <UploadForm defaultRole={role} />

      <div className="flex gap-2 border-b border-neutral-200 dark:border-neutral-800">
        {(["PM", "SPM"] as Role[]).map((r) => (
          <Link
            key={r}
            href={`/?role=${r}`}
            className={clsx(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px",
              role === r
                ? "border-indigo-600 text-indigo-700 dark:text-indigo-400"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            )}
          >
            {r === "PM" ? "Product Manager" : "Senior Product Manager"}
          </Link>
        ))}
      </div>

      {envCheck.ok && <CandidateTable candidates={candidates} />}
    </main>
  );
}
