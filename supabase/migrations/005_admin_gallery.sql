-- Card gallery (<site>/#/admin): lets listed admin emails read every tester's saved state.
-- Run once in Supabase → SQL Editor, after 004_user_states.sql.

alter table public.user_states add column if not exists email text;

-- who may see everyone's cards; no policies = the app can't read or change this list
create table if not exists public.app_admins (email text primary key);
alter table public.app_admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admins where email = lower(auth.jwt() ->> 'email'))
$$;

drop policy if exists "admins: read all states" on public.user_states;
create policy "admins: read all states" on public.user_states for select using (public.is_admin());

-- Add yourself (use the email you log in with, lowercase):
-- insert into public.app_admins (email) values ('you@example.com');
