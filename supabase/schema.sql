-- Kargo AI Hiring Dashboard — database schema
-- Run this in your Supabase project's SQL Editor (Database > SQL Editor > New query).
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT / ADD COLUMN IF NOT EXISTS throughout.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Roles (reference data — the two JDs this app hires for)
-- ---------------------------------------------------------------------------
create table if not exists roles (
  id text primary key check (id in ('PM', 'SPM')),
  title text not null,
  jd_text text not null
);

insert into roles (id, title, jd_text) values
('PM', 'Product Manager', $$Kargo · Mumbai · Series A
Product Manager
Full-time · In-office, Mumbai · Reports to: Arjun Mehta, Founder

About Kargo
Kargo builds software for mid-sized freight forwarders and 3PLs — the companies that move goods across borders and between ports, warehouses, and buyers. Our platform automates the parts of their operation that still run on spreadsheets and WhatsApp chains: shipment tracking, documentation, and carrier coordination. We are Series A, 40 people, and scaling to 70 by December.

Why This Role Exists
We have one product, a growing customer base, and no dedicated PM function yet. The person in this role will be the first PM at Kargo focused on our core platform — the day-to-day tool that operations teams at freight forwarders live inside. There is a lot to build, and a lot to understand about how our customers actually work. Both are connected.

What You'll Own
- The product roadmap for Kargo's core operations platform: shipment tracking, documentation workflows, and real-time status visibility for freight forwarders and their customers
- Customer discovery — understanding where the platform is helping and where it isn't, from the people who use it daily
- Working directly with the engineering team to define what gets built, in what order, and why
- The rhythms a PM function needs: how we decide what to prioritise, how we track whether something worked, how decisions are communicated across the team

What Success Looks Like at 6 Months
- You have shipped at least two features that customers use without being asked to — not because we asked, because they found them useful
- You can tell Arjun, without hesitation, what the three most important things to build next are and why
- The engineering team knows what they are building three sprints out
- You have spent time inside freight forwarding operations — not just over calls, but in the rooms where the work actually happens

What We're Looking For
- 2-4 years of product management experience, ideally at a company building for the first time rather than maintaining what already exists
- Comfort operating without structure — no PM handbook, no design system, no sprint template. You'll build those
- Evidence that you've shipped things, killed things, and learned from both — preferably in short cycles
- Genuine curiosity about how operations work at ground level. What does a freight forwarder's morning actually look like? What breaks? What slows them down?
- Mumbai-based or willing to relocate. This role is in-office

What Kargo Offers
- Real ownership, early. You will be the PM — not one of ten
- Direct access to the founding team and to customers
- A product with genuine complexity and users who depend on it for their daily operations
- The experience of building a product function from scratch, not joining one that already exists

Kargo is an equal opportunity employer. All roles are in-office, Mumbai. If you are relocating, we will work with you on timing.$$)
on conflict (id) do update set title = excluded.title, jd_text = excluded.jd_text;

insert into roles (id, title, jd_text) values
('SPM', 'Senior Product Manager', $$Kargo · Mumbai · Series A
Senior Product Manager
Full-time · In-office, Mumbai · Reports to: Arjun Mehta, Founder

About Kargo
Kargo builds software for mid-sized freight forwarders and 3PLs. Our platform automates shipment tracking, documentation, and carrier coordination. We are Series A, 40 people, scaling to 70 by December.

Why This Role Exists
As we scale, Kargo's product is becoming more complex — more carrier integrations, more customer-specific configurations, more data flowing between Kargo and customers' existing systems. We need someone who can own the harder parts of the platform.

What You'll Own
- The integration and data layer: carrier systems, port portals, ERP environments, freight management tools
- The hard architectural product calls — what we build, what we configure, what we stay away from
- Reliability and data quality standards
- Working across sales, engineering, and customer operations
- Helping define the practices the PM function will run on as Kargo grows

What We're Looking For
- 5-8 years of product management experience, with clear evidence of owning a product area without a layer of senior PMs above you
- Experience with platform products, integration layers, or complex existing technical environments
- Proven ability to make calls in ambiguous situations and live with the consequences
- Time spent at an early-stage company, or strong evidence of operating where the rules were not written yet
- Familiarity with logistics, supply chain, or adjacent domains is a genuine advantage
- Mumbai-based or willing to relocate. This role is in-office$$)
on conflict (id) do update set title = excluded.title, jd_text = excluded.jd_text;

