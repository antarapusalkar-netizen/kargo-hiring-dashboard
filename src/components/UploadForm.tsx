"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Role } from "@/lib/rubric";

/** "" means auto-detect — see detectAppliedRole in the upload route. */
type RoleChoice = Role | "";

export function UploadForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [role, setRole] = useState<RoleChoice>("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a resume file first (PDF or DOCX).");
      return;
    }
    setStatus("uploading");
    setError(null);

    const body = new FormData();
    if (role) body.append("role", role);
    body.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        setStatus("idle");
        return;
      }
      setFile(null);
      formRef.current?.reset();
      setStatus("idle");
      if (data.candidateId) {
        router.push(`/candidates/${data.candidateId}`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
      setStatus("idle");
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 sm:flex-row sm:items-end"
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-neutral-500">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as RoleChoice)}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        >
          <option value="">Auto-detect from resume</option>
          <option value="PM">Product Manager</option>
          <option value="SPM">Senior Product Manager</option>
        </select>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <label className="text-xs font-medium text-neutral-500">Resume (PDF or DOCX)</label>
        <input
          type="file"
          accept=".pdf,.docx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white dark:file:bg-neutral-100 dark:file:text-neutral-900"
        />
      </div>
      <button
        type="submit"
        disabled={status === "uploading"}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {status === "uploading" ? "Analyzing…" : "Upload & Score"}
      </button>
      {error && <p className="text-sm text-rose-600 sm:basis-full">{error}</p>}
    </form>
  );
}
