# Kargo AI Hiring Dashboard

Built specifically for Kargo's hiring problem: score PM and SPM resumes
against `KARGO_HIRING_RUBRIC.txt` (the single source of truth for every
weight, band, and override rule), rank candidates within their own role
pool, generate an interview brief, and let Arjun make the ADVANCE/REJECT
call before any email is ever revealed. The AI recommends; Arjun decides —
the AI never sets a decision, and nothing is ever sent automatically.

## How it works

1. Upload a PDF/DOCX resume and pick the role the candidate applied for (PM
   or SPM).
2. The file is saved to Supabase Storage, and text is extracted server-side.
3. OpenAI extracts structured facts (employment, dates, titles, education,
   skills) — never inventing anything not in the resume.
4. Years of **PM-titled** experience are computed in code (not by the
   model) from those employment dates. If any PM-titled role has
   missing/unparseable dates, tenure is never guessed — the candidate is
   marked `NEEDS MORE EVIDENCE` instead (rubric Part 18).
5. A redacted "scoring packet" (no name, contact info, or university —
   company names replaced with aliases) is sent to OpenAI **once**, scoring
   every criterion from *both* the PM and SPM rubrics in a single call (the
   two rubrics share 2 of their ~11 criteria, so nothing is scored twice) —
   0/1/2 with an evidence quote + evidence-quality tag, plus every
   past-hire calibration pattern.
6. Deterministic code (`src/lib/scoring.ts`) runs that same set of raw
   scores through **both** roles' band caps/override rules and produces two
   independent results: the full breakdown for the role applied for, and a
   summary (score/eligibility/flag) for the other role — so a PM applicant
   whose scope actually sits in the SPM band gets an explicit "Potential SPM
   fit" flag on their PM-pool card, without ever being silently reassigned
   (rubric Part 1 / Part 16).
7. OpenAI drafts a short interview brief, gap-specific interview probes, and
   both an interview-invite and a rejection email — generated up front but
   **never shown or sendable** until Arjun records a decision.
8. On the candidate page, Arjun clicks **Advance** or **Reject**
   (`DecisionPanel`). Only then does the matching draft appear
   (`EmailPanel`) — never a free choice between the two — and only
   **Send** ever reaches Resend.
9. The dashboard ranks candidates within their own role pool only (PM vs PM,
   SPM vs SPM, never mixed); an ineligible candidate is never ranked above
   an eligible one regardless of score.

## Past-hire calibration (10/100)

Exactly the two patterns in rubric Part 8 — no third pattern, no invented
history:

- **Ground-Level Logistics / Operations Exposure** (max 6 pts) — HIGH/MEDIUM
  evidence quality earns the full 6; LOW earns 3; no match earns 0.
- **Unprompted Build, Adopted Beyond Role** (max 4 pts) — earns points
  **only if** the ground-level-ops pattern also scored above 0 for that
  candidate. It reinforces that signal; it is never awarded standalone
  (rubric Part 8 is explicit that this pattern alone doesn't discriminate —
  one "Meets Expectations" past hire has it with no ops exposure).

See `supabase/schema.sql` (`calibration_patterns` table, `source_note`
column, `requires_pattern_key` dependency) for the exact reasoning. If Kargo
adds more labeled hires later, update that table (points must still sum to
10) — no code change needed.

## AI Recommendation (rubric Part 14)

Computed deterministically in `src/lib/scoring.ts`, never left to the model
to self-assess:

- `NEEDS MORE EVIDENCE` — dates are ambiguous, or confidence is LOW.
- `DOES NOT CURRENTLY MEET ROLE REQUIREMENTS` — ineligible, or eligible with
  a low score across most weighted criteria.
- `RECOMMENDED FOR HUMAN REVIEW` — eligible, confidence ≥ MEDIUM, reasonable
  score.

## Project structure (what was rebuilt)

