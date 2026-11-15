import { supabase } from './auth'
import { deviceId } from './gilbti'
import { viewAsId } from './viewAs'

// App event log → Supabase table app_events (supabase/migrations/009_app_events.sql), read in <site>/admin → Stats.
// Each row: event name + client timestamp; the server adds the account. Off without Supabase or in admin "view as".
// ponytail: fire-and-forget, an event sent with no network is lost; add a local retry queue if gaps show up in Stats.
export function logEvent(event: string, data?: Record<string, unknown>, session = '-') {
  if (!supabase || viewAsId) return
  supabase
    .from('app_events')
    .insert({ session_id: session, device_id: deviceId(), event, at: new Date().toISOString(), data: data ?? null })
    .then(({ error }) => error && console.warn('app_events save failed (run supabase/migrations/009_app_events.sql?)', error.message))
}
