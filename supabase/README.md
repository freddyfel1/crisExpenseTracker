# Supabase setup

This is the shared backend for both the web dashboard (`web/`) and the mobile app (`mobile/`).

## 1. Create a project

1. Go to [supabase.com](https://supabase.com) and create a free account/project (this step has to be done by you — sign-up isn't something I can do on your behalf).
2. Pick a region close to you and a database password (save it somewhere).

## 2. Run the migration

In the Supabase dashboard, open **SQL Editor** → paste the contents of
[`migrations/0001_init.sql`](migrations/0001_init.sql) → **Run**.

This creates:
- `profiles`, `categories`, `transactions`, `budgets` tables with row-level security (every row is scoped to `auth.uid()`, so users can only ever see their own data)
- a trigger that seeds each new signup with a profile and the 16 starter categories
- a private `receipts` storage bucket, one folder per user, for receipt photos

## 3. Get your API keys

**Project Settings → API** gives you:
- `Project URL`
- `anon` `public` key

## 4. Wire them into the apps

**Web** (`web/.env.local`, gitignored):
```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

**Mobile** (`mobile/.env`, gitignored):
```
EXPO_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

Once both are set, restart the dev servers. Both apps read and write straight to
Supabase — there's no separate mock/localStorage data layer to switch off.

## 5. (Later) Enable email auth

Auth → Providers → Email is on by default, which is enough for a personal app.
Turn on "Confirm email" only if you want the verification step; for solo/dev use it's
fine to leave it off.

## 6. (Later) Bank sync via Plaid

1. Run [`migrations/0010_plaid_connections.sql`](migrations/0010_plaid_connections.sql) and [`migrations/0011_plaid_connections_fn.sql`](migrations/0011_plaid_connections_fn.sql) the same way as step 2, in order.
2. Create a free account at [plaid.com](https://plaid.com) and grab your `client_id` and `sandbox` secret from the dashboard.
3. Deploy the `plaid-link-token`, `plaid-exchange-token`, and `plaid-sync-transactions` functions under `functions/`, then set these secrets on the project (Edge Functions → Manage secrets, or `supabase secrets set`):
   - `PLAID_CLIENT_ID`
   - `PLAID_SECRET`
   - `PLAID_ENV` — `sandbox` while testing, `production` once Plaid approves the app for real accounts.

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected into every edge function automatically — no need to set those yourself.
