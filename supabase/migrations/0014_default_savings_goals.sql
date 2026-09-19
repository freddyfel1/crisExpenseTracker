-- Applied directly to the live project via the Supabase MCP; saved here so a fresh
-- project ends up in the same state. See supabase/README.md.
--
-- Every user gets three starter savings goals (Goal1/Goal2/Goal3) and three matching
-- "Transfer to GoalN" categories, so there's somewhere to log a transaction that's really
-- money moving into a goal rather than an expense. Both are placeholders the user renames.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''));

  insert into public.categories (user_id, name, icon, color) values
    (new.id, 'Food & Dining',     'UtensilsCrossed', '#b4483a'),
    (new.id, 'Groceries',         'ShoppingBasket',  '#2f6f52'),
    (new.id, 'Transportation',    'Bus',             '#3b6e8f'),
    (new.id, 'Fuel',              'Fuel',            '#a15c2f'),
    (new.id, 'Shopping',          'ShoppingBag',     '#8a5fb0'),
    (new.id, 'Bills & Utilities', 'Receipt',         '#5a5f52'),
    (new.id, 'Rent/Housing',      'Home',            '#1e4a37'),
    (new.id, 'Health',            'HeartPulse',      '#c0546b'),
    (new.id, 'Entertainment',     'Clapperboard',    '#b3872f'),
    (new.id, 'Travel',            'Plane',           '#3f7d7a'),
    (new.id, 'Education',         'GraduationCap',   '#4a5a8f'),
    (new.id, 'Subscriptions',     'RefreshCcw',      '#6b6f3f'),
    (new.id, 'Personal Care',     'Sparkles',        '#b0708a'),
    (new.id, 'Gifts & Donations', 'Gift',            '#c46b3f'),
    (new.id, 'Business',          'Briefcase',       '#3f4f6b'),
    (new.id, 'Other',             'CircleDashed',    '#7c8175'),
    (new.id, 'Transfer to Goal1', 'PiggyBank',       '#2d7d6b'),
    (new.id, 'Transfer to Goal2', 'PiggyBank',       '#1f6f8f'),
    (new.id, 'Transfer to Goal3', 'PiggyBank',       '#4f6f3f');

  insert into public.savings_goals (user_id, name, target_amount, current_amount, sort_order) values
    (new.id, 'Goal1', 0, 0, 0),
    (new.id, 'Goal2', 0, 0, 1),
    (new.id, 'Goal3', 0, 0, 2);

  return new;
end;
$$;

-- Backfill for users who signed up before this migration.
insert into public.categories (user_id, name, icon, color)
select u.id, v.name, 'PiggyBank', v.color
from auth.users u
cross join (values
  ('Transfer to Goal1', '#2d7d6b'),
  ('Transfer to Goal2', '#1f6f8f'),
  ('Transfer to Goal3', '#4f6f3f')
) as v(name, color)
on conflict (user_id, name) do nothing;

insert into public.savings_goals (user_id, name, target_amount, current_amount, sort_order)
select u.id, v.name, 0, 0, v.sort_order
from auth.users u
cross join (values ('Goal1', 0), ('Goal2', 1), ('Goal3', 2)) as v(name, sort_order)
where not exists (
  select 1 from public.savings_goals sg where sg.user_id = u.id and sg.name = v.name
);
