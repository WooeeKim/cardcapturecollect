import { supabase } from './auth'
import { deviceId } from './gilbti'
import { viewAsId } from './viewAs'

// App event log → Supabase table app_events (009_app_events.sql + 012_app_events_v2.sql), read in <site>/admin → Stats.
// Replaces screen recordings (docs/logging-plan.md): every row carries the app session, its order in that
// session and the screen it happened on. Events wait in a queue on this device and go up in batches, so
// nothing is lost offline or when the app is closed mid-send (the rest goes on the next start).
// Off without Supabase and in admin "view as". Typed text is never logged, only its length (feedback aside).

type Row = {
  session_id: string // card session on the drawing screen ('-' elsewhere)
  device_id: string
  event: string
  at: string
  data: Record<string, unknown> | null
  app_session: string
  seq: number
  screen: string
}

const QUEUE = 'subwayseal.eventQueue'
const MAX_QUEUE = 2000
const BATCH = 200
const FLUSH_MS = 10_000
const HEARTBEAT_MS = 30_000
const IDLE_MS = 60_000
const NEW_SESSION_MS = 30 * 60_000 // back from the background after this long = a new app session

const on = () => !!supabase && !viewAsId

let appSession = crypto.randomUUID()
let seq = 0
let screen = 'start'
let hiddenAt = 0
let lastInput = Date.now()
let sending = false
// before 012_app_events_v2.sql the table has no app_session / seq / screen columns: they ride inside data
let legacy = false

// The queue lives in memory and is copied to localStorage a moment later (or right away when the app hides),
// not on every event: re-reading and re-writing the whole queue (up to 2000 rows) on each stroke was a
// noticeable stall on the drawing screen.
let mem: Row[] | null = null
let persistTimer = 0
const PERSIST_MS = 2000

function readQueue(): Row[] {
  if (mem) return mem
  try {
    mem = JSON.parse(localStorage.getItem(QUEUE) ?? '[]')
  } catch {
    mem = []
  }
  return mem!
}
function persist() {
  clearTimeout(persistTimer)
  persistTimer = 0
  if (!mem) return
  try {
    localStorage.setItem(QUEUE, JSON.stringify(mem))
  } catch {
    /* storage full / private mode: events stay in memory until sent */
  }
}
function writeQueue(q: Row[]) {
  // too many waiting (long offline): heartbeats go first, then the oldest
  if (q.length > MAX_QUEUE) {
    const beats = q.filter((r) => r.event === 'heartbeat')
    const drop = new Set(beats.slice(0, q.length - MAX_QUEUE))
    q = q.filter((r) => !drop.has(r)).slice(-MAX_QUEUE)
  }
  mem = q
  if (!persistTimer) persistTimer = window.setTimeout(persist, PERSIST_MS)
  return q
}

export function track(event: string, data?: Record<string, unknown>, session = '-') {
  if (!on()) return
  const row: Row = { session_id: session, device_id: deviceId(), event, at: new Date().toISOString(), data: data ?? null, app_session: appSession, seq: seq++, screen }
  const q = readQueue()
  q.push(row)
  writeQueue(q)
}
// older name, still used by the card screen
export const logEvent = track

// the screen every following event is tagged with; logs screen_view when it changes
export function setScreen(next: string, data?: Record<string, unknown>) {
  if (next === screen) return
  const from = screen
  screen = next
  track('screen_view', { from, ...data })
}

export async function flush() {
  if (!on() || sending) return
  const q = readQueue()
  if (!q.length) return
  sending = true
  try {
    const batch = q.slice(0, BATCH)
    const rows: Record<string, unknown>[] = legacy ? batch.map(({ app_session, seq, screen, ...r }) => ({ ...r, data: { ...r.data, _as: app_session, _seq: seq, _scr: screen } })) : batch
    let { error } = await supabase!.from('app_events').insert(rows)
    if (error && !legacy && /app_session|seq|screen|column/i.test(error.message)) {
      legacy = true
      console.warn('app_events: run supabase/migrations/012_app_events_v2.sql (sending without the new columns for now)')
      sending = false
      return flush()
    }
    if (error) return console.warn('app_events save failed (run supabase/migrations/009_app_events.sql?)', error.message)
    // drop what was sent (new events may have been added meanwhile)
    const sent = new Set(batch.map((r) => `${r.app_session}:${r.seq}`))
    const rest = writeQueue(readQueue().filter((r) => !sent.has(`${r.app_session}:${r.seq}`)))
    if (rest.length) setTimeout(flush, 0)
  } finally {
    sending = false
  }
}

function standalone() {
  return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

function openSession(kind: 'cold' | 'resume') {
  track('app_open', {
    kind,
    from: new URLSearchParams(location.search).get('from') ?? (document.referrer ? 'link' : null),
    version: __BUILD__,
    lang: document.documentElement.lang,
    w: innerWidth,
    h: innerHeight,
    pwa: standalone(),
    ua: navigator.userAgent,
    notify: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  })
}

// once, from the app (not the admin page): app session, heartbeats while visible, flush on hide
let started = false
export function startTracking() {
  if (started || !on()) return
  started = true
  openSession('cold')
  flush()

  for (const t of ['pointerdown', 'keydown', 'wheel'] as const) addEventListener(t, () => (lastInput = Date.now()), { capture: true, passive: true })

  setInterval(() => {
    if (document.visibilityState === 'visible') track('heartbeat', Date.now() - lastInput > IDLE_MS ? { idle: true } : undefined)
  }, HEARTBEAT_MS)
  setInterval(flush, FLUSH_MS)

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now()
      track('app_hide')
      persist()
      flush()
    } else {
      if (!hiddenAt) return // a 'visible' with no 'hidden' before it (some browsers at start): nothing to report
      const away = Date.now() - hiddenAt
      hiddenAt = 0
      if (away > NEW_SESSION_MS) {
        appSession = crypto.randomUUID()
        seq = 0
        openSession('resume')
        track('screen_view', { from: null, resumed: true })
      } else track('app_show', { away_ms: away })
    }
  })
  addEventListener('pagehide', () => {
    track('app_close')
    persist()
    flush()
  })
  addEventListener('error', (e) => track('js_error', { message: String(e.message).slice(0, 300), source: `${e.filename}:${e.lineno}` }))
  addEventListener('unhandledrejection', (e) => track('promise_error', { message: String(e.reason?.message ?? e.reason).slice(0, 300) }))
}
