-- Reusable, admin-verified scorecard library. Applied to the live project as
-- migration `verified_scorecard_library`.
create table if not exists public.course_scorecards (
  id uuid primary key default gen_random_uuid(), course_name text not null,
  course_layout text not null default 'Main course', source_note text,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz not null default now(), created_at timestamptz not null default now(),
  unique (course_name, course_layout)
);
create table if not exists public.course_scorecard_tees (
  id uuid primary key default gen_random_uuid(), scorecard_id uuid not null references public.course_scorecards(id) on delete cascade,
  playing_category text not null check (playing_category in ('men','women')),
  tee_name text not null, source_images jsonb not null default '[]'::jsonb,
  unique (scorecard_id, playing_category)
);
create table if not exists public.course_scorecard_holes (
  tee_id uuid not null references public.course_scorecard_tees(id) on delete cascade,
  hole_number integer not null check (hole_number between 1 and 18), par integer not null check (par between 3 and 6),
  yards integer not null check (yards between 40 and 800), stroke_index integer not null check (stroke_index between 1 and 18),
  primary key (tee_id, hole_number)
);