-- ---------------------------------------------------------------------------
-- Candidates
-- ---------------------------------------------------------------------------
create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  location text,
  role text not null check (role in ('PM', 'SPM')), -- role applied for
  resume_storage_path text,
  resume_text text,
  raw_extraction jsonb,
  years_pm_experience numeric, -- null when dates are ambiguous (needs_more_evidence)
  experience_flags text[] not null default '{}',
  eligibility text check (eligibility in ('eligible', 'ineligible', 'needs_more_evidence')),
  overall_score numeric,
  confidence text check (confidence in ('HIGH', 'MEDIUM', 'LOW', 'NO_EVIDENCE')),
  recommendation text check (
    recommendation in (
      'RECOMMENDED FOR HUMAN REVIEW',
      'NEEDS MORE EVIDENCE',
      'DOES NOT CURRENTLY MEET ROLE REQUIREMENTS'
    )
  ),
  -- Dual-role scoring (rubric Part 1 + Part 16): every candidate is also
  -- scored against the OTHER role's rubric. This is a summary only — full
  -- criterion-by-criterion detail is stored just for the applied role.
  -- Ranking pools are never mixed; this is purely a dashboard flag.
  other_role text check (other_role in ('PM', 'SPM')),
  other_role_score numeric,
  other_role_eligibility text check (other_role_eligibility in ('eligible', 'ineligible', 'needs_more_evidence')),
  other_role_flag text,
  -- Founder decision (Part 15): AI never sets this. Pending until Arjun
  -- explicitly clicks Advance or Reject; only then is the matching email
  -- draft revealed.
  decision_status text not null default 'pending' check (decision_status in ('pending', 'advanced', 'rejected')),
  decided_at timestamptz,
  status text not null default 'processing' check (status in ('processing', 'scored', 'error')),
  error_message text,
  created_at timestamptz not null default now()
);

alter table candidates add column if not exists other_role text check (other_role in ('PM', 'SPM'));
alter table candidates add column if not exists other_role_score numeric;
alter table candidates add column if not exists other_role_eligibility text check (other_role_eligibility in ('eligible', 'ineligible', 'needs_more_evidence'));
alter table candidates add column if not exists other_role_flag text;
alter table candidates add column if not exists decision_status text not null default 'pending' check (decision_status in ('pending', 'advanced', 'rejected'));
alter table candidates add column if not exists decided_at timestamptz;
alter table candidates add column if not exists recommendation text check (
  recommendation in (
    'RECOMMENDED FOR HUMAN REVIEW',
    'NEEDS MORE EVIDENCE',
    'DOES NOT CURRENTLY MEET ROLE REQUIREMENTS'
  )
);
-- eligibility now also allows 'needs_more_evidence' (Part 18: ambiguous dates).
alter table candidates drop constraint if exists candidates_eligibility_check;
alter table candidates add constraint candidates_eligibility_check check (eligibility in ('eligible', 'ineligible', 'needs_more_evidence'));
alter table candidates drop constraint if exists candidates_other_role_eligibility_check;
alter table candidates add constraint candidates_other_role_eligibility_check check (other_role_eligibility in ('eligible', 'ineligible', 'needs_more_evidence'));

create index if not exists candidates_role_idx on candidates (role);
create index if not exists candidates_score_idx on candidates (role, overall_score desc);

-- ---------------------------------------------------------------------------
-- Criterion-level scores (applied role only — full breakdown)
-- ---------------------------------------------------------------------------
create table if not exists criterion_scores (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates (id) on delete cascade,
  criterion_key text not null,
  label text not null,
  weight int not null,
  score smallint not null check (score in (0, 1, 2)),
  raw_ai_score smallint,
  evidence_quote text,
  evidence_quality text not null check (evidence_quality in ('HIGH', 'MEDIUM', 'LOW', 'NO_EVIDENCE')),
  rationale text,
  cap_note text,
  unique (candidate_id, criterion_key)
);

-- ---------------------------------------------------------------------------
-- Past-hire calibration (worth 10/100 — rubric Part 8, exactly two patterns).
-- Seeded from Kargo's 8 historical hires (name/role/joined/rating table
-- supplied in the rubric). See source_note on each row for the reasoning —
-- nothing here is fabricated, and no third pattern is invented.
-- Pattern 2 only awards points if Pattern 1 also matched with quality > NONE
-- (requires_pattern_key enforces that dependency in code, src/lib/scoring.ts).
-- ---------------------------------------------------------------------------
create table if not exists calibration_patterns (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  description text not null,
  evidence_signal text not null,
  points int not null,
  requires_pattern_key text references calibration_patterns (key),
  source_note text not null,
  active boolean not null default true
);

