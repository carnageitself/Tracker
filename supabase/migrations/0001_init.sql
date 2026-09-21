-- Lead Tracker schema: per-user lead lists that can be shared with other users.
-- Run this once against your Supabase project (SQL Editor, or `supabase db push`).

-- ---------------------------------------------------------------------------
-- profiles: a readable mirror of auth.users so lists can be shared by email.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null unique,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill anyone who signed up before this migration ran.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- list_shares: owner grants another user access to their whole lead list.
-- ---------------------------------------------------------------------------
create table if not exists public.list_shares (
  owner_id       uuid not null references auth.users (id) on delete cascade,
  shared_with_id uuid not null references auth.users (id) on delete cascade,
  can_edit       boolean not null default true,
  created_at     timestamptz not null default now(),
  primary key (owner_id, shared_with_id),
  constraint list_shares_no_self check (owner_id <> shared_with_id)
);

create index if not exists list_shares_shared_with_idx
  on public.list_shares (shared_with_id);

-- ---------------------------------------------------------------------------
-- leads: one row per prospect. Each pipeline step is a nullable date —
-- set means "reached, on this day", null means "not there yet".
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users (id) on delete cascade,
  full_name      text not null,
  phone          text not null default '',
  lead_date      date not null default current_date,
  follow_up      date,
  mg1            date,
  mg2            date,
  meet_in_person date,
  pv             date,
  pv_amount      numeric(10, 2) not null default 0 check (pv_amount >= 0),
  starter_pack   date,
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists leads_owner_idx on public.leads (owner_id, updated_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_touch_updated_at on public.leads;
create trigger leads_touch_updated_at
  before update on public.leads
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Access helpers. SECURITY DEFINER so the leads policies can consult
-- list_shares without tripping over that table's own RLS.
-- ---------------------------------------------------------------------------
create or replace function public.can_view_list(list_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select list_owner = auth.uid()
      or exists (
        select 1 from public.list_shares s
        where s.owner_id = list_owner
          and s.shared_with_id = auth.uid()
      );
$$;

create or replace function public.can_edit_list(list_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select list_owner = auth.uid()
      or exists (
        select 1 from public.list_shares s
        where s.owner_id = list_owner
          and s.shared_with_id = auth.uid()
          and s.can_edit
      );
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.list_shares enable row level security;
alter table public.leads       enable row level security;

-- profiles: you can see yourself, plus anyone you share with in either
-- direction. Not a directory of every user on the instance.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.list_shares s
      where (s.owner_id = profiles.id and s.shared_with_id = auth.uid())
         or (s.shared_with_id = profiles.id and s.owner_id = auth.uid())
    )
  );

-- list_shares: you manage grants you gave; you can see grants given to you.
drop policy if exists list_shares_select on public.list_shares;
create policy list_shares_select on public.list_shares
  for select to authenticated
  using (owner_id = auth.uid() or shared_with_id = auth.uid());

drop policy if exists list_shares_insert on public.list_shares;
create policy list_shares_insert on public.list_shares
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists list_shares_update on public.list_shares;
create policy list_shares_update on public.list_shares
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Either side can end a share: the owner revokes, the recipient leaves.
drop policy if exists list_shares_delete on public.list_shares;
create policy list_shares_delete on public.list_shares
  for delete to authenticated
  using (owner_id = auth.uid() or shared_with_id = auth.uid());

-- leads: readable by the owner and anyone they shared with; writable by the
-- owner and anyone granted edit, who may also add leads to that list.
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads
  for select to authenticated
  using (public.can_view_list(owner_id));

drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads
  for insert to authenticated
  with check (public.can_edit_list(owner_id));

drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads
  for update to authenticated
  using (public.can_edit_list(owner_id))
  with check (public.can_edit_list(owner_id));

drop policy if exists leads_delete on public.leads;
create policy leads_delete on public.leads
  for delete to authenticated
  using (public.can_edit_list(owner_id));

-- ---------------------------------------------------------------------------
-- Sharing by email, without exposing a user directory to the client.
-- ---------------------------------------------------------------------------
create or replace function public.share_list_with_email(
  target_email text,
  allow_edit   boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select id into target_id
  from public.profiles
  where lower(email) = lower(trim(target_email));

  if target_id is null then
    raise exception 'No account exists for %. Ask them to sign up first.', target_email;
  end if;

  if target_id = auth.uid() then
    raise exception 'That is your own account';
  end if;

  insert into public.list_shares (owner_id, shared_with_id, can_edit)
  values (auth.uid(), target_id, allow_edit)
  on conflict (owner_id, shared_with_id)
    do update set can_edit = excluded.can_edit;
end;
$$;

revoke all on function public.share_list_with_email(text, boolean) from public;
grant execute on function public.share_list_with_email(text, boolean) to authenticated;
