-- Daily 8 p.m. interview answers (2026-11-16 … 11-22), written by the app (src/lib/interview.ts),
-- read in <site>/admin → 8pm tab. Run once in Supabase → SQL Editor, after 010_push.sql.

create table if not exists public.interview_responses (
  id uuid primary key default gen_random_uuid(),
  day date not null,                                  -- the day whose 20:00 opened this interview
  kind text not null check (kind in ('drew', 'didnt_draw')),
  cards integer not null default 0,                   -- cards made in that day's window (prev 20:00 → 20:00)
  answers jsonb not null,                             -- why_not | situation, who_why, feeling, feeling_other
  user_id uuid references auth.users (id) on delete set null,
  email text,
  nickname text,
  device_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists interview_responses_day on public.interview_responses (day);
create index if not exists interview_responses_user on public.interview_responses (user_id);

alter table public.interview_responses enable row level security;

-- anyone may add answers; a logged-in row must be their own account and email
drop policy if exists "anyone: insert interview" on public.interview_responses;
create policy "anyone: insert interview" on public.interview_responses for insert to anon, authenticated
  with check (
    (user_id is null or user_id = auth.uid())
    and (email is null or email = lower(auth.jwt() ->> 'email'))
  );

-- each account sees whether it answered (so another device doesn't ask again); admins see everything
drop policy if exists "own interview: select" on public.interview_responses;
create policy "own interview: select" on public.interview_responses for select to authenticated using (user_id = auth.uid());
drop policy if exists "admins: read interview" on public.interview_responses;
create policy "admins: read interview" on public.interview_responses for select using (public.is_admin());


-- ---------- automatic push at 20:00 KST (= 11:00 UTC), 11/16 … 11/22 ----------
-- Supabase calls <site>/api/interview-push, which sends to every phone in push_subscriptions.
-- 1) Supabase → Database → Extensions: turn on pg_cron and pg_net (or run the two lines below).
-- 2) Vercel → Settings → Environment Variables: CRON_SECRET (any long random text) and
--    SUPABASE_SERVICE_ROLE_KEY (Supabase → Project Settings → API → service_role), then redeploy.
-- 3) Put the same CRON_SECRET in place of <CRON_SECRET> below and run it.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('interview-8pm') where exists (select 1 from cron.job where jobname = 'interview-8pm');
select cron.schedule(
  'interview-8pm',
  '0 11 16-22 11 *', -- 11:00 UTC on Nov 16–22 only; stops by itself afterwards
  $$
  select net.http_post(
    url := 'https://cardcapturecollect.vercel.app/api/interview-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <CRON_SECRET>'),
    body := '{}'::jsonb
  )
  $$
);

-- check it ran:   select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'interview-8pm') order by start_time desc;
-- see the reply:  select * from net._http_response order by created desc limit 5;
-- stop early:     select cron.unschedule('interview-8pm');
