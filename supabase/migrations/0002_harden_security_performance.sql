-- Applied directly to the live project via the Supabase MCP; saved here so a fresh
-- project ends up in the same state. See supabase/README.md.

-- Lock down handle_new_user: it should only ever run via the auth.users trigger,
-- not be directly callable through the REST RPC endpoint by anon/authenticated.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- profiles: wrap auth.uid() in a subselect so it's evaluated once per query, not once per row.
drop policy if exists "profiles are self-readable" on public.profiles;
drop policy if exists "profiles are self-updatable" on public.profiles;
drop policy if exists "profiles are self-insertable" on public.profiles;

create policy "profiles are self-readable" on public.profiles
  for select using ((select auth.uid()) = id);
create policy "profiles are self-updatable" on public.profiles
  for update using ((select auth.uid()) = id);
create policy "profiles are self-insertable" on public.profiles
  for insert with check ((select auth.uid()) = id);

-- categories: the separate "-readable" policy was fully redundant with "-writable" (FOR ALL
-- already covers SELECT), which was forcing Postgres to evaluate both on every read.
drop policy if exists "categories are owner-readable" on public.categories;
drop policy if exists "categories are owner-writable" on public.categories;
create policy "categories are owner-access" on public.categories
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- transactions: same redundant-policy fix.
drop policy if exists "transactions are owner-readable" on public.transactions;
drop policy if exists "transactions are owner-writable" on public.transactions;
create policy "transactions are owner-access" on public.transactions
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- budgets: same redundant-policy fix.
drop policy if exists "budgets are owner-readable" on public.budgets;
drop policy if exists "budgets are owner-writable" on public.budgets;
create policy "budgets are owner-access" on public.budgets
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- missing covering indexes on foreign keys (needed for efficient FK-constraint checks,
-- e.g. when a category is deleted and Postgres scans for referencing rows).
create index if not exists budgets_category_id_idx on public.budgets (category_id);
create index if not exists transactions_category_id_idx on public.transactions (category_id);
