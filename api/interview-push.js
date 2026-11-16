// POST /api/interview-push (Vercel function) — the daily 8 p.m. interview push to every phone that allowed notifications.
// Called by Supabase pg_cron at 20:00 KST on 11/16–11/22 (supabase/migrations/011_interview.sql), not by people.
// Header: Authorization: Bearer <CRON_SECRET>. Tapping the notification opens the app, which shows the interview.
// Env (Vercel → Settings → Environment Variables): CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY (reads every subscription;
// server only, never VITE_), plus the ones api/push.js uses: VITE_SUPABASE_URL, VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY.
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const FIRST_DAY = '2026-11-16'
const LAST_DAY = '2026-11-22'

export default async function handler(req, res) {
  const env = process.env
  if (!env.CRON_SECRET || (req.headers.authorization || '') !== `Bearer ${env.CRON_SECRET}`) return res.status(401).json({ error: 'Unauthorized' })
  if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.VITE_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY)
    return res.status(500).json({ error: 'Missing env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY' })

  // only during the interview week (Korea time), whatever calls this
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
  if (today < FIRST_DAY || today > LAST_DAY) return res.json({ skipped: `outside ${FIRST_DAY}…${LAST_DAY} (today ${today})` })

  const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data: rows, error } = await sb.from('push_subscriptions').select('endpoint, sub')
  if (error) return res.status(500).json({ error: error.message })

  webpush.setVapidDetails(env.VAPID_SUBJECT || `https://${req.headers.host}`, env.VITE_VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)
  const payload = JSON.stringify({ title: 'It’s 8p.m. Interview Time!', body: '저녁 8시, 인터뷰 시간이에요! 눌러서 오늘 이야기를 들려주세요.', url: '/' })
  const results = await Promise.all(
    rows.map((r) =>
      webpush.sendNotification(r.sub, payload, { TTL: 60 * 60 * 4 }).then(
        () => ({ endpoint: r.endpoint, ok: true }),
        (e) => ({ endpoint: r.endpoint, ok: false, gone: e.statusCode === 404 || e.statusCode === 410, error: e.body || e.message }),
      ),
    ),
  )
  // phone unsubscribed / app removed: forget it
  const gone = results.filter((r) => r.gone).map((r) => r.endpoint)
  if (gone.length) await sb.from('push_subscriptions').delete().in('endpoint', gone)

  res.json({ day: today, sent: results.filter((r) => r.ok).length, gone: gone.length, failed: results.filter((r) => !r.ok && !r.gone).map((r) => r.error) })
}
