-- Bank-sync via Plaid. plaid_items holds one row per connected bank connection, including
-- the access_token — a live credential that can pull the user's real bank data, so unlike
-- every other table here it gets RLS enabled with *no* policies at all: the anon/authenticated
-- PostgREST roles get zero access, and only the service-role key (used exclusively inside the
-- plaid-* edge functions, never forwarded to the browser) can read or write it.
create table if not exists public.plaid_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null unique,
  access_token text not null,
  institution_name text,
  cursor text,
  created_at timestamptz not null default now()
);

alter table public.plaid_items enable row level security;

create index if not exists plaid_items_user_idx on public.plaid_items (user_id);

-- Client-safe view: the same rows as plaid_items minus access_token, scoped to the
-- caller directly in the view body rather than via RLS (plaid_items has none — see
-- above). This lets the Settings page list what's connected without ever being able
-- to select the token itself.
create or replace view public.plaid_connections as
select id, item_id, institution_name, created_at
from public.plaid_items
where user_id = (select auth.uid());

grant select on public.plaid_connections to authenticated;

-- Transactions pulled from Plaid are tagged so the UI can distinguish them from manual
-- entries, and plaid_transaction_id is the dedup key a resync upserts against. A plain
-- unique index is enough — Postgres never treats two NULLs as conflicting, so manual
-- entries (which leave this column null) are untouched by the constraint.
alter table public.transactions
  add column if not exists source text not null default 'manual',
  add column if not exists plaid_transaction_id text;

create unique index if not exists transactions_user_plaid_id_idx
  on public.transactions (user_id, plaid_transaction_id);
