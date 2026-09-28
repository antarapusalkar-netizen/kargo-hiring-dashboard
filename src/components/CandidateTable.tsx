import Link from "next/link";
import type { CandidateListItem } from "@/lib/types";
import { ConfidenceBadge, EligibilityBadge, ScoreBadge, StatusBadge } from "./Badges";

export function CandidateTable({ candidates }: { candidates: CandidateListItem[] }) {
  if (candidates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
        No candidates yet for this role. Upload a resume above to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-800 text-sm">
        <thead className="bg-neutral-50 dark:bg-neutral-900">
          <tr className="text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
            <th className="px-4 py-2.5">Rank</th>
            <th className="px-4 py-2.5">Candidate</th>
            <th className="px-4 py-2.5">Experience</th>
            <th className="px-4 py-2.5">Score</th>
            <th className="px-4 py-2.5">Eligibility</th>
            <th className="px-4 py-2.5">Confidence</th>
            <th className="px-4 py-2.5">Key strengths</th>
            <th className="px-4 py-2.5">Key gaps</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {candidates.map((c) => (
            <tr key={c.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/60">
              <td className="px-4 py-3 font-medium text-neutral-500">
                {c.rank ?? "—"}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/candidates/${c.id}`}
                  className="font-medium text-indigo-700 hover:underline dark:text-indigo-400"
                >
                  {c.name}
                </Link>
                <div className="mt-0.5">
                  <StatusBadge status={c.status} />
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">{c.yearsPmExperience}y PM</td>
              <td className="px-4 py-3">
                <ScoreBadge score={c.overallScore} />
              </td>
              <td className="px-4 py-3">
                <EligibilityBadge eligibility={c.eligibility} />
              </td>
              <td className="px-4 py-3">
                <ConfidenceBadge confidence={c.confidence} />
              </td>
              <td className="px-4 py-3 max-w-xs">
                <ul className="list-disc pl-4 text-neutral-600 dark:text-neutral-400">
                  {c.strengths.slice(0, 2).map((s, i) => (
                    <li key={i} className="truncate">{s}</li>
                  ))}
                </ul>
              </td>
              <td className="px-4 py-3 max-w-xs">
                <ul className="list-disc pl-4 text-neutral-600 dark:text-neutral-400">
                  {c.gaps.slice(0, 2).map((g, i) => (
                    <li key={i} className="truncate">{g}</li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
