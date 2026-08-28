-- Adds a second, separate income figure ("other income" — e.g. a side gig or a
-- spouse's pay) and a manually-entered total balance figure, both shown on the
-- dashboard alongside the existing monthly_income. Same pattern as 0003: a flat
-- recurring/point-in-time value per user, not historized per calendar month.

alter table public.profiles
  add column if not exists other_income numeric(10, 2) not null default 0,
  add column if not exists total_balance numeric(10, 2) not null default 0;
