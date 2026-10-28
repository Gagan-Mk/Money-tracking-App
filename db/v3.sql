-- Ruchi Vana v3 migration: active-member flag, loan funding, 50/50 split.
-- Run once in the Supabase SQL Editor. Idempotent and safe to re-run.
-- (The password rotation is applied separately — see the deploy notes.)

-- Active-member flag. Ex-members keep their history but drop out of the UI
-- and are pooled as "Ex spendings".
alter table people add column if not exists is_active boolean not null default true;

-- A bill can be paid from a raised loan instead of a founder.
alter table expenses add column if not exists from_loan boolean not null default false;

-- Loans raised; loan-funded expenses draw these down.
create table if not exists loans (
  id uuid primary key default gen_random_uuid(),
  amount numeric(12,2) not null check (amount > 0),
  raised_on date not null default current_date,
  source text,
  note text,
  created_by uuid references people(id),
  created_at timestamptz not null default now()
);
alter table loans enable row level security;

-- Ankith leaves the active roster: login disabled, hidden from the UI.
-- His spending stays in history and shows as "Ex spendings".
update people set is_active = false, can_login = false where username = 'ankith';

-- New 50/50 split between Gagan and Yashas, effective today. Past expenses keep
-- whatever split applied on their own date. Guarded against duplicate runs.
insert into split_versions (start_date)
select current_date
where not exists (select 1 from split_versions where start_date = current_date);

insert into split_shares (version_id, person_id, percentage)
select v.id, p.id, 50
from split_versions v
join people p on p.username in ('gagan', 'yashas')
where v.start_date = current_date
  and not exists (
    select 1 from split_shares s where s.version_id = v.id and s.person_id = p.id
  );

notify pgrst, 'reload schema';
