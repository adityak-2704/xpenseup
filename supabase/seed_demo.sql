-- ═══════════════════════════════════════════════════════════════════════════
-- XpenseUp — optional demo data
--
-- Run this AFTER you have registered arjun@demo.com (password demo123) through
-- the app's own Register tab. Passwords are hashed by Supabase Auth, so the
-- account has to be created through the sign-up form rather than in SQL.
--
-- Safe to re-run: it wipes and rewrites only the demo user's own rows.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  demo_id uuid;
  m       int  := extract(month from current_date);
  y       int  := extract(year  from current_date);
  d       date;
begin
  select id into demo_id from public.profiles
  where lower(email) = 'arjun@demo.com';

  if demo_id is null then
    raise notice 'arjun@demo.com not found — register it in the app first, then re-run.';
    return;
  end if;

  update public.profiles
     set budget = 15000,
         name   = 'Arjun Sharma',
         avatar = '🧑‍💻',
         color  = '#7c5cfc'
   where id = demo_id;

  delete from public.transactions where user_id = demo_id;

  d := make_date(y, m, 1);

  insert into public.transactions (user_id, type, amount, category, note, date) values
    (demo_id, 'debit',   120, 'snacks',    'Chai & biscuits',      current_date),
    (demo_id, 'debit',   850, 'food',      'Lunch with friends',   current_date),
    (demo_id, 'credit', 5000, 'salary',    'Part-time stipend',    current_date),
    (demo_id, 'debit',   299, 'recharge',  'Jio recharge',         least(d + 14, current_date)),
    (demo_id, 'debit',  1200, 'transport', 'Auto & metro',         least(d + 17, current_date)),
    (demo_id, 'debit',  3500, 'education', 'Online course fees',   least(d +  9, current_date)),
    (demo_id, 'debit',   450, 'groceries', 'Vegetables & atta',    least(d + 11, current_date)),
    (demo_id, 'debit',   699, 'entertain', 'Netflix subscription', least(d +  4, current_date)),
    (demo_id, 'credit', 2000, 'salary',    'Freelance payment',    least(d +  7, current_date)),
    (demo_id, 'debit',   280, 'health',    'Pharmacy',             least(d + 19, current_date));

  raise notice 'Seeded 10 demo transactions for arjun@demo.com.';
end $$;
