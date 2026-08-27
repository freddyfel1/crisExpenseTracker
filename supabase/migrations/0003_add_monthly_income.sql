-- Adds a single editable monthly income figure per user, shown on the dashboard
-- alongside total expense. Mirrors the existing budgets.monthly_limit pattern:
-- one recurring value, not historized per calendar month.

alter table public.profiles
  add column if not exists monthly_income numeric(10, 2) not null default 0;
