-- Day-7 post-test interview answers (the 7일차 사후 인터뷰 Google Form, asked in the app from 11/22 22:00).
-- Written by the app (src/lib/finalInterview.ts), read in <site>/admin → Day 7. Run once in Supabase → SQL Editor.
-- No secrets in this file.

create table if not exists public.final_interviews (
  id uuid primary key default gen_random_uuid(),
  answers jsonb not null, -- keyed by question id (FINAL_QUESTIONS); choices are saved as their Korean labels
  user_id uuid references auth.users (id) on delete set null,
  email text,
  nickname text,
  device_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists final_interviews_user on public.final_interviews (user_id);

alter table public.final_interviews enable row level security;

drop policy if exists "anyone: insert final" on public.final_interviews;
create policy "anyone: insert final" on public.final_interviews for insert to anon, authenticated
  with check (
    (user_id is null or user_id = auth.uid())
    and (email is null or email = lower(auth.jwt() ->> 'email'))
  );

-- each account sees whether it answered (so another device doesn't ask again); admins see everything
drop policy if exists "own final: select" on public.final_interviews;
create policy "own final: select" on public.final_interviews for select to authenticated using (user_id = auth.uid());
drop policy if exists "admins: read final" on public.final_interviews;
create policy "admins: read final" on public.final_interviews for select using (public.is_admin());

-- check:  select nickname, created_at from public.final_interviews order by created_at desc;
