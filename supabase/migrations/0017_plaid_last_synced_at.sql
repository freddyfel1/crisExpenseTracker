-- Applied directly to the live project via the Supabase MCP; saved here so a fresh
-- project ends up in the same state. See supabase/README.md.
--
-- The Connect to bank page only ever showed a connection's created_at ("since Sept 5"),
-- which never changes even when sync runs successfully and finds nothing new — making a
-- perfectly healthy connection look stuck. last_synced_at is stamped by plaid-sync-transactions
-- on every attempt (success or Plaid-side error alike counts as "we tried"), so the UI can
-- show real sync freshness instead of the connection's age.
alter table public.plaid_items
  add column if not exists last_synced_at timestamptz;

-- Postgres won't let CREATE OR REPLACE change a table-returning function's column list,
-- so the old signature has to be dropped first.
drop function if exists public.get_plaid_connections();

create function public.get_plaid_connections()
returns table (id uuid, item_id text, institution_name text, created_at timestamptz, last_synced_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select id, item_id, institution_name, created_at, last_synced_at
  from public.plaid_items
  where user_id = auth.uid()
$$;

revoke all on function public.get_plaid_connections() from public, anon;
grant execute on function public.get_plaid_connections() to authenticated;
