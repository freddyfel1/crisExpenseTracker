-- Savings goals: named targets (e.g. "Vacation fund") with a target amount
-- and a manually-tracked current amount, shown with progress on a new page.

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  target_amount numeric(10, 2) not null default 0,
  current_amount numeric(10, 2) not null default 0,
  target_date date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.savings_goals enable row level security;

create policy "savings goals are owner-readable" on public.savings_goals
  for select using (auth.uid() = user_id);
create policy "savings goals are owner-writable" on public.savings_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists savings_goals_user_idx on public.savings_goals (user_id);
