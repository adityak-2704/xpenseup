-- ═══════════════════════════════════════════════════════════════════════════
-- XpenseUp — central database schema (Supabase / Postgres)
--
-- Run this ONCE in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It is idempotent: re-running it is safe.
--
-- Design notes
--   * Auth lives in Supabase's own `auth.users` table. Passwords are bcrypt
--     hashed by Supabase; this app never sees or stores a password.
--   * `public.profiles` mirrors auth.users 1:1 and holds display data + budget.
--   * Every table is protected by Row Level Security, so the browser's anon key
--     can only ever read rows the logged-in user is entitled to.
--   * Membership checks go through SECURITY DEFINER functions. Doing the lookup
--     inline inside a policy on group_members would make that policy consult
--     itself and Postgres would abort with "infinite recursion detected".
-- ═══════════════════════════════════════════════════════════════════════════

-- ── PROFILES ───────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text        not null default '',
  email      text        not null,
  avatar     text        not null default '🧑‍💻',
  color      text        not null default '#7c5cfc',
  budget     numeric(12,2) not null default 12000 check (budget >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_email_lower_idx
  on public.profiles (lower(email));

-- ── TRANSACTIONS (personal ledger) ─────────────────────────────────────────
create table if not exists public.transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  type       text        not null check (type in ('debit', 'credit')),
  amount     numeric(12,2) not null check (amount > 0),
  category   text        not null default 'other',
  note       text        not null default '',
  date       date        not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc);

-- ── GROUPS (shared between real accounts) ──────────────────────────────────
-- Foreign keys point at public.profiles rather than auth.users so that
-- PostgREST can infer the relationships and serve a whole group — members,
-- expenses and splits — in a single embedded request.
create table if not exists public.groups (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null check (length(trim(name)) > 0),
  created_by uuid        not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id  uuid not null references public.groups (id)   on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists group_members_user_idx
  on public.group_members (user_id);

create table if not exists public.group_expenses (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid        not null references public.groups (id) on delete cascade,
  description text        not null default '',
  amount      numeric(12,2) not null check (amount > 0),
  paid_by     uuid        not null references public.profiles (id),
  date        date        not null default current_date,
  created_at  timestamptz not null default now()
);

create index if not exists group_expenses_group_idx
  on public.group_expenses (group_id, date desc);

create table if not exists public.expense_splits (
  id         uuid primary key default gen_random_uuid(),
  expense_id uuid    not null references public.group_expenses (id) on delete cascade,
  user_id    uuid    not null references public.profiles (id) on delete cascade,
  amount     numeric(12,2) not null check (amount >= 0),
  settled    boolean not null default false,
  unique (expense_id, user_id)
);

create index if not exists expense_splits_user_idx
  on public.expense_splits (user_id);

-- ── HELPER FUNCTIONS ───────────────────────────────────────────────────────
-- SECURITY DEFINER so they bypass RLS on the tables they read. Without this,
-- a policy on group_members that looks at group_members would recurse forever.

create or replace function public.is_group_member(gid uuid)
returns boolean language sql security definer stable
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_owner(gid uuid)
returns boolean language sql security definer stable
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.groups
    where id = gid and created_by = auth.uid()
  );
$$;

-- True when the caller and `other` sit in at least one group together.
-- Gates profile visibility: you can see the name/avatar of people you split
-- with, and nobody else.
create or replace function public.shares_group_with(other uuid)
returns boolean language sql security definer stable
set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = auth.uid() and theirs.user_id = other
  );
$$;

create or replace function public.expense_group(eid uuid)
returns uuid language sql security definer stable
set search_path = public, pg_temp as $$
  select group_id from public.group_expenses where id = eid;
$$;

create or replace function public.expense_payer(eid uuid)
returns uuid language sql security definer stable
set search_path = public, pg_temp as $$
  select paid_by from public.group_expenses where id = eid;
$$;

-- ── AUTO-CREATE A PROFILE ON SIGN UP ───────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, name, email, avatar, color)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
             split_part(new.email, '@', 1)),
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'avatar', ''), '🧑‍💻'),
    coalesce(nullif(new.raw_user_meta_data ->> 'color',  ''), '#7c5cfc')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── ADD-A-MEMBER LOOKUP ────────────────────────────────────────────────────
-- Groups are built by typing a member's email. This deliberately does NOT
-- return the email column and only matches in full, so it cannot be used to
-- enumerate the user base.
create or replace function public.find_profile_by_email(lookup_email text)
returns table (id uuid, name text, avatar text, color text)
language sql security definer stable
set search_path = public, pg_temp as $$
  select p.id, p.name, p.avatar, p.color
  from public.profiles p
  where auth.uid() is not null
    and lower(p.email) = lower(trim(lookup_email))
  limit 1;
