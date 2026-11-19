-- Daily interview push: 20:00 → 22:00 KST (11/19~). Run once in Supabase → SQL Editor.
-- Before running: replace <CRON_SECRET> below with the same value as Vercel's CRON_SECRET
-- (no < > around it, one space after "Bearer"). Don't commit the file with the real value.
-- Needs pg_cron + pg_net turned on (Database → Extensions), same as 011_interview.sql.

-- remove the old 20:00 job (and an earlier 22:00 one, so running this twice is fine)
select cron.unschedule('interview-8pm') where exists (select 1 from cron.job where jobname = 'interview-8pm');
select cron.unschedule('interview-10pm') where exists (select 1 from cron.job where jobname = 'interview-10pm');

-- 13:00 UTC = 22:00 KST, Nov 16–22 only; stops by itself afterwards
select cron.schedule(
  'interview-10pm',
  '0 13 16-22 11 *',
  $$
  select net.http_post(
    url := 'https://cardcapturecollect.vercel.app/api/interview-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <CRON_SECRET>'),
    body := '{}'::jsonb
  )
  $$
);
