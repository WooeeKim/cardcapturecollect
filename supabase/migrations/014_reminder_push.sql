-- Reminder pushes at 12:00 and 18:00 KST, 11/19 … 11/22 ("go collect someone"). Run once in Supabase → SQL Editor.
-- Before running: replace BOTH <CRON_SECRET> below with the same value as Vercel's CRON_SECRET
-- (no < > around it, one space after "Bearer"). Don't commit the file with the real value.
-- Same endpoint as the 22:00 interview push (013); the body's "kind" picks the message (api/interview-push.js).

-- running this twice is fine: an existing job with the same name is replaced
select cron.unschedule('reminder-noon') where exists (select 1 from cron.job where jobname = 'reminder-noon');
select cron.unschedule('reminder-evening') where exists (select 1 from cron.job where jobname = 'reminder-evening');

-- 03:00 UTC = 12:00 KST
select cron.schedule(
  'reminder-noon',
  '0 3 16-22 11 *',
  $$
  select net.http_post(
    url := 'https://cardcapturecollect.vercel.app/api/interview-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <CRON_SECRET>'),
    body := '{"kind": "noon"}'::jsonb
  )
  $$
);

-- 09:00 UTC = 18:00 KST
select cron.schedule(
  'reminder-evening',
  '0 9 16-22 11 *',
  $$
  select net.http_post(
    url := 'https://cardcapturecollect.vercel.app/api/interview-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <CRON_SECRET>'),
    body := '{"kind": "evening"}'::jsonb
  )
  $$
);
