-- Kargo AI Hiring Dashboard — database schema
-- Run this in your Supabase project's SQL Editor (Database > SQL Editor > New query).
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT throughout.

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
We have one product, a growing customer base, and no dedicated PM function yet. The person in this role will be the first PM at Kargo focused on our core platform — the day-to-day tool that operations teams at freight forwarders live inside.

What You'll Own
- The product roadmap for Kargo's core operations platform: shipment tracking, documentation workflows, and real-time status visibility
- Customer discovery — understanding where the platform is helping and where it isn't
- Working directly with the engineering team to define what gets built, in what order, and why
- The rhythms a PM function needs: prioritisation, tracking outcomes, decision communication

What We're Looking For
- 2-4 years of product management experience, ideally at a company building for the first time
- Comfort operating without structure — no PM handbook, no design system, no sprint template
- Evidence that you've shipped things, killed things, and learned from both
- Genuine curiosity about how operations work at ground level
- Mumbai-based or willing to relocate. This role is in-office$$)
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
  role text not null check (role in ('PM', 'SPM')),
  resume_storage_path text,
  resume_text text,
  raw_extraction jsonb,
  years_pm_experience numeric,
  experience_flags text[] not null default '{}',
  eligibility text check (eligibility in ('eligible', 'ineligible')),
  overall_score numeric,
  confidence text check (confidence in ('HIGH', 'MEDIUM', 'LOW', 'NO_EVIDENCE')),
  status text not null default 'processing' check (status in ('processing', 'scored', 'error')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists candidates_role_idx on candidates (role);
create index if not exists candidates_score_idx on candidates (role, overall_score desc);

-- ---------------------------------------------------------------------------
-- Criterion-level scores
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
-- Past-hire calibration (worth 15/100). Seeded from Kargo's 8 historical
-- hires (name/role/joined/rating table + CVs supplied in the case brief).
-- See source_note on each row for how the pattern was derived — nothing here
-- is fabricated; each pattern is evidence present in the "Exceeds
-- Expectations" hires and absent (or weak) in the "Meets"/"Below" hires.
-- ---------------------------------------------------------------------------
create table if not exists calibration_patterns (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  description text not null,
  evidence_signal text not null,
  points int not null,
  source_note text not null,
  active boolean not null default true
);

insert into calibration_patterns (key, name, description, evidence_signal, points, source_note) values
(
  'unprompted_build_adopted',
  'Unprompted Build, Adopted Beyond Role',
  'Candidate spotted a gap nobody assigned them to fix, built the fix/process/tool themselves, and it was adopted by others beyond their own task.',
  'Look for: identified an unrequested problem; built a tool, process, or workaround on their own initiative (not assigned); the result was adopted by colleagues, a team, or a client beyond the candidate''s own role.',
  6,
  'Present in all 5 "Exceeds Expectations" historical hires (e.g. built a verification module over a weekend that 30 colleagues adopted; redesigned an intake workflow after a vendor change with no request to do so, retained permanently by the team; built the company''s first case study programme; built an onboarding framework the whole team now uses). Weak or absent in the "Meets"/"Below" hires, whose achievements were largely assigned work delivered well rather than self-initiated and adopted beyond their lane.'
),
(
  'ground_level_ops_exposure',
  'Ground-Level Logistics / Operations Exposure',
  'Candidate has direct, hands-on exposure to freight forwarding, customs documentation, port operations, carrier coordination, or supply-chain execution — not just abstract familiarity with the domain.',
  'Look for: roles or bullets describing direct work with shipments, customs, carriers, ports, freight documentation, or supply-chain operations at the execution level (not just "worked in logistics SaaS").',
  5,
  'Present in all 5 "Exceeds Expectations" historical hires (freight/customs/ops backgrounds preceding their eventual role, or direct port/terminal-level client work). Absent in the two "Meets Expectations" hires and the one "Below Expectations" hire, whose experience was entirely inside generic SaaS/engineering without ground-level operational exposure.'
),
(
  'owned_high_stakes_moment',
  'Owned a High-Stakes Moment Without Escalating',
  'Candidate resolved an urgent, consequential problem (outage, deadline, compliance issue, escalation) on their own authority — same-day or overnight — without waiting for a playbook or escalating it upward first.',
  'Look for: a specific incident with real stakes (compliance deadline, production outage, customer escalation, time-boxed crisis) that the candidate resolved personally, quickly, and without handing it to someone senior first.',
  4,
  'Present in all 5 "Exceeds Expectations" historical hires (e.g. resolved a customs hold overnight before the client noticed; fixed a critical production issue same-day; ran a loss post-mortem and changed team practice off their own initiative). The "Meets"/"Below" hires show competent, assigned delivery but no comparable unscripted, self-owned crisis moment.'
)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  evidence_signal = excluded.evidence_signal,
  points = excluded.points,
  source_note = excluded.source_note;

-- Points must sum to 15 (calibration is worth 15/100 in the rubric).
-- 6 + 5 + 4 = 15.

create table if not exists calibration_matches (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates (id) on delete cascade,
  pattern_id uuid not null references calibration_patterns (id) on delete cascade,
  matched boolean not null,
  evidence_quote text,
  rationale text,
  points_awarded int not null default 0,
  unique (candidate_id, pattern_id)
);

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
  email_interview_subject text,
  email_interview_body text,
  email_rejection_subject text,
  email_rejection_body text,
  sent_email_type text check (sent_email_type in ('interview', 'rejection')),
  sent_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Storage bucket for uploaded resume files
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;
