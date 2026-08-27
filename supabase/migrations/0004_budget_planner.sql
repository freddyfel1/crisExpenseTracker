-- Budget Planner: a spreadsheet-style planned budget (sections of line items,
-- each with a monthly amount + notes), distinct from the per-category
-- `budgets.monthly_limit` used elsewhere. Mirrors the layout of the user's
-- own budget spreadsheet: sections -> line items, plus a savings figure used
-- in the summary (Income - Expenses = Difference; Difference - Savings = Balance).

alter table public.profiles
  add column if not exists monthly_savings numeric(10, 2) not null default 0;

create table if not exists public.budget_sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.budget_sections enable row level security;

create policy "budget sections are owner-readable" on public.budget_sections
  for select using (auth.uid() = user_id);
create policy "budget sections are owner-writable" on public.budget_sections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists budget_sections_user_idx on public.budget_sections (user_id, sort_order);

create table if not exists public.budget_line_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  section_id uuid not null references public.budget_sections (id) on delete cascade,
  name text not null,
  monthly_amount numeric(10, 2) not null default 0,
  misc_info text,
  remarks text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.budget_line_items enable row level security;

create policy "budget line items are owner-readable" on public.budget_line_items
  for select using (auth.uid() = user_id);
create policy "budget line items are owner-writable" on public.budget_line_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists budget_line_items_user_idx on public.budget_line_items (user_id);
create index if not exists budget_line_items_section_idx on public.budget_line_items (section_id, sort_order);
