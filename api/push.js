// POST /api/push (Vercel function) — sends a notification from <site>/admin → Notify.
// Body: { title, body, endpoints: string[] | null }  (null = everyone subscribed)
// Header: Authorization: Bearer <admin's Supabase access token>. The token is used as-is against Supabase,
// so app_admins / RLS decide who may send and which subscriptions are readable (no service key here).
// Env (Vercel → Settings → Environment Variables): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
// VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, optional VAPID_SUBJECT (mailto: or https: contact).
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const env = process.env
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY || !env.VITE_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY)
    return res.status(500).json({ error: 'Missing env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY' })

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })
  const { data: isAdmin } = await sb.rpc('is_admin')
  if (!token || !isAdmin) return res.status(403).json({ error: 'Admins only' })

  const { title, body, endpoints } = req.body || {}
  if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'Title is required' })
  if (endpoints != null && !Array.isArray(endpoints)) return res.status(400).json({ error: 'endpoints must be a list or null' })

  const { data: rows, error } = await sb.from('push_subscriptions').select('endpoint, sub')
  if (error) return res.status(500).json({ error: error.message })
  const pick = endpoints ? new Set(endpoints) : null
  const targets = rows.filter((r) => !pick || pick.has(r.endpoint))

  webpush.setVapidDetails(env.VAPID_SUBJECT || `https://${req.headers.host}`, env.VITE_VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)
  const payload = JSON.stringify({ title: title.trim(), body: typeof body === 'string' ? body : '' })
  const results = await Promise.all(
    targets.map((r) =>
      webpush.sendNotification(r.sub, payload, { TTL: 60 * 60 * 24 }).then(
        () => ({ endpoint: r.endpoint, ok: true }),
        (e) => ({ endpoint: r.endpoint, ok: false, gone: e.statusCode === 404 || e.statusCode === 410, error: e.body || e.message }),
      ),
    ),
  )
  // phone unsubscribed / app removed: forget it
  const gone = results.filter((r) => r.gone).map((r) => r.endpoint)
  if (gone.length) await sb.from('push_subscriptions').delete().in('endpoint', gone)

  res.json({ sent: results.filter((r) => r.ok).length, gone: gone.length, failed: results.filter((r) => !r.ok && !r.gone).map((r) => r.error) })
}