```
src/lib/rubric.ts        Rubric weights, bands, override rules — transcribed verbatim from KARGO_HIRING_RUBRIC.txt
src/lib/experience.ts    Deterministic PM-experience-years calc; flags ambiguous/unparseable dates instead of guessing
src/lib/redact.ts        Builds the PII-redacted packet sent to the scoring model
src/lib/ai.ts            OpenAI calls: resume extraction, dual-rubric scoring, interview brief + email drafts
src/lib/scoring.ts       Deterministic combination: band caps, override rules, calibration formula, recommendation, confidence
src/lib/calibration.ts   Loads active calibration patterns from Supabase
src/lib/parse.ts         PDF/DOCX text extraction + unreadable-file errors
src/lib/queries.ts       Supabase reads for the dashboard + candidate detail page
src/lib/supabase.ts      Server-only Supabase client (service role key)
src/lib/env.ts           Central env validation with clear error messages
src/lib/__tests__/       Scoring-engine tests: experience bands, leadership/first-principles override rules, calibration dependency, weighted-math correctness
src/app/page.tsx                              Dashboard (PM/SPM tabs, upload form, ranked table)
src/app/candidates/[id]/page.tsx              Candidate detail (breakdown, missing evidence, calibration, probes, brief, decision, email)
src/app/api/upload/route.ts                   Upload → extract → score (both roles) → brief → persist pipeline
src/app/api/candidates/[id]/decision/route.ts Records Arjun's Advance/Reject decision — the only place decision_status changes
src/app/api/candidates/[id]/email/route.ts    Sends the drafted email via Resend (only after a decision is recorded)
src/components/*         UploadForm, CandidateTable, DecisionPanel, EmailPanel, badges, decision banner
supabase/schema.sql       Full database schema + calibration seed data + storage bucket (idempotent — safe to re-run after upgrading)
```

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** → paste the contents of `supabase/schema.sql` → run it.
   This creates every table and the private `resumes` storage bucket. It is
   **safe to re-run** on an existing database — it uses
   `ADD COLUMN IF NOT EXISTS` / `ON CONFLICT` throughout, drops the
   previously-fabricated third calibration pattern, and migrates
   `calibration_patterns`/`candidates`/`interview_briefs` to the new shape
   (dual-role summary columns, `decision_status`, `missing_evidence`,
   calibration `evidence_quality` + `requires_pattern_key`).
3. Copy your **Project URL** and **service_role key** from
   Project Settings → API. The service role key is server-only — it is never
   sent to the browser in this app.

## 2. Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

| Variable | Where it's used |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase access (DB + Storage) |
| `OPENAI_API_KEY` | Resume extraction, rubric scoring, brief/email generation |
| `OPENAI_MODEL` | Optional, defaults to `gpt-4.1`. Must support Structured Outputs (`response_format: json_schema`, `strict: true`). |
| `RESEND_API_KEY` | Sending interview/rejection emails |
| `RESEND_FROM_ADDRESS` | Must be a domain verified in your Resend account |

Scoring works without `RESEND_API_KEY` — the dashboard shows a warning and
only the "send email" action on a candidate page fails until it's set.

## 3. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without valid Supabase/OpenAI env vars, the
dashboard shows a "Setup incomplete" banner instead of crashing.

## 4. Run the scoring-engine tests

```bash
npm test
```

Covers (see `src/lib/__tests__/scoring.test.ts`): PM years 0/1/2/3/4/5+, SPM
years 0-3/4/5-8/8+ (growing vs. plateaued scope), ambiguous-dates handling,
SPM Leadership title-only vs. real evidence, First-Principles generic vs.
specific evidence, missing-evidence reporting, calibration present/absent
and the pattern-2-depends-on-pattern-1 rule, and weighted-score math.

## 5. Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel, **or** run `vercel` from
   this directory.
2. In the Vercel project → Settings → Environment Variables, add the same six
   variables listed above (Production and Preview).
3. Note: the upload pipeline makes 3 sequential OpenAI calls per resume and
   can take 15–40 seconds. `maxDuration = 60` is set on the upload route, but
   Vercel's Hobby plan caps function duration at 10s regardless — use a Pro
   plan (or split the pipeline across a queue) if uploads on Hobby time out.

## Error handling

- **Invalid/unreadable resume**: unsupported file types and empty/scanned PDFs
  return a clear 400 message before any AI call is made (`src/lib/parse.ts`).
- **Ambiguous employment dates**: never guessed — eligibility is reported as
  `NEEDS MORE EVIDENCE` and flagged for manual review (`src/lib/experience.ts`,
  rubric Part 18).
- **Missing API key / Supabase config**: every route checks env up front and
  returns a specific "which variable is missing" message; the dashboard shows
  a setup banner instead of a blank crash (`src/lib/env.ts`).
- **Supabase failures**: storage/DB errors are caught and surfaced with the
  underlying message; a candidate whose scoring fails partway is marked
  `status = 'error'` with `error_message` so it's visible in the dashboard
  rather than silently disappearing.
- **AI analysis failure**: wrapped in `AiAnalysisError` with a user-facing
  message; never silently falls back to guessed data.
- **Incomplete resume evidence**: never invented — criteria with no evidence
  are scored 0 with `evidenceQuality = NO_EVIDENCE` and "No evidence found in
  resume.", and rolled up into a dedicated "Missing evidence" section.
- **Emailing before a decision**: the send API rejects the request until
  `decision_status` is `advanced` or `rejected` — there is no code path that
  reaches Resend before that.
