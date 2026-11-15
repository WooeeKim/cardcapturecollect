-- App event log: one row per event, read by <site>/admin → Stats.
-- Run once in Supabase → SQL Editor, after 007_gilbti.sql.
--
-- Card screen events (session = one visit to the drawing screen, src/screens/DrawScreen.tsx):
--   draw / memo / confirm / hidden  = the screen entered that state at `at` (it lasts until the next event)
--   finish / exit                    = card saved / screen left without saving
-- Other: feedback (data.text).
-- user_id / email are filled by the server from the login (null for guests; device_id tells guests apart).

create table if not exists public.app_events (
  id bigint generated always as identity primary key,
  session_id text not null,
  device_id text not null,
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  email text default lower(auth.jwt() ->> 'email'),
  event text not null,
  at timestamptz not null, -- client clock, so offline order is kept
  data jsonb
);
create index if not exists app_events_session on public.app_events (session_id);
create index if not exists app_events_at on public.app_events (at);

alter table public.app_events enable row level security;

-- anyone (guest or logged in) may add events; a logged-in row must be their own account
drop policy if exists "anyone: insert events" on public.app_events;
create policy "anyone: insert events" on public.app_events for insert to anon, authenticated
  with check (
    (user_id is null or user_id = auth.uid())
    and (email is null or email = lower(auth.jwt() ->> 'email'))
  );

-- only team admins (app_admins) read them
drop policy if exists "admins: read events" on public.app_events;
create policy "admins: read events" on public.app_events for select using (public.is_admin());
