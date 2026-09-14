# Ruchi Vana Ledger

Expense tracker for the 3 RV founders (+ Vyuh Gravity as a funding entity).
Rebuilt as a **static Bootstrap frontend + thin Vercel API** over Supabase —
fast, responsive across phone / iPad / laptop, and deploys on Vercel like before.

## How the money math works

- Every expense has a **payer** (a founder or Vyuh Gravity) and a **Settled?** flag.
- **Settled = yes** → already squared up in person, just a record, doesn't touch balances.
- **Settled = no (default)** → deferred. It accumulates into "RV owes X" until RV can repay it.
- The 3-way founder split is **not** entered in the app — it lives only in the database
  (`split_versions` / `split_shares`), edited via the scripts below. Each deferred expense
  automatically uses whichever split ratio was active *on that expense's date*, so changing
  the ratio later never changes past months' numbers.
- Balance per founder = (what they personally paid on deferred expenses, plus any repayment
  amounts they funded) − (their split share across all deferred expenses). Vyuh Gravity has
  no split share — RV just owes it back whatever it paid. Balances always net to zero.

The math lives in one place and is unit-tested: `lib/balances.js` (server) and its identical
client port `js/balances.js` (browser). `npm test` asserts they agree.

## Architecture (why it's fast now)

- **Static pages** (`index.html`, `ledger.html`, `login.html`) with separate `css/` and `js/`
  — they paint instantly, no per-navigation server render.
- **One data call**: `/api/data` returns people + expenses + repayments + split versions in a
  single request. The browser caches it (memory + `sessionStorage`) and computes month totals,
  balances and the settlement-split preview locally, so switching Dashboard ↔ Ledger needs no
  network. Mutations refresh just that cache.
- **Thin serverless API** in `/api` holds the Supabase **service-role key** and the login/session
  logic — the browser never sees the key. Auth is the same jose-signed cookie + bcrypt hashes as
  before, so your existing accounts and data work unchanged.
- Bootstrap 5.3 (CDN) provides the responsive grid + modal; `css/theme.css` re-skins it into the
  warm "soil / harvest / parchment" identity.

```
index.html · ledger.html · login.html   static pages
css/theme.css · css/app.css              palette + components
js/api.js        one cached /api/data fetch + mutations (+ ?mock=1 preview)
js/balances.js   client port of the ledger math
js/dashboard.js · js/ledger.js · js/login.js   page logic
js/add-expense.js  shared add/edit modal + local split preview
api/data.js      GET: combined bootstrap payload (auth-gated)
api/expenses.js  POST/PATCH/DELETE expenses (+ settlement repayments)
api/login.js · api/logout.js · api/session.js   auth
lib/             supabaseAdmin, auth (jose), session (cookie), splits, balances, cookies
db/schema.sql    Postgres schema (unchanged)   db/perf.sql   optional scale-path RPC
scripts/         seed.js, update-split.js (unchanged)
```

## One-time setup

Same Supabase project and env as before — nothing in the database changes.

1. **Supabase**: SQL Editor → run `db/schema.sql` (already done for the live project).
2. **Env**: copy `.env.example` to `.env.local` and fill in:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SESSION_SECRET` — `openssl rand -base64 32`
3. **Accounts + initial split** (already seeded on the live project):
   ```
   npm install
   export $(cat .env.local | xargs)
   npm run seed
   ```

## Run locally

Two options:

- **Full app (API + pages)** — needs the Vercel CLI and your `.env.local`:
  ```
  npm install
  npm run dev        # vercel dev — serves the static pages AND /api functions
  ```
  Open the printed URL and log in with a seeded account.

- **UI only, no backend** — preview the pages/responsiveness with built-in mock data:
  ```
  npm run preview    # python3 -m http.server 4173
  ```
  Then open `http://localhost:4173/index.html?mock=1` (the `?mock=1` makes every page render
  from `js/mock-data.json`, so no database or login is needed).

Run the math tests any time with `npm test`.

## Deploy

1. Push to GitHub, import into Vercel (framework preset: **Other** — it's static + `/api`).
2. Add the three env vars in Vercel → Project Settings → Environment Variables.
3. Point your domain / subdomain at the deployment.

## Changing the split ratio later

Edit `scripts/update-split.js` (set `NEW_START_DATE` and the new percentages) and run
`npm run update-split`. It adds a new split version effective from that date only; everything
before it is untouched.

## Scale path (optional, not needed yet)

`db/perf.sql` documents a `get_balances()` Postgres function that computes balances in SQL, plus
a ledger-pagination note — for whenever the expense history is large enough that shipping every
row to the browser feels heavy.

## Not built yet

- Recording repayments *against* a balance from the ledger UI (repayments are captured today only
  as part of settling an expense).
- Per-founder password change from within the app (update `password_hash` in Supabase directly
  with a fresh `bcrypt.hash()`).
