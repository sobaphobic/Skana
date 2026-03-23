# SkAna — build notes

Working assumptions and decisions while the UI is built **before** Supabase. Update this file as flows or naming change.

## Stack (target)

- **Next.js** (App Router), **TypeScript**, **Tailwind v4**
- **Supabase** (Auth, Postgres, Storage, RLS) — **not wired yet**
- **Vercel** deploy, **GitHub** as source of truth

## Brand / theme

- Product name: **SkAna** (metadata, alt text)
- **Teal + cream** palette — tokens in `app/globals.css` (`crm-*`)
- Logo: `public/skana-logo.png`, component `components/BrandLogo.tsx`

## Routes

| Path | Purpose |
|------|---------|
| `/` | Redirects to `/login` |
| `/login` | Log in / Sign up (tabs) |
| `/onboarding/company` | After sign-up: create new company vs join existing |
| `/onboarding/company/create` | New company form + logo upload + role |
| `/onboarding/company/join` | Enter **company login code** (validation TBD) |
| `/dashboard` | Main app shell + home (after **Create company**); reads `skana_company_profile` from `sessionStorage` |
| `/dashboard/pipeline` | **Sales pipeline** Kanban (Lead → Closed Lost); sidebar + **Active Pipeline** stat card |

## Auth UI (pre-Supabase)

- **Log in:** `username`, `password` (Supabase typically uses **email** for password auth — reconcile when integrating).
- **Sign up:** `first_name`, `last_name`, `email`, `username`, `password`
- On successful sign-up (client-only): `sessionStorage` key `skana_onboarding_profile` (JSON: `firstName`, `lastName`, `email`, `username`), then navigate to `/onboarding/company`. Legacy key `skana_onboarding_email` is cleared on sign-out but no longer written on sign-up.
- **Dashboard** welcome line uses **first + last name** from `skana_onboarding_profile` (`formatWelcomeDisplayName`).
- After **Create company**: `sessionStorage` key `skana_company_profile` (JSON: `name`, optional `logoDataUrl` if file ≤ ~600KB, plus optional `company_number`, `company_address`, `company_role`), then navigate to `/dashboard`.

## Forms — field `name` values (for future API/schema)

**Login**

- `username`, `password`

**Sign up**

- `first_name`, `last_name`, `email`, `username`, `password`

**Create company**

- `company_name`, `company_number`, `company_address`, `company_logo` (file), `company_role` (select: `owner` \| `co_founder` \| `director` \| `admin` \| `member` \| `other`)

**Join company**

- `company_login_code`

## Shared UI

- `components/AuthFlowShell.tsx` — gradient background + centered column; optional `maxWidthClass`
- `components/auth-forms.tsx` — `FormField`, `FormTextarea`, `FormSelect`, `PrimarySubmitButton`
- `components/dashboard/*` — `DashboardShell`, sidebar (SkAna logo + nav), main header (company name + logo), `DashboardCalendar` (month view, **Show**: All + member name buttons, `CalendarItem.memberIds`, legend + task done / overdue — demo `CALENDAR_TEAM_MEMBERS` until Supabase), `PipelineBoard` (KPI strip + 6-column Kanban — demo until Supabase)
- `lib/skanaSession.ts` — company + onboarding profile helpers (`ONBOARDING_PROFILE_KEY`, `saveOnboardingProfile`, `formatWelcomeDisplayName`, etc.)
- `lib/formatDate.ts` — stable English date strings (avoids SSR/client `toLocaleDateString` mismatches)

## Deferred / TBD

- [ ] Supabase project, env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, server secrets as needed)
- [ ] Real sign-up, session, protected routes
- [x] Post-submit: **Create company** → `/dashboard` (local session only). **Join company** → still TBD (no dashboard handoff yet).
- [ ] **Company login code**: generation (admin UI), storage, expiry, server-side validation
- [ ] Logo upload → **Supabase Storage** + URL on `companies` (or equivalent)
- [ ] Email verification, password reset, if required by product

## Changelog

- **2026-03-21** — Initial NOTES: routes, form names, theme, deferred Supabase items.
- **2026-03-21** — Dashboard shell + home; `skana_company_profile` session; `BrandLogo` size `xs` for sidebar.
- **2026-03-21** — Sign-up collects first/last name; `skana_onboarding_profile`; dashboard “Welcome back, First Last”.
- **2026-03-21** — Dashboard: replaced dual panels with `DashboardCalendar` (legend, month nav, today + overdue).
- **2026-03-21** — Calendar: completed tasks → green ring; overdue excludes completed tasks.
- **2026-03-21** — Calendar: member filter (All + Alex / Jordan / Chris); `memberIds` on items.
- **2026-03-21** — Dashboard stats: **Active Pipeline** + **Current Users** only (removed Pending Tasks, Events Today, Closed Won).
- **2026-03-22** — `lib/formatDate.ts` for stable dashboard/calendar headings (fixes React hydration mismatch vs `toLocaleDateString`).
- **2026-03-22** — `/dashboard/pipeline` Kanban + nav link + **Active Pipeline** card → pipeline.
