# AGENTS.md

## Backend: Supabase

This project's central database is a [Supabase](https://supabase.com) Postgres
instance. There is no server of our own — the SPA talks to Supabase directly.

- **Schema:** `supabase/schema.sql` is the single source of truth. It is
  idempotent; change it there and re-run the whole file in the SQL editor rather
  than applying ad-hoc DDL. `supabase/seed_demo.sql` is optional demo data.
- **No SDK.** `@supabase/supabase-js` is deliberately not installed.
  `src/lib/supabaseClient.js` speaks to the GoTrue (`/auth/v1/...`) and PostgREST
  (`/rest/v1/...`) endpoints with plain `fetch`. Keep it that way unless there is
  a reason worth a new dependency.
- **All data access goes through `src/lib/api.js`.** Components never build
  queries; add a function there instead.
- **Credentials:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, read from
  `.env.local` locally and from Vercel's environment variables in production.
  See `.env.example`. Vite only exposes `VITE_`-prefixed variables. Never
  reference the `service_role` key from frontend code — it bypasses RLS.

Key patterns:

- Row Level Security is the security boundary, not the client. The anon key is
  public by design. Every new table needs `enable row level security`, explicit
  policies, and grants to `authenticated` only — never to `anon`.
- Membership and ownership checks inside policies must go through the
  `SECURITY DEFINER` helpers (`is_group_member`, `is_group_owner`,
  `shares_group_with`, `expense_group`, `expense_payer`). A policy on
  `group_members` that queries `group_members` makes Postgres abort with
  *infinite recursion detected*.
- Foreign keys point at `public.profiles(id)`, not `auth.users(id)`, so
  PostgREST can infer relationships and serve embedded selects. `profiles.id`
  itself references `auth.users(id) on delete cascade`.
- PostgREST inserts take an array: `rest("/table", { method:"POST", body:[{...}] })`.
  Add `prefer: "return=representation"` when the inserted row is needed back.
- Use `auth.uid()` in policies. Never store a password column anywhere; Supabase
  Auth owns credentials.
- Money is `numeric(12,2)`. Split maths is done in integer cents with the
  rounding remainder absorbed by the payer (`evenSplits` in `src/lib/api.js`).

Deployment is a static Vercel build (`npm run build` → `dist/`), with
`vercel.json` rewriting all paths to `index.html`. Full walkthrough in
`README.md`.

## History

An earlier attempt used InsForge as the backend; the leftover `.insforge/`
directory and `.env.insforge.bak.local` are unused and gitignored. Before that,
all data lived in `localStorage` under `xpenseup_app_state_v1`, which
`importLocalDataOnce()` still reads once per account to migrate old data.
