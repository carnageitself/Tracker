# Lead Tracker

A pipeline tracker for an Amway business. Each lead moves through six steps —
Follow up → MG-1 → MG-2 → Meet in person → PV → Starter pack — and each step
stores the date it happened, so you can see both where someone is and how long
they've been there.

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase.

---

## Setup

### 1. Supabase

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Open the SQL Editor and run, in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_calendar.sql`
3. Copy `.env.local.example` to `.env.local` and fill in the project URL and
   anon key from **Project Settings → API**.

```bash
npm install
npm run dev
```

If `.env.local` is missing, the app renders setup instructions instead of
crashing.

> **Email confirmation.** Supabase enables it by default, so a new signup has
> to click the emailed link before signing in. To skip that while testing, turn
> it off under **Authentication → Providers → Email**.

### 2. Google Calendar (optional)

1. In the Google Cloud Console, enable the **Google Calendar API**.
2. Create an **OAuth client ID** of type *Web application*.
3. Add the authorised redirect URI:
   - `http://localhost:3000/api/google/callback`
   - plus the same path on your deployed domain.
4. Put the client ID and secret in `.env.local`. Both are server-only — they
   have no `NEXT_PUBLIC_` prefix, so they never reach the browser bundle.
5. In production, also set `NEXT_PUBLIC_SITE_URL` so the redirect URI matches
   your real domain rather than being inferred from the request.

### 3. Calendly (optional)

Nothing to configure server-side. Each user connects their own account by
pasting a **personal access token** on the Integrations page, created under
Calendly → *Integrations → API & Webhooks*. A token was chosen over OAuth
because it needs no app review and keeps each user's connection their own.

---

## How it works

### Pipeline

`leads` has one nullable `date` column per step. A date means "reached, on that
day"; null means "not there yet". The lead's current stage is derived as the
furthest step with a date, so nothing can drift out of sync with the dates
themselves.

In the table, the six segments are clickable — clicking one stamps today's date
on that step, clicking again clears it.

`pv_amount` is separate from the `pv` step date: the step records *when* they
ordered, the amount records *how much* personal volume, which is what the
dashboard totals.

### Sharing

Lists are private by default and shared explicitly, enforced by row-level
security rather than by the UI:

- You always see and edit your own leads.
- `share_list_with_email(email, allow_edit)` grants another user access to your
  whole list. They must have signed up already.
- Someone granted edit can add and change leads in your list; view-only users
  can only read.
- Either side can end a share — the owner revokes, the recipient leaves.

The RPC resolves the email server-side, so the client never gets a directory of
every user on the instance.

Calendar connections are deliberately **not** shared. They hold OAuth refresh
tokens and API keys, so their policy is strictly `user_id = auth.uid()`, with no
read path for people you share your lead list with.

### Calendar import

Import pulls attendees (Google) or invitees (Calendly) from the last 90 and next
30 days. Rows are upserted on `(owner_id, external_id)`, so re-importing an
event refreshes the contact details instead of creating a duplicate — and any
pipeline dates or PV you've already recorded against that lead are left alone.

Google events have no phone field, so the phone number is scraped best-effort
from the event description or location. Calendly supplies it properly, from the
SMS reminder number or a booking-form question.

---

## Design notes

The theme follows Vercel's Geist palette: near-pure surfaces, hairline borders,
and a primary button that inverts against the page. Dark mode is a selected set
of steps against the dark surface, not an inverted copy, and is declared twice —
once for the OS setting and once for the in-app toggle, which wins either way.

The pipeline meter is an **ordinal** encoding: one hue, reached segments in the
accent step and the rest in a lighter step of the same ramp. Position and the
stage label carry the meaning, so six steps never need six competing colours.
Both ramps were checked against their own surfaces for lightness monotonicity,
step separation, and contrast. Status colours (good / serious / critical) are
reserved, clear 3:1 in both modes, and always ship with an icon or a label so
nothing depends on hue alone.

Layout is card-based below 1024px and switches to the table above it — the Lead
column needs roughly that much width before names and phone numbers stop
wrapping onto three lines. Dialogs are full-bleed sheets on phones and centred
cards from `sm` up.

---

## Scripts

| Command         | Does                                  |
| --------------- | ------------------------------------- |
| `npm run dev`   | Dev server                            |
| `npm run build` | Production build (also typechecks)    |
| `npm run lint`  | ESLint                                |
| `npx tsc --noEmit` | Typecheck on its own               |

## Layout

```
src/
  app/
    page.tsx              dashboard (server: auth, list selection, fetch)
    actions.ts            lead + share server actions
    login/                sign in / sign up
    integrations/         calendar connections and import
    api/google/           OAuth connect + callback
    auth/callback/        Supabase email confirmation
  components/             UI, with shared class strings in ui.ts
  lib/
    supabase/             browser + server clients, generated-style types
    calendar/             Google and Calendly providers
    data.ts               server-side reads
    types.ts              pipeline model
supabase/migrations/      schema and RLS
```

Regenerate the database types after a schema change:

```bash
npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
```