alter table calibration_patterns add column if not exists requires_pattern_key text references calibration_patterns (key);

-- Remove the fabricated third pattern from any previously-seeded database —
-- it does not exist in the rubric and must not award points.
delete from calibration_matches
  using calibration_patterns
  where calibration_matches.pattern_id = calibration_patterns.id
  and calibration_patterns.key = 'owned_high_stakes_moment';
delete from calibration_patterns where key = 'owned_high_stakes_moment';

insert into calibration_patterns (key, name, description, evidence_signal, points, requires_pattern_key, source_note) values
(
  'ground_level_ops_exposure',
  'Ground-Level Logistics / Operations Exposure',
  'Direct, ground-level exposure to freight-forwarding, logistics, ports, or customs operations, held prior to or alongside the hired role.',
  'Look for: hands-on operations roles or bullets — customs documentation, carrier coordination, port/terminal work, supply-chain execution at the execution level (not just "worked in logistics SaaS" or vendor/implementer-side integration work).',
  6,
  null,
  'Present in all 5 of Kargo''s 8 historical hires rated "Exceeds Expectations" (e.g. operations executive at a CHA firm, 7 years of freight documentation/customs compliance, port-services sales alongside terminal operations, freight-forwarder client relations, supply-chain/carrier analyst at a 3PL). Absent at ground level in the "Meets"/"Below" hires — a clean 5-of-5 vs 0-of-3 split, and the only pattern that distinguishes Kargo''s own two PM hires (Lavanya, who has it, rated Exceeds; Vikram, who does not, rated only Meets, despite a stronger enterprise-SaaS PM resume on paper). Confidence: MEDIUM (small sample, n=8). Scoring: HIGH/MEDIUM evidence quality earns the full 6 points; LOW evidence quality earns 3; no match earns 0.'
),
(
  'unprompted_build_adopted',
  'Unprompted Build, Adopted Beyond Role',
  'Demonstrated building or fixing something from nothing, independently, without being asked or given a playbook — especially under a live deadline or an active problem.',
  'Look for: identified a problem nobody assigned them to fix, built the tool/process/workaround on their own initiative, and it was adopted by others beyond their own task — ideally under time pressure or a live incident.',
  4,
  'ground_level_ops_exposure',
  'Present in all 5 "Exceeds Expectations" hires, but ALSO present in one "Meets" hire (built a marketing team/programme from zero) — so it does not cleanly discriminate on its own and must never be scored standalone. Per rubric Part 8: a candidate earns these points ONLY if Pattern 1 (ground-level ops exposure) also scored above 0 — this pattern reinforces Pattern 1, it is not an independent signal. Confidence: LOW-MEDIUM.'
)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  evidence_signal = excluded.evidence_signal,
  points = excluded.points,
  requires_pattern_key = excluded.requires_pattern_key,
  source_note = excluded.source_note;

-- Points must sum to 10 (calibration is worth 10/100 in the rubric): 6 + 4 = 10.

create table if not exists calibration_matches (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates (id) on delete cascade,
  pattern_id uuid not null references calibration_patterns (id) on delete cascade,
  matched boolean not null,
  evidence_quality text check (evidence_quality in ('HIGH', 'MEDIUM', 'LOW', 'NO_EVIDENCE')),
  evidence_quote text,
  rationale text,
  points_awarded int not null default 0,
  unique (candidate_id, pattern_id)
);

alter table calibration_matches add column if not exists evidence_quality text check (evidence_quality in ('HIGH', 'MEDIUM', 'LOW', 'NO_EVIDENCE'));

-- ---------------------------------------------------------------------------
-- Interview probes (auto-generated for gap criteria)
-- ---------------------------------------------------------------------------
create table if not exists interview_probes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates (id) on delete cascade,
  criterion_key text not null,
  question text not null
);

-- ---------------------------------------------------------------------------
-- Interview briefs + draft emails
-- ---------------------------------------------------------------------------
create table if not exists interview_briefs (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid unique not null references candidates (id) on delete cascade,
  summary text not null,
  strengths text[] not null default '{}',
  gaps text[] not null default '{}',
  missing_evidence text[] not null default '{}',
  email_interview_subject text,
  email_interview_body text,
  email_rejection_subject text,
  email_rejection_body text,
  sent_email_type text check (sent_email_type in ('interview', 'rejection')),
  sent_at timestamptz
);

alter table interview_briefs add column if not exists missing_evidence text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- Storage bucket for uploaded resume files
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;
