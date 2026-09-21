-- Calendar import: Google Calendar and Calendly.
-- Run after 0001_init.sql.

-- ---------------------------------------------------------------------------
-- Leads gain an email (how calendar invitees are identified) and provenance.
-- ---------------------------------------------------------------------------
alter table public.leads
  add column if not exists email       text not null default '',
  add column if not exists source      text not null default 'manual',
  add column if not exists external_id text;

alter table public.leads
  drop constraint if exists leads_source_check;
alter table public.leads
  add constraint leads_source_check
  check (source in ('manual', 'google', 'calendly'));

-- Re-importing the same event must update the lead, not duplicate it.
create unique index if not exists leads_owner_external_idx
  on public.leads (owner_id, external_id)
  where external_id is not null;

-- ---------------------------------------------------------------------------
-- calendar_connections: one row per user per provider.
--
-- These rows hold OAuth refresh tokens and API keys, so unlike leads they are
-- never shared: the policies below are strictly `user_id = auth.uid()`, with
-- no read path for the users you share your lead list with.
-- ---------------------------------------------------------------------------
create table if not exists public.calendar_connections (
  user_id       uuid not null references auth.users (id) on delete cascade,
  provider      text not null check (provider in ('google', 'calendly')),
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  account_email text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, provider)
);

drop trigger if exists calendar_connections_touch on public.calendar_connections;
create trigger calendar_connections_touch
  before update on public.calendar_connections
  for each row execute function public.touch_updated_at();

alter table public.calendar_connections enable row level security;

drop policy if exists calendar_connections_all on public.calendar_connections;
create policy calendar_connections_all on public.calendar_connections
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
