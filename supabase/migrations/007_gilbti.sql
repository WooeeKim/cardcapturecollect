-- 길BTI (Subway-TI) pre-interview answers + team admin access.
-- Run once in Supabase → SQL Editor, after 005_admin_gallery.sql.
--
-- The interview runs on first launch, usually before login, so a row is written with this device's random id.
-- Logging in later attaches the device's rows to the account (claim_gilbti). Only admins can read rows.

create table if not exists public.gilbti_responses (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  user_id uuid references auth.users (id) on delete set null,
  email text,
  nickname text,
  type text not null check (type in ('both', 'record', 'observe', 'neither')),
  observe smallint not null, -- 1..5 "do you enjoy watching people"
  record smallint not null,  -- 1..5 "do you enjoy recording things"
  answers jsonb not null,    -- every answer, keyed by question id (src/lib/gilbti.ts)
  created_at timestamptz not null default now()
);
create index if not exists gilbti_responses_device on public.gilbti_responses (device_id);
create index if not exists gilbti_responses_user on public.gilbti_responses (user_id);

alter table public.gilbti_responses enable row level security;

-- anyone (guest or logged in) may add answers; a logged-in row must be their own account and email
drop policy if exists "anyone: insert answers" on public.gilbti_responses;
create policy "anyone: insert answers" on public.gilbti_responses for insert to anon, authenticated
  with check (
    (user_id is null or user_id = auth.uid())
    and (email is null or email = lower(auth.jwt() ->> 'email'))
  );

-- only team admins (app_admins) read them
drop policy if exists "admins: read answers" on public.gilbti_responses;
create policy "admins: read answers" on public.gilbti_responses for select using (public.is_admin());

-- after login: attach this device's guest answers to the account
create or replace function public.claim_gilbti(device text) returns void
language sql security definer set search_path = public as $$
  update public.gilbti_responses
     set user_id = auth.uid(), email = lower(auth.jwt() ->> 'email')
   where device_id = device and user_id is null and auth.uid() is not null
$$;
revoke all on function public.claim_gilbti(text) from public;
grant execute on function public.claim_gilbti(text) to authenticated;

-- ---------- team admins: can open <site>/admin and read everyone's cards + 길BTI answers ----------
-- Each person signs up in the app first with this email, then gets admin by being listed here (lowercase).
-- insert into public.app_admins (email) values
--   ('member1@example.com'),
--   ('member2@example.com'),
--   ('member3@example.com'),
--   ('member4@example.com')
-- on conflict do nothing;
