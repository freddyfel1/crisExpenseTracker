-- Scope budget sections (and, transitively, their line items) to a calendar
-- month so the Budget Planner can hold a separate plan per month, the way
-- the source spreadsheet has one tab per month.
alter table public.budget_sections
  add column if not exists month_key text not null default to_char(now(), 'YYYY-MM');

create index if not exists budget_sections_month_idx
  on public.budget_sections (user_id, month_key, sort_order);
