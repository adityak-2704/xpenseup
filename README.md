# 💸 XpenseUp

Expense tracker with a **central cloud database**. Sign in on your phone, your
laptop, a friend's browser — same data every time. Split group expenses with
other real accounts and watch the "who owes what" update on both devices.

Built with Vite + React, backed by Supabase (Postgres + Auth), deployed on Vercel.

---

## Setup — Part 1: the database (about 5 minutes)

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), sign in, and click **New project**.
Pick any name, set a database password (you will not need it again for this app),
choose the region closest to you, and wait for it to finish provisioning.

### 2. Create the tables

In the left sidebar open **SQL Editor → New query**. Open
[`supabase/schema.sql`](supabase/schema.sql) from this repo, paste the whole
file in, and click **Run**. You should see *Success. No rows returned*.

This creates six tables (`profiles`, `transactions`, `groups`, `group_members`,
`group_expenses`, `expense_splits`), turns on Row Level Security for every one
of them, and installs the trigger that gives each new sign-up a profile. The
script is idempotent — re-running it is safe.

### 3. Turn off email confirmation

**Authentication → Sign In / Providers → Email**, and switch
**Confirm email** *off*, then save. Without this, new accounts have to click a
link in their inbox before they can log in. (Leaving it on also works — the app
handles it and tells the user to check their email — but it makes the demo
account fiddly to set up.)

### 4. Copy your two keys

**Project Settings → API**:

| Supabase field | Goes into |
| --- | --- |
| Project URL | `VITE_SUPABASE_URL` |
| `anon` `public` key | `VITE_SUPABASE_ANON_KEY` |

Use the **anon** key, never `service_role`. The anon key is designed to sit in a
browser: the RLS policies are what actually keep one user out of another user's
data. `service_role` bypasses RLS completely and must never reach the frontend.

---

## Setup — Part 2: run it locally

```bash
cp .env.example .env.local     # then paste your two values in
npm install
npm run dev
```

Open the URL Vite prints, click **Register**, and create an account. Add a
transaction, then open the same URL on your phone, sign in with the same email,
and it will be there.

If the app shows a "Connect your database" screen instead of the login page, the
two `VITE_` variables are missing or misspelled. Vite only reads `.env.local` at
startup, so restart `npm run dev` after editing it.

---

## Setup — Part 3: deploy to Vercel

### 1. Push to GitHub

```bash
git init                       # skip if the repo already exists
git add -A
git commit -m "XpenseUp with Supabase cloud sync"
git branch -M main
git remote add origin https://github.com/<you>/xpenseup.git
git push -u origin main
```

`.env.local` is gitignored (via `*.local`), so your keys stay out of the repo.

### 2. Import into Vercel

At [vercel.com/new](https://vercel.com/new), pick the repository. Vercel detects
Vite on its own — framework **Vite**, build command `npm run build`, output
directory `dist`. Leave all of it alone.

### 3. Add the environment variables **before** the first build

Still on the import screen, expand **Environment Variables** and add both:

```
VITE_SUPABASE_URL        = https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY   = eyJhbGci...
```

These are compiled into the JavaScript bundle at build time, not read at
runtime. If you add them after deploying, you have to **Redeploy** for them to
take effect.

Click **Deploy**. About a minute later you have a live URL.

### 4. Allow your Vercel URL in Supabase

**Authentication → URL Configuration**, and add your
`https://your-app.vercel.app` domain to **Site URL** / **Redirect URLs**.
Password sign-in works without this, but it matters if you later add email
confirmation or password resets.

`vercel.json` already rewrites every path to `index.html`, so refreshing on any
screen works instead of 404-ing.

---

## Optional: the demo account

The app's login screen advertises `arjun@demo.com` / `demo123`.

Passwords are hashed by Supabase Auth, so the account cannot be created in SQL —
**register it through the app's own Register tab first**. Then run
[`supabase/seed_demo.sql`](supabase/seed_demo.sql) in the SQL editor to give it a
₹15,000 budget and ten sample transactions. If you skip this, delete the demo
line from the login footer in `src/App.jsx`.

---

## What happens to data already in your browser

Earlier versions of XpenseUp kept everything in `localStorage`. The first time
you sign in to a **new, empty** cloud account, the app lifts those transactions
(and your budget) into it, shows a toast saying how many it moved, then writes a
per-user flag so a second visit can never import them twice. If the cloud
account already has transactions, the import is skipped rather than merged.

---

## How the security works

The frontend ships a public key, so none of the protection can live in the
frontend. All of it is in the database:

- **Passwords** are bcrypt-hashed by Supabase Auth. This app never sees, sends
  or stores a password, and there is no password column anywhere in the schema.
- **Your ledger is yours.** Every policy on `transactions` is
  `user_id = auth.uid()`. There is no query the browser can construct — even a
  hand-crafted one — that returns another person's transactions.
- **Groups are shared, narrowly.** You can read a group's expenses and splits
  only if you are a member of that group. Membership checks go through
  `SECURITY DEFINER` functions, because a policy on `group_members` that queries
  `group_members` makes Postgres abort with *infinite recursion detected*.
- **Profiles are not a directory.** You can only see someone's name and avatar
  if you share a group with them. Adding a member goes through
  `find_profile_by_email()`, which matches the full address only and never
  returns an email column, so it cannot be used to enumerate users.
- **`anon` has no table grants at all.** You must be signed in to read or write
  anything.

Rotate the anon key from **Project Settings → API** if you ever need to; then
update the Vercel variable and redeploy.

---

## Project layout

```
src/
  App.jsx                 UI and all screens
  lib/supabaseClient.js   auth + REST over plain fetch (no SDK dependency)
  lib/api.js              every read and write the app performs
supabase/
  schema.sql              run once — tables, RLS policies, triggers
  seed_demo.sql           optional demo data
.env.example              the two variables you need
vercel.json               SPA rewrites
```

The Supabase SDK is deliberately not installed — the client talks to the REST
and Auth endpoints with `fetch`, which keeps the dependency list to React and
Recharts.

## Scripts

```bash
npm run dev       # local dev server
npm run build     # production build into dist/
npm run preview   # serve the built bundle
npm run lint      # oxlint
```
