-- Ruchi Vana Ledger — optional performance helpers.
--
-- NOT required to run. The app fetches once and computes balances in the
-- browser, which is correct and fast at the current data volume. Run this
-- only when the expense history grows large enough that shipping every row
-- to the client to compute balances feels heavy — it moves that computation
-- into Postgres so the balances payload stays tiny (one row per person).
--
-- Safe to run in the Supabase SQL editor. It creates a function; the API's
-- /api/data endpoint would then call supabaseAdmin.rpc('get_balances') and
-- fall back to client-side compute if the function is absent.

create or replace function get_balances()
returns table (
  id uuid,
  name text,
  paid numeric,
  owed_share numeric,
  net numeric
)
language sql
stable
as $$
  with deferred as (
    select e.id, e.amount, e.paid_by, e.expense_date
    from expenses e
    where e.settled = false
  ),
  -- the split version active on each deferred expense's own date
  applicable as (
    select d.id as expense_id, d.amount, d.paid_by,
           (select sv.id
              from split_versions sv
             where sv.start_date <= d.expense_date
             order by sv.start_date desc
             limit 1) as version_id
    from deferred d
  ),
  -- what each person personally paid on deferred expenses
  paid_by_person as (
    select paid_by as person_id, sum(amount) as amount
    from deferred group by paid_by
  ),
  -- plus repayment amounts they funded
  funded as (
    select funded_by as person_id, sum(amount) as amount
    from repayments where funded_by is not null group by funded_by
  ),
  paid_total as (
    select person_id, sum(amount) as amount from (
      select person_id, amount from paid_by_person
      union all
      select person_id, amount from funded
    ) x group by person_id
  ),
  -- each person's split share across all deferred expenses
  owed as (
    select ss.person_id, sum(a.amount * ss.percentage / 100.0) as amount
    from applicable a
    join split_shares ss on ss.version_id = a.version_id
    group by ss.person_id
  )
  select p.id,
         p.name,
         round(coalesce(pt.amount, 0), 2) as paid,
         round(coalesce(o.amount, 0), 2) as owed_share,
         round(coalesce(pt.amount, 0) - coalesce(o.amount, 0), 2) as net
  from people p
  left join paid_total pt on pt.person_id = p.id
  left join owed o on o.person_id = p.id
  order by net desc;
$$;

-- Ledger pagination note: when the list gets long, /api/data (or a dedicated
-- /api/expenses?month=YYYY-MM&limit=&offset=) can page with Supabase's
-- .range(offset, offset + limit - 1) and default to the current month. The
-- expenses(expense_date) index already supports that ordering.
