# Ruchi Vana Ledger

Mobile-first expense tracker for the 3 RV founders (+ Vyuh Gravity as a funding entity).

## How the money math works

- Every expense has a **payer** (one founder, or Vyuh Gravity) and a **Settled?** flag.
- **Settled = yes** → already squared up in person, just a record, doesn't touch balances.
- **Settled = no (default)** → deferred. It accumulates into "RV owes X" until RV can repay it from profit.
- The 3-way founder split is **not** entered in the app — it lives only in the database
  (`split_versions` / `split_shares`), edited via the scripts below. Each deferred expense
  automatically uses whichever split ratio was active *on that expense's date*, so changing
  the ratio later never changes past months' numbers.
- Balance per founder = (what they personally paid on deferred expenses) − (their split share
  across all deferred expenses). Vyuh Gravity has no split share — RV just owes it back
  whatever it paid.

## One-time setup

### 1. Create the Supabase project
1. Go to [supabase.com](https://supabase.com), create a new project.
2. Open **SQL Editor**, paste in `db/schema.sql`, run it.
3. Open **Project Settings > API** — copy the **Project URL** and the **service_role** key
   (not the anon key — this app only ever talks to Supabase from the server).

### 2. Install dependencies
```
npm install
```

### 3. Environment variables
Copy `.env.example` to `.env.local` and fill in:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET` — generate with `openssl rand -base64 32`

### 4. Create the founders + initial split
Open `scripts/seed.js`, edit the `FOUNDERS` list (real names, usernames, temporary passwords)
and `INITIAL_SPLIT` (must add up to 100). Then, with your env vars loaded:
```
export $(cat .env.local | xargs)
node scripts/seed.js
```
This creates the 3 login accounts, the "Vyuh Gravity" payer, and the first split version.
**Change the placeholder passwords before doing this for real**, and have each founder change
theirs after first login if you want that (not built into the UI yet — update `password_hash`
in Supabase directly with a fresh `bcrypt.hash()` if needed).

### 5. Run locally
```
npm run dev
```
Visit `http://localhost:3000`, log in with one of the seeded accounts.

### 6. Deploy
1. Push this folder to a GitHub repo.
2. Import it into [Vercel](https://vercel.com).
3. Add the same three env vars in Vercel's Project Settings > Environment Variables.
4. Point your domain (or a subdomain like `ledger.ruchivana.com`) at the Vercel deployment.

## Changing the split ratio later

Edit `scripts/update-split.js` — set a `NEW_START_DATE` and the new percentages — and run it.
It adds a new split version effective from that date only; everything before it is untouched.

## What's in here

```
app/
  page.js              Dashboard: this month's total + who RV owes
  login/page.js         Login screen
  ledger/page.js         Full expense history, filterable by month/payer/settled
  api/login, logout      Session cookie handling
  api/expenses            List + create expenses
components/
  AddExpenseSheet.js     The + button and bottom-sheet add-expense form
  BalancesCard.js         "RV owes" card
  BottomNav.js             Dashboard/Ledger/Sign out
lib/
  balances.js              Core balance math (see comments in the file)
  splits.js                 Fetches split versions + shares from Supabase
  auth.js, session.js       Login cookie sign/verify
  supabaseAdmin.js           Server-only Supabase client (service role key)
db/schema.sql               Full Postgres schema for Supabase
scripts/seed.js               One-time: create founders + initial split
scripts/update-split.js        Add a new split version going forward
```

## Not built yet (flagged for later)
- Recording actual repayments (e.g. "RV paid Ankith back ₹5,000 from profit") to reduce a
  balance — right now the app only tracks what's owed, not payouts against it.
- Editing/deleting an expense after it's logged.
- Per-founder password change from within the app.
