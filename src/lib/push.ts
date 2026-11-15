import { supabase } from './auth'
import { deviceId } from './gilbti'

// Keeps this phone's Web Push subscription in Supabase (push_subscriptions, supabase/migrations/010_push.sql)
// matching the My Page toggle + the phone's permission, under whoever is logged in now (guest = no account).
// Call after login/logout, after the permission answer, and when the toggle flips. Never throws.
const KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
const NOTIFY = 'subwayseal.notify' // My Page toggle

const wanted = () => {
  try {
    return localStorage.getItem(NOTIFY) !== 'off' && Notification.permission === 'granted'
  } catch {
    return false
  }
}

// base64url → bytes (applicationServerKey)
const bytes = (b64: string) => Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

export async function syncPush() {
  if (!KEY) console.warn('Push off: VITE_VAPID_PUBLIC_KEY is not set at build time (Vercel env), so no phone can subscribe')
  if (!supabase || !KEY || typeof Notification === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    const existing = await reg.pushManager.getSubscription()
    if (!wanted()) {
      if (existing) {
        await supabase.rpc('drop_push', { endpoint: existing.endpoint })
        await existing.unsubscribe()
      }
      return
    }
    const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(KEY) }))
    const { error } = await supabase.rpc('save_push', { sub: sub.toJSON(), device: deviceId() })
    if (error) console.warn('save_push failed (run supabase/migrations/010_push.sql?)', error.message)
  } catch {
    /* no push service (e.g. iPhone outside the Home Screen app) — nothing to do */
  }
}
