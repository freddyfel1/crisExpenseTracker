-- total_balance (added in 0005) was replaced by a computed "Total income"
-- stat (monthly_income + other_income) on the dashboard before it was ever
-- used, so drop it rather than leave unused schema around.

alter table public.profiles
  drop column if exists total_balance;
