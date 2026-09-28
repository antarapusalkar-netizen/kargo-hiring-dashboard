# Kargo AI Hiring Dashboard

Built specifically for Kargo's Case 2 hiring problem: score PM and SPM resumes
against Kargo's FINAL rubric, rank candidates, generate an interview brief,
and let Arjun send the interview/rejection email in one click. The AI
recommends; Arjun makes the final call.

## How it works

1. Upload a PDF/DOCX resume and pick a role (PM or SPM).
2. The file is saved to Supabase Storage, and text is extracted server-side.
3. OpenAI extracts structured facts (employment, dates, titles, education,
   skills) — never inventing anything not in the resume.
4. Years of **PM-titled** experience are computed in code (not by the model)
   from those employment dates, per the rubric's experience-band rules.
5. A redacted "scoring packet" (no name, contact info, or university —
   company names replaced with aliases) is sent to OpenAI to score every
   rubric criterion 0/1/2 with an evidence quote + evidence quality tag, and
   to check the candidate against Kargo's past-hire calibration patterns.
6. Deterministic code (`src/lib/scoring.ts`) applies the experience-band caps,
   the First-Principles override rule, sums the weighted score (out of 85) +
   calibration (out of 15) = /100, and computes eligibility + confidence.
7. OpenAI drafts a short interview brief, gap-specific interview probes, and
   both an interview-invite and a rejection email — all saved to Supabase.
8. The dashboard ranks candidates per role; the candidate page shows the full
   breakdown and lets you send the drafted email via Resend.

## Past-hire calibration (15/100)

The rubric's calibration slot needs a labeled historical dataset to do
anything. Kargo's case brief supplied exactly that: 8 past hires with CVs and
outcome ratings (Exceeds / Meets / Below Expectations), across several roles,
not just PM/SPM. Three patterns were derived by comparing what the "Exceeds"
hires' resumes actually contained versus the "Meets"/"Below" hires — see
`supabase/schema.sql` (`calibration_patterns` table, `source_note` column) for
the exact reasoning behind each one:

- **Unprompted Build, Adopted Beyond Role** (6 pts)
- **Ground-Level Logistics / Operations Exposure** (5 pts)
- **Owned a High-Stakes Moment Without Escalating** (4 pts)

Nothing here is fabricated — every pattern is evidence that was present in the
supplied "Exceeds Expectations" hires and weak/absent in the others. If Kargo
later adds more labeled hires, update `calibration_patterns` (points must
still sum to 15) and the scoring call picks it up automatically — no code
change needed.

## Project structure (what was built)

```
src/lib/rubric.ts        Rubric weights, experience bands, override rules — transcribed from the FINAL rubric
src/lib/experience.ts    Deterministic PM-experience-years calculation (de-duplicates overlapping roles)
src/lib/redact.ts        Builds the PII-redacted packet sent to the scoring model
src/lib/ai.ts            OpenAI calls: resume extraction, rubric scoring, interview brief + email drafts
src/lib/scoring.ts        Deterministic combination: caps, weighted sum, eligibility, confidence, gaps
src/lib/calibration.ts   Loads active calibration patterns from Supabase
src/lib/parse.ts         PDF/DOCX text extraction + unreadable-file errors
src/lib/queries.ts       Supabase reads for the dashboard + candidate detail page
src/lib/supabase.ts      Server-only Supabase client (service role key)
src/lib/env.ts           Central env validation with clear error messages
src/app/page.tsx                     Dashboard (PM/SPM tabs, upload form, ranked table)
src/app/candidates/[id]/page.tsx     Candidate detail (breakdown, calibration, probes, brief, email)
src/app/api/upload/route.ts                     Upload → extract → score → brief → persist pipeline
src/app/api/candidates/[id]/email/route.ts      Sends the drafted email via Resend
src/components/*         UploadForm, CandidateTable, EmailPanel, badges, decision banner
supabase/schema.sql       Full database schema + calibration seed data + storage bucket
```

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** → paste the contents of `supabase/schema.sql` → run it.
   This creates every table (`roles`, `candidates`, `criterion_scores`,
   `calibration_patterns` + seed data, `calibration_matches`,
   `interview_probes`, `interview_briefs`) and the private `resumes` storage
   bucket.
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

## 4. Deploy to Vercel

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
  are scored 0 with `evidenceQuality = NO_EVIDENCE` and "No evidence found."
