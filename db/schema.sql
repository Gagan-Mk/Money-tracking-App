-- Ruchi Vana Ledger — schema
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query)

create extension if not exists "pgcrypto";

-- Everyone who can either pay for something or (for founders) log in.
create table people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  username text unique,          -- null for non-login payers like Vyuh Gravity
  password_hash text,            -- null for non-login payers
  can_login boolean not null default false,
  is_admin boolean not null default false,  -- only the admin can edit split config
  created_at timestamptz not null default now()
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_by uuid not null references people(id),
  settled boolean not null default false,
  expense_date date not null default current_date,
  note text,
  created_by uuid references people(id),
  created_at timestamptz not null default now()
);

create table repayments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  repaid_by uuid not null references people(id),
  amount numeric(12,2) not null check (amount > 0),
  repayment_date date not null default current_date,
  funded_by uuid references people(id),
  note text,
  created_at timestamptz not null default now()
);

create index expenses_date_idx on expenses (expense_date);
create index expenses_paid_by_idx on expenses (paid_by);
create index expenses_settled_idx on expenses (settled);
create index repayments_expense_idx on repayments (expense_id);
create index repayments_repaid_by_idx on repayments (repaid_by);
create index repayments_funded_by_idx on repayments (funded_by);

-- Backend-only split configuration. A new version can be added any time;
-- it only applies to expenses dated on/after its start_date, so past
-- months' math is never touched.
create table split_versions (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  created_at timestamptz not null default now()
);

create table split_shares (
  version_id uuid not null references split_versions(id) on delete cascade,
  person_id uuid not null references people(id),
  percentage numeric(5,2) not null check (percentage >= 0 and percentage <= 100),
  primary key (version_id, person_id)
);

-- Row Level Security: this app only ever talks to Supabase via the
-- service role key from server-side code, so RLS can stay locked down
-- with no public policies. Nothing is reachable directly from the browser.
alter table people enable row level security;
alter table expenses enable row level security;
alter table repayments enable row level security;
alter table split_versions enable row level security;
alter table split_shares enable row level security;

-- Flock tracking: batches of hens, mortality events, and dated reminders.
create table batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  started_on date,
  bird_count integer check (bird_count is null or bird_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table mortality (
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

create table reminders (
  id uuid primary key default gen_random_uuid(),
  due_date date not null,
  title text not null,
  kind text,         -- 'vaccine' | 'task' | 'pending' | 'reminder'
  note text,
  done boolean not null default false,
  created_by uuid references people(id),
  created_at timestamptz not null default now()
);

create index mortality_batch_idx on mortality (batch_id);
create index mortality_date_idx on mortality (event_date);
create index reminders_due_idx on reminders (due_date);

alter table batches enable row level security;
alter table mortality enable row level security;
alter table reminders enable row level security;
