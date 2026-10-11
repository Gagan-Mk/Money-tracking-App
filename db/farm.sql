-- Ruchi Vana — flock mortality + reminders tables.
-- Run this once in the Supabase SQL Editor (New query → paste → Run).
-- Idempotent and safe to re-run. The app tolerates these tables being absent
-- (the new sections just show empty) until you run this.

-- A batch (cohort) of hens. One is marked active; the dashboard shows it.
create table if not exists batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  started_on date,
  bird_count integer check (bird_count is null or bird_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- A mortality event: how many died, the mistake, and what to avoid next time.
create table if not exists mortality (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references batches(id) on delete cascade,
  event_date date not null default current_date,
  count integer not null check (count > 0),
  reason text,       -- what mistake happened
  prevention text,   -- next time what to avoid
  note text,
  created_by uuid references people(id),
  created_at timestamptz not null default now()
);

-- Dated reminders: vaccines, tasks, pending work, general reminders.
create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  due_date date not null,
  title text not null,
  kind text,         -- 'vaccine' | 'task' | 'pending' | 'reminder'
  note text,
  done boolean not null default false,
  created_by uuid references people(id),
  created_at timestamptz not null default now()
);

create index if not exists mortality_batch_idx on mortality (batch_id);
create index if not exists mortality_date_idx on mortality (event_date);
create index if not exists reminders_due_idx on reminders (due_date);

-- Same locked-down RLS as the rest of the app (service-role access only).
alter table batches enable row level security;
alter table mortality enable row level security;
alter table reminders enable row level security;

notify pgrst, 'reload schema';