$$;

revoke all on function public.find_profile_by_email(text) from anon;
grant execute on function public.find_profile_by_email(text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- The browser ships with the anon key, which is public by design. RLS is what
-- actually keeps one user out of another user's ledger, so every table gets it.
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.profiles       enable row level security;
alter table public.transactions   enable row level security;
alter table public.groups         enable row level security;
alter table public.group_members  enable row level security;
alter table public.group_expenses enable row level security;
alter table public.expense_splits enable row level security;

-- ── profiles ───────────────────────────────────────────────────────────────
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_group_with(id));

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ── transactions: strictly private ─────────────────────────────────────────
drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists transactions_insert on public.transactions;
create policy transactions_insert on public.transactions for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists transactions_update on public.transactions;
create policy transactions_update on public.transactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists transactions_delete on public.transactions;
create policy transactions_delete on public.transactions for delete to authenticated
  using (user_id = auth.uid());

-- ── groups ─────────────────────────────────────────────────────────────────
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups for select to authenticated
  using (created_by = auth.uid() or public.is_group_member(id));

drop policy if exists groups_insert on public.groups;
create policy groups_insert on public.groups for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists groups_delete on public.groups;
create policy groups_delete on public.groups for delete to authenticated
  using (created_by = auth.uid());

-- ── group_members ──────────────────────────────────────────────────────────
drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members for select to authenticated
  using (user_id = auth.uid() or public.is_group_member(group_id));

-- The owner adds people; an existing member may also pull someone in.
drop policy if exists group_members_insert on public.group_members;
create policy group_members_insert on public.group_members for insert to authenticated
  with check (public.is_group_owner(group_id) or public.is_group_member(group_id));

-- Leave a group yourself, or be removed by the owner.
drop policy if exists group_members_delete on public.group_members;
create policy group_members_delete on public.group_members for delete to authenticated
  using (user_id = auth.uid() or public.is_group_owner(group_id));

-- ── group_expenses ─────────────────────────────────────────────────────────
drop policy if exists group_expenses_select on public.group_expenses;
create policy group_expenses_select on public.group_expenses for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists group_expenses_insert on public.group_expenses;
create policy group_expenses_insert on public.group_expenses for insert to authenticated
  with check (public.is_group_member(group_id));

drop policy if exists group_expenses_update on public.group_expenses;
create policy group_expenses_update on public.group_expenses for update to authenticated
  using (paid_by = auth.uid() or public.is_group_owner(group_id))
  with check (public.is_group_member(group_id));

drop policy if exists group_expenses_delete on public.group_expenses;
create policy group_expenses_delete on public.group_expenses for delete to authenticated
  using (paid_by = auth.uid() or public.is_group_owner(group_id));

-- ── expense_splits ─────────────────────────────────────────────────────────
drop policy if exists expense_splits_select on public.expense_splits;
create policy expense_splits_select on public.expense_splits for select to authenticated
  using (public.is_group_member(public.expense_group(expense_id)));

drop policy if exists expense_splits_insert on public.expense_splits;
create policy expense_splits_insert on public.expense_splits for insert to authenticated
  with check (public.is_group_member(public.expense_group(expense_id)));

-- Either the person who owes marks it paid, or the person who fronted the
-- money confirms they got it back.
drop policy if exists expense_splits_update on public.expense_splits;
create policy expense_splits_update on public.expense_splits for update to authenticated
  using (user_id = auth.uid() or public.expense_payer(expense_id) = auth.uid())
  with check (user_id = auth.uid() or public.expense_payer(expense_id) = auth.uid());

drop policy if exists expense_splits_delete on public.expense_splits;
create policy expense_splits_delete on public.expense_splits for delete to authenticated
  using (public.expense_payer(expense_id) = auth.uid());

-- ── GRANTS ─────────────────────────────────────────────────────────────────
-- RLS decides the rows; these grants decide the tables. `anon` gets nothing:
-- you must be signed in to touch any data.
grant usage on schema public to authenticated;
grant select, insert, update, delete
  on public.profiles, public.transactions, public.groups,
     public.group_members, public.group_expenses, public.expense_splits
  to authenticated;

-- Done. Next: Dashboard → Authentication → Providers → Email, and turn
-- "Confirm email" OFF so sign-ups can log straight in.
