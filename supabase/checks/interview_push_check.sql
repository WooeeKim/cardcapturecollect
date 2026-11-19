-- Check the scheduled pushes: 22:00 interview + 12:00 / 18:00 reminders (read-only, safe to run any time). Supabase → SQL Editor, run each block.

-- 1) Registered? Expect exactly these three rows, each active = true and secret_filled = true:
--      interview-10pm   | 0 13 16-22 11 *   (22:00, 013_interview_push_10pm.sql)
--      reminder-noon    | 0 3 16-22 11 *    (12:00, 014_reminder_push.sql)
--      reminder-evening | 0 9 16-22 11 *    (18:00, 014_reminder_push.sql)
--    An interview-8pm row means the old 20:00 job is still there → run 013_interview_push_10pm.sql again.
--    secret_filled = false means <CRON_SECRET> was left in → every send will get 401.
select jobid,
       jobname,
       schedule,
       active,
       command not like '%<CRON_SECRET>%' as secret_filled
from cron.job
where jobname in ('interview-8pm', 'interview-10pm', 'reminder-noon', 'reminder-evening')
order by jobname;

-- 2) Did the schedule fire? (after 12:00 / 18:00 / 22:00) status = succeeded means Supabase made the call.
select j.jobname, d.start_time at time zone 'Asia/Seoul' as kst, d.status, d.return_message
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
where j.jobname in ('interview-8pm', 'interview-10pm', 'reminder-noon', 'reminder-evening')
order by d.start_time desc
limit 10;

-- 3) What did the site answer? content shows "kind": interview / noon / evening
--    200 + "sent": N  → N phones got it
--    401              → CRON_SECRET here and in Vercel differ
--    500 Missing env  → Vercel env vars missing, or not redeployed after adding them
select created at time zone 'Asia/Seoul' as kst, status_code, content
from net._http_response
order by created desc
limit 10;
