# SkAna: backend, Vercel, PWA, real-time, and notifications

This guide assumes you are new to hosting and backends. Read it in order; each phase builds on the last.

---

## 1. Words you will see (plain English)

| Term | Meaning |
|------|--------|
| **Frontend** | What runs in the browser: pages, buttons, SkAna’s UI. Your app is built with **Next.js** (React). |
| **Backend** | Code and data on a server: saving deals, calendar, users. Today SkAna keeps data in the **browser only** (`sessionStorage` / `localStorage`). A real backend means data lives in a **database** on the internet. |
| **Host** | A company that runs your app on their computers. **Vercel** is built for Next.js: you connect GitHub, it builds and serves your site. |
| **Database** | Structured storage (tables, rows). **PostgreSQL** is common; **Supabase** gives you Postgres plus auth and real-time. |
| **API** | URLs your frontend calls to read/write data. Next.js can expose **Route Handlers** (`app/api/...`) on Vercel as **serverless functions** (short-lived server code). |
| **Real-time** | When one user changes data, others see it without refreshing. Usually: database **subscriptions** (Supabase Realtime) or a **WebSocket** service. |
| **PWA** | **Progressive Web App**: install SkAna from the browser (home screen / dock), full-screen, feels more like an app. You already have a **web app manifest** (`app/manifest.ts`). |
| **Service worker** | A script the browser runs in the background for offline cache and **push notifications**. Not added yet; add in a later phase. |
| **Notifications** | **In-app**: toast when data changes (easy once real-time works). **Push**: message when the tab is closed (needs service worker + **VAPID** keys + a small server to send pushes). |

---

## 2. What you have today

- SkAna works **entirely in the browser**: each person’s data is on **their device** until you add a shared database.
- Deploying to Vercel **does not by itself** sync data between teammates; it only hosts the website.
- To share data and real-time updates, you **replace** (or gradually mirror) `sessionStorage` usage with **API calls + Supabase** (or similar).

---

## 3. Phase A — Put the current app on Vercel (no backend yet)

**Goal:** A public URL that runs the same app you have locally.

### Step A1 — GitHub

1. Create a **GitHub** account if needed.
2. Create a **new repository** (empty is fine).
3. In your project folder on your Mac, run (in Terminal):

   ```bash
   git init
   git add .
   git commit -m "Initial SkAna"
   git branch -M main
   git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
   git push -u origin main
   ```

   (Replace the URL with your repo.)

### Step A2 — Vercel

1. Go to [vercel.com](https://vercel.com) and sign up (use **GitHub** login).
2. **Add New Project** → import your GitHub repo.
3. Framework: **Next.js** (auto-detected). Build command: `npm run build`. Output: default.
4. Deploy. Wait for the green checkmark.
5. Open the **`.vercel.app` URL** — that’s your live site.

**Note:** Session data still lives in each visitor’s browser only. Two users = two separate datasets until Phase B/C.

### Step A3 — Custom domain (optional)

In Vercel: Project → **Settings** → **Domains** → add `app.yourdomain.com` and follow DNS instructions from your registrar.

---

## 4. Phase B — Supabase project (your database + auth home)

**Goal:** One Postgres database in the cloud; later, SkAna reads/writes here instead of only `sessionStorage`.

### Step B1 — Create Supabase

1. Go to [supabase.com](https://supabase.com) → sign up.
2. **New project** → choose region close to you → set a database password (save it in a password manager).
3. Wait until the project is **healthy**.

### Step B2 — Keys you need

In Supabase: **Project Settings** (gear) → **API**:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **`anon` `public` key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Copy these into:

- **Local:** create `.env.local` in the project root (copy from `.env.example` and fill values).
- **Vercel:** Project → **Settings** → **Environment Variables** → add the same names for **Production** (and Preview if you want).

**Security:** The `anon` key is safe to put in the browser **only if** you use **Row Level Security (RLS)** in Postgres so users can only see rows they are allowed to see. Never put the **service_role** key in frontend code.

### Step B3 — Tables (high level)

You will design tables to match SkAna’s data, for example:

- `profiles` or `users` (link to Supabase Auth `auth.users`)
- `companies` / `company_members` (who belongs to which workspace)
- `deals`, `calendar_entries`, `contacts`, `team_messages`, etc.

This is a **migration project**: map each `lib/*Session.ts` module to tables and Supabase client calls. Do it **one feature at a time** (e.g. companies first, then deals).

---

## 5. Phase C — Real-time between users

**Typical approach with Supabase:**

1. Turn on **Realtime** for the tables that should sync live (Supabase → **Database** → **Replication** for those tables).
2. In the Next.js app, use the Supabase JS client:

   ```ts
   supabase.channel("room1").on("postgres_changes", { event: "*", schema: "public", table: "deals" }, (payload) => {
     // update React state / invalidate cache
   }).subscribe();
   ```

3. When anyone inserts/updates/deletes a row, subscribed clients get an event.

**Rules:**

- Every write should go to Postgres (not only local storage) or you will see inconsistent state.
- Use **RLS policies** so company A never sees company B’s rows.

---

## 6. Phase D — PWA “desktop-like” install

Already in the repo:

- `app/manifest.ts` — name, colors, start URL, icon.
- `layout.tsx` — `appleWebApp` + `themeColor` for iOS.

**Next improvements (when you want):**

1. Add **192×192** and **512×512** **square** PNG icons in `public/` (your logo may need padding).
2. Add a **service worker** for offline shell (popular option for Next.js: **Serwist** or similar; follow their Next 15+ docs).
3. Test: Chrome → install app; Safari → Share → Add to Home Screen.

---

## 7. Phase E — Notifications

| Type | Difficulty | What you need |
|------|------------|----------------|
| **Toasts inside the app** | Easier | Real-time listener + a small UI library or custom toast when events arrive. |
| **Push when browser is closed** | Harder | Service worker, **Web Push** keys (VAPID), store each user’s **push subscription** in Supabase, an API route or Edge Function to **send** pushes when something important happens. |

Start with **in-app** notifications; add **push** after PWA service worker is stable.

---

## 8. Suggested order of work

1. **Deploy to Vercel** (Phase A) — confirm builds pass.
2. **Supabase project + `.env.local` + Vercel env vars** (Phase B1–B2).
3. **Auth** — Supabase Email magic link or OAuth; protect `/dashboard` routes.
4. **Migrate one domain** — e.g. save **companies** to Postgres; read on load; then deals, calendar, etc.
5. **Enable Realtime** on migrated tables (Phase C).
6. **PWA polish** — icons, optional service worker (Phase D).
7. **Notifications** — toasts, then push (Phase E).

---

## 9. Getting help in Cursor

You can ask for concrete steps like:

- “Add `@supabase/supabase-js` and a `lib/supabase/client.ts` browser client.”
- “Create SQL for `companies` and `company_members` with RLS.”
- “Replace `readDealsRaw` with Supabase for logged-in users.”

Each step should stay **small** so you can test after every change.

---

## 10. Files added for this roadmap

| File | Purpose |
|------|--------|
| `.env.example` | Lists env var **names** (safe to commit). |
| `app/manifest.ts` | PWA manifest for installable app. |
| `app/layout.tsx` | `viewport` + `appleWebApp` for mobile install UX. |
| `docs/BACKEND_AND_DEPLOYMENT.md` | This guide. |

Your application logic in `lib/*Session.ts` is unchanged until you intentionally migrate feature by feature to Supabase.
