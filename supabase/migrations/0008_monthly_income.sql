-- Makes income a per-month figure instead of a single flat value on the
-- profile, so Income/Other income can vary month to month and the
-- Transactions page can show real historical income per month/year.
-- profiles.monthly_income/other_income are left in place (still read by the
-- mobile app, which hasn't been migrated to this table yet) but the web app
-- stops writing to them in favor of this table.

create table if not exists public.monthly_income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month_key text not null,
  monthly_income numeric(10, 2) not null default 0,
  other_income numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, month_key)
);

alter table public.monthly_income enable row level security;

create policy "monthly income is owner-readable" on public.monthly_income
  for select using (auth.uid() = user_id);
create policy "monthly income is owner-writable" on public.monthly_income
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists monthly_income_user_month_idx on public.monthly_income (user_id, month_key);

-- Seed the current month from the old flat profile figure so existing users
-- don't lose their number.
insert into public.monthly_income (user_id, month_key, monthly_income, other_income)
select id, to_char(now(), 'YYYY-MM'), monthly_income, other_income
from public.profiles
where monthly_income <> 0 or other_income <> 0
on conflict (user_id, month_key) do nothing;
