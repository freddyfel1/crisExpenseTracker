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

Once both are set, restart the dev servers. The web app currently runs on mock
localStorage data — that's a separate data layer (`web/src/data/store.tsx`) and won't
switch to Supabase automatically. Say the word when you're ready and I'll wire it up
(swap the store for live queries) — I held off so the working demo doesn't break
before you've actually got a project to point it at.

## 5. (Later) Enable email auth

Auth → Providers → Email is on by default, which is enough for a personal app.
Turn on "Confirm email" only if you want the verification step; for solo/dev use it's
fine to leave it off.
