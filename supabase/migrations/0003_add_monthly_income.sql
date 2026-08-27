-- Applied directly to the live project via the Supabase MCP; saved here so a fresh
-- project ends up in the same state. See supabase/README.md.

alter table public.profiles
  add column if not exists monthly_income numeric(10, 2) not null default 0;
